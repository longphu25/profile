import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SuiDashboard } from './SuiDashboard'
import './sui-dashboard.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SuiDashboard />
  </StrictMode>,
)
