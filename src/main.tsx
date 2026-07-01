import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
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
