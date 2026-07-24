import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './lib/i18n'
import { SessionProvider } from './state/session'
import { ToastProvider } from './components/Toast'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </HashRouter>
  </React.StrictMode>,
)

// Preloader zmizi, jakmile React nabehne. Drzime jen 180 ms, aby na rychlem
// pripojeni neproblikl — ne aby uměle zdrzoval. Fade resi CSS na #boot.
const boot = document.getElementById('boot')
if (boot) {
  const start = Number(boot.dataset.t || 0) || performance.now()
  const hide = () => {
    boot.classList.add('boot-hide')
    setTimeout(() => boot.remove(), 500)
  }
  const waited = performance.now() - start
  setTimeout(hide, Math.max(0, 180 - waited))
}
