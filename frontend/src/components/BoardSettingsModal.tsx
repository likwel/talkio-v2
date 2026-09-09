import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import Select from '@/components/Select';
import { api } from '@/lib/api';
import { useProfile } from '@/context/ProfileContext';
import type { Board, WorkspaceDetail } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { IconAdd, IconClose } from '@/lib/icons';

export default function BoardSettingsModal({
  board,
  open,
  onClose,
  onChanged,
}: {
  board: Board;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { openProfile } = useProfile();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? '');
  const [color, setColor] = useState<string | null>(board.color ?? null);
  const [leadId, setLeadId] = useState(board.leadId ?? '');
  const [start, setStart] = useState(board.startDate?.slice(0, 10) ?? '');
  const [end, setEnd] = useState(board.endDate?.slice(0, 10) ?? '');

  useEffect(() => {
    if (open) {
      setName(board.name);
      setDescription(board.description ?? '');
      setColor(board.color ?? null);
      setLeadId(board.leadId ?? '');
      setStart(board.startDate?.slice(0, 10) ?? '');
      setEnd(board.endDate?.slice(0, 10) ?? '');
    }
  }, [open, board]);

  const wsDetail = useQuery({
    queryKey: ['workspace', board.workspaceId],
    enabled: open && !!board.workspaceId,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${board.workspaceId}`)).data,
  });
  const memberIds = new Set((board.members ?? []).map((m) => m.user.id));

  async function save() {
    await api.patch(`/boards/${board.id}`, {
      name: name.trim(),
      description: description.trim() || null,
      color,
      leadId: leadId || null,
      startDate: start || null,
      endDate: end || null,
    });
    onChanged();
    onClose();
  }
  async function addMember(uid: string) {
    await api.post(`/boards/${board.id}/members`, { userIds: [uid] });
    onChanged();
  }
  async function removeMember(uid: string) {
    await api.delete(`/boards/${board.id}/members/${uid}`);
    onChanged();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Paramètres du projet"
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
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Description</span>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Début</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Échéance</span>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Chef de projet</span>
          <Select
            value={leadId}
            onChange={setLeadId}
            options={[
              { value: '', label: 'Aucun' },
              ...(wsDetail.data?.members ?? []).map((m) => ({ value: m.user.id, label: m.user.fullName })),
            ]}
          />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">Couleur</span>
          <ColorPicker value={color} onChange={setColor} allowNone />
        </div>

        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
            Équipe ({board.members?.length ?? 0})
          </div>
          <ul className="mb-2 space-y-0.5">
            {(board.members ?? []).map((m) => (
              <li key={m.user.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm">
                <button onClick={() => openProfile(m.user.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <Avatar id={m.user.id} name={m.user.fullName} src={m.user.avatarUrl} size={28} />
                  <span className="truncate">{m.user.fullName}</span>
                </button>
                <button className="icon-btn-sm text-red-500" onClick={() => removeMember(m.user.id)} title="Retirer">
                  <IconClose className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-[var(--outline)]">
            {wsDetail.data?.members
              .filter((m) => !memberIds.has(m.user.id))
              .map((m) => (
                <button
                  key={m.user.id}
                  onClick={() => addMember(m.user.id)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                >
                  <IconAdd className="h-4 w-4 text-[var(--text-dim)]" /> {m.user.fullName}
                </button>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
