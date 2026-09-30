import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5187', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: process.env.QALO_PREVIEW === '1' ? 'npm.cmd run preview -- --host 127.0.0.1 --port 5187 --strictPort' : 'npm.cmd run dev -- --host 127.0.0.1 --port 5187 --strictPort', url: 'http://127.0.0.1:5187', reuseExistingServer: false },
})
