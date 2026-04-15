import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import SistemasPage from './pages/SistemasPage.jsx'
import AutomacaoPage from './pages/AutomacaoPage.jsx'
import DashboardsPage from './pages/DashboardsPage.jsx'
import IntegracoesPage from './pages/IntegracoesPage.jsx'
import ClienteAreaPage from './pages/ClienteAreaPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacidade" element={<PrivacyPage />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/servicos/sistemas-sob-medida" element={<SistemasPage />} />
        <Route path="/servicos/automacao-de-processos" element={<AutomacaoPage />} />
        <Route path="/servicos/dashboards-e-bi" element={<DashboardsPage />} />
        <Route path="/servicos/integracoes" element={<IntegracoesPage />} />
        <Route path="/area-do-cliente" element={<ClienteAreaPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
