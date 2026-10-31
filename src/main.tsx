import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App.tsx'
import { applySettingsToDocument } from './lib/storage.ts'
import './index.css'
import { BASE } from './lib/paths.ts'

applySettingsToDocument()
// Follow the phone's light/dark setting when the theme is "system".
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettingsToDocument)

// Save the app on the device so it works offline. When a new version is
// ready, show a small banner instead of reloading while you might be typing.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('foundations:update-ready', { detail: () => updateSW(true) }))
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={BASE.replace(/\/$/, '') || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
