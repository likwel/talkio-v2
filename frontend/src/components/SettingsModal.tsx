import { FormEvent, ReactNode, useEffect, useState } from 'react';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemePref } from '@/context/ThemeContext';
import { useDialog } from '@/context/DialogContext';
import StatusPicker from '@/components/StatusPicker';
import {
  IconPerson,
  IconPalette,
  IconShield,
  IconLogout,
  IconTick,
  IconLight,
  IconDark,
  IconToday,
} from '@/lib/icons';

export type SettingsTab = 'profil' | 'apparence' | 'securite' | 'compte';
type Tab = SettingsTab;

const TABS: { id: Tab; label: string; Icon: typeof IconPerson }[] = [
  { id: 'profil', label: 'Profil', Icon: IconPerson },
  { id: 'apparence', label: 'Apparence', Icon: IconPalette },
  { id: 'securite', label: 'Securite', Icon: IconShield },
  { id: 'compte', label: 'Compte', Icon: IconLogout },
];

export default function SettingsModal({
  open,
  onClose,
  initialTab = 'profil',
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Parametres">
      <div className="flex min-h-[300px] flex-col gap-4 sm:min-h-[380px] sm:flex-row sm:gap-5">
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition sm:w-full',
                tab === id
                  ? 'accent-active'
                  : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 border-t border-[var(--outline)] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          {tab === 'profil' && <ProfileTab />}
          {tab === 'apparence' && <AppearanceTab />}
          {tab === 'securite' && <SecurityTab />}
          {tab === 'compte' && <AccountTab onClose={onClose} />}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">{label}</span>
      {children}
    </label>
  );
}

function Notice({ kind, children }: { kind: 'ok' | 'err'; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'rounded-lg px-3 py-2 text-sm',
        kind === 'ok'
          ? 'bg-brand-50 text-brand-700 dark:bg-[var(--accent-soft)] dark:text-brand-200'
          : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
      )}
    >
      {children}
    </div>
  );
}

function ProfileTab() {
  const { user, patchUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.patch('/auth/me', { fullName, avatarUrl: avatarUrl || null });
      patchUser(r.data);
      setMsg({ kind: 'ok', text: 'Profil mis a jour.' });
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.response?.data?.error ?? 'Echec de la mise a jour' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <StatusPicker />
      <form onSubmit={save} className="space-y-4">
        <h3 className="font-display text-md font-bold">Profil</h3>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <Field label="Nom complet">
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} required />
      </Field>
      <Field label="URL de l'avatar (optionnel)">
        <input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Email">
        <input className="input opacity-60" value={user?.email ?? ''} disabled />
      </Field>
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}

function AppearanceTab() {
  const { pref, setPref, accent, setAccent } = useTheme();
  const opts: { id: ThemePref; label: string; Icon: typeof IconLight }[] = [
    { id: 'light', label: 'Clair', Icon: IconLight },
    { id: 'dark', label: 'Sombre', Icon: IconDark },
    { id: 'system', label: 'Systeme', Icon: IconToday },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-md font-bold">Theme</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {opts.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPref(id)}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition',
                pref === id
                  ? 'border-[var(--accent)] accent-active'
                  : 'border-[var(--outline)] text-[var(--text-dim)] hover:bg-black/5 dark:hover:bg-white/5',
              )}
            >
              <Icon className="h-6 w-6" />
              {label}
              {pref === id && <IconTick className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-md font-bold">Couleur d'accent</h3>
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          Appliquee a toute l'interface (sauf si un espace impose sa propre couleur).
        </p>
        <ColorPicker value={accent} onChange={(hex) => setAccent(hex ?? '#0cae36')} />
      </div>
    </div>
  );
}

function SecurityTab() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ kind: 'err', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setMsg({ kind: 'ok', text: 'Mot de passe modifie. Vos autres sessions ont ete deconnectees.' });
      setCur('');
      setNext('');
      setConfirm('');
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.response?.data?.error ?? 'Echec de la modification' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-display text-md font-bold">Securite</h3>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <Field label="Mot de passe actuel">
        <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      </Field>
      <Field label="Nouveau mot de passe (8 caracteres min.)">
        <input
          className="input"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      <Field label="Confirmer le nouveau mot de passe">
        <input
          className="input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Modification…' : 'Modifier le mot de passe'}
      </button>
    </form>
  );
}

function AccountTab({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const dialog = useDialog();

  async function doLogout() {
    const ok = await dialog.confirm({
      title: 'Se deconnecter',
      message: 'Vous devrez vous reconnecter pour acceder a Talkio.',
      confirmLabel: 'Se deconnecter',
      danger: true,
    });
    if (ok) {
      onClose();
      logout();
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-md font-bold">Compte</h3>
      <div className="rounded-xl border border-[var(--outline)] p-4 text-sm">
        <div className="font-semibold">{user?.fullName}</div>
        <div className="text-[var(--text-dim)]">{user?.email}</div>
      </div>
      <button onClick={doLogout} className="btn-danger">
        <IconLogout className="h-4 w-4" /> Se deconnecter
      </button>
    </div>
  );
}
