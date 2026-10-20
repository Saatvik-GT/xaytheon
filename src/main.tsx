import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/spectral/latin-300.css'
import '@fontsource/spectral/latin-400.css'
import './styles/base.css'
import './styles/site.css'
import './styles/lab.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
