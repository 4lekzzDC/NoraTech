import { StrictMode, Component } from 'react'
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
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', background: '#08080a', color: '#eeede9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'monospace' }}>
        <div style={{ maxWidth: 560, border: '1px solid rgba(255,80,80,0.3)', borderRadius: 12, padding: 28, background: 'rgba(255,80,80,0.05)' }}>
          <div style={{ color: '#ff6b6b', fontWeight: 700, marginBottom: 12 }}>Erro de configuração</div>
          <pre style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {this.state.error.message}
          </pre>
        </div>
      </div>
    )
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(200,255,0,0.2)', borderTopColor: '#c8ff00', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
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
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
