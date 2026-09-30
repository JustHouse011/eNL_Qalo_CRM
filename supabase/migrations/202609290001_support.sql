-- Apply to a new Supabase project. No demo/customer sample records are inserted.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(), name text not null,
  chat_enabled boolean not null default false, created_at timestamptz not null default now()
);
create table public.memberships (
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('admin','supervisor','agent')),
  display_name text not null, primary key (workspace_id,user_id)
);
create function public.member_role(w uuid) returns text language sql stable security definer set search_path = '' as $$
  select role from public.memberships where workspace_id = w and user_id = auth.uid()
$$;
create table public.conversations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  customer_id uuid not null references auth.users, customer_name text not null check(length(customer_name) between 1 and 80),
  customer_email text not null check(length(customer_email) between 3 and 254),
  status text not null default 'waiting' check(status in ('open','waiting','resolved')),
  assignee uuid, priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  department text not null default 'Customer care', tags text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz,
  unique(id,workspace_id), foreign key(workspace_id,assignee) references public.memberships(workspace_id,user_id)
);
create table public.messages (
  id uuid primary key, conversation_id uuid not null references public.conversations on delete cascade,
  author_id uuid not null references auth.users, kind text not null check(kind in ('customer','agent','note')),
  body text not null check(length(trim(body)) between 1 and 4000), created_at timestamptz not null default now()
);
create index messages_conversation_time on public.messages(conversation_id,created_at);
create index conversations_workspace on public.conversations(workspace_id,updated_at desc);
create table public.contacts (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  name text not null, email text not null, organisation text, tags text[] default '{}',
  custom_fields jsonb not null default '{}', notes text, unique(workspace_id,email)
);
create table public.tickets (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  conversation_id uuid, subject text not null check(length(trim(subject)) between 1 and 200), description text not null default '',
  status text not null default 'Open' check(status in ('Open','Pending','Resolved')),
  priority text not null default 'normal', assignee uuid, due_at timestamptz, created_at timestamptz not null default now(),
  foreign key(conversation_id,workspace_id) references public.conversations(id,workspace_id),
  foreign key(workspace_id,assignee) references public.memberships(workspace_id,user_id)
);
create table public.articles (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  title text not null, body text not null, category text not null, published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.audit_records (
  id bigint generated always as identity primary key, workspace_id uuid not null references public.workspaces,
  actor_id uuid references auth.users, action text not null, record_id uuid, created_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.contacts enable row level security;
alter table public.tickets enable row level security;
alter table public.articles enable row level security;
alter table public.audit_records enable row level security;
create policy workspace_members on public.workspaces for select to authenticated using (public.member_role(id) is not null);
create policy membership_read on public.memberships for select to authenticated using (public.member_role(workspace_id) is not null);
create policy conversation_read on public.conversations for select to authenticated using (customer_id = auth.uid() or public.member_role(workspace_id) is not null);
create policy message_read on public.messages for select to authenticated using (
  exists(select 1 from public.conversations c where c.id = conversation_id and
    (public.member_role(c.workspace_id) is not null or (c.customer_id = auth.uid() and kind <> 'note')))
);
create policy contacts_member on public.contacts for all to authenticated using (public.member_role(workspace_id) is not null) with check(public.member_role(workspace_id) is not null);
create policy tickets_member on public.tickets for all to authenticated using (public.member_role(workspace_id) is not null) with check(public.member_role(workspace_id) is not null);
create policy article_read on public.articles for select to authenticated using (published or public.member_role(workspace_id) is not null);
create policy article_manage on public.articles for all to authenticated using (public.member_role(workspace_id) in ('admin','supervisor')) with check(public.member_role(workspace_id) in ('admin','supervisor'));
create policy audit_read on public.audit_records for select to authenticated using (public.member_role(workspace_id) in ('admin','supervisor'));

-- Customer creation and writes are RPC-only; clients cannot forge author/kind/workspace.
create function public.start_chat(w uuid, customer_name text, customer_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.workspaces where id=w and chat_enabled) then raise exception 'Chat unavailable'; end if;
  if length(trim(customer_name)) not between 1 and 80 or customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid customer details'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if (select count(*) from public.conversations where customer_id=auth.uid() and created_at > now()-interval '1 hour') >= 5 then raise exception 'Chat limit reached'; end if;
  insert into public.conversations(workspace_id,customer_id,customer_name,customer_email) values(w,auth.uid(),trim(customer_name),customer_email) returning id into result;
  return result;
end $$;
create function public.send_message(c uuid, message_id uuid, content text, private_note boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare conversation public.conversations; member text; message_kind text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into conversation from public.conversations where id=c for update;
  member := public.member_role(conversation.workspace_id);
  if conversation.id is null or (member is null and conversation.customer_id <> auth.uid()) then raise exception 'Access denied'; end if;
  if private_note and member is null then raise exception 'Private notes require an agent'; end if;
  if length(trim(content)) not between 1 and 4000 then raise exception 'Message must contain 1-4000 characters'; end if;
  message_kind := case when private_note then 'note' when member is not null then 'agent' else 'customer' end;
  if exists(select 1 from public.messages where id=message_id) then
    if exists(select 1 from public.messages where id=message_id and conversation_id=c and author_id=auth.uid() and body=trim(content) and kind=message_kind) then return message_id; end if;
    raise exception 'Message identifier conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if (select count(*) from public.messages where author_id=auth.uid() and created_at>now()-interval '1 minute') >= 30 then raise exception 'Please wait before sending more messages'; end if;
  insert into public.messages(id,conversation_id,author_id,kind,body) values(message_id,c,auth.uid(),message_kind,trim(content));
  update public.conversations set updated_at=now(), status=case when message_kind='customer' then 'waiting' when message_kind='agent' then 'open' else status end,
    resolved_at=case when message_kind='note' then resolved_at else null end where id=c;
  return message_id;
end $$;
create function public.claim_conversation(c uuid) returns void language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  select workspace_id into w from public.conversations where id=c;
  if public.member_role(w) is null then raise exception 'Access denied'; end if;
  update public.conversations set assignee=auth.uid(), updated_at=now() where id=c and (assignee is null or assignee=auth.uid());
  if not found then raise exception 'Already claimed by another agent'; end if;
  insert into public.audit_records(workspace_id,actor_id,action,record_id) values(w,auth.uid(),'conversation.claimed',c);
end $$;
create function public.resolve_conversation(c uuid, resolved boolean) returns void language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  select workspace_id into w from public.conversations where id=c;
  if public.member_role(w) is null then raise exception 'Access denied'; end if;
  update public.conversations set status=case when resolved then 'resolved' else 'open' end, resolved_at=case when resolved then now() else null end, updated_at=now() where id=c;
  insert into public.audit_records(workspace_id,actor_id,action,record_id) values(w,auth.uid(),case when resolved then 'conversation.resolved' else 'conversation.reopened' end,c);
end $$;
create function public.audit_business_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_records(workspace_id,actor_id,action,record_id) values(coalesce(new.workspace_id,old.workspace_id),auth.uid(),tg_table_name || '.' || lower(tg_op),coalesce(new.id,old.id));
  return coalesce(new,old);
end $$;
create trigger ticket_audit after insert or update or delete on public.tickets for each row execute function public.audit_business_change();
create trigger article_audit after insert or update or delete on public.articles for each row execute function public.audit_business_change();
create trigger contact_audit after insert or update or delete on public.contacts for each row execute function public.audit_business_change();

revoke all on function public.start_chat(uuid,text,text), public.send_message(uuid,uuid,text,boolean), public.claim_conversation(uuid), public.resolve_conversation(uuid,boolean), public.member_role(uuid) from public,anon;
grant execute on function public.start_chat(uuid,text,text), public.send_message(uuid,uuid,text,boolean), public.claim_conversation(uuid), public.resolve_conversation(uuid,boolean), public.member_role(uuid) to authenticated;
revoke all on public.workspaces,public.memberships,public.conversations,public.messages,public.contacts,public.tickets,public.articles,public.audit_records from anon,authenticated;
grant select on public.workspaces,public.memberships,public.conversations,public.messages,public.contacts,public.tickets,public.articles,public.audit_records to authenticated;
grant insert,update,delete on public.contacts,public.tickets,public.articles to authenticated;
alter publication supabase_realtime add table public.conversations,public.messages;

-- Storage is private. Customer uploads/downloads are deliberately disabled until attachment moderation and message-link validation are implemented.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('support-attachments','support-attachments',false,5242880,array['image/jpeg','image/png','application/pdf']);
create policy agent_attachment_read on storage.objects for select to authenticated using (
  bucket_id='support-attachments' and exists(select 1 from public.conversations c where c.id::text=(storage.foldername(name))[1] and public.member_role(c.workspace_id) is not null)
);
create policy agent_attachment_insert on storage.objects for insert to authenticated with check (
  bucket_id='support-attachments' and exists(select 1 from public.conversations c where c.id::text=(storage.foldername(name))[1] and public.member_role(c.workspace_id) is not null)
);
