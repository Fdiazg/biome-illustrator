import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './studio/App'
import './studio/studio.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
