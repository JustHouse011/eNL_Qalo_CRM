import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { supportSeed } from '../src/data/supportSeed.ts'

export function demoApi(): Plugin {
  const directory = resolve('.local-data'); mkdirSync(directory, { recursive: true })
  const db = new DatabaseSync(resolve(directory, 'support-demo.sqlite'))
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS demo_sessions (id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)')
  const limits = new Map<string, { start: number; count: number }>()
  async function handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.url?.split('?')[0] !== '/api/demo') return next()
    const reply = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
    const address = req.socket.remoteAddress || ''
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return reply(403, { error: 'Demo API is available on localhost only' })
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return reply(403, { error: 'Cross-origin demo requests are not allowed' })
    const id = req.headers['x-demo-session']
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return reply(400, { error: 'Invalid demo session' })
    db.prepare('INSERT OR IGNORE INTO demo_sessions(id,version,data) VALUES(?,0,?)').run(id, JSON.stringify(supportSeed))
    if (req.method === 'GET') {
      const row = db.prepare('SELECT version,data FROM demo_sessions WHERE id=?').get(id) as { version: number; data: string }
      return reply(200, { version: row.version, data: JSON.parse(row.data) })
    }
    if (req.method !== 'PUT') return reply(405, { error: 'Method not supported' })
    const limit = limits.get(id)
    if (!limit || Date.now() - limit.start > 60000) limits.set(id, { start: Date.now(), count: 1 })
    else if (++limit.count > 120) return reply(429, { error: 'Too many updates. Please wait a minute.' })
    if (limits.size > 10000) for (const [key, value] of limits) if (Date.now() - value.start > 60000) limits.delete(key)
    try {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of req) { size += chunk.length; if (size > 3 * 1024 * 1024) { reply(413, { error: 'Demo record limit is 3 MB' }); return }; chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!Number.isInteger(body.version) || !body.data || !['conversations', 'tickets', 'contacts', 'articles', 'visitors'].every(k => Array.isArray(body.data[k]))) return reply(400, { error: 'Invalid demo record format' })
      if (body.data.conversations.some((c: { id?: string; messages?: { text?: string }[] }) => typeof c.id !== 'string' || !Array.isArray(c.messages) || c.messages.some(m => typeof m.text !== 'string' || m.text.length > 4000))) return reply(400, { error: 'Invalid conversation or message' })
      const result = db.prepare('UPDATE demo_sessions SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(body.data), id, body.version)
      if (!result.changes) return reply(409, { error: 'Records changed; retry using the latest version' })
      return reply(200, { version: body.version + 1, data: body.data })
    } catch { return reply(400, { error: 'Could not save demo records' }) }
  }
  return { name: 'qalo-local-demo-api', configureServer(server) { server.middlewares.use((req, res, next) => { void handler(req, res, next) }) }, configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void handler(req, res, next) }) } }
}
