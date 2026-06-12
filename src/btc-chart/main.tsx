import '../dev'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BtcChartPage } from './BtcChartPage'
import './btc-chart.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BtcChartPage />
  </StrictMode>,
)
