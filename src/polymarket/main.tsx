import '../dev'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PolymarketDashboard } from './PolymarketDashboard'
import './polymarket.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PolymarketDashboard />
  </StrictMode>,
)
