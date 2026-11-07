import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const child = spawn(process.execPath, [
  'node_modules/@playwright/test/cli.js', 'test',
  'tests/browser/stage0a.spec.ts', 'tests/browser/workspace.spec.ts',
  '--grep', 'Stage 0A|edits the selected article|contact editing|customer chat, agent reply',
  '--reporter=line', '--trace=off', '--output', join(tmpdir(), 'qalo-web-portal-stage0a-build-checks'),
], { stdio: 'inherit', env: { ...process.env, QALO_PREVIEW: '1' } })
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
