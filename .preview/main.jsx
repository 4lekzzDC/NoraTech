import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import InboxPage from '../src/modules/noradocs/pages/InboxPage';
import ConfiguracoesPage from '../src/modules/noradocs/pages/ConfiguracoesPage';
import HistoricoPage from '../src/modules/noradocs/pages/HistoricoPage';
import ClientesPage from '../src/modules/noradocs/pages/ClientesPage';
import DifalPage from '../src/modules/solucoes-contabeis/sistemas/difal/DifalPage';
import FiscalPage from '../src/modules/solucoes-contabeis/sistemas/fiscal/FiscalPage';
import AdminDifalRegrasPage from '../src/pages/admin/AdminDifalRegrasPage';
import AjusteFiscalPage from '../src/modules/solucoes-contabeis/sistemas/difal/AjusteFiscalPage';

const TELAS = {
  inbox: InboxPage, configuracoes: ConfiguracoesPage, historico: HistoricoPage,
  clientes: ClientesPage, difal: DifalPage, fiscal: FiscalPage,
  regrasGlobais: AdminDifalRegrasPage, ajusteFiscal: AjusteFiscalPage,
};
const params = new URLSearchParams(location.search);
const Tela = TELAS[params.get('tela')] || InboxPage;
// Caminho opcional (?rota=/solucoes-contabeis/x) — só para checar o
// breadcrumb do SolucoesHeader, que lê a pathname de verdade.
const rota = params.get('rota') ? [params.get('rota')] : ['/'];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={rota}>
          <Tela />
        </MemoryRouter>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
