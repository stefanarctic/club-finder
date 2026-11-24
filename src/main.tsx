import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './design-system'
import { LiveCatalogProvider } from './data/LiveCatalog'
import { App } from './app/App'
import { AuthProvider } from './app/auth'
import { SessionProvider } from './app/session'
import { TicketsProvider } from './app/tickets'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <AuthProvider>
          <TicketsProvider>
            <LiveCatalogProvider>
              <App />
            </LiveCatalogProvider>
          </TicketsProvider>
        </AuthProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
