import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './design-system'
import { LiveCatalogProvider } from './data/LiveCatalog'
import { App } from './app/App'
import { AuthProvider } from './app/auth'
import { SessionProvider } from './app/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <AuthProvider>
          <LiveCatalogProvider>
            <App />
          </LiveCatalogProvider>
        </AuthProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
