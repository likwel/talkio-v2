import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { IconPrev, IconNext } from '@/lib/icons';

/**
 * Pagination cote client. `slice` = elements de la page courante.
 * Se remet a la page 1 quand la cle de dependance change (filtre, recherche…).
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  const slice = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return { page, setPage, pageCount, slice, start, end: start + slice.length, total: items.length };
}

/** Suite de pages avec ellipses : 1 … 4 5 6 … 20 */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const s = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => s.add(n));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => s.add(n));
  const nums = [...s].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

export default function Pagination({
  page,
  pageCount,
  onChange,
  total,
  start,
  end,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
  total?: number;
  start?: number;
  end?: number;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className={clsx('flex flex-wrap items-center justify-between gap-2 pt-1', className)}>
      {total != null && (
        <span className="text-2xs text-[var(--text-dim)]">
          {(start ?? 0) + 1}–{end ?? total} sur {total}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="icon-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Page precedente"
        >
          <IconPrev className="h-5 w-5" />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1 text-sm text-[var(--text-dim)]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={clsx(
                'h-8 min-w-[32px] rounded-md px-2 text-sm transition',
                p === page
                  ? 'accent-active font-semibold'
                  : 'text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="icon-btn"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          aria-label="Page suivante"
        >
          <IconNext className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
