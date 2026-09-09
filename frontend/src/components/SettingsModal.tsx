import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemePref } from '@/context/ThemeContext';
import { useDialog } from '@/context/DialogContext';
import { useToast } from '@/context/ToastContext';
import { useI18n, LANGS } from '@/i18n';
import { PRESENCE_OPTIONS, DOT_COLOR } from '@/context/PresenceContext';
import {
  IconPerson,
  IconPalette,
  IconShield,
  IconLogout,
  IconTick,
  IconLight,
  IconDark,
  IconToday,
  IconCamera,
  IconEye,
  IconLanguage,
} from '@/lib/icons';

const MAX_PHOTO = 1024 * 1024; // 1 Mo
const avInitials = (n?: string) =>
  (n ?? '?').split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('');

export type SettingsTab = 'profil' | 'apparence' | 'statut' | 'langue' | 'securite' | 'compte';
type Tab = SettingsTab;

const TABS: { id: Tab; key: string; Icon: typeof IconPerson }[] = [
  { id: 'profil', key: 'settings.tab.profile', Icon: IconPerson },
  { id: 'apparence', key: 'settings.tab.appearance', Icon: IconPalette },
  { id: 'statut', key: 'settings.profile.statusLabel', Icon: IconEye },
  { id: 'langue', key: 'settings.appearance.languageTitle', Icon: IconLanguage },
  { id: 'securite', key: 'settings.tab.security', Icon: IconShield },
  { id: 'compte', key: 'settings.tab.account', Icon: IconLogout },
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
  const { t } = useI18n();

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('settings.title')}>
      <div className="flex min-h-[300px] flex-col gap-4 sm:min-h-[380px] sm:flex-row sm:gap-5">
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
          {TABS.map(({ id, key, Icon }) => (
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
              {t(key)}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 border-t border-[var(--outline)] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          {tab === 'profil' && <ProfileTab />}
          {tab === 'apparence' && <AppearanceTab />}
          {tab === 'statut' && <StatusTab />}
          {tab === 'langue' && <LanguageTab />}
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

const PRESENCE_KEY: Record<string, string> = {
  ONLINE: 'presence.online',
  AWAY: 'presence.away',
  BUSY: 'presence.busy',
  INVISIBLE: 'presence.invisible',
};

/** Ligne d'option facon "radio moderne" : puce ronde + fond accentué si actif. */
function RadioRow({
  selected,
  onSelect,
  label,
  leading,
  trailing,
}: {
  selected: boolean;
  onSelect: () => void;
  label: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition',
        selected
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]'
          : 'border-[var(--outline)] hover:bg-black/5 dark:hover:bg-white/5',
      )}
    >
      <span
        className={clsx(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition',
          selected ? 'border-[var(--accent)]' : 'border-[var(--outline)]',
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />}
      </span>
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function ProfileTab() {
  const { user, patchUser } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Libère l'URL blob de l'aperçu quand elle change / au démontage.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const shownAvatar = photoPreview ?? avatarUrl;

  function pickPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Fichier image attendu.', 'error');
    if (file.size > MAX_PHOTO) return toast('La photo dépasse la limite de 1 Mo.', 'error');
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file)); // aperçu immédiat, avant sauvegarde
    if (fileRef.current) fileRef.current.value = '';
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAvatarUrl('');
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let nextAvatar: string | null = avatarUrl || null;
      if (photoFile) {
        const up = await api.post<{ url: string }>('/uploads', photoFile, {
          headers: { 'Content-Type': photoFile.type },
          params: { name: photoFile.name },
        });
        nextAvatar = up.data.url;
      }
      const r = await api.patch('/auth/me', { fullName, avatarUrl: nextAvatar });
      patchUser(r.data);
      setAvatarUrl(nextAvatar ?? '');
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
      setMsg({ kind: 'ok', text: t('settings.profile.updated') });
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.response?.data?.error ?? t('settings.profile.updateFailed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <h3 className="font-display text-md font-bold">{t('settings.profile.title')}</h3>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">
            Photo de profil (1 Mo max)
          </span>
          <div className="flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--surface-2)] text-lg font-bold text-[var(--text-dim)]">
              {shownAvatar ? (
                <img src={shownAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                avInitials(user?.fullName)
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-tonal h-9" onClick={() => fileRef.current?.click()}>
                <IconCamera className="h-4 w-4" />
                {shownAvatar ? 'Changer' : 'Importer une photo'}
              </button>
              {shownAvatar && (
                <button type="button" className="btn-text h-9 text-red-500" onClick={clearPhoto}>
                  Retirer
                </button>
              )}
              {photoFile && (
                <span className="text-2xs font-medium text-[var(--accent-strong)]">
                  Aperçu — enregistrez pour appliquer
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickPhoto(e.target.files)}
            />
          </div>
        </div>

        <Field label={t('settings.profile.fullName')}>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} required />
        </Field>
        <Field label={t('settings.profile.avatarUrl', { optional: t('common.optional') })}>
          <input className="input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label={t('settings.profile.email')}>
          <input className="input opacity-60" value={user?.email ?? ''} disabled />
        </Field>
        <button className="btn-primary" disabled={busy}>
          {busy ? t('common.saving') : t('common.save')}
        </button>
      </form>
    </div>
  );
}

function AppearanceTab() {
  const { pref, setPref, accent, setAccent } = useTheme();
  const { t } = useI18n();
  const opts: { id: ThemePref; key: string; Icon: typeof IconLight }[] = [
    { id: 'light', key: 'settings.theme.light', Icon: IconLight },
    { id: 'dark', key: 'settings.theme.dark', Icon: IconDark },
    { id: 'system', key: 'settings.theme.system', Icon: IconToday },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-md font-bold">{t('settings.appearance.themeTitle')}</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {opts.map(({ id, key, Icon }) => (
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
              {t(key)}
              {pref === id && <IconTick className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-md font-bold">{t('settings.appearance.accentTitle')}</h3>
        <p className="mb-3 text-sm text-[var(--text-dim)]">{t('settings.appearance.accentHint')}</p>
        <ColorPicker value={accent} onChange={(hex) => setAccent(hex ?? '#ff2c5f')} />
      </div>
    </div>
  );
}

function StatusTab() {
  const { t } = useI18n();
  const { user, setStatus } = useAuth();
  const currentStatus = user?.presenceStatus ?? 'ONLINE';
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-md font-bold">{t('settings.profile.statusLabel')}</h3>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">{t('settings.status.hint')}</p>
      </div>
      <div role="radiogroup" className="space-y-2">
        {PRESENCE_OPTIONS.map((o) => (
          <RadioRow
            key={o.value}
            selected={currentStatus === o.value}
            onSelect={() => setStatus(o.value).catch(() => undefined)}
            leading={
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: DOT_COLOR[o.dot] }}
              />
            }
            label={t(PRESENCE_KEY[o.value] ?? o.value)}
          />
        ))}
      </div>
    </div>
  );
}

function LanguageTab() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-md font-bold">{t('settings.appearance.languageTitle')}</h3>
        <p className="mt-0.5 text-sm text-[var(--text-dim)]">{t('settings.appearance.languageHint')}</p>
      </div>
      <div role="radiogroup" className="space-y-2">
        {LANGS.map((l) => (
          <RadioRow
            key={l.id}
            selected={lang === l.id}
            onSelect={() => setLang(l.id)}
            label={l.native}
            trailing={
              <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                {l.id}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}

function SecurityTab() {
  const { t } = useI18n();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ kind: 'err', text: t('settings.security.mismatch') });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setMsg({ kind: 'ok', text: t('settings.security.changed') });
      setCur('');
      setNext('');
      setConfirm('');
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.response?.data?.error ?? t('settings.security.failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="font-display text-md font-bold">{t('settings.security.title')}</h3>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <Field label={t('settings.security.current')}>
        <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      </Field>
      <Field label={t('settings.security.new')}>
        <input
          className="input"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      <Field label={t('settings.security.confirm')}>
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
        {busy ? t('settings.security.submitting') : t('settings.security.submit')}
      </button>
    </form>
  );
}

function AccountTab({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const dialog = useDialog();

  async function doLogout() {
    const ok = await dialog.confirm({
      title: t('account.logoutConfirmTitle'),
      message: t('account.logoutConfirmMsg'),
      confirmLabel: t('account.logout'),
      danger: true,
    });
    if (ok) {
      onClose();
      logout();
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-display text-md font-bold">{t('settings.account.title')}</h3>
      <div className="rounded-xl border border-[var(--outline)] p-4 text-sm">
        <div className="font-semibold">{user?.fullName}</div>
        <div className="text-[var(--text-dim)]">{user?.email}</div>
      </div>
      <button onClick={doLogout} className="btn-danger">
        <IconLogout className="h-4 w-4" /> {t('account.logout')}
      </button>
    </div>
  );
}
