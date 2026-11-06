import type { Page } from '@playwright/test'

/** Switch through the user-facing select-only combobox; confirmation remains owned by each test. */
export async function selectWorkspace(page: Page, workspaceId: string) {
  await page.getByRole('combobox', { name: 'Switch workspace', exact: true }).click()
  await page.locator(`[role="option"][data-workspace-id=${JSON.stringify(workspaceId)}]`).click()
}
