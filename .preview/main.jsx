import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import InboxPage from '../src/modules/noradocs/pages/InboxPage';
import ConfiguracoesPage from '../src/modules/noradocs/pages/ConfiguracoesPage';
import HistoricoPage from '../src/modules/noradocs/pages/HistoricoPage';
import ClientesPage from '../src/modules/noradocs/pages/ClientesPage';
import DifalPage from '../src/modules/solucoes-contabeis/sistemas/difal/DifalPage';
import FiscalPage from '../src/modules/solucoes-contabeis/sistemas/fiscal/FiscalPage';
import ContabilPage from '../src/modules/solucoes-contabeis/sistemas/contabil/ContabilPage';
import PessoalPage from '../src/modules/solucoes-contabeis/sistemas/pessoal/PessoalPage';
import AdminSystemEditorPage from '../src/pages/admin/AdminSystemEditorPage';
import AjusteFiscalPage from '../src/modules/solucoes-contabeis/sistemas/difal/AjusteFiscalPage';
import AdminProposalsPage from '../src/pages/admin/AdminProposalsPage';
import AdminProposalEditorPage from '../src/pages/admin/AdminProposalEditorPage';
import PropostaPublicaPage from '../src/pages/PropostaPublicaPage';
import AdminOverviewPage from '../src/pages/admin/AdminOverviewPage';

// A maioria das telas é montada direto, sem depender de parâmetro de rota.
// AdminSystemEditorPage/AdminProposalEditorPage/PropostaPublicaPage são a
// exceção — usam useParams() — por isso elas sozinhas precisam de um
// <Routes> de verdade por baixo.
const TELAS = {
  inbox: InboxPage, configuracoes: ConfiguracoesPage, historico: HistoricoPage,
  clientes: ClientesPage, difal: DifalPage, fiscal: FiscalPage,
  contabil: ContabilPage, pessoal: PessoalPage, ajusteFiscal: AjusteFiscalPage,
  propostas: AdminProposalsPage, visaoGeral: AdminOverviewPage,
};
const params = new URLSearchParams(location.search);
const nomeTela = params.get('tela');
// Caminho opcional (?rota=/solucoes-contabeis/x) — só para checar o
// breadcrumb do SolucoesHeader, que lê a pathname de verdade.
const rota = params.get('rota') ? [params.get('rota')] : ['/'];

// Sem componente próprio (this é um entry point, não um módulo de
// componente) — react-refresh reprova um arquivo sem export que define um —
// então o conteúdo é montado como uma expressão só, calculada na hora.
const conteudo = nomeTela === 'sistemaEditor' ? (
  <MemoryRouter initialEntries={[params.get('rota') || '/admin/sistemas/solucoes-contabeis']}>
    <Routes>
      <Route path="/admin/sistemas/:slug" element={<AdminSystemEditorPage />} />
    </Routes>
  </MemoryRouter>
) : nomeTela === 'propostaEditor' ? (
  <MemoryRouter initialEntries={[params.get('rota') || '/admin/propostas/novo']}>
    <Routes>
      <Route path="/admin/propostas/novo" element={<AdminProposalEditorPage />} />
      <Route path="/admin/propostas/:id" element={<AdminProposalEditorPage />} />
    </Routes>
  </MemoryRouter>
) : nomeTela === 'propostaPublica' ? (
  <MemoryRouter initialEntries={[params.get('rota') || '/proposta/seed-token-0001']}>
    <Routes>
      <Route path="/proposta/:token" element={<PropostaPublicaPage />} />
    </Routes>
  </MemoryRouter>
) : (
  <MemoryRouter initialEntries={rota}>
    {(() => { const Tela = TELAS[nomeTela] || InboxPage; return <Tela />; })()}
  </MemoryRouter>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        {conteudo}
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
