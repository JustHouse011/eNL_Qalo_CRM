import { supportService } from './supportService'
import { sessionPreferences } from './storage'
declare global {
  interface Window { qaloDev?: { resetDemoData: () => Promise<void> } }
}
// Loaded only by Vite's development build. No customer-facing reset action.
if (import.meta.env.DEV) {
  window.qaloDev = {
    async resetDemoData() {
      await supportService.reset()
      sessionPreferences.removeItem('qalo-demo-chat')
      window.location.reload()
    },
  }
}
