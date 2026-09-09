import { Link } from 'react-router-dom';
import { WordmarkOnDark } from '@/components/Wordmark';

const PRODUCT: { to: string; label: string }[] = [
  { to: '/welcome', label: 'Fonctionnalités' },
  { to: '/register', label: 'Créer un compte' },
  { to: '/login', label: 'Se connecter' },
];

const LEGAL: { to: string; label: string }[] = [
  { to: '/legal/cgu', label: "Conditions d'utilisation" },
  { to: '/legal/confidentialite', label: 'Confidentialité' },
  { to: '/legal/mentions-legales', label: 'Mentions légales' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/contact', label: 'Contact' },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="text-white" style={{ background: '#201c3f' }}>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-3">
          <WordmarkOnDark size="lg" />
          <p className="max-w-xs text-sm leading-relaxed text-white/55">
            Messagerie, projet, agenda, suivi‑évaluation et collecte de données —
            l'espace de travail unique de vos équipes.
          </p>
        </div>

        <FooterCol title="Produit" links={PRODUCT} />
        <FooterCol title="Légal" links={LEGAL} />
      </div>

      <div className="border-t border-white/10 px-6 py-4">
        <p className="mx-auto max-w-6xl text-2xs text-white/40">
          © {year} Talkio. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <div className="mb-2.5 text-2xs font-bold uppercase tracking-wide text-white/40">{title}</div>
      <nav className="flex flex-col gap-2 text-sm">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="text-white/65 transition hover:text-white">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
