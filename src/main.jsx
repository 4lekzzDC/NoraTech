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
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage.jsx'
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage.jsx'
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage.jsx'
import {
  SolucoesContabeisPage,
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_ROUTE,
  SOLUCOES_CONTABEIS_LEGACY_ROUTE,
} from './modules/solucoes-contabeis'
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
          <Route path="/admin" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/empresas" element={<AdminRoute><AdminCompaniesPage /></AdminRoute>} />
          <Route path="/admin/assinaturas" element={<AdminRoute><AdminSubscriptionsPage /></AdminRoute>} />
          <Route path="/admin/faturas" element={<AdminRoute><AdminInvoicesPage /></AdminRoute>} />
          <Route
            path={SOLUCOES_CONTABEIS_ROUTE}
            element={
              <SubscriptionRoute
                systemSlug={SOLUCOES_CONTABEIS_SLUG}
                legacySlugs={SOLUCOES_CONTABEIS_LEGACY_SLUGS}
              >
                <SolucoesContabeisPage />
              </SubscriptionRoute>
            }
          />
          <Route
            path={SOLUCOES_CONTABEIS_LEGACY_ROUTE}
            element={<Navigate to={SOLUCOES_CONTABEIS_ROUTE} replace />}
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
