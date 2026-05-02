import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './i18n'
import Home from './pages/Home'
import Calculation from './pages/Calculation'
import Imprint from './pages/Imprint'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calculate/:lat/:lng" element={<Calculation />} />
        <Route path="/calculate/:lat/:lng/:day" element={<Calculation />} />
        <Route path="/imprint" element={<Imprint />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)