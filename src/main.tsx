import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './design-system'
import { LiveCatalogProvider } from './data/LiveCatalog'
import { App } from './app/App'
import { SessionProvider } from './app/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <LiveCatalogProvider>
          <App />
        </LiveCatalogProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
