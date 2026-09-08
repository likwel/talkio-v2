import { useState } from 'react';
import { addMonths, fmtMonthYear, isSameDay, isToday, monthGrid, startOfMonth } from '@/lib/date';
import { IconPrev, IconNext } from '@/lib/icons';

interface Props {
  selected: Date;
  onSelect: (d: Date) => void;
}

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function MiniMonth({ selected, onSelect }: Props) {
  const [cursor, setCursor] = useState(startOfMonth(selected));
  const grid = monthGrid(cursor);

  return (
    <div className="select-none px-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="pl-1 text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
          {fmtMonthYear(cursor)}
        </span>
        <div className="flex">
          <button className="icon-btn-sm" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mois precedent">
            <IconPrev className="h-4 w-4" />
          </button>
          <button className="icon-btn-sm" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mois suivant">
            <IconNext className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] text-slate-400">
        {WEEK_LABELS.map((l, i) => (
          <span key={i} className="py-1">
            {l}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center text-xs">
        {grid.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const sel = isSameDay(d, selected);
          const today = isToday(d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={[
                'mx-auto my-0.5 grid h-7 w-7 place-items-center rounded-full transition',
                inMonth ? '' : 'text-slate-300 dark:text-slate-600',
                sel
                  ? 'bg-brand-600 font-medium text-white'
                  : today
                    ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                    : 'hover:bg-black/5 dark:hover:bg-white/10',
              ].join(' ')}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
