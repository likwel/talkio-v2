import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { IconSearch, IconChevronDown, IconTick } from '@/lib/icons';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Classes du bouton declencheur (largeur, hauteur…). */
  className?: string;
  disabled?: boolean;
  /** Affiche le champ de recherche (defaut : auto des qu'il y a > 5 options). */
  searchable?: boolean;
  'aria-label'?: string;
}

/**
 * Select « cherchable » (combobox) — meme rendu que `.input`, sans dependance.
 * Popover en position fixed : ne se fait pas rogner par un conteneur qui defile.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Selectionner…',
  className,
  disabled,
  searchable,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; drop: 'down' | 'up' } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 5;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const below = window.innerHeight - b.bottom;
    const drop = below < 260 && b.top > below ? 'up' : 'down';
    setRect({ top: drop === 'down' ? b.bottom + 4 : b.top - 4, left: b.left, width: b.width, drop });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    setActiveIdx(Math.max(0, filtered.findIndex((o) => o.value === value)));
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    const onScroll = () => place();
    // Capture + stopPropagation : Echap ferme le Select sans fermer une modale parente.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onClick);
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = filtered[activeIdx];
      if (o) pick(o.value);
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'input flex items-center justify-between gap-2 text-left',
          !selected && 'text-[var(--text-dim)]',
          open && 'border-[var(--accent)] ring-4 ring-[var(--accent-soft)]',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <IconChevronDown className={clsx('h-4 w-4 shrink-0 text-[var(--text-dim)] transition', open && 'rotate-180')} />
      </button>

      {open && rect && (
        <div
          ref={popRef}
          role="listbox"
          onKeyDown={onListKey}
          style={{
            position: 'fixed',
            top: rect.drop === 'down' ? rect.top : undefined,
            bottom: rect.drop === 'up' ? window.innerHeight - rect.top : undefined,
            left: rect.left,
            width: Math.max(rect.width, 200),
            // Au-dessus des modales (z-80) : un Select cherchable peut vivre dans une modale.
            zIndex: 90,
          }}
          className="flex max-h-[min(20rem,60vh)] flex-col overflow-hidden rounded-lg border border-[var(--outline)] bg-[var(--surface)] shadow-elevation-3"
        >
          {showSearch && (
            <div className="relative shrink-0 border-b border-[var(--outline)] p-1.5">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                ref={searchRef}
                className="h-8 w-full rounded-md bg-[var(--surface-2)] pl-8 pr-2 text-sm outline-none placeholder:text-[var(--text-dim)]"
                placeholder="Rechercher…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={onListKey}
              />
            </div>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto p-1">
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(o.value)}
                    className={clsx(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition',
                      i === activeIdx && 'bg-[var(--surface-2)]',
                      isSel && 'font-semibold text-[var(--accent-strong)]',
                    )}
                  >
                    {o.icon}
                    <span className="min-w-0 flex-1 truncate">
                      {o.label}
                      {o.hint && <span className="ml-1 text-2xs text-[var(--text-dim)]">{o.hint}</span>}
                    </span>
                    {isSel && <IconTick className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-2.5 py-3 text-center text-xs text-[var(--text-dim)]">Aucun resultat</li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
