import { localPreferences } from './lib/storage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './theme.css'
import './glass.css'
import './animatedGradientBorder.css'

if (import.meta.env.DEV) void import('./lib/devTools')

document.documentElement.dataset.reducedMotion = localPreferences.getItem('qalo-reduced-motion') || 'false'
// One-time capability gate: unregistered custom properties animate discretely.
document.documentElement.dataset.gradientMotion = typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function' ? 'supported' : 'static'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
