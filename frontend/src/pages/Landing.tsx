import { Link, Navigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useI18n } from '@/i18n';
import Wordmark from '@/components/Wordmark';
import SiteFooter from '@/components/SiteFooter';
import {
  IconChat,
  IconKanban,
  IconCalendar,
  IconAnalytics,
  IconForms,
  IconBolt,
  IconShield,
  IconGroups,
  IconForward,
  IconTick,
  IconLight,
  IconDark,
} from '@/lib/icons';

const NAVY = 'linear-gradient(170deg, #211d43 0%, #2b2559 55%, #322a63 100%)';
const ACCENT = '#ff2c5f';
const ACCENT_GRAD = 'linear-gradient(150deg, #ff2c5f, #ff6a8d)';
/** Landing bilingue : uniquement FR / EN. */
const LANDING_LANGS = ['fr', 'en'] as const;

/** Carte a double liseré : `border` interne + `outline` décalé (2px de vide). */
const CARD =
  'rounded-2xl border border-[var(--outline)] bg-[var(--surface)] outline outline-1 outline-offset-2 outline-[var(--outline)] shadow-[0_1px_2px_rgba(16,24,40,0.06),0_6px_16px_-8px_rgba(16,24,40,0.10)]';

export default function Landing() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { t, lang, setLang } = useI18n();
  if (user) return <Navigate to="/" replace />;

  const VALUES = [
    { Icon: IconChat, t: 'landing.values.t1', d: 'landing.values.d1' },
    { Icon: IconBolt, t: 'landing.values.t2', d: 'landing.values.d2' },
    { Icon: IconShield, t: 'landing.values.t3', d: 'landing.values.d3' },
  ];
  const STEPS = [
    { k: 'landing.step1.k', tx: 'landing.step1.t', l: 'landing.step1.l', to: '/register' },
    { k: 'landing.step2.k', tx: 'landing.step2.t', l: 'landing.step2.l', to: '/welcome#modules' },
    { k: 'landing.step3.k', tx: 'landing.step3.t', l: 'landing.step3.l', to: '/welcome#modules' },
  ];
  const MODULES = [
    { Icon: IconChat, t: 'landing.mod.messaging.t', d: 'landing.mod.messaging.d', tags: ['landing.tag.channels', 'landing.tag.threads', 'landing.tag.files'] },
    { Icon: IconKanban, t: 'landing.mod.project.t', d: 'landing.mod.project.d', tags: ['landing.tag.kanban', 'landing.tag.deadlines'] },
    { Icon: IconCalendar, t: 'landing.mod.calendar.t', d: 'landing.mod.calendar.d', tags: ['landing.tag.dwm'] },
    { Icon: IconAnalytics, t: 'landing.mod.meal.t', d: 'landing.mod.meal.d', tags: ['landing.tag.indicators', 'landing.tag.summaries'] },
    { Icon: IconForms, t: 'landing.mod.forms.t', d: 'landing.mod.forms.d', tags: ['landing.tag.forms', 'landing.tag.export'] },
    { Icon: IconBolt, t: 'landing.mod.auto.t', d: 'landing.mod.auto.d', tags: ['landing.tag.rules', 'landing.tag.nocode'] },
  ];

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      {/* ============ EN-TÊTE (clair, collant) ============ */}
      <header className="sticky top-0 z-40 border-b border-[var(--outline)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Link to="/welcome" aria-label="Talkio">
            <Wordmark size="lg" />
          </Link>

          <nav className="ml-4 hidden items-center gap-6 text-sm font-medium text-[var(--text-dim)] lg:flex">
            <a href="#valeurs" className="transition hover:text-[var(--text)]">{t('landing.nav.why')}</a>
            <a href="#demarrage" className="transition hover:text-[var(--text)]">{t('landing.nav.start')}</a>
            <a href="#modules" className="transition hover:text-[var(--text)]">{t('landing.nav.modules')}</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Sélecteur de langue (FR / EN) */}
            <div className="flex items-center gap-0.5 rounded-full border border-[var(--outline)] p-0.5">
              {LANDING_LANGS.map((id) => (
                <button
                  key={id}
                  onClick={() => setLang(id)}
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-2xs font-bold uppercase transition',
                    lang === id
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-dim)] hover:text-[var(--text)]',
                  )}
                  aria-pressed={lang === id}
                >
                  {id}
                </button>
              ))}
            </div>

            {/* Bascule clair / sombre */}
            <button
              onClick={toggle}
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--outline)] text-[var(--text-dim)] transition hover:text-[var(--text)]"
              title={theme === 'dark' ? t('landing.themeToLight') : t('landing.themeToDark')}
              aria-label={theme === 'dark' ? t('landing.themeToLight') : t('landing.themeToDark')}
            >
              {theme === 'dark' ? <IconLight className="h-5 w-5" /> : <IconDark className="h-5 w-5" />}
            </button>

            <Link
              to="/login"
              className="hidden px-2 text-sm font-medium text-[var(--text-dim)] transition hover:text-[var(--text)] sm:inline-flex"
            >
              {t('landing.signin')}
            </Link>
            <Link to="/register" className="btn-primary h-9 px-4 text-sm">
              {t('landing.create')}
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO (fond sombre) ============ */}
      <div className="relative overflow-hidden text-white" style={{ background: NAVY }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{ background: ACCENT }}
        />

        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
              {t('landing.hero.badge')}
            </span>

            <h1 className="mt-5 font-display text-4xl font-black leading-[1.08] tracking-tight sm:text-[3.2rem]">
              {t('landing.hero.title.a')}
              <span style={{ color: ACCENT }}>{t('landing.hero.title.hl')}</span>
              {t('landing.hero.title.b')}
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65">{t('landing.hero.sub')}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                style={{ background: ACCENT }}
              >
                {t('landing.hero.explore')} <IconForward className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-full border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {t('landing.hero.signin')}
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <IconTick className="h-4 w-4" style={{ color: ACCENT }} /> {t('landing.hero.check1')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconTick className="h-4 w-4" style={{ color: ACCENT }} /> {t('landing.hero.check2')}
              </span>
            </div>
          </div>

          {/* Aperçu "device" */}
          <div className="relative">
            <div className="rounded-[26px] border border-white/15 bg-white/5 p-3 shadow-2xl outline outline-1 outline-offset-2 outline-white/15 backdrop-blur">
              <div className="overflow-hidden rounded-2xl bg-[#f6f6f9] p-3 text-[#1e1b3a]">
                <div className="flex items-center gap-1.5 pb-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1.5 rounded-xl bg-white p-2.5 shadow-sm">
                    {['# terrain', '# logistique', '# rapports', 'Alice', 'Bob'].map((s, i) => (
                      <div
                        key={s}
                        className={
                          'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-2xs ' +
                          (i === 0 ? 'font-semibold text-[#ff2c5f]' : 'text-[#6b6885]')
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                        {s}
                      </div>
                    ))}
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <div className="w-4/5 rounded-xl rounded-tl-sm bg-white px-2.5 py-1.5 text-2xs shadow-sm">
                      {t('landing.mock.msg1')}
                    </div>
                    <div
                      className="ml-auto w-3/5 rounded-xl rounded-tr-sm px-2.5 py-1.5 text-2xs text-white"
                      style={{ background: ACCENT }}
                    >
                      {t('landing.mock.msg2')}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {['landing.mock.todo', 'landing.mock.doing', 'landing.mock.done'].map((c) => (
                        <div key={c} className="rounded-lg bg-white p-1.5 shadow-sm">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[#8a87a0]">
                            {t(c)}
                          </div>
                          <div className="mt-1 space-y-1">
                            <div className="h-3 rounded bg-[#eceaf2]" />
                            <div className="h-3 w-2/3 rounded bg-[#eceaf2]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-4 bottom-8 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#1e1b3a] shadow-xl ring-1 ring-black/5 sm:flex">
              <IconBolt className="h-4 w-4" style={{ color: ACCENT }} />
              {t('landing.mock.chipAuto')}
            </div>
            <div className="absolute -right-3 top-6 hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1e1b3a] shadow-xl ring-1 ring-black/5 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('landing.mock.chipOnline')}
            </div>
          </div>
        </section>
      </div>

      {/* ============ VALEURS ============ */}
      <section id="valeurs" className="relative z-10 mx-auto -mt-10 max-w-6xl px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUES.map(({ Icon, t: tt, d }) => (
            <article key={tt} className={clsx(CARD, 'p-5')}>
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--outline)] bg-[var(--surface-2)] text-[var(--text-dim)]">
                <Icon className="icon-3d-strong h-6 w-6" />
              </span>
              <h3 className="mt-3.5 font-display text-base font-bold">{t(tt)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-dim)]">{t(d)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============ PRISE EN MAIN ============ */}
      <section id="demarrage" className="mt-16 border-y border-[var(--outline)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.85fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
              <IconGroups className="h-4 w-4" /> {t('landing.start.eyebrow')}
            </div>
            <h2 className="mt-3 font-display text-2xl font-black tracking-tight">{t('landing.start.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-dim)]">{t('landing.start.sub')}</p>
            <Link
              to="/register"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--outline)] px-5 text-sm font-semibold transition hover:bg-[var(--surface-2)]"
            >
              {t('landing.start.cta')} <IconForward className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {STEPS.map((s) => (
              <div key={s.k} className={clsx(CARD, 'bg-[var(--bg)] p-4')}>
                <div className="text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">{t(s.k)}</div>
                <p className="mt-1 text-sm">{t(s.tx)}</p>
                <Link
                  to={s.to}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: ACCENT }}
                >
                  {t(s.l)} <IconForward className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MODULES ============ */}
      <section id="modules" className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-2xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
              {t('landing.modules.eyebrow')}
            </div>
            <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
              {t('landing.modules.title')}
            </h2>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            style={{ color: ACCENT }}
          >
            {t('landing.modules.all')} <IconForward className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ Icon, t: tt, d, tags }) => (
            <article
              key={tt}
              className={clsx(
                CARD,
                'p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:outline-[var(--accent)] hover:shadow-elevation-3',
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl text-white shadow-[0_6px_16px_var(--accent-ring)]"
                  style={{ background: ACCENT_GRAD }}
                >
                  <Icon className="icon-3d-strong h-6 w-6" />
                </span>
                <IconForward className="h-4 w-4 -rotate-45 text-[var(--text-dim)]" />
              </div>
              <h3 className="mt-3.5 font-display text-base font-bold">{t(tt)}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-dim)]">{t(d)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((tg) => (
                  <span
                    key={tg}
                    className="rounded-md border border-[var(--outline)] bg-[var(--surface-2)] px-2 py-0.5 text-2xs font-medium text-[var(--text-dim)]"
                  >
                    {t(tg)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============ POUR LES ÉQUIPES TERRAIN ============ */}
      <section className="border-t border-[var(--outline)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-[var(--accent-ring)] bg-[var(--accent-soft)] p-7 outline outline-1 outline-offset-2 outline-[var(--accent-ring)] sm:p-9">
            <div className="text-2xs font-bold uppercase tracking-wide text-[var(--accent-strong)]">
              {t('landing.field.eyebrow')}
            </div>
            <h2 className="mt-3 font-display text-2xl font-black tracking-tight">{t('landing.field.title')}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-dim)]">{t('landing.field.sub')}</p>
            <Link to="/register" className="btn-primary mt-5 h-10 px-5 text-sm">
              {t('landing.field.cta')}
            </Link>
          </div>

          <div className="space-y-4">
            <div className={clsx(CARD, 'bg-[var(--bg)] p-5')}>
              <IconForms className="icon-3d h-6 w-6" style={{ color: ACCENT }} />
              <h3 className="mt-2.5 font-semibold">{t('landing.field.collect.t')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-dim)]">{t('landing.field.collect.d')}</p>
            </div>
            <div
              className="rounded-2xl border border-white/10 p-5 text-white outline outline-1 outline-offset-2 outline-white/10"
              style={{ background: '#221e46' }}
            >
              <IconAnalytics className="icon-3d h-6 w-6" style={{ color: ACCENT }} />
              <h3 className="mt-2.5 font-semibold">{t('landing.field.meal.t')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/60">{t('landing.field.meal.d')}</p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
