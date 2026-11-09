import { localPreferences } from './lib/storage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-300.css'
import '@fontsource/inter/latin-400.css'
import './index.css'
import App from './App.tsx'
import './theme.css'
import './glass.css'
import './animatedGradientBorder.css'
import './features/BankingOperations.css'
import './design-foundation.css'
import './features/InboxWorkspace.css'
import './dropdowns.css'
import './features/BankingPremium.css'

if (import.meta.env.DEV) void import('./lib/devTools')

document.documentElement.dataset.reducedMotion = localPreferences.getItem('qalo-reduced-motion') || 'false'
// One-time capability gate: unregistered custom properties animate discretely.
document.documentElement.dataset.gradientMotion = typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function' ? 'supported' : 'static'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
