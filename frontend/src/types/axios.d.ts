import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** N'affiche pas le toast d'erreur global : l'appelant gère lui-même l'échec. */
    skipErrorToast?: boolean;
  }
}
