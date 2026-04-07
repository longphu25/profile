import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PluginDemoApp } from './PluginDemoApp'
import './plugin-demo.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PluginDemoApp />
  </StrictMode>,
)
