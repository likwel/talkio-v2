import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import type { Channel, FormDef } from '@/lib/types';
import Modal from '@/components/Modal';
import { IconSearch, IconHash, IconGroups, IconTick, IconForms } from '@/lib/icons';

/** Partage d'un formulaire : le publié comme carte dans un salon ou un message direct. */
export default function ShareFormModal({
  form,
  onClose,
  onShared,
}: {
  form: FormDef | null;
  onClose: () => void;
  onShared?: () => void;
}) {
  const { workspaces } = useWorkspace();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wsIds = workspaces.map((w) => w.id);
  const channels = useQuery({
    queryKey: ['channels-all', wsIds],
    enabled: !!form && wsIds.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(
        workspaces.map(async (w) => {
          const r = await api.get<Channel[]>('/channels', { params: { workspaceId: w.id } });
          return r.data.map((c) => ({ c, wsName: w.name }));
        }),
      );
      return lists.flat();
    },
  });

  const chanName = (c: Channel) =>
    c.type !== 'DIRECT'
      ? `# ${c.name ?? 'salon'}`
      : (c.members ?? [])
          .filter((m) => m.userId !== user?.id)
          .map((m) => m.user.fullName.split(' ')[0])
          .join(', ') || 'Message direct';

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (channels.data ?? []).filter(
      ({ c, wsName }) =>
        !s || chanName(c).toLowerCase().includes(s) || wsName.toLowerCase().includes(s),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.data, q, user?.id]);

  async function shareTo(c: Channel) {
    if (!form || busy) return;
    setBusy(true);
    try {
      await api.post('/messages', { channelId: c.id, formId: form.id });
      setSentTo(c.id);
      onShared?.();
      setTimeout(() => {
        setSentTo(null);
        onClose();
      }, 700);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!form} onClose={onClose} title="Partager le formulaire">
      <div className="mb-3 flex items-center gap-2.5 rounded-lg border-l-2 border-[var(--accent)] bg-[var(--surface-2)] px-3 py-2 text-sm">
        <IconForms className="h-5 w-5 shrink-0 text-[var(--accent)]" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{form?.title}</span>
          <span className="block text-2xs text-[var(--text-dim)]">
            {form?.status === 'PUBLISHED' ? 'Publié' : form?.status === 'CLOSED' ? 'Fermé' : 'Brouillon'} ·{' '}
            {form?._count?.fields ?? form?.fields?.length ?? 0} champ(s)
          </span>
        </span>
      </div>

      <div className="relative mb-2">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          autoFocus
          className="input pl-9"
          placeholder="Rechercher un salon ou une conversation…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {list.map(({ c, wsName }) => (
          <li key={c.id}>
            <button
              disabled={busy}
              onClick={() => shareTo(c)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">
                {c.type !== 'DIRECT' ? (
                  <IconHash className="h-3.5 w-3.5" />
                ) : (
                  <IconGroups className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{chanName(c)}</span>
                <span className="block truncate text-2xs text-[var(--text-dim)]">{wsName}</span>
              </span>
              {sentTo === c.id && <IconTick className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
            </button>
          </li>
        ))}
        {channels.isLoading && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">Chargement…</li>
        )}
        {!channels.isLoading && list.length === 0 && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">Aucun salon</li>
        )}
      </ul>
    </Modal>
  );
}
