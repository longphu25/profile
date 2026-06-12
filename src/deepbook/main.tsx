import '../dev'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DeepBookSuite } from './DeepBookSuite'
import '../sui-deepbook-predict/predict.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeepBookSuite />
  </StrictMode>,
)
