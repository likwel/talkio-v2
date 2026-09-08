import { ReactNode, useEffect } from 'react';
import clsx from 'clsx';
import { IconClose } from '@/lib/icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Empeche la fermeture au clic exterieur / Echap. */
  locked?: boolean;
}

const SIZE = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md', locked }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, locked, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'flex max-h-[92vh] w-full flex-col overflow-hidden border border-[var(--outline)] bg-[var(--surface)] shadow-elevation-3',
          'rounded-t-2xl safe-b sm:max-h-[85vh] sm:rounded-2xl sm:pb-0',
          SIZE[size],
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--outline)] sm:hidden" />
        {title !== undefined && (
          <div className="flex items-center justify-between gap-4 border-b border-[var(--outline)] px-5 py-3.5">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            {!locked && (
              <button className="icon-btn-sm -mr-1" onClick={onClose} aria-label="Fermer">
                <IconClose className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--outline)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
