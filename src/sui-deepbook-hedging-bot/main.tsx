import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HedgingBotPage } from './HedgingBotPage'
import './hedging-bot.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HedgingBotPage />
  </StrictMode>,
)
