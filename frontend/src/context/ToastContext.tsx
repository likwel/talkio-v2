import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { registerToastHandler, type ToastKind } from '@/lib/toastBus';
import { IconCheck, IconError, IconInfo, IconClose } from '@/lib/icons';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastApi | undefined>(undefined);

const STYLES: Record<ToastKind, { box: string; Icon: typeof IconError }> = {
  error: {
    box: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200',
    Icon: IconError,
  },
  success: {
    box: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200',
    Icon: IconCheck,
  },
  info: {
    box: 'border-[var(--outline)] bg-[var(--surface)] text-[var(--text)]',
    Icon: IconInfo,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      if (!message) return;
      const id = (idRef.current += 1);
      setItems((list) => {
        // Evite les doublons consecutifs identiques.
        if (list.some((t) => t.message === message && t.kind === kind)) return list;
        return [...list, { id, message, kind }].slice(-4);
      });
      window.setTimeout(() => remove(id), kind === 'error' ? 6500 : 4000);
    },
    [remove],
  );

  useEffect(() => {
    registerToastHandler((m, k) => toast(m, k));
    return () => registerToastHandler(null);
  }, [toast]);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-5">
        {items.map((t) => {
          const s = STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="alert"
              className={clsx(
                'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-elevation-3',
                s.box,
              )}
            >
              <s.Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100"
                aria-label="Fermer"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return ctx;
}
