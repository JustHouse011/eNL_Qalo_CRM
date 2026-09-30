import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const workspace = '10000000-0000-4000-8000-000000000001'
const otherWorkspace = '10000000-0000-4000-8000-000000000002'
const customer = '20000000-0000-4000-8000-000000000001'
const agent = '20000000-0000-4000-8000-000000000002'
const stranger = '20000000-0000-4000-8000-000000000003'
const secondAgent = '20000000-0000-4000-8000-000000000004'
let conversation
async function asUser(id, role = 'authenticated') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec(`set role ${role}`)
}
before(async () => {
  // Supabase-owned auth/storage schemas are emulated. Business SQL and RLS are unchanged.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema storage to authenticated;
    grant select,insert on storage.objects to authenticated;
    grant usage on schema public to anon,authenticated;`)
  const sql = await readFile(new URL('../supabase/migrations/202609290001_support.sql', import.meta.url), 'utf8')
  await db.exec(sql.replace('alter publication supabase_realtime add table public.conversations,public.messages;', ''))
  await db.query('insert into auth.users values ($1),($2),($3),($4)', [customer,agent,stranger,secondAgent])
  await db.query('insert into public.workspaces(id,name,chat_enabled) values($1,\'Qalo\',true),($2,\'Other\',true)', [workspace,otherWorkspace])
  await db.query("insert into public.memberships values($1,$2,'agent','Agent'),($1,$3,'agent','Second agent')", [workspace,agent,secondAgent])
  await asUser(customer)
  conversation = (await db.query('select public.start_chat($1,$2,$3) id', [workspace,'Customer','customer@example.co.za'])).rows[0].id
  await db.exec('reset role')
  await db.exec(await readFile(new URL('../supabase/migrations/202609300001_business_areas.sql', import.meta.url), 'utf8'))
})
after(() => db.close())

test('customer sends, agent replies, private notes are excluded by RLS', async () => {
  await asUser(customer)
  await db.query('select public.send_message($1,$2,$3,false)', [conversation,crypto.randomUUID(),'Customer question'])
  await asUser(agent)
  await db.query('select public.send_message($1,$2,$3,false)', [conversation,crypto.randomUUID(),'Agent response'])
  await db.query('select public.send_message($1,$2,$3,true)', [conversation,crypto.randomUUID(),'Secret note'])
  assert.equal((await db.query('select * from public.messages')).rows.length, 3)
  await asUser(customer)
  const messages = (await db.query('select * from public.messages')).rows
  assert.equal(messages.length, 2)
  assert.equal(messages.some(m => m.body === 'Secret note'), false)
  await assert.rejects(db.query('select public.send_message($1,$2,$3,true)', [conversation,crypto.randomUUID(),'Forged note']), /require an agent/)
})
test('another customer cannot read or write this conversation', async () => {
  await asUser(stranger)
  assert.equal((await db.query('select * from public.conversations')).rows.length, 0)
  assert.equal((await db.query('select * from public.messages')).rows.length, 0)
  await assert.rejects(db.query('select public.send_message($1,$2,$3,false)', [conversation,crypto.randomUUID(),'Intrusion']), /Access denied/)
  await assert.rejects(db.query('select public.claim_conversation($1)', [conversation]), /Access denied/)
  await assert.rejects(db.query("insert into public.memberships values($1,$2,'admin','Intruder')", [workspace,stranger]), /permission denied/)
})
test('unauthenticated users cannot invoke chat or read records', async () => {
  await asUser('', 'anon')
  await assert.rejects(db.query('select * from public.conversations'), /permission denied/)
  await assert.rejects(db.query('select public.start_chat($1,$2,$3)', [workspace,'Customer','a@example.co.za']), /permission denied/)
})
test('claim is exclusive and client writes cannot bypass RPC validation', async () => {
  await asUser(agent)
  await db.query('select public.claim_conversation($1)', [conversation])
  await asUser(secondAgent)
  await assert.rejects(db.query('select public.claim_conversation($1)', [conversation]), /Already claimed/)
  await assert.rejects(db.query('update public.conversations set assignee=$1 where id=$2', [secondAgent,conversation]), /permission denied/)
})
test('message retries are idempotent; mismatched retries fail', async () => {
  await asUser(customer)
  const id = crypto.randomUUID()
  await db.query('select public.send_message($1,$2,$3,false)', [conversation,id,'Retry-safe message'])
  await db.query('select public.send_message($1,$2,$3,false)', [conversation,id,'Retry-safe message'])
  assert.equal((await db.query('select * from public.messages where id=$1',[id])).rows.length, 1)
  await assert.rejects(db.query('select public.send_message($1,$2,$3,false)', [conversation,id,'Different body']), /identifier conflict/)
})
test('tickets preserve context and cannot link across workspaces', async () => {
  await asUser(agent)
  const result = await db.query('insert into public.tickets(workspace_id,conversation_id,subject) values($1,$2,$3) returning *',[workspace,conversation,'Follow-up'])
  assert.equal(result.rows[0].conversation_id, conversation)
  await assert.rejects(db.query('insert into public.tickets(workspace_id,conversation_id,subject) values($1,$2,$3)',[otherWorkspace,conversation,'Invalid']), /row-level security|not-null|Invalid conversation/)
  await asUser(customer)
  assert.equal((await db.query('select * from public.tickets')).rows.length, 0)
})
test('agents cannot publish knowledge or read another workspace attachments', async () => {
  await asUser(agent)
  await assert.rejects(db.query("insert into public.articles(workspace_id,title,body,category,published) values($1,'Title','Body','Orders',true)",[workspace]), /row-level security/)
  await db.query("insert into storage.objects(bucket_id,name) values('support-attachments',$1)", [`${conversation}/test.pdf`])
  await asUser(customer)
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0)
  await asUser(stranger)
  assert.equal((await db.query('select * from storage.objects')).rows.length, 0)
})
test('oversize messages and excessive sends are rejected', async () => {
  await asUser(customer)
  await assert.rejects(db.query('select public.send_message($1,$2,$3,false)',[conversation,crypto.randomUUID(),'x'.repeat(4001)]), /1-4000/)
  let limited = false
  for (let i = 0; i < 31; i++) {
    try { await db.query('select public.send_message($1,$2,$3,false)',[conversation,crypto.randomUUID(),`Message ${i}`]) }
    catch (error) { assert.match(error.message,/Please wait/); limited = true; break }
  }
  assert.equal(limited,true)
})

test('additive migration preserves legacy records and classifies new community/store chats', async () => {
  await asUser(agent)
  const old = (await db.query('select * from public.conversations where id=$1', [conversation])).rows[0]
  assert.equal(old.customer_name, 'Customer')
  assert.equal(old.business_area, 'general')
  await asUser(stranger)
  const community = (await db.query('select public.start_support_chat($1,$2,$3,$4,$5,$6) id', [workspace,'Community participant','community@example.org','community','OWN SPAZA SHOPS enquiries','Co-operative representative'])).rows[0].id
  const store = (await db.query('select public.start_support_chat($1,$2,$3,$4,$5,$6) id', [workspace,'Store customer','store@example.org','store','Delivery tracking','Store customer'])).rows[0].id
  await asUser(agent)
  assert.equal((await db.query('select department from public.conversations where id=$1', [community])).rows[0].department, 'Initiative Enquiries')
  assert.equal((await db.query('select department from public.conversations where id=$1', [store])).rows[0].department, 'Deliveries')
  await db.query('select public.send_message($1,$2,$3,true)', [community,crypto.randomUUID(),'Preserved private note'])
  await db.query('select public.reclassify_support_chat($1,$2,$3,$4)', [community,'store','Returns, refunds and exchanges','Returns, Refunds & Exchanges'])
  assert.equal((await db.query('select body from public.messages where conversation_id=$1', [community])).rows[0].body, 'Preserved private note')
  const ticket = (await db.query('insert into public.tickets(workspace_id,conversation_id,subject) values($1,$2,$3) returning *', [workspace,community,'Retained context'])).rows[0]
  assert.equal(ticket.business_area, 'store')
  assert.equal(ticket.category, 'Returns, refunds and exchanges')
})

test('resolution cannot change verified business status; sensitive references require elevated role', async () => {
  await db.exec('reset role')
  await db.query("insert into public.verified_business_references(workspace_id,conversation_id,source_system,masked_reference,verified_status,verified_at) values($1,$2,'test-authorised-source','****1234','Awaiting verification',now())", [workspace,conversation])
  await asUser(agent)
  assert.equal((await db.query('select * from public.verified_business_references')).rows.length, 0)
  await assert.rejects(db.query("update public.verified_business_references set verified_status='Approved'"), /permission denied/)
  await db.query('select public.resolve_conversation($1,true)', [conversation])
  await db.exec('reset role')
  assert.equal((await db.query('select verified_status from public.verified_business_references where conversation_id=$1', [conversation])).rows[0].verified_status, 'Awaiting verification')
  await asUser(stranger)
  await assert.rejects(db.query('select public.reclassify_support_chat($1,$2,$3,$4)', [conversation,'store','Payment enquiries','Orders & Payments']), /Access denied/)
  await asUser(secondAgent)
  await assert.rejects(db.query('select public.transfer_support_chat($1,$2)', [conversation,secondAgent]), /Assignment permission/)
})
