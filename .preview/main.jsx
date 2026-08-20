import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import InboxPage from '../src/modules/noradocs/pages/InboxPage';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
