import { selectWorkspace } from '../helpers/workspaceSelector'
import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ENL_WORKSPACE_ID } from '../../src/lib/enlWorkspace'
const artifacts = resolve('.local-data/d3-1a/review/r1')
async function switchWorkspace(page: Page, id: string, width: number) {
  if (width <= 820) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await selectWorkspace(page, id)
  if (await page.getByRole('dialog', { name: 'Workspace navigation' }).count()) await page.keyboard.press('Escape')
}
async function selectFirst(page: Page) {
  const humanConversation = page.locator('.conversation-row').filter({ hasText: 'Human Handling' }).first()
  await (await humanConversation.count() ? humanConversation : page.locator('.conversation-row').first()).click()
  await expect(page.getByLabel('Write a customer reply')).toBeVisible()
}
async function assertFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const composer = await page.getByRole('region', { name: 'Reply composer' }).boundingBox()
  expect(composer).not.toBeNull()
  expect(composer!.y).toBeGreaterThan(0)
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight))
  await expect(page.getByRole('button', { name: 'Create Ticket', exact: true })).toBeVisible()
}
for (const width of [390, 768, 900, 1440, 1920]) {
  test(`D3.1A shared Inbox, both workspaces/themes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/inbox')
    await mkdir(artifacts, { recursive: true })
    page.on('dialog', dialog => dialog.accept())
    for (const [workspace, id] of [['qalo', 'workspace-qalo'], ['enl', ENL_WORKSPACE_ID]]) {
      await switchWorkspace(page, id, width)
      if (width <= 820 && await page.locator('.chat-panel').isVisible()) await page.getByRole('button', { name: 'Back to conversations', exact: true }).click()
      if (width <= 820) await page.screenshot({ path: resolve(artifacts, `${workspace}-mobile-queue-${width}.png`) })
      await selectFirst(page)
      for (const theme of ['light', 'dark']) {
        if ((await page.locator('.app-shell').getAttribute('class'))!.includes('theme-light') !== (theme === 'light')) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
        await assertFits(page)
        const queue = await page.locator('.conversation-panel').boundingBox()
        const chat = await page.locator('.chat-panel').boundingBox()
        if (width > 820) {
          expect(queue!.width).toBeGreaterThanOrEqual(260)
          expect(chat!.width).toBeGreaterThan(queue!.width)
        }
        if (width >= 1280) {
          await expect(page.getByRole('complementary', { name: 'Customer details', exact: true })).toBeVisible()
          expect(queue!.width).toBeLessThanOrEqual(290)
          const detailsWidth = (await page.locator('.context-panel').boundingBox())!.width
          expect(detailsWidth).toBeGreaterThanOrEqual(260)
          expect(detailsWidth).toBeLessThanOrEqual(290)
        } else {
          await expect(page.locator('#inbox-customer-details')).toBeHidden()
        }
        const typography = await page.locator('.inbox-console').evaluate(root => Array.from(root.querySelectorAll<HTMLElement>('*')).filter(el => el.getClientRects().length).every(el => getComputedStyle(el).fontFamily.startsWith('Inter') && ['300','400'].includes(getComputedStyle(el).fontWeight)))
        expect(typography).toBe(true)
        await page.screenshot({ path: resolve(artifacts, `${workspace}-${theme}-${width}.png`) })
      }
      const draft = page.getByLabel('Write a customer reply')
      await draft.fill('Unsaved reply survives Details toggling')
      const selectedName = await page.locator('.chat-person > strong').textContent()
      const expandedWidth = (await page.locator('.chat-panel').boundingBox())!.width
      await page.getByRole('button', { name: 'Customer details', exact: true }).click()
      if (width >= 1280) {
        await expect(page.locator('#inbox-customer-details')).toBeHidden()
        expect((await page.locator('.chat-panel').boundingBox())!.width).toBeGreaterThan(expandedWidth + 250)
        await expect(draft).toHaveValue('Unsaved reply survives Details toggling')
        await page.screenshot({ path: resolve(artifacts, `${workspace}-details-collapsed-${width}.png`) })
        await page.getByRole('button', { name: 'Customer details', exact: true }).click()
      }
      await expect(page.getByLabel('Assignee', { exact: true })).toBeVisible()
      if (workspace === 'enl') {
        await expect(page.locator('.context-panel')).toContainText('Fictional banking support only')
        await expect(page.locator('.context-panel')).not.toContainText('Linked order')
      }
      await page.screenshot({ path: resolve(artifacts, `${workspace}-details-${width}.png`) })
      if (width < 1280) {
        expect(await page.locator('#inbox-customer-details').evaluate(el => el.matches(':modal'))).toBe(true)
        await page.keyboard.press('Escape')
        await expect(page.locator('#inbox-customer-details')).toBeHidden()
        await expect(page.getByRole('button', { name: 'Customer details', exact: true })).toBeFocused()
      }
      await expect(draft).toHaveValue('Unsaved reply survives Details toggling')
      await expect(page.locator('.chat-person > strong')).toHaveText(selectedName!)
      await draft.fill('')
    }
  })
}

test('queue, messages and details scroll independently; long content is rendered safely and selected row stays visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/inbox')
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!)
    const snapshot = store.snapshots['workspace-qalo']
    const source = snapshot.conversations.find((c: { id: string }) => c.id === 'conv-1')
    source.customer = 'Long customer name '.repeat(8)
    source.messages = Array.from({ length: 60 }, (_, i) => ({ id: `stress-message-${i}`, workspaceId: 'workspace-qalo', conversationId: source.id, author: i % 2 ? 'Fictional Agent' : source.customer, text: i === 59 ? '<img src=x onerror=alert(1)> ' + 'LongUnbrokenContent'.repeat(80) : `Message ${i} with recorded support context.`, kind: i % 2 ? 'agent' : 'customer', time: new Date(Date.UTC(2026,9,20,8,i)).toISOString(), delivery: 'sent' }))
    snapshot.conversations.push(...Array.from({ length: 35 }, (_, i) => ({ ...source, id: `stress-conversation-${i}`, customer: `Queue visitor ${i}`, messages: source.messages.map((m: object) => ({ ...m, conversationId: `stress-conversation-${i}` })) })))
    localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store))
  })
  await page.goto('/inbox?conversation=conv-1')
  await assertFits(page)
  await expect(page.locator('.messages-scroll')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.messages-scroll img')).toHaveCount(0)
  const initial = await page.evaluate(() => ({ body: document.documentElement.scrollTop, messages: document.querySelector('.messages-scroll')!.scrollTop }))
  for (const selector of ['.conversation-list','.messages-scroll','.context-panel']) {
    const result = await page.locator(selector).evaluate(el => { const box = el as HTMLElement; const before = box.scrollTop; box.scrollTop = before > 0 ? 0 : box.scrollHeight; return { scrollable: box.scrollHeight > box.clientHeight, changed: before !== box.scrollTop } })
    expect(result).toEqual({ scrollable: true, changed: true })
  }
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(initial.body)
  await page.goto('/inbox?conversation=stress-conversation-30')
  await expect(page.locator('.conversation-row[aria-current=true]')).toBeInViewport()
  await assertFits(page)
  await page.screenshot({ path: resolve(artifacts, 'long-messages-independent-scrolling.png') })
})

test('mobile drill-down, modal focus, Escape, keyboard-height layout and D1 navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/inbox')
  await selectFirst(page)
  await expect(page.locator('.chat-person > strong')).toBeFocused()
  await page.getByRole('button', { name: 'Customer details', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Customer details', exact: true })
  await expect(drawer).toBeVisible()
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  expect(await drawer.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await assertFits(page)
  await page.getByRole('button', { name: 'Back to conversations', exact: true }).click()
  await expect(page.getByLabel('Search conversations', { exact: true })).toBeVisible()
  await selectFirst(page)
  await page.setViewportSize({ width: 390, height: 600 })
  await assertFits(page)
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Workspace navigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: resolve(artifacts, 'qalo-mobile-composer-short-viewport.png') })
})

test('queue filters, empty states, saved replies, attachments and note shortcuts retain their existing behavior', async ({ page }) => {
  await page.goto('/inbox?conversation=conv-1')
  await page.getByLabel('Search conversations', { exact: true }).fill('no-matching-visitor-123')
  await expect(page.getByText('No conversations here', { exact: true })).toBeVisible()
  await page.getByLabel('Search conversations', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Conversation filters', exact: true }).click()
  await expect(page.getByLabel('Handling state filter')).toBeVisible()
  await page.getByLabel('Handling state filter').selectOption('waiting')
  await expect(page.locator('.conversation-row')).not.toHaveCount(0)
  await page.getByLabel('Handling state filter').selectOption('all')
  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  await page.getByLabel('Write an internal note').fill('Keyboard note preserved by the shared Inbox')
  await page.getByLabel('Write an internal note').press('Enter')
  await expect(page.locator('.note-message')).toContainText('Keyboard note preserved by the shared Inbox')
  await page.getByRole('button', { name: 'Saved replies', exact: true }).click()
  await expect(page.getByLabel('Find saved reply')).toBeVisible()
  await page.getByRole('button', { name: 'Saved replies', exact: true }).click()
  await page.locator('.composer input[type=file]').setInputFiles({ name: 'context.pdf', mimeType: 'application/pdf', buffer: Buffer.from('local attachment reference') })
  await expect(page.locator('.composer textarea')).toHaveValue('[Attachment reference: context.pdf]')
  await page.reload()
  await expect(page.locator('.note-message')).toContainText('Keyboard note preserved by the shared Inbox')
  await page.evaluate(() => { const store = JSON.parse(localStorage.getItem('qalo-workspaces-v2')!); store.snapshots['workspace-qalo'].conversations.find((c: { id: string }) => c.id === 'conv-1').messages = []; localStorage.setItem('qalo-workspaces-v2', JSON.stringify(store)) })
  await page.reload()
  await expect(page.getByText('No messages recorded yet.')).toBeVisible()
  await page.goto('/inbox?conversation=missing-conversation')
  await expect(page.getByRole('heading', { name: 'Choose a conversation' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Customer', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Customer details', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to conversation', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Customer details', exact: true })).toBeHidden()
})
