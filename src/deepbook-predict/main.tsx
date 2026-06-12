import '../dev'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DeepBookPredictPage } from './DeepBookPredictPage'
import './deepbook-predict.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeepBookPredictPage />
  </StrictMode>,
)
