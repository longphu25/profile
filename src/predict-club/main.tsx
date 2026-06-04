import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PredictClubPage } from './PredictClubPage'
import './predict-club.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PredictClubPage />
  </StrictMode>,
)
