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

// Remove the instant preloader once the app has painted. A short minimum keeps
// it from flickering on fast loads; the fade is handled by CSS on #boot.
const boot = document.getElementById('boot')
if (boot) {
  const start = Number(boot.dataset.t || 0) || performance.now()
  const hide = () => {
    boot.classList.add('boot-hide')
    setTimeout(() => boot.remove(), 500)
  }
  const waited = performance.now() - start
  setTimeout(hide, Math.max(0, 400 - waited))
}
