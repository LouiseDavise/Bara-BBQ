import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/base.css'
import './public.css'
import { PublicApp } from './PublicApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PublicApp />
    </BrowserRouter>
  </StrictMode>,
)
