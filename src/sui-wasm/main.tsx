import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SuiWasmDashboard } from './SuiWasmDashboard'
import './sui-wasm.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SuiWasmDashboard />
  </StrictMode>,
)
