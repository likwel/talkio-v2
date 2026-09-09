import { Link, useParams } from 'react-router-dom';
import Wordmark from '@/components/Wordmark';
import SiteFooter from '@/components/SiteFooter';

type Block = { h?: string; p?: string; list?: string[] };
type Doc = { title: string; updated: string; intro?: string; blocks: Block[] };

const DOCS: Record<string, Doc> = {
  cgu: {
    title: "Conditions générales d'utilisation",
    updated: '2026',
    intro:
      "Les présentes conditions régissent l'accès et l'utilisation de la plateforme Talkio (« le Service »). En créant un compte, vous les acceptez sans réserve.",
    blocks: [
      {
        h: '1. Objet',
        p: "Talkio met à disposition des outils de messagerie, de gestion de projet, d'agenda, de suivi-évaluation (MEAL) et de collecte de données, destinés à un usage professionnel et associatif.",
      },
      {
        h: '2. Compte utilisateur',
        p: "Vous êtes responsable de l'exactitude des informations fournies et de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte vous est imputable.",
      },
      {
        h: '3. Usage acceptable',
        list: [
          "Ne pas diffuser de contenu illégal, diffamatoire ou portant atteinte aux droits de tiers.",
          "Ne pas tenter de compromettre la sécurité ou la disponibilité du Service.",
          "Respecter la réglementation applicable au traitement des données que vous collectez.",
        ],
      },
      {
        h: '4. Disponibilité',
        p: "Le Service est fourni « en l'état ». Nous nous efforçons d'assurer une disponibilité continue mais ne garantissons pas l'absence d'interruption.",
      },
      {
        h: '5. Résiliation',
        p: "Vous pouvez supprimer votre compte à tout moment. Nous pouvons suspendre un compte en cas de manquement aux présentes conditions.",
      },
      {
        h: '6. Droit applicable',
        p: "Les présentes conditions sont soumises au droit applicable au siège de l'éditeur. Tout litige relève des tribunaux compétents de ce ressort.",
      },
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    updated: '2026',
    intro:
      "Cette politique décrit les données que Talkio traite, les finalités de ce traitement et vos droits.",
    blocks: [
      {
        h: 'Données collectées',
        list: [
          "Données de compte : nom, adresse e-mail, mot de passe (haché), avatar.",
          "Contenus que vous créez : messages, tâches, événements, formulaires et réponses.",
          "Données techniques : journaux de connexion, préférences (thème, langue).",
        ],
      },
      {
        h: 'Finalités',
        p: "Fournir et sécuriser le Service, permettre la collaboration au sein de vos espaces, améliorer la plateforme et respecter nos obligations légales.",
      },
      {
        h: 'Base légale',
        p: "Exécution du contrat (fourniture du Service), intérêt légitime (sécurité, amélioration) et consentement lorsque celui-ci est requis.",
      },
      {
        h: 'Conservation',
        p: "Les données sont conservées pendant la durée de vie du compte, puis supprimées ou anonymisées dans un délai raisonnable après sa clôture.",
      },
      {
        h: 'Sous-traitants',
        p: "Nous faisons appel à des hébergeurs et prestataires techniques tenus à des engagements de confidentialité et de sécurité équivalents.",
      },
      {
        h: 'Vos droits',
        p: "Accès, rectification, effacement, limitation, portabilité et opposition. Pour les exercer, contactez-nous via la page Contact.",
      },
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    updated: '2026',
    blocks: [
      {
        h: 'Éditeur',
        p: "Talkio — plateforme collaborative. Les informations d'immatriculation, la raison sociale, l'adresse du siège et le nom du directeur de la publication sont fournis sur demande à l'adresse de contact ci-dessous.",
      },
      {
        h: 'Hébergement',
        p: "L'application et les données sont hébergées auprès d'un prestataire d'infrastructure professionnel. Les coordonnées de l'hébergeur sont communiquées sur demande.",
      },
      {
        h: 'Propriété intellectuelle',
        p: "La marque, le logo, l'interface et le code de Talkio sont protégés. Toute reproduction non autorisée est interdite.",
      },
      {
        h: 'Contact',
        p: "Pour toute question relative aux présentes mentions, écrivez à contact@talkio.app.",
      },
    ],
  },
  cookies: {
    title: 'Gestion des cookies',
    updated: '2026',
    intro:
      "Talkio limite l'usage des traceurs au strict nécessaire au fonctionnement du Service.",
    blocks: [
      {
        h: 'Cookies et stockage local strictement nécessaires',
        list: [
          "Jeton de session pour vous maintenir connecté.",
          "Préférences d'affichage : thème clair/sombre, couleur d'accent, langue.",
        ],
      },
      {
        h: 'Mesure d’audience',
        p: "Aucune mesure d'audience publicitaire ni revente de données n'est effectuée.",
      },
      {
        h: 'Votre contrôle',
        p: "Vous pouvez vider le stockage de votre navigateur à tout moment ; vous serez alors déconnecté et vos préférences réinitialisées.",
      },
    ],
  },
  contact: {
    title: 'Contact',
    updated: '2026',
    intro:
      "Une question, une demande relative à vos données ou un besoin d'assistance ? Voici comment nous joindre.",
    blocks: [
      { h: 'Support', p: "support@talkio.app — réponse sous 2 jours ouvrés." },
      { h: 'Données personnelles', p: "privacy@talkio.app pour l'exercice de vos droits." },
      { h: 'Autres demandes', p: "contact@talkio.app" },
    ],
  },
};

export default function LegalPage() {
  const { doc } = useParams();
  const key = doc && DOCS[doc] ? doc : 'contact';
  const data = DOCS[key];

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--outline)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
          <Link to="/welcome">
            <Wordmark size="md" />
          </Link>
          <Link to="/welcome" className="btn-text">
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tight">{data.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">Dernière mise à jour : {data.updated}</p>
        {data.intro && <p className="mt-6 text-[var(--text-dim)]">{data.intro}</p>}

        <div className="mt-8 space-y-7">
          {data.blocks.map((b, i) => (
            <section key={i}>
              {b.h && <h2 className="font-display text-lg font-bold">{b.h}</h2>}
              {b.p && <p className="mt-2 text-[var(--text-dim)]">{b.p}</p>}
              {b.list && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--text-dim)]">
                  {b.list.map((li, j) => (
                    <li key={j}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-2 border-t border-[var(--outline)] pt-6 text-sm">
          {Object.entries(DOCS).map(([k, d]) => (
            <Link
              key={k}
              to={k === 'contact' ? '/contact' : `/legal/${k}`}
              className={
                'rounded-full px-3 py-1 transition ' +
                (k === key
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]'
                  : 'text-[var(--text-dim)] hover:bg-[var(--surface-2)]')
              }
            >
              {d.title}
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
