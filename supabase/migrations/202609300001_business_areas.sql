-- Additive migration. Existing rows remain unclassified ('general'); do not infer financial context.
begin;
alter table public.conversations add column business_area text not null default 'general' check(business_area in ('community','store','general'));
alter table public.conversations add column category text not null default 'Unclassified' check(length(category) <= 160);
alter table public.conversations add column participant_type text not null default 'Not recorded';
alter table public.conversations add column support_reference text;
alter table public.conversations add column initiative text;
alter table public.tickets add column business_area text not null default 'general' check(business_area in ('community','store','general'));
alter table public.tickets add column category text not null default 'Unclassified';
alter table public.tickets add column support_reference text;
alter table public.articles add column business_area text not null default 'general' check(business_area in ('community','store','general'));
alter table public.articles add column source_url text;
alter table public.articles add column content_review text not null default 'Awaiting content review';
alter table public.contacts add column participant_type text;
alter table public.contacts add column contact_preference text;
alter table public.contacts add column consent_record text;
create table public.organisations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  name text not null check(length(name) between 1 and 200), organisation_type text not null,
  unique(id,workspace_id)
);
alter table public.contacts add column organisation_id uuid;
alter table public.contacts add foreign key(organisation_id,workspace_id) references public.organisations(id,workspace_id);
alter table public.conversations add column organisation_id uuid;
alter table public.conversations add foreign key(organisation_id,workspace_id) references public.organisations(id,workspace_id);
create table public.support_configuration (
  workspace_id uuid primary key references public.workspaces,
  queues jsonb not null default '[]', workflows jsonb not null default '[]', ai_draft jsonb not null default '{}'
);
create table public.support_pipeline_cases (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  business_area text not null check(business_area in ('community','store','general')),
  title text not null, workflow text not null, support_stage text not null,
  support_reference text, conversation_id uuid,
  foreign key(conversation_id,workspace_id) references public.conversations(id,workspace_id)
);
-- Separate, service-written integration references. No client can change a payment or approval.
create table public.verified_business_references (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces,
  conversation_id uuid not null, source_system text not null, masked_reference text not null,
  verified_status text not null, verified_at timestamptz not null,
  foreign key(conversation_id,workspace_id) references public.conversations(id,workspace_id)
);
alter table public.organisations enable row level security;
alter table public.support_configuration enable row level security;
alter table public.support_pipeline_cases enable row level security;
alter table public.verified_business_references enable row level security;
create policy organisations_members on public.organisations for all to authenticated using(public.member_role(workspace_id) is not null) with check(public.member_role(workspace_id) is not null);
create policy configuration_read on public.support_configuration for select to authenticated using(public.member_role(workspace_id) is not null);
create policy configuration_manage on public.support_configuration for all to authenticated using(public.member_role(workspace_id) in ('admin','supervisor')) with check(public.member_role(workspace_id) in ('admin','supervisor'));
create policy pipeline_members on public.support_pipeline_cases for all to authenticated using(public.member_role(workspace_id) is not null) with check(public.member_role(workspace_id) is not null);
create policy restricted_reference_read on public.verified_business_references for select to authenticated using(public.member_role(workspace_id) in ('admin','supervisor'));
revoke all on public.organisations,public.support_configuration,public.support_pipeline_cases,public.verified_business_references from anon,authenticated;
grant select,insert,update,delete on public.organisations,public.support_configuration,public.support_pipeline_cases to authenticated;
grant select on public.verified_business_references to authenticated;
create trigger organisation_audit after insert or update or delete on public.organisations for each row execute function public.audit_business_change();
create trigger pipeline_case_audit after insert or update or delete on public.support_pipeline_cases for each row execute function public.audit_business_change();

create function public.start_support_chat(w uuid, customer_name text, customer_email text, area text, topic text, participant text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; queue_name text;
begin
  if area is null or area not in ('community','store','general') or topic is null or length(trim(topic)) not between 1 and 160 or participant is null or length(participant)>120 then raise exception 'Invalid support classification'; end if;
  result := public.start_chat(w,customer_name,customer_email);
  queue_name := case when area='store' then 'Orders & Payments' when area='community' then 'Member Support' else 'Technical Support' end;
  if area='community' and topic like 'OWN %' then queue_name := 'Initiative Enquiries'; end if;
  if area='community' and topic like 'SME%' then queue_name := 'SME Support'; end if;
  if area='community' and (topic like 'Contribution%' or topic like 'Statements%') then queue_name := 'Contribution & Reporting Enquiries'; end if;
  if area='community' and topic like 'Co-operative%' then queue_name := 'Co-operative & Stokvel Support'; end if;
  if area='community' and topic like 'Complaints%' then queue_name := 'Complaints'; end if;
  if area='store' and topic like 'Delivery%' then queue_name := 'Deliveries'; end if;
  if area='store' and (topic like 'Returns%' or topic like 'Damaged%') then queue_name := 'Returns, Refunds & Exchanges'; end if;
  if area='store' and topic like 'Product%' then queue_name := 'Product Enquiries'; end if;
  update public.conversations set business_area=area,category=trim(topic),participant_type=participant,department=queue_name where id=result;
  return result;
end $$;
create function public.reclassify_support_chat(c uuid, area text, topic text, queue_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  select workspace_id into w from public.conversations where id=c for update;
  if public.member_role(w) is null then raise exception 'Access denied'; end if;
  if area is null or area not in ('community','store','general') or topic is null or length(trim(topic)) not between 1 and 160 or queue_name is null or length(trim(queue_name)) not between 1 and 160 then raise exception 'Invalid support classification'; end if;
  update public.conversations set business_area=area,category=topic,department=queue_name,updated_at=now() where id=c;
  insert into public.audit_records(workspace_id,actor_id,action,record_id) values(w,auth.uid(),'conversation.reclassified',c);
end $$;
create function public.transfer_support_chat(c uuid, target_agent uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare conversation public.conversations;
begin
  select * into conversation from public.conversations where id=c for update;
  if public.member_role(conversation.workspace_id) is null or (public.member_role(conversation.workspace_id)='agent' and conversation.assignee is distinct from auth.uid()) then raise exception 'Assignment permission required'; end if;
  if target_agent is not null and not exists(select 1 from public.memberships where workspace_id=conversation.workspace_id and user_id=target_agent) then raise exception 'Target agent must belong to workspace'; end if;
  update public.conversations set assignee=target_agent,updated_at=now() where id=c;
  insert into public.audit_records(workspace_id,actor_id,action,record_id) values(conversation.workspace_id,auth.uid(),'conversation.transferred',c);
end $$;
create function public.inherit_ticket_context() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.conversation_id is not null then
    select business_area,category,support_reference into new.business_area,new.category,new.support_reference from public.conversations where id=new.conversation_id and workspace_id=new.workspace_id;
  end if;
  return new;
end $$;
create trigger ticket_support_context before insert on public.tickets for each row execute function public.inherit_ticket_context();
revoke all on function public.start_support_chat(uuid,text,text,text,text,text), public.reclassify_support_chat(uuid,text,text,text), public.transfer_support_chat(uuid,uuid) from public,anon;
grant execute on function public.start_support_chat(uuid,text,text,text,text,text), public.reclassify_support_chat(uuid,text,text,text), public.transfer_support_chat(uuid,uuid) to authenticated;
commit;
