import axios from 'axios';

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
    return Promise.reject(error);
  },
);
