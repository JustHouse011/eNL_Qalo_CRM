import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { channelStatus, sendChannel, verifyMetaWebhook, verifyTelegramWebhook } from '../server/channels.mjs'
test('unconfigured channels never claim connected or attempt delivery', async () => {
  assert.equal(channelStatus('email', {}).connected, false)
  await assert.rejects(sendChannel({ channel: 'email', to: 'x@example.co.za', text: 'Hello' }, { env: {}, fetcher: () => { throw Error('Must not call network') } }), /not configured/)
})
test('provider acceptance requires a confirmed identifier', async () => {
  const args = { channel: 'email', to: 'x@example.co.za', text: 'Hello', subject: 'Support', idempotencyKey: 'test-request' }
  const env = { RESEND_API_KEY: 'test-only', EMAIL_FROM: 'support@example.co.za' }
  const result = await sendChannel(args, { env, fetcher: async () => new Response(JSON.stringify({ id: 'message-1' })) })
  assert.equal(result.status, 'accepted')
  await assert.rejects(sendChannel(args, { env, fetcher: async () => new Response('{}') }), /did not confirm/)
  await assert.rejects(sendChannel(args, { env, fetcher: async () => new Response('{}', { status: 401 }) }), /rejected request/)
})
test('webhook verification rejects modified payloads and missing secrets', () => {
  const body = Buffer.from('{"object":"page"}')
  const signature = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`
  assert.equal(verifyMetaWebhook(body, signature, 'test-secret'), true)
  assert.equal(verifyMetaWebhook(Buffer.from('{}'), signature, 'test-secret'), false)
  assert.equal(verifyMetaWebhook(body, signature, ''), false)
  assert.equal(verifyTelegramWebhook('secret', 'secret'), true)
  assert.equal(verifyTelegramWebhook('wrong', 'secret'), false)
})
