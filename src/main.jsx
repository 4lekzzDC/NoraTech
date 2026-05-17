import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import SistemasPage from './pages/SistemasPage.jsx'
import AutomacaoPage from './pages/AutomacaoPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AreaDoClientePage from './pages/AreaDoClientePage.jsx'
import FinanceiroPage from './pages/FinanceiroPage.jsx'
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage.jsx'
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage.jsx'
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage.jsx'
import {
  SolucoesContabeisHub,
  SistemaEmConstrucao,
  AcompanhamentoContabilPage,
  ContabilPage,
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_ROUTE,
  ACOMPANHAMENTO_CONTABIL_LEGACY_ROUTE,
} from './modules/solucoes-contabeis'
import CodificadorPage from './modules/solucoes-contabeis/sistemas/codificador/CodificadorPage.jsx'
import ConciliadorExtratosPage from './modules/solucoes-contabeis/sistemas/conciliador-extratos/ConciliadorExtratosPage.jsx'
import ConciliadorFornecedoresPage from './modules/solucoes-contabeis/sistemas/conciliador-fornecedores/ConciliadorFornecedoresPage.jsx'
import GestaoClientesPage from './modules/solucoes-contabeis/sistemas/gestao-clientes/GestaoClientesPage.jsx'
import PrazosPage from './modules/solucoes-contabeis/sistemas/prazos/PrazosPage.jsx'
import AnaliseDemonstracoesPage from './modules/solucoes-contabeis/sistemas/analise-demonstracoes/AnaliseDemonstracoesPage.jsx'
import TransformadorExtratoPage from './modules/solucoes-contabeis/sistemas/transformador-extrato/TransformadorExtratoPage.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import SubscriptionRoute from './components/SubscriptionRoute.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(124, 58, 237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

// Wrapper que aplica o gate de assinatura `solucoes-contabeis` (aceita
// também o slug legado `acompanhamento-contabil`) a qualquer rota da suite.
function SolucoesContabeisRoute({ children }) {
  return (
    <SubscriptionRoute
      systemSlug={SOLUCOES_CONTABEIS_SLUG}
      legacySlugs={SOLUCOES_CONTABEIS_LEGACY_SLUGS}
    >
      {children}
    </SubscriptionRoute>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/servicos/sistemas-sob-medida" element={<SistemasPage />} />
          <Route path="/servicos/automacao-de-processos" element={<AutomacaoPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/area-do-cliente" element={<ProtectedRoute><AreaDoClientePage /></ProtectedRoute>} />
          <Route path="/area-do-cliente/financeiro" element={<ProtectedRoute><FinanceiroPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/empresas" element={<AdminRoute><AdminCompaniesPage /></AdminRoute>} />
          <Route path="/admin/assinaturas" element={<AdminRoute><AdminSubscriptionsPage /></AdminRoute>} />
          <Route path="/admin/faturas" element={<AdminRoute><AdminInvoicesPage /></AdminRoute>} />
          {/* Hub da suite Soluções Contábeis */}
          <Route
            path={SOLUCOES_CONTABEIS_ROUTE}
            element={<SolucoesContabeisRoute><SolucoesContabeisHub /></SolucoesContabeisRoute>}
          />
          {/* Módulo real já migrado */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/acompanhamento-contabil`}
            element={<SolucoesContabeisRoute><AcompanhamentoContabilPage /></SolucoesContabeisRoute>}
          />
          {/* Categoria "Contábil" — grid de subcategorias migrado do Autonomy */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/contabil`}
            element={<SolucoesContabeisRoute><ContabilPage /></SolucoesContabeisRoute>}
          />
          {/* Placeholders dos módulos do Autonomy em migração */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/codificador`}
            element={<SolucoesContabeisRoute><CodificadorPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/conciliador-extratos`}
            element={<SolucoesContabeisRoute><ConciliadorExtratosPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/conciliador-fornecedores`}
            element={<SolucoesContabeisRoute><ConciliadorFornecedoresPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/gestao-clientes`}
            element={<SolucoesContabeisRoute><GestaoClientesPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/prazos`}
            element={<SolucoesContabeisRoute><PrazosPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/analise-demonstracoes`}
            element={<SolucoesContabeisRoute><AnaliseDemonstracoesPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/transformador-extrato`}
            element={<SolucoesContabeisRoute><TransformadorExtratoPage /></SolucoesContabeisRoute>}
          />
          {/* Catch-all: itens do catálogo sem rota dedicada caem aqui */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/:slug`}
            element={<SolucoesContabeisRoute><SistemaEmConstrucao /></SolucoesContabeisRoute>}
          />
          {/* Compatibilidade: rota antiga que ia direto ao Acompanhamento Contábil */}
          <Route
            path={ACOMPANHAMENTO_CONTABIL_LEGACY_ROUTE}
            element={<Navigate to={`${SOLUCOES_CONTABEIS_ROUTE}/acompanhamento-contabil`} replace />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
