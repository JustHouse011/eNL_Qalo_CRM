import { selectWorkspace } from '../helpers/workspaceSelector'
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { presentProductCopy } from '../../src/lib/productCopy'
import { createSupportService } from '../../src/lib/supportService'
import { platformPreview } from '../../src/lib/workspaceManagement'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
if (process.platform === 'win32' && existsSync(edge)) test.use({ launchOptions: { executablePath: edge } })

test('saved fixture copy is presented without removing records or changing IDs', async () => {
  const values = new Map<string, string>()
  const service = createSupportService(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }))
  service.initializeEnl(platformPreview.id)
  const before = await service.readWorkspace(ENL_WORKSPACE_ID)
  await service.updateWorkspace(ENL_WORKSPACE_ID, data => ({ ...data, contacts: data.contacts.map((c, i) => i ? c : { ...c, name: 'Demo Thandi Molefe' }) }))
  const after = await service.readWorkspace(ENL_WORKSPACE_ID)
  expect(after.contacts[0].name).toBe('Thandi Molefe')
  expect(after.contacts.map(c => c.id)).toEqual(before.contacts.map(c => c.id))
  expect(after.conversations.map(c => c.id)).toEqual(before.conversations.map(c => c.id))
  expect(after.tickets.map(t => t.id)).toEqual(before.tickets.map(t => t.id))
  expect(after.conversations.map(c => c.messages.length)).toEqual(before.conversations.map(c => c.messages.length))
  expect(presentProductCopy('Customer asked about a demo of their own product')).toBe('Customer asked about a demo of their own product')
})

test('Qalo and eNL routes have no demo disclosures', async ({ page }) => {
  test.setTimeout(180000)
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(60000)
  page.on('dialog', dialog => dialog.accept())
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  const routes = ['/overview','/inbox','/visitors','/tickets','/contacts','/pipeline','/knowledge','/saved-replies','/integrations','/automations','/ai-assist','/team','/reports','/activities','/feedback','/widget','/settings','/workspaces']
  await page.goto('/dev/session', { waitUntil: 'domcontentloaded' })
  await page.getByRole('combobox', { name: 'Account', exact: true }).selectOption('user-agent-1')
  await page.getByRole('button', { name: 'Start session', exact: true }).click()
  for (const bank of [false,true]) {
    if (bank) { await page.goto('/workspaces', { waitUntil: 'domcontentloaded' }); await selectWorkspace(page, ENL_WORKSPACE_ID); await expect(page.getByLabel('Switch workspace')).toHaveAttribute('data-workspace-id', ENL_WORKSPACE_ID) }
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('h1').first()).toBeVisible()
      const text = (await page.locator('body').innerText()).replace(/\bDemo Data\b/g, '')
      expect(text, `${bank ? 'eNL' : 'Qalo'} ${route}`).not.toMatch(/\b(demo|fictional|simulated|simulation|mock|synthetic|prototype)\b/i)
    }
  }
  for (const route of ['/signin','/chat','/help','/customer-preview','/enl-preview','/dev/session']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1').first()).toBeVisible()
    expect((await page.locator('body').innerText()).replace(/\bDemo Data\b/g, ''), route).not.toMatch(/\b(demo|fictional|simulated|simulation|mock|synthetic|prototype)\b/i)
  }
  expect(errors).toEqual([])
})
