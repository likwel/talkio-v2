/**
 * Petit bus decouple : `lib/api.ts` (hors React) publie des messages d'erreur,
 * le `ToastProvider` s'abonne pour les afficher.
 */
export type ToastKind = 'error' | 'success' | 'info';

type Handler = (message: string, kind: ToastKind) => void;

let handler: Handler | null = null;

export function registerToastHandler(fn: Handler | null) {
  handler = fn;
}

export function pushToast(message: string, kind: ToastKind = 'info') {
  handler?.(message, kind);
}
