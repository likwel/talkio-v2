import axios from 'axios';
import { pushToast } from './toastBus';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL });

let accessToken: string | null = localStorage.getItem('talkio.access') || null;
let refreshToken: string | null = localStorage.getItem('talkio.refresh') || null;

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem('talkio.access', access);
  else localStorage.removeItem('talkio.access');
  if (refresh) localStorage.setItem('talkio.refresh', refresh);
  else localStorage.removeItem('talkio.refresh');
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && refreshToken) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          api
            .post('/auth/refresh', { refreshToken })
            .then((r) => {
              setTokens(r.data.accessToken, r.data.refreshToken);
              return r.data.accessToken as string;
            })
            .finally(() => {
              refreshing = null;
            });
        const newToken = await refreshing;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        setTokens(null, null);
        window.location.href = '/login';
      }
    }

    // Filet de securite : signale les erreurs qu'un ecran ne gere generalement
    // pas lui-meme (permission refusee, panne serveur, reseau injoignable).
    if (!original?.skipErrorToast) {
      const status: number | undefined = error.response?.status;
      const serverMsg: string | undefined = error.response?.data?.error;
      if (!error.response && error.code !== 'ERR_CANCELED') {
        pushToast('Impossible de joindre le serveur. Vérifiez votre connexion.', 'error');
      } else if (status === 403) {
        pushToast(serverMsg || "Vous n'avez pas la permission d'effectuer cette action.", 'error');
      } else if (status === 429) {
        pushToast(serverMsg || 'Trop de requêtes. Patientez un instant avant de réessayer.', 'error');
      } else if (typeof status === 'number' && status >= 500) {
        pushToast(serverMsg || 'Une erreur serveur est survenue. Réessayez dans un instant.', 'error');
      }
    }

    return Promise.reject(error);
  },
);
