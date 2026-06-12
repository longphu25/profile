import '../dev'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { MarketplaceApp } from './MarketplaceApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MarketplaceApp />
  </StrictMode>,
)
