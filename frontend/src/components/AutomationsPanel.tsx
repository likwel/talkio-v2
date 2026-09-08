import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import type { Automation, Board, Channel } from '@/lib/types';
import { IconAdd, IconClose, IconForward } from '@/lib/icons';

const TRIGGERS: { id: Automation['triggerType']; label: string }[] = [
  { id: 'form.response.created', label: 'Une reponse de formulaire est envoyee' },
  { id: 'card.moved.done', label: 'Une tache passe en « Termine »' },
  { id: 'meal.measurement.created', label: 'Une mesure MEAL est enregistree' },
  { id: 'message.keyword', label: 'Un message contient un mot-cle' },
];
const ACTIONS: { id: Automation['actionType']; label: string }[] = [
  { id: 'message.post', label: 'Publier un message dans un salon' },
  { id: 'card.create', label: 'Creer une tache dans un projet' },
];

export default function AutomationsPanel() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const dialog = useDialog();
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ['automations', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Automation[]>('/automations', { params: { workspaceId: current!.id } })).data,
  });
  const channels = useQuery({
    queryKey: ['channels', current?.id],
    enabled: !!current && creating,
    queryFn: async () => (await api.get<Channel[]>('/channels', { params: { workspaceId: current!.id } })).data,
  });
  const boards = useQuery({
    queryKey: ['boards-full', current?.id],
    enabled: !!current && creating,
    queryFn: async () => {
      const bs = (await api.get<Board[]>('/boards', { params: { workspaceId: current!.id } })).data;
      const full = await Promise.all(bs.map((b) => api.get<Board>(`/boards/${b.id}`).then((r) => r.data)));
      return full;
    },
  });

  async function toggle(a: Automation) {
    await api.patch(`/automations/${a.id}`, { enabled: !a.enabled });
    qc.invalidateQueries({ queryKey: ['automations'] });
  }
  async function remove(a: Automation) {
    const ok = await dialog.confirm({ title: 'Supprimer', message: `« ${a.name} » ?`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/automations/${a.id}`);
      qc.invalidateQueries({ queryKey: ['automations'] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-bold">Automatisation</h3>
          <p className="text-sm text-[var(--text-dim)]">
            Reliez messagerie, projet, MEAL et collecte : quand un evenement se produit, une action est declenchee.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreating((v) => !v)}>
          <IconAdd className="h-4 w-4" /> Regle
        </button>
      </div>

      {creating && (
        <CreateForm
          channels={channels.data ?? []}
          boards={boards.data ?? []}
          onDone={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['automations'] });
          }}
        />
      )}

      <ul className="space-y-2">
        {list.data?.map((a) => (
          <li key={a.id} className="rounded-xl border border-[var(--outline)] p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggle(a)}
                className={clsx(
                  'relative h-5 w-9 shrink-0 rounded-full transition',
                  a.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--outline)]',
                )}
                aria-label="Activer"
              >
                <span
                  className={clsx(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                    a.enabled ? 'left-4' : 'left-0.5',
                  )}
                />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
              <span className="text-[11px] text-[var(--text-dim)]">{a.runCount}x</span>
              <button className="icon-btn-sm text-red-500" onClick={() => remove(a)} title="Supprimer">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-dim)]">
              <span className="chip">{TRIGGERS.find((t) => t.id === a.triggerType)?.label ?? a.triggerType}</span>
              <IconForward className="h-3.5 w-3.5" />
              <span className="chip">{ACTIONS.find((x) => x.id === a.actionType)?.label ?? a.actionType}</span>
            </div>
          </li>
        ))}
        {list.data?.length === 0 && !creating && (
          <li className="rounded-xl border border-dashed border-[var(--outline)] py-6 text-center text-sm text-[var(--text-dim)]">
            Aucune automatisation. Creez votre premiere regle.
          </li>
        )}
      </ul>
    </div>
  );
}

function CreateForm({
  channels,
  boards,
  onDone,
}: {
  channels: Channel[];
  boards: Board[];
  onDone: () => void;
}) {
  const { current } = useWorkspace();
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<Automation['triggerType']>('form.response.created');
  const [keyword, setKeyword] = useState('');
  const [actionType, setActionType] = useState<Automation['actionType']>('message.post');
  const [channelId, setChannelId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [template, setTemplate] = useState('{{summary}}');
  const [busy, setBusy] = useState(false);

  const columns = useMemo(
    () => boards.flatMap((b) => (b.columns ?? []).map((c) => ({ id: c.id, label: `${b.name} › ${c.name}` }))),
    [boards],
  );

  async function submit() {
    if (!current || !name.trim()) return;
    setBusy(true);
    try {
      await api.post('/automations', {
        workspaceId: current.id,
        name: name.trim(),
        triggerType,
        triggerConfig: triggerType === 'message.keyword' ? { keyword: keyword.trim() } : {},
        actionType,
        actionConfig:
          actionType === 'message.post'
            ? { channelId, template }
            : { columnId, titleTemplate: template },
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--outline)] bg-[var(--surface-2)] p-3">
      <input className="input" placeholder="Nom de la regle" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        Quand…
        <select className="input mt-1" value={triggerType} onChange={(e) => setTriggerType(e.target.value as any)}>
          {TRIGGERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {triggerType === 'message.keyword' && (
        <input className="input" placeholder="Mot-cle (ex: #tache)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      )}

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        Alors…
        <select className="input mt-1" value={actionType} onChange={(e) => setActionType(e.target.value as any)}>
          {ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {actionType === 'message.post' ? (
        <select className="input" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          <option value="">Choisir un salon…</option>
          {channels
            .filter((c) => c.type !== 'DIRECT')
            .map((c) => (
              <option key={c.id} value={c.id}>
                # {c.name}
              </option>
            ))}
        </select>
      ) : (
        <select className="input" value={columnId} onChange={(e) => setColumnId(e.target.value)}>
          <option value="">Choisir une colonne…</option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}

      <label className="block text-xs font-semibold text-[var(--text-dim)]">
        {actionType === 'message.post' ? 'Message' : 'Titre de la tache'}
        <input className="input mt-1" value={template} onChange={(e) => setTemplate(e.target.value)} />
        <span className="mt-1 block font-normal text-[var(--text-dim)]">
          Jetons : <code>{'{{summary}}'}</code>, <code>{'{{author}}'}</code>, <code>{'{{form.title}}'}</code>,{' '}
          <code>{'{{card.title}}'}</code>, <code>{'{{indicator.name}}'}</code>
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <button className="btn-text" onClick={onDone}>
          Annuler
        </button>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={
            busy ||
            !name.trim() ||
            (actionType === 'message.post' && !channelId) ||
            (actionType === 'card.create' && !columnId)
          }
        >
          Creer
        </button>
      </div>
    </div>
  );
}
