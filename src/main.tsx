import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App.tsx'
import { applySettingsToDocument } from './lib/storage.ts'
import './index.css'

applySettingsToDocument()
// Follow the phone's light/dark setting when the theme is "system".
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettingsToDocument)

// Save the app on the device so it works offline.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
