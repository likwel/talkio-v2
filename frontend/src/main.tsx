import React from 'react';
import ReactDOM from 'react-dom/client';
import { IconContext } from 'react-icons';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/i18n';
import { ToastProvider } from '@/context/ToastContext';
import { DialogProvider } from '@/context/DialogContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { PresenceProvider } from '@/context/PresenceContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { CryptoProvider } from '@/context/CryptoContext';
import { ImageViewerProvider } from '@/components/ImageViewer';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
      <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DialogProvider>
            <AuthProvider>
              <CryptoProvider>
              <WorkspaceProvider>
                <PresenceProvider>
                  <SettingsProvider>
                    <ProfileProvider>
                      <ImageViewerProvider>
                        {/* Toutes les icones (react-icons) heritent du rendu "relief" icon-3d */}
                        <IconContext.Provider value={{ className: 'icon-3d' }}>
                          <App />
                        </IconContext.Provider>
                      </ImageViewerProvider>
                    </ProfileProvider>
                  </SettingsProvider>
                </PresenceProvider>
              </WorkspaceProvider>
              </CryptoProvider>
            </AuthProvider>
          </DialogProvider>
        </BrowserRouter>
      </QueryClientProvider>
      </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
