import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'
import SistemasPage from './pages/SistemasPage.jsx'
import AutomacaoPage from './pages/AutomacaoPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AreaDoClientePage from './pages/AreaDoClientePage.jsx'
import SystemDetailsPage from './pages/SystemDetailsPage.jsx'
import SystemContractPage from './pages/SystemContractPage.jsx'
import FinanceiroPage from './pages/FinanceiroPage.jsx'
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import AdminCompaniesPage from './pages/admin/AdminCompaniesPage.jsx'
import AdminSystemsPage from './pages/admin/AdminSystemsPage.jsx'
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage.jsx'
import AdminSupportPage from './pages/admin/AdminSupportPage.jsx'
import {
  SolucoesContabeisHub,
  SistemaEmConstrucao,
  AcompanhamentoContabilPage,
  ContabilPage,
  PessoalPage,
  SOLUCOES_CONTABEIS_SLUG,
  SOLUCOES_CONTABEIS_LEGACY_SLUGS,
  SOLUCOES_CONTABEIS_ROUTE,
  ACOMPANHAMENTO_CONTABIL_LEGACY_ROUTE,
} from './modules/solucoes-contabeis'
import {
  NoraDocsInboxPage,
  NoraDocsHistoricoPage,
  NoraDocsClientesPage,
  NoraDocsConfiguracoesPage,
  NoraDocsGoogleCallbackPage,
  NORADOCS_SLUG,
  NORADOCS_ROUTE,
  GOOGLE_CALLBACK_ROUTE,
} from './modules/noradocs'
import CodificadorPage from './modules/solucoes-contabeis/sistemas/codificador/CodificadorPage.jsx'
import ConciliadorExtratosPage from './modules/solucoes-contabeis/sistemas/conciliador-extratos/ConciliadorExtratosPage.jsx'
import ConciliadorFornecedoresPage from './modules/solucoes-contabeis/sistemas/conciliador-fornecedores/ConciliadorFornecedoresPage.jsx'
import GestaoClientesPage from './modules/solucoes-contabeis/sistemas/gestao-clientes/GestaoClientesPage.jsx'
import PrazosPage from './modules/solucoes-contabeis/sistemas/prazos/PrazosPage.jsx'
import AnaliseDemonstracoesPage from './modules/solucoes-contabeis/sistemas/analise-demonstracoes/AnaliseDemonstracoesPage.jsx'
import TransformadorExtratoPage from './modules/solucoes-contabeis/sistemas/transformador-extrato/TransformadorExtratoPage.jsx'
import CalculadoraIrpjCsllPage from './modules/solucoes-contabeis/sistemas/calculadora-irpj-csll/CalculadoraIrpjCsllPage.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import SubscriptionRoute from './components/SubscriptionRoute.jsx'
import OrgManagerRoute from './components/OrgManagerRoute.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import ForcePasswordResetGate from './components/ForcePasswordResetGate.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  // Fast-path: if user is already known (navigation between protected routes)
  // skip the loading screen — no need to wait for re-validation.
  if (user) return children
  if (loading) return <LoadingScreen />
  return <Navigate to="/login" replace />
}

// Wrapper que aplica o gate de assinatura `solucoes-contabeis` (aceita
// também o slug legado `acompanhamento-contabil`) a qualquer rota da suite.
// `moduleSlug` é opcional — só as rotas de ferramenta o passam, pra também
// checar se aquele módulo específico está liberado na assinatura (o admin
// pode restringir quais módulos do hub uma empresa paga). Hub, categorias
// (Contábil/Pessoal) e o catch-all "em construção" não levam moduleSlug:
// são navegação, não ferramenta — o gate neles é só o do sistema inteiro.
function SolucoesContabeisRoute({ moduleSlug, children }) {
  return (
    <SubscriptionRoute
      systemSlug={SOLUCOES_CONTABEIS_SLUG}
      legacySlugs={SOLUCOES_CONTABEIS_LEGACY_SLUGS}
      moduleSlug={moduleSlug}
      moduleFallback={`${SOLUCOES_CONTABEIS_ROUTE}/contabil`}
    >
      {children}
    </SubscriptionRoute>
  )
}

// Gate de assinatura do NoraDocs. Produto comercial separado do hub Soluções
// Contábeis: slug próprio, assinatura própria. Sem `moduleSlug` — o NoraDocs é
// vendido inteiro, não por módulo.
function NoraDocsRoute({ children }) {
  return <SubscriptionRoute systemSlug={NORADOCS_SLUG}>{children}</SubscriptionRoute>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
    {/* Sobreposição: o app monta embaixo enquanto a marca se desenha, então a
        splash não adia a renderização — só cobre o tempo de carga. */}
    <SplashScreen />
    <BrowserRouter>
      <AuthProvider>
        <ForcePasswordResetGate>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/termos" element={<TermsPage />} />
          <Route path="/servicos/sistemas-sob-medida" element={<SistemasPage />} />
          <Route path="/servicos/automacao-de-processos" element={<AutomacaoPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/registro" element={<AuthPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/area-do-cliente" element={<ProtectedRoute><AreaDoClientePage /></ProtectedRoute>} />
          <Route path="/area-do-cliente/financeiro" element={<OrgManagerRoute><FinanceiroPage /></OrgManagerRoute>} />
          <Route path="/area-do-cliente/sistemas/:slug" element={<ProtectedRoute><SystemDetailsPage /></ProtectedRoute>} />
          <Route path="/area-do-cliente/sistemas/:slug/contrato" element={<OrgManagerRoute><SystemContractPage /></OrgManagerRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminOverviewPage /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
          <Route path="/admin/empresas" element={<AdminRoute><AdminCompaniesPage /></AdminRoute>} />
          <Route path="/admin/sistemas" element={<AdminRoute><AdminSystemsPage /></AdminRoute>} />
          <Route path="/admin/faturas" element={<AdminRoute><AdminInvoicesPage /></AdminRoute>} />
          <Route path="/admin/suporte" element={<AdminRoute><AdminSupportPage /></AdminRoute>} />
          {/* Hub da suite Soluções Contábeis */}
          <Route
            path={SOLUCOES_CONTABEIS_ROUTE}
            element={<SolucoesContabeisRoute><SolucoesContabeisHub /></SolucoesContabeisRoute>}
          />
          {/* Módulo real já migrado */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/acompanhamento-contabil`}
            element={<SolucoesContabeisRoute moduleSlug="acompanhamento-contabil"><AcompanhamentoContabilPage /></SolucoesContabeisRoute>}
          />
          {/* Categoria "Contábil" — grid de subcategorias migrado do Autonomy */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/contabil`}
            element={<SolucoesContabeisRoute><ContabilPage /></SolucoesContabeisRoute>}
          />
          {/* Categoria "Pessoal" — RH e processos de pessoal */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/pessoal`}
            element={<SolucoesContabeisRoute><PessoalPage /></SolucoesContabeisRoute>}
          />
          {/* Placeholders dos módulos do Autonomy em migração */}
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/codificador`}
            element={<SolucoesContabeisRoute moduleSlug="codificador"><CodificadorPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/conciliador-extratos`}
            element={<SolucoesContabeisRoute moduleSlug="conciliador-extratos"><ConciliadorExtratosPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/conciliador-fornecedores`}
            element={<SolucoesContabeisRoute moduleSlug="conciliador-fornecedores"><ConciliadorFornecedoresPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/gestao-clientes`}
            element={<SolucoesContabeisRoute moduleSlug="gestao-clientes"><GestaoClientesPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/prazos`}
            element={<SolucoesContabeisRoute moduleSlug="prazos"><PrazosPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/analise-demonstracoes`}
            element={<SolucoesContabeisRoute moduleSlug="analise-demonstracoes"><AnaliseDemonstracoesPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/transformador-extrato`}
            element={<SolucoesContabeisRoute moduleSlug="transformador-extrato"><TransformadorExtratoPage /></SolucoesContabeisRoute>}
          />
          <Route
            path={`${SOLUCOES_CONTABEIS_ROUTE}/calculadora-irpj-csll`}
            element={<SolucoesContabeisRoute moduleSlug="calculadora-irpj-csll"><CalculadoraIrpjCsllPage /></SolucoesContabeisRoute>}
          />
          {/* NoraDocs — organização automática de documentos no Google Drive */}
          <Route path={NORADOCS_ROUTE} element={<NoraDocsRoute><NoraDocsInboxPage /></NoraDocsRoute>} />
          <Route path={`${NORADOCS_ROUTE}/historico`} element={<NoraDocsRoute><NoraDocsHistoricoPage /></NoraDocsRoute>} />
          <Route path={`${NORADOCS_ROUTE}/clientes`} element={<NoraDocsRoute><NoraDocsClientesPage /></NoraDocsRoute>} />
          <Route path={`${NORADOCS_ROUTE}/configuracoes`} element={<NoraDocsRoute><NoraDocsConfiguracoesPage /></NoraDocsRoute>} />
          {/* Destino do redirect do Google após o consentimento OAuth — não é uma tela de navegação normal */}
          <Route path={GOOGLE_CALLBACK_ROUTE} element={<NoraDocsRoute><NoraDocsGoogleCallbackPage /></NoraDocsRoute>} />
          {/* Qualquer outra sub-rota do NoraDocs volta para a caixa de entrada */}
          <Route path={`${NORADOCS_ROUTE}/*`} element={<Navigate to={NORADOCS_ROUTE} replace />} />
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
        </ForcePasswordResetGate>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
