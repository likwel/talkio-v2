import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toLocalInput } from '@/lib/date';
import type { Calendar, CalendarEvent } from '@/lib/types';
import { IconDelete, IconClose } from '@/lib/icons';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';

interface Props {
  calendars: Calendar[];
  event: CalendarEvent | null;
  /** Valeurs initiales quand on cree depuis un clic sur la grille. */
  draft: { start: Date; end: Date } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventDialog({ calendars, event, draft, onClose, onSaved }: Props) {
  const editing = !!event;
  const dialog = useDialog();
  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setCalendarId(event.calendarId);
      setStart(toLocalInput(new Date(event.startsAt)));
      setEnd(toLocalInput(new Date(event.endsAt)));
      setAllDay(event.allDay);
      setLocation(event.location ?? '');
      setDescription(event.description ?? '');
    } else if (draft) {
      setTitle('');
      setCalendarId(calendars.find((c) => c.isDefault)?.id ?? calendars[0]?.id ?? '');
      setStart(toLocalInput(draft.start));
      setEnd(toLocalInput(draft.end));
      setAllDay(false);
      setLocation('');
      setDescription('');
    }
  }, [event, draft, calendars]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        calendarId,
        title,
        location: location || undefined,
        description: description || undefined,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        allDay,
      };
      if (editing) await api.patch(`/calendar/events/${event!.id}`, payload);
      else await api.post('/calendar/events', payload);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!event) return;
    const ok = await dialog.confirm({
      title: "Supprimer l'evenement",
      message: `« ${event.title} » sera definitivement supprime.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.delete(`/calendar/events/${event.id}`);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-6 shadow-elevation-3 safe-b sm:max-w-md sm:rounded-3xl sm:pb-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[var(--text)]">
            {editing ? "Modifier l'evenement" : 'Nouvel evenement'}
          </h2>
          <button type="button" className="icon-btn-sm" onClick={onClose} aria-label="Fermer">
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/60">{error}</div>
        )}

        <input
          autoFocus
          className="input text-base"
          placeholder="Ajouter un titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-[var(--text-dim)]">
            Debut
            <input
              className="input mt-1"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </label>
          <label className="text-xs font-medium text-[var(--text-dim)]">
            Fin
            <input
              className="input mt-1"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Toute la journee
        </label>

        <label className="block text-xs font-medium text-[var(--text-dim)]">
          Agenda
          <Select
            className="mt-1"
            aria-label="Agenda"
            value={calendarId}
            onChange={setCalendarId}
            options={calendars.map((c) => ({
              value: c.id,
              label: c.name,
              icon: (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: c.color }}
                />
              ),
            }))}
          />
        </label>

        <input
          className="input"
          placeholder="Lieu (optionnel)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <textarea
          className="input"
          rows={2}
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex items-center justify-between pt-1">
          {editing ? (
            <button
              type="button"
              onClick={remove}
              className="btn-text text-red-600 hover:bg-red-500/10 hover:text-red-700"
              disabled={busy}
            >
              <IconDelete className="h-4 w-4" /> Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1">
            <button type="button" className="btn-text" onClick={onClose}>
              Annuler
            </button>
            <button className="btn-primary" disabled={busy}>
              {busy ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
