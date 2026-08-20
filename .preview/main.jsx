import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import InboxPage from '../src/modules/noradocs/pages/InboxPage';
import ConfiguracoesPage from '../src/modules/noradocs/pages/ConfiguracoesPage';
import HistoricoPage from '../src/modules/noradocs/pages/HistoricoPage';

const TELAS = { inbox: InboxPage, configuracoes: ConfiguracoesPage, historico: HistoricoPage };
const Tela = TELAS[new URLSearchParams(location.search).get('tela')] || InboxPage;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <MemoryRouter>
          <Tela />
        </MemoryRouter>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
