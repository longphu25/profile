import '../dev'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SolanaDashboard } from './SolanaDashboard'
import './solana.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaDashboard />
  </StrictMode>,
)
