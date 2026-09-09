import { FormEvent, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProfile } from '@/context/ProfileContext';
import { useDialog } from '@/context/DialogContext';
import type { WorkspaceDetail } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { IconClose, IconImage } from '@/lib/icons';

const MAX_IMG = 1024 * 1024; // 1 Mo

export default function WorkspaceSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current, reload } = useWorkspace();
  const { openProfile } = useProfile();
  const dialog = useDialog();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [imgErr, setImgErr] = useState('');
  const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (current) {
      setName(current.name);
      setColor(current.color ?? null);
      setImgErr('');
    }
  }, [current?.id, open]);

  const detail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: open && !!current,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });

  const imageUrl = detail.data?.imageUrl ?? current?.imageUrl ?? null;

  async function save() {
    if (!current) return;
    await api.patch(`/workspaces/${current.id}`, { name: name.trim(), color });
    await reload();
    onClose();
  }

  async function pickImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || !current) return;
    setImgErr('');
    if (!file.type.startsWith('image/')) {
      setImgErr('Fichier image attendu (PNG, JPG, WebP…).');
      return;
    }
    if (file.size > MAX_IMG) {
      setImgErr('L’image dépasse la limite de 1 Mo.');
      return;
    }
    setImgBusy(true);
    try {
      const up = await api.post<{ url: string }>('/uploads', file, {
        headers: { 'Content-Type': file.type },
        params: { name: file.name },
      });
      await api.patch(`/workspaces/${current.id}`, { imageUrl: up.data.url });
      await Promise.all([reload(), detail.refetch()]);
    } catch {
      setImgErr('Échec de l’envoi.');
    } finally {
      setImgBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeImage() {
    if (!current) return;
    setImgBusy(true);
    try {
      await api.patch(`/workspaces/${current.id}`, { imageUrl: null });
      await Promise.all([reload(), detail.refetch()]);
    } finally {
      setImgBusy(false);
    }
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
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">
            Photo de l’espace (1 Mo max)
          </span>
          <div className="flex items-center gap-3">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--surface-2)] text-sm font-bold text-[var(--text-dim)]"
            >
              {imageUrl ? (
                <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <IconImage className="h-6 w-6" />
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-tonal h-9"
                disabled={imgBusy}
                onClick={() => fileRef.current?.click()}
              >
                {imgBusy ? 'Envoi…' : imageUrl ? 'Remplacer' : 'Ajouter une photo'}
              </button>
              {imageUrl && (
                <button type="button" className="btn-text h-9 text-red-500" disabled={imgBusy} onClick={removeImage}>
                  Retirer
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files)}
            />
          </div>
          {imgErr && (
            <div className="mt-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-950/50">
              {imgErr}
            </div>
          )}
        </div>

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
                  <Avatar id={m.user.id} name={m.user.fullName} src={m.user.avatarUrl} size={28} />
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
