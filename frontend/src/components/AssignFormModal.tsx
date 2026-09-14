import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { FormAssignee, FormDef, User } from '@/lib/types';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import { IconSearch, IconClose, IconTick, IconPersonAdd } from '@/lib/icons';

function statusLabel(a: FormAssignee): string {
  if (a.status === 'DECLINED') return 'A refusé l’invitation';
  if (a.status !== 'ACCEPTED') return 'Invitation en attente d’acceptation';
  if (a.respondedAt) return `A répondu le ${new Date(a.respondedAt).toLocaleDateString('fr-FR')}`;
  return 'A accepté — en attente de réponse';
}

/** Attribuer un formulaire a des utilisateurs : ils le recoivent (notification + message). */
export default function AssignFormModal({
  form,
  onClose,
  onChanged,
}: {
  form: FormDef | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['form', form?.id, 'assignees'],
    enabled: !!form,
    queryFn: async () => (await api.get<FormDef>(`/forms/${form!.id}`)).data,
  });
  const members = useQuery({
    queryKey: ['form-assignable', form?.id],
    enabled: !!form,
    queryFn: async () => (await api.get<User[]>(`/forms/${form!.id}/assignable`)).data,
  });

  const assignees: FormAssignee[] = detail.data?.assignees ?? [];
  const assignedIds = new Set(assignees.map((a) => a.userId));

  const candidates = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (members.data ?? [])
      .filter((u) => !assignedIds.has(u.id))
      .filter((u) => !s || u.fullName.toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.data, q, assignees]);

  async function assign(userId: string) {
    if (!form || busy) return;
    setBusy(userId);
    try {
      await api.post(`/forms/${form.id}/assignees`, { userIds: [userId] });
      await detail.refetch();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }
  async function unassign(userId: string) {
    if (!form || busy) return;
    setBusy(userId);
    try {
      await api.delete(`/forms/${form.id}/assignees/${userId}`);
      await detail.refetch();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={!!form} onClose={onClose} title="Attribuer le formulaire">
      <p className="mb-3 text-sm text-[var(--text-dim)]">
        Les personnes choisies recoivent une <span className="font-semibold">invitation</span> a
        remplir <span className="font-semibold">« {form?.title} »</span>. Après acceptation, elles
        rejoignent l’espace (en invite si besoin), recoivent la carte du formulaire dans leur
        messagerie et le voient dans « Attribués a moi ».
      </p>

      {assignees.length > 0 && (
        <ul className="mb-3 space-y-1">
          {assignees.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-lg bg-[var(--surface-2)] px-2 py-1.5">
              <Avatar id={a.user.id} name={a.user.fullName} src={a.user.avatarUrl} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.user.fullName}</span>
                <span className="block truncate text-2xs text-[var(--text-dim)]">{statusLabel(a)}</span>
              </span>
              {a.respondedAt && <IconTick className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
              <button
                className="icon-btn-sm text-red-500"
                title="Retirer"
                disabled={busy === a.userId}
                onClick={() => unassign(a.userId)}
              >
                <IconClose className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative mb-2">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          autoFocus
          className="input pl-9"
          placeholder="Rechercher un membre ou un ami…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="max-h-64 space-y-0.5 overflow-y-auto">
        {candidates.map((u) => (
          <li key={u.id}>
            <button
              disabled={busy === u.id}
              onClick={() => assign(u.id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <Avatar id={u.id} name={u.fullName} src={u.avatarUrl} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {u.fullName}
                  {u.id === user?.id && ' (moi)'}
                </span>
                {u.email && <span className="block truncate text-2xs text-[var(--text-dim)]">{u.email}</span>}
              </span>
              <IconPersonAdd className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
            </button>
          </li>
        ))}
        {members.isLoading && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">Chargement…</li>
        )}
        {!members.isLoading && candidates.length === 0 && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">
            {members.data?.length ? 'Tout le monde est déjà attribué.' : 'Aucune personne disponible.'}
          </li>
        )}
      </ul>
    </Modal>
  );
}
