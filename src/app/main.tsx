import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/base.css'
import './app.css'
import { StaffApp } from './StaffApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StaffApp />
    </BrowserRouter>
  </StrictMode>,
)
