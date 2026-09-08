import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import {
  addDays,
  addMonths,
  fmtDayLong,
  fmtMonthYear,
  fmtWeekRange,
  monthGrid,
  startOfDay,
  startOfWeek,
  weekDays,
} from '@/lib/date';
import type { Calendar as Cal, CalendarEvent } from '@/lib/types';
import { IconMenu, IconCalendar, IconPrev, IconNext, IconSearch, IconAdd } from '@/lib/icons';
import MiniMonth from '@/components/calendar/MiniMonth';
import TimeGridView from '@/components/calendar/TimeGridView';
import MonthView from '@/components/calendar/MonthView';
import EventDialog from '@/components/calendar/EventDialog';

type View = 'day' | 'week' | 'month';

const VIEW_LABEL: Record<View, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

export default function CalendarPage() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const dlg = useDialog();
  const isDesktop = useIsDesktop();

  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week',
  );
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [live, setLive] = useState(false);
  const [dialog, setDialog] = useState<
    { mode: 'edit'; event: CalendarEvent } | { mode: 'create'; start: Date; end: Date } | null
  >(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
    if (view === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 7) };
    const grid = monthGrid(anchor);
    return { from: grid[0], to: addDays(grid[41], 1) };
  }, [view, anchor]);

  const calendars = useQuery({
    queryKey: ['calendars', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Cal[]>('/calendar/calendars', { params: { workspaceId: current!.id } })).data,
  });

  const events = useQuery({
    queryKey: ['events', current?.id, range.from.toISOString(), range.to.toISOString()],
    enabled: !!current,
    queryFn: async () =>
      (
        await api.get<CalendarEvent[]>('/calendar/events', {
          params: { workspaceId: current!.id, from: range.from.toISOString(), to: range.to.toISOString() },
        })
      ).data,
  });

  // --- Temps reel : synchronisation des evenements via WebSocket ----------
  useEffect(() => {
    if (!current) return;
    const socket = getSocket();
    const subscribe = () => {
      socket.emit('calendar:subscribe', current.id);
      setLive(true);
    };
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onChanged = () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['calendars'] });
    };
    socket.on('calendar:changed', onChanged);
    socket.on('disconnect', () => setLive(false));

    return () => {
      socket.emit('calendar:unsubscribe', current.id);
      socket.off('connect', subscribe);
      socket.off('calendar:changed', onChanged);
      setLive(false);
    };
  }, [current, qc]);

  const hiddenCalendarIds = useMemo(
    () => new Set((calendars.data ?? []).filter((c) => !c.isVisible).map((c) => c.id)),
    [calendars.data],
  );

  const visibleEvents = useMemo(() => {
    let list = (events.data ?? []).filter((e) => !hiddenCalendarIds.has(e.calendarId));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q));
    }
    return list;
  }, [events.data, hiddenCalendarIds, search]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['events'] });
    setDialog(null);
  }

  function move(dir: -1 | 1) {
    if (view === 'day') setAnchor((d) => addDays(d, dir));
    else if (view === 'week') setAnchor((d) => addDays(d, dir * 7));
    else setAnchor((d) => addMonths(d, dir));
  }

  async function toggleCalendar(cal: Cal) {
    qc.setQueryData<Cal[]>(['calendars', current?.id], (old) =>
      (old ?? []).map((c) => (c.id === cal.id ? { ...c, isVisible: !c.isVisible } : c)),
    );
    await api.patch(`/calendar/calendars/${cal.id}`, { isVisible: !cal.isVisible });
  }

  async function addCalendar() {
    const name = await dlg.prompt({
      title: 'Nouvel agenda',
      label: 'Nom',
      placeholder: 'Ex : Projet WASH',
      confirmLabel: 'Creer',
    });
    if (!name?.trim() || !current) return;
    await api.post('/calendar/calendars', { workspaceId: current.id, name: name.trim() });
    calendars.refetch();
  }

  function openCreate(start: Date, minutes = 60) {
    setDialog({ mode: 'create', start, end: new Date(start.getTime() + minutes * 60_000) });
  }

  const title =
    view === 'day' ? fmtDayLong(anchor) : view === 'week' ? fmtWeekRange(anchor) : fmtMonthYear(anchor);

  const days = view === 'day' ? [anchor] : weekDays(anchor);

  return (
    <div className="flex h-full flex-col">
      {/* ---------- Toolbar agenda ---------- */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button className="icon-btn" onClick={() => setSidebarOpen((v) => !v)} aria-label="Panneau lateral">
          <IconMenu className="h-6 w-6" />
        </button>
        <IconCalendar className="h-7 w-7 text-brand-600" />
        <span className="hidden text-[20px] font-normal text-slate-700 dark:text-slate-200 sm:inline">Agenda</span>
        <span
          className={`h-2 w-2 rounded-full ${live ? 'bg-brand-500' : 'bg-slate-300'}`}
          title={live ? 'Synchronisation temps reel active' : 'Hors ligne'}
        />

        <button className="btn-outlined ml-2 h-9" onClick={() => setAnchor(startOfDay(new Date()))}>
          Aujourd'hui
        </button>

        <div className="flex items-center">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Precedent">
            <IconPrev className="h-6 w-6" />
          </button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Suivant">
            <IconNext className="h-6 w-6" />
          </button>
        </div>

        <h1 className="text-base font-normal capitalize text-slate-800 dark:text-slate-100 sm:text-[22px]">{title}</h1>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="input h-10 w-60 pl-10"
              placeholder="Rechercher"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input h-10 w-32" value={view} onChange={(e) => setView(e.target.value as View)}>
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <option key={v} value={v}>
                {VIEW_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---------- Corps ---------- */}
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && !isDesktop && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        {sidebarOpen && (
          <aside
            className="z-30 flex w-64 shrink-0 flex-col gap-5 overflow-y-auto bg-[var(--bg)] p-3
                       max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:border-r max-lg:border-[var(--outline)] max-lg:shadow-elevation-3"
          >
            <button className="fab w-fit" onClick={() => openCreate(nextHour())}>
              <span className="grid h-8 w-8 place-items-center rounded-full">
                <IconAdd className="h-6 w-6 text-brand-600" />
              </span>
              Creer
            </button>

            <MiniMonth
              selected={anchor}
              onSelect={(d) => {
                setAnchor(startOfDay(d));
                if (view === 'month') setView('day');
              }}
            />

            <div>
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Mes agendas</span>
                <button className="icon-btn-sm" onClick={addCalendar} aria-label="Ajouter un agenda">
                  <IconAdd className="h-4 w-4" />
                </button>
              </div>
              <ul className="space-y-0.5">
                {calendars.data?.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={c.isVisible}
                        onChange={() => toggleCalendar(c)}
                        className="h-4 w-4 rounded"
                        style={{ accentColor: c.color }}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* ---------- Vue principale ---------- */}
        <div className="m-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--outline)] surface">
          {events.isError && (
            <div className="bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/60">
              Impossible de charger les evenements
            </div>
          )}
          {view === 'month' ? (
            <MonthView
              anchor={anchor}
              events={visibleEvents}
              onSelectEvent={(e) => setDialog({ mode: 'edit', event: e })}
              onCreateAt={(start) => openCreate(start)}
              onPickDay={(d) => {
                setAnchor(startOfDay(d));
                setView('day');
              }}
            />
          ) : (
            <TimeGridView
              days={days}
              events={visibleEvents}
              onSelectEvent={(e) => setDialog({ mode: 'edit', event: e })}
              onCreateAt={(start) => openCreate(start)}
            />
          )}
        </div>
      </div>

      {dialog && calendars.data && (
        <EventDialog
          calendars={calendars.data}
          event={dialog.mode === 'edit' ? dialog.event : null}
          draft={dialog.mode === 'create' ? { start: dialog.start, end: dialog.end } : null}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
