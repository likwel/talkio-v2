import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProfile } from '@/context/ProfileContext';
import { useDialog } from '@/context/DialogContext';
import type { WorkspaceDetail } from '@/lib/types';
import { IconClose } from '@/lib/icons';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('');

export default function WorkspaceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current, reload } = useWorkspace();
  const { openProfile } = useProfile();
  const dialog = useDialog();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (current) {
      setName(current.name);
      setColor(current.color ?? null);
    }
  }, [current?.id, open]);

  const detail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: open && !!current,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });

  async function save() {
    if (!current) return;
    await api.patch(`/workspaces/${current.id}`, { name: name.trim(), color });
    await reload();
    onClose();
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!current || !email.trim()) return;
    setErr('');
    try {
      await api.post(`/workspaces/${current.id}/members`, { email: email.trim().toLowerCase() });
      setEmail('');
      detail.refetch();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Echec');
    }
  }

  async function removeMember(uid: string, fullName: string) {
    if (!current) return;
    const ok = await dialog.confirm({
      title: 'Retirer le membre',
      message: `${fullName} n'aura plus acces a « ${current.name} ».`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (ok) {
      await api.delete(`/workspaces/${current.id}/members/${uid}`);
      detail.refetch();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Parametres de l'espace"
      footer={
        <>
          <button className="btn-text" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-primary" onClick={save}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Nom</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">
            Couleur du theme (accent quand l'espace est actif)
          </span>
          <ColorPicker value={color} onChange={setColor} allowNone />
        </div>

        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
            Membres ({detail.data?.members.length ?? 0})
          </div>
          <form onSubmit={addMember} className="mb-2 flex gap-2">
            <input
              className="input h-9"
              type="email"
              placeholder="Inviter par email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-tonal h-9 shrink-0">Inviter</button>
          </form>
          {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-950/50">{err}</div>}
          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {detail.data?.members.map((m) => (
              <li key={m.user.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm">
                <button onClick={() => openProfile(m.user.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-2xs font-bold text-white"
                    style={{ background: tint(m.user.id) }}
                  >
                    {initials(m.user.fullName)}
                  </span>
                  <span className="min-w-0 truncate">{m.user.fullName}</span>
                  <span className="chip shrink-0 text-2xs">{m.role}</span>
                </button>
                {m.role !== 'OWNER' && (
                  <button
                    className="icon-btn-sm text-red-500"
                    title="Retirer"
                    onClick={() => removeMember(m.user.id, m.user.fullName)}
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
