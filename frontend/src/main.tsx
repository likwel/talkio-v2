import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { DialogProvider } from '@/context/DialogContext';
import { ProfileProvider } from '@/context/ProfileContext';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DialogProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <ProfileProvider>
                  <App />
                </ProfileProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </DialogProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
