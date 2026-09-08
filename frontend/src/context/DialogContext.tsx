import { createContext, useCallback, useContext, useRef, useState, ReactNode, FormEvent } from 'react';
import Modal from '@/components/Modal';

type Kind = 'alert' | 'confirm' | 'prompt';

interface DialogSpec {
  kind: Kind;
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogApi {
  alert: (o: Omit<DialogSpec, 'kind'>) => Promise<void>;
  confirm: (o: Omit<DialogSpec, 'kind'>) => Promise<boolean>;
  prompt: (o: Omit<DialogSpec, 'kind'>) => Promise<string | null>;
}

const Ctx = createContext<DialogApi | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<(v: unknown) => void>();

  const open = useCallback((s: DialogSpec) => {
    setSpec(s);
    setValue(s.defaultValue ?? '');
    return new Promise((resolve) => {
      resolver.current = resolve as (v: unknown) => void;
    });
  }, []);

  const api: DialogApi = {
    alert: (o) => open({ ...o, kind: 'alert' }) as Promise<void>,
    confirm: (o) => open({ ...o, kind: 'confirm' }) as Promise<boolean>,
    prompt: (o) => open({ ...o, kind: 'prompt' }) as Promise<string | null>,
  };

  function settle(result: unknown) {
    resolver.current?.(result);
    resolver.current = undefined;
    setSpec(null);
  }

  function onCancel() {
    settle(spec?.kind === 'prompt' ? null : spec?.kind === 'confirm' ? false : undefined);
  }
  function onConfirm(e?: FormEvent) {
    e?.preventDefault();
    settle(spec?.kind === 'prompt' ? value : spec?.kind === 'confirm' ? true : undefined);
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <Modal
        open={!!spec}
        onClose={onCancel}
        size="sm"
        title={spec?.title}
        footer={
          spec && (
            <>
              {spec.kind !== 'alert' && (
                <button type="button" className="btn-text" onClick={onCancel}>
                  {spec.cancelLabel ?? 'Annuler'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onConfirm()}
                className={spec.danger ? 'btn-danger' : 'btn-primary'}
              >
                {spec.confirmLabel ?? (spec.kind === 'confirm' ? 'Confirmer' : spec.kind === 'prompt' ? 'Valider' : 'OK')}
              </button>
            </>
          )
        }
      >
        {spec?.message && <p className="text-sm text-[var(--text-dim)]">{spec.message}</p>}
        {spec?.kind === 'prompt' && (
          <form onSubmit={onConfirm} className="mt-3">
            {spec.label && <label className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">{spec.label}</label>}
            <input
              autoFocus
              className="input"
              placeholder={spec.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDialog hors DialogProvider');
  return ctx;
}
