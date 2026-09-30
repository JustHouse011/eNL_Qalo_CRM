// Server-only integration contracts. Never import this module from src/.
import { createHmac, timingSafeEqual } from 'node:crypto'

const requirements = {
  email: ['RESEND_API_KEY', 'EMAIL_FROM'],
  whatsapp: ['META_ACCESS_TOKEN', 'WHATSAPP_PHONE_ID', 'META_GRAPH_VERSION'],
  messenger: ['META_ACCESS_TOKEN', 'META_PAGE_ID', 'META_GRAPH_VERSION'],
  telegram: ['TELEGRAM_BOT_TOKEN'],
  sms: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
}
export function channelStatus(channel, env = process.env) {
  const required = requirements[channel]
  if (!required) throw new Error('Unsupported channel')
  const missing = required.filter(key => !env[key])
  return { channel, configured: !missing.length, connected: false, missing }
}
// A successful HTTP response is provider acceptance, never proof of customer delivery.
export async function sendChannel({ channel, to, text, subject, idempotencyKey }, { env = process.env, fetcher = fetch } = {}) {
  if (!channelStatus(channel, env).configured) throw new Error(`${channel} is not configured`)
  if (typeof to !== 'string' || !to.trim() || typeof text !== 'string' || !text.trim() || text.length > 4000) throw new Error('Invalid outbound message')
  const headers = { 'Content-Type': 'application/json' }
  let url, body
  switch (channel) {
    case 'email':
      if (!subject?.trim() || !idempotencyKey) throw new Error('Email requires subject and idempotency key')
      url = 'https://api.resend.com/emails'; headers.Authorization = `Bearer ${env.RESEND_API_KEY}`; headers['Idempotency-Key'] = idempotencyKey
      body = JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }); break
    case 'whatsapp':
      url = `https://graph.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/${encodeURIComponent(env.WHATSAPP_PHONE_ID)}/messages`
      headers.Authorization = `Bearer ${env.META_ACCESS_TOKEN}`
      body = JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }); break
    case 'messenger':
      url = `https://graph.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/${encodeURIComponent(env.META_PAGE_ID)}/messages`
      headers.Authorization = `Bearer ${env.META_ACCESS_TOKEN}`
      body = JSON.stringify({ recipient: { id: to }, message: { text }, messaging_type: 'RESPONSE' }); break
    case 'telegram':
      url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`
      body = JSON.stringify({ chat_id: to, text }); break
    case 'sms':
      url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`
      headers.Authorization = `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: text }).toString(); break
  }
  const response = await fetcher(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`${channel} provider rejected request (${response.status})`)
  const result = await response.json()
  const id = channel === 'whatsapp' ? result.messages?.[0]?.id : channel === 'messenger' ? result.message_id : channel === 'telegram' ? (result.ok ? result.result?.message_id : null) : channel === 'sms' ? result.sid : result.id
  if (!id) throw new Error(`${channel} provider did not confirm acceptance`)
  return { providerId: String(id), status: 'accepted', channel }
}
export function verifyMetaWebhook(rawBody, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const supplied = Buffer.from(signature.slice(7), 'hex')
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}
export function verifyTelegramWebhook(supplied, expected) {
  if (!supplied || !expected) return false
  const a = Buffer.from(supplied), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
