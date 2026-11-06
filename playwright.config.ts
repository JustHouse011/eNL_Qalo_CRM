import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
const installedEdge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
export default defineConfig({
  testDir: './tests/browser',
  // Bulk trace writes should not contend with OneDrive synchronization.
  outputDir: join(tmpdir(), 'qalo-web-portal-stage0a-tests'),
  fullyParallel: true,
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5187', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure', ...(process.platform === 'win32' && existsSync(installedEdge) ? { launchOptions: { executablePath: installedEdge } } : {}) },
  webServer: { command: `node node_modules/vite/bin/vite.js ${process.env.QALO_PREVIEW === '1' ? 'preview ' : ''}--host 127.0.0.1 --port 5187 --strictPort`, url: 'http://127.0.0.1:5187', reuseExistingServer: false },
})
