import '../dev/react-grab'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PredictPage } from './PredictPage'
import './predict.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PredictPage />
  </StrictMode>,
)
