import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import { useDialog } from '@/context/DialogContext';
import type {
  Project,
  QualitativeTranscript,
  TranscriptInterviewee,
  TranscriptQa,
  TranscriptReviewStep,
  TranscriptStatus,
} from '@/lib/types';
import { IconAdd, IconDelete, IconDownload, IconGroups, IconPrint } from '@/lib/icons';

const INTERVIEW_TYPES = ['Entretien individuel', 'Focus group (FGD)', 'Entretien informateur clé (KII)', 'Observation'];
const STATUS_LABEL: Record<TranscriptStatus, string> = { DRAFT: 'Brouillon', FINAL: 'Finalisé' };
export const REVIEW_STEPS: TranscriptReviewStep[] = ['ORIGINAL', 'REVIEWED', 'REVISED', 'FINAL'];
export const REVIEW_STEP_LABEL: Record<TranscriptReviewStep, string> = {
  ORIGINAL: 'Original',
  REVIEWED: 'Révisé',
  REVISED: 'Corrigé',
  FINAL: 'Final',
};
const SOURCE_CREDIT =
  'Example Interview Transcript / Interview tracking table / Matrice de saisie des données qualitatives — USAID / IDEAL';

/**
 * Sujets par défaut de la matrice de saisie des données qualitatives (IDEAL) —
 * axés résilience/marché. À adapter selon le guide d'entretien de l'étude.
 */
const MATRIX_TOPICS = [
  'Composition du groupe (types de participants – p. ex., jeunes, aînés, dirigeants, personnes en situation de handicap, déplacés internes/hôtes/autres ; cadre ; contexte de l’entretien ; dynamique de groupe)',
  'Principaux moyens de subsistance et activités sur les marchés locaux (acteurs/qui fait quoi ; pourquoi ; ce qui a changé ou est en train de changer ; obstacles, contraintes ou opportunités)',
  'Chocs et facteurs de stress (primaires/moteurs, secondaires/en aval ; effets sur la communauté, effets différents sur différents groupes ; changement/dynamique)',
  'Stratégies d’adaptation — réponses primaires/secondaires (stratégies différentielles par groupe ; changement/dynamique)',
  'Stratégies d’adaptation — changements à plus long terme (préparation, gestion, réduction des répercussions négatives ; stratégies/avantages différentiels)',
  'Action collective (incidence des chocs sur les relations communautaires ; prise de décision ; activités de groupe, entraide ; changement/dynamique)',
  'Participation à des programmes gouvernementaux ou d’ONG (programmes/organismes actifs, participation différentielle, coordination ; effet sur la communauté)',
  'Recettes de transferts en espèces ou d’aide humanitaire (type, source, fréquence, durée ; qui reçoit, pour quelle raison ; effets sur les ménages)',
  'Ressources naturelles (accès, changement dans la gestion ou l’utilisation, disponibilité de l’eau, réponse communautaire aux problèmes)',
  'Marchés, infrastructure et information (type/accessibilité des marchés, accès aux systèmes d’alerte rapide et aux télécommunications)',
  'Épargne, crédit, services financiers, assurance (accès, perceptions, participation et répercussions différentielles)',
  'Dynamiques de déplacement (caractéristiques des hôtes, rapatriés, déplacés internes, réfugiés ; mouvements, défis, relations avec la communauté)',
  'Aspirations (vision/plans de changement à court et long terme ; sentiment de pouvoir agir ; qui en bénéficiera, qui ne le fera pas, pourquoi)',
  'Commentaires supplémentaires',
];

type FormState = Omit<QualitativeTranscript, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;

const EMPTY: FormState = {
  quipsId: null,
  title: '',
  interviewType: INTERVIEW_TYPES[0],
  facilitator: '',
  noteTaker: '',
  location: '',
  interviewDate: '',
  startTime: '',
  endTime: '',
  consentObtained: false,
  facilitatorNotes: '',
  genderMix: '',
  participantCount: null,
  interviewees: [{ name: '', age: '', type: '', maritalStatus: '', profession: '' }],
  qa: [{ question: '', answer: '', researcherNotes: '' }],
  status: 'DRAFT',
  region: '',
  district: '',
  community: '',
  kiiType: '',
  sex: '',
  organizationName: '',
  marketActorType: '',
  round2Date: '',
  reviewStep: 'ORIGINAL',
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block px-0.5">
      <span className="mb-1 block text-sm font-semibold">
        {label}
        {hint && <span className="ml-1 text-2xs font-normal text-[var(--text-dim)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Sérialise le transcript en texte brut (pour export/téléchargement), fidèle au gabarit officiel. */
function toPlainText(f: FormState): string {
  const v = (s?: string | null) => (s && s.trim() ? s.trim() : '—');
  const lines = [
    `EXAMPLE INTERVIEW TRANSCRIPT`,
    f.title || 'Sans titre',
    `Statut : ${STATUS_LABEL[f.status]}`,
    ``,
    `Facilitateur d'entretien : ${v(f.facilitator)}`,
    `Preneur de notes : ${v(f.noteTaker)}`,
    `Région/district/commune : ${v(f.location)}`,
    `Date de l'entretien (Round 1) : ${f.interviewDate ? new Date(f.interviewDate).toLocaleDateString('fr-FR') : '—'}`,
    `Date du 2e passage (Round 2) : ${f.round2Date ? new Date(f.round2Date).toLocaleDateString('fr-FR') : '—'}`,
    ``,
    `Suivi : Région ${v(f.region)} — Zone (LGA) ${v(f.district)} — Communauté ${v(f.community)}`,
    `Type d'informateur clé : ${v(f.kiiType)} — Sexe : ${v(f.sex)}`,
    `Organisation : ${v(f.organizationName)} — Type d'acteur de marché : ${v(f.marketActorType)}`,
    `Étape de revue interne : ${REVIEW_STEP_LABEL[f.reviewStep]}`,
    ``,
    `Personnes interrogées :`,
    ...f.interviewees
      .filter((i) => i.name || i.age || i.type || i.maritalStatus || i.profession)
      .map(
        (i, idx) =>
          `  ${idx + 1}. ${v(i.name)} — Âge : ${v(i.age)}, Type : ${v(i.type)}, Statut marital : ${v(i.maritalStatus)}, Profession : ${v(i.profession)}`,
      ),
    ``,
    `Type d'entretien : ${v(f.interviewType)}`,
    `Heure de début : ${v(f.startTime)} — Heure de fin : ${v(f.endTime)}`,
    `Consentement éclairé obtenu : ${f.consentObtained ? 'Oui' : 'Non'}`,
    ``,
    `Observations du facilitateur/preneur de notes :`,
    v(f.facilitatorNotes),
    `Composition du groupe (genre) : ${v(f.genderMix)} — Nombre de participants : ${f.participantCount ?? '—'}`,
    ``,
    `SUJETS / QUESTIONS, NOTES ET OBSERVATIONS DU CHERCHEUR`,
    ...f.qa
      .filter((q) => q.question.trim() || (q.answer ?? '').trim() || (q.researcherNotes ?? '').trim())
      .flatMap((q, idx) => [
        `${idx + 1}. ${q.question || '—'}`,
        `   Notes : ${v(q.answer)}`,
        `   Commentaires du chercheur : ${v(q.researcherNotes)}`,
        ``,
      ]),
    `Modèle : ${SOURCE_CREDIT}`,
  ];
  return lines.join('\n');
}

export default function TranscriptModal({
  open,
  onClose,
  project,
  transcript,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** Transcript à éditer, ou `null` pour un nouveau transcript. */
  transcript: QualitativeTranscript | null;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [f, setF] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const editing = !!transcript?.id;
  const quipsOptions = project.qualitativeInquiries ?? [];

  useEffect(() => {
    if (!open) return;
    setF(
      transcript
        ? {
            ...EMPTY,
            ...transcript,
            interviewDate: transcript.interviewDate ? transcript.interviewDate.slice(0, 10) : '',
            round2Date: transcript.round2Date ? transcript.round2Date.slice(0, 10) : '',
            interviewees: transcript.interviewees.length ? transcript.interviewees : EMPTY.interviewees,
            qa: transcript.qa.length ? transcript.qa : EMPTY.qa,
          }
        : EMPTY,
    );
  }, [open, transcript]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((cur) => ({ ...cur, [key]: value }));
  }

  function setInterviewee(idx: number, patch: Partial<TranscriptInterviewee>) {
    setF((cur) => ({
      ...cur,
      interviewees: cur.interviewees.map((i, n) => (n === idx ? { ...i, ...patch } : i)),
    }));
  }
  function addInterviewee() {
    setF((cur) => ({ ...cur, interviewees: [...cur.interviewees, { name: '', age: '', type: '', maritalStatus: '', profession: '' }] }));
  }
  function removeInterviewee(idx: number) {
    setF((cur) => ({ ...cur, interviewees: cur.interviewees.filter((_, n) => n !== idx) }));
  }

  function setQa(idx: number, patch: Partial<TranscriptQa>) {
    setF((cur) => ({ ...cur, qa: cur.qa.map((q, n) => (n === idx ? { ...q, ...patch } : q)) }));
  }
  function addQa() {
    setF((cur) => ({ ...cur, qa: [...cur.qa, { question: '', answer: '', researcherNotes: '' }] }));
  }
  function removeQa(idx: number) {
    setF((cur) => ({ ...cur, qa: cur.qa.filter((_, n) => n !== idx) }));
  }

  /** Remplace les lignes par les sujets standards de la matrice de saisie IDEAL (à adapter ensuite). */
  async function loadMatrixTemplate() {
    const hasContent = f.qa.some((q) => q.question.trim() || (q.answer ?? '').trim() || (q.researcherNotes ?? '').trim());
    if (hasContent) {
      const ok = await dialog.confirm({
        title: 'Charger le modèle standard',
        message: 'Les lignes actuelles seront remplacées par les sujets standards de la matrice IDEAL. Continuer ?',
        confirmLabel: 'Charger',
        danger: true,
      });
      if (!ok) return;
    }
    setF((cur) => ({ ...cur, qa: MATRIX_TOPICS.map((question) => ({ question, answer: '', researcherNotes: '' })) }));
  }

  async function save() {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...f,
        quipsId: f.quipsId || null,
        interviewDate: f.interviewDate || null,
        round2Date: f.round2Date || null,
        interviewees: f.interviewees.filter((i) => i.name || i.age || i.type || i.maritalStatus || i.profession),
        qa: f.qa.filter((q) => q.question.trim() || (q.answer ?? '').trim() || (q.researcherNotes ?? '').trim()),
      };
      if (editing && transcript) {
        await api.patch(`/meal/transcripts/${transcript.id}`, payload);
      } else {
        await api.post(`/meal/projects/${project.id}/transcripts`, payload);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function download() {
    const blob = new Blob([toPlainText(f)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${f.title || 'Transcript'}.txt`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Ouvre une mise en page imprimable dans un nouvel onglet (fidèle au gabarit officiel). */
  function printSheet() {
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (!win) return;
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const infoRow = (label: string, value: string) =>
      `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value || '—')}</td></tr>`;
    const intervieweesRows = f.interviewees
      .filter((i) => i.name || i.age || i.type || i.maritalStatus || i.profession)
      .map(
        (i) =>
          `<tr><td>${esc(i.name || '—')}</td><td>${esc(i.age || '—')}</td><td>${esc(i.type || '—')}</td><td>${esc(i.maritalStatus || '—')}</td><td>${esc(i.profession || '—')}</td></tr>`,
      )
      .join('');
    const qaRows = f.qa
      .filter((q) => q.question.trim() || (q.answer ?? '').trim() || (q.researcherNotes ?? '').trim())
      .map(
        (q) =>
          `<tr><td class="q">${esc(q.question || '—')}</td><td class="a">${esc(q.answer || '—')}</td><td class="a">${esc(q.researcherNotes || '—')}</td></tr>`,
      )
      .join('');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.title || 'Transcript')}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:15px;margin:0 0 2px;color:#c0392b;}
  h2{font-size:14px;margin:0 0 10px;}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  td,th{border:1px solid #999;padding:5px 8px;vertical-align:top;}
  td.lbl{background:#e2e2e2;font-weight:bold;font-size:10.5px;width:220px;}
  td.val{background:#fff;white-space:pre-wrap;}
  td.q{background:#f2f2f2;font-weight:bold;white-space:pre-wrap;}
  td.a{background:#fff;white-space:pre-wrap;min-height:18px;}
  th{background:#f2f2f2;font-size:10.5px;}
  .credit{margin-top:10px;font-size:9px;color:#666;font-style:italic;}
  @media print { body{margin:10mm;} }
</style></head><body>
<h1>EXAMPLE INTERVIEW TRANSCRIPT</h1>
<h2>${esc(f.title || 'Sans titre')}</h2>
<table>
  ${infoRow('Facilitateur d’entretien', f.facilitator || '')}
  ${infoRow('Preneur de notes', f.noteTaker || '')}
  ${infoRow('Région/district/commune', f.location || '')}
  ${infoRow('Date de l’entretien', f.interviewDate ? new Date(f.interviewDate).toLocaleDateString('fr-FR') : '')}
</table>
<table>
  <tr><th>Nom</th><th>Âge</th><th>Type</th><th>Statut marital</th><th>Profession</th></tr>
  ${intervieweesRows || '<tr><td colspan="5">—</td></tr>'}
</table>
<table>
  ${infoRow("Type d'entretien", f.interviewType || '')}
  ${infoRow('Heure de début', f.startTime || '')}
  ${infoRow('Heure de fin', f.endTime || '')}
  ${infoRow('Consentement éclairé obtenu', f.consentObtained ? 'Oui' : 'Non')}
  ${infoRow('Genre (composition du groupe)', f.genderMix || '')}
  ${infoRow('Nombre de participants', f.participantCount != null ? String(f.participantCount) : '')}
</table>
<table>
  <tr><td class="lbl">Observations du facilitateur/preneur de notes</td></tr>
  <tr><td class="val">${esc(f.facilitatorNotes || '—')}</td></tr>
</table>
<table>
  <tr><th>Sujet</th><th>Notes</th><th>Commentaires, idées, observations du chercheur</th></tr>
  ${qaRows || '<tr><td colspan="3">—</td></tr>'}
</table>
<p class="credit">Modèle : ${esc(SOURCE_CREDIT)} (Implementer-led Design, Evidence, Analysis and Learning).</p>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <IconGroups className="h-5 w-5 text-[var(--accent)]" />
          {editing ? 'Transcript d’entretien' : 'Nouveau transcript d’entretien'}
        </span>
      }
      footer={
        <>
          <button className="btn-text" onClick={download}>
            <IconDownload className="h-4 w-4" /> Télécharger (.txt)
          </button>
          <button className="btn-text" onClick={printSheet}>
            <IconPrint className="h-4 w-4" /> Imprimer
          </button>
          <span className="flex-1" />
          <button className="btn-text" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" disabled={saving || !f.title.trim()} onClick={save}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 rounded-lg bg-[var(--accent)] p-3 text-white sm:grid-cols-[1fr_160px]">
          <label className="block">
            <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-white/80">
              Titre de l'entretien
            </span>
            <input
              autoFocus
              className="input bg-white/10 text-white placeholder:text-white/60"
              placeholder="ex. FGD — membres du groupe DRR de Toamasina"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-white/80">Type</span>
            <select
              className="input bg-white/10 text-white"
              value={f.interviewType ?? ''}
              onChange={(e) => set('interviewType', e.target.value)}
            >
              {INTERVIEW_TYPES.map((t) => (
                <option key={t} value={t} className="text-black">
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-semibold text-[var(--text-dim)]">Statut :</span>
            {(['DRAFT', 'FINAL'] as TranscriptStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('status', s)}
                className={clsx(
                  'rounded-full px-2.5 py-0.5 text-2xs font-semibold transition',
                  f.status === s
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {quipsOptions.length > 0 && (
            <label className="flex items-center gap-1.5 text-2xs font-semibold text-[var(--text-dim)]">
              Étude QuIPS liée :
              <select
                className="input h-7 py-0 text-xs"
                value={f.quipsId ?? ''}
                onChange={(e) => set('quipsId', e.target.value || null)}
              >
                <option value="">Aucune</option>
                {quipsOptions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <SectionHeader>Informations générales</SectionHeader>
        <div className="grid gap-2.5 rounded-lg border border-[var(--outline)] p-3 sm:grid-cols-2">
          <Row label="Facilitateur d'entretien">
            <input className="input" value={f.facilitator ?? ''} onChange={(e) => set('facilitator', e.target.value)} />
          </Row>
          <Row label="Preneur de notes">
            <input className="input" value={f.noteTaker ?? ''} onChange={(e) => set('noteTaker', e.target.value)} />
          </Row>
          <Row label="Région/district/commune">
            <input className="input" value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} />
          </Row>
          <Row label="Date de l'entretien" hint="(Round 1)">
            <input
              className="input"
              type="date"
              value={f.interviewDate ?? ''}
              onChange={(e) => set('interviewDate', e.target.value)}
            />
          </Row>
          <Row label="Heure de début">
            <input className="input" type="time" value={f.startTime ?? ''} onChange={(e) => set('startTime', e.target.value)} />
          </Row>
          <Row label="Heure de fin">
            <input className="input" type="time" value={f.endTime ?? ''} onChange={(e) => set('endTime', e.target.value)} />
          </Row>
          <Row label="Genre" hint="(composition du groupe, ex. « H/F », « Femmes uniquement »)">
            <input className="input" value={f.genderMix ?? ''} onChange={(e) => set('genderMix', e.target.value)} />
          </Row>
          <Row label="Nombre de participants">
            <input
              className="input"
              type="number"
              min={0}
              value={f.participantCount ?? ''}
              onChange={(e) => set('participantCount', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Row>
        </div>

        <SectionHeader>Tableau de suivi des entretiens</SectionHeader>
        <div className="grid gap-2.5 rounded-lg border border-[var(--outline)] p-3 sm:grid-cols-3">
          <Row label="Région (State)">
            <input className="input" value={f.region ?? ''} onChange={(e) => set('region', e.target.value)} />
          </Row>
          <Row label="Zone administrative locale (LGA)">
            <input className="input" value={f.district ?? ''} onChange={(e) => set('district', e.target.value)} />
          </Row>
          <Row label="Communauté">
            <input className="input" value={f.community ?? ''} onChange={(e) => set('community', e.target.value)} />
          </Row>
          <Row label="Type d'informateur clé" hint="(institutionnel, communautaire...)">
            <input className="input" value={f.kiiType ?? ''} onChange={(e) => set('kiiType', e.target.value)} />
          </Row>
          <Row label="Sexe">
            <input className="input" value={f.sex ?? ''} onChange={(e) => set('sex', e.target.value)} />
          </Row>
          <Row label="Organisation">
            <input className="input" value={f.organizationName ?? ''} onChange={(e) => set('organizationName', e.target.value)} />
          </Row>
          <Row label="Type d'acteur de marché">
            <input className="input" value={f.marketActorType ?? ''} onChange={(e) => set('marketActorType', e.target.value)} />
          </Row>
          <Row label="Date du 2e passage" hint="(Round 2)">
            <input className="input" type="date" value={f.round2Date ?? ''} onChange={(e) => set('round2Date', e.target.value)} />
          </Row>
          <Row label="Étape de revue interne">
            <div className="mt-1 flex flex-wrap gap-1.5">
              {REVIEW_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('reviewStep', s)}
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition',
                    f.reviewStep === s
                      ? 'border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'border border-[var(--outline)] text-[var(--text-dim)] hover:text-[var(--text)]',
                  )}
                >
                  {REVIEW_STEP_LABEL[s]}
                </button>
              ))}
            </div>
          </Row>
        </div>

        <SectionHeader>Personnes interrogées</SectionHeader>
        <div className="space-y-2 rounded-lg border border-[var(--outline)] p-3">
          <div className="space-y-2">
            {f.interviewees.map((i, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--surface-2)] p-2 sm:grid-cols-6">
                <input
                  className="input col-span-2 sm:col-span-2"
                  placeholder="Nom"
                  value={i.name ?? ''}
                  onChange={(e) => setInterviewee(idx, { name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Âge"
                  value={i.age ?? ''}
                  onChange={(e) => setInterviewee(idx, { age: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Type"
                  value={i.type ?? ''}
                  onChange={(e) => setInterviewee(idx, { type: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Statut marital"
                  value={i.maritalStatus ?? ''}
                  onChange={(e) => setInterviewee(idx, { maritalStatus: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <input
                    className="input min-w-0 flex-1"
                    placeholder="Profession"
                    value={i.profession ?? ''}
                    onChange={(e) => setInterviewee(idx, { profession: e.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-btn-sm shrink-0 text-red-500"
                    title="Retirer"
                    onClick={() => removeInterviewee(idx)}
                  >
                    <IconDelete className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn-text btn-sm" onClick={addInterviewee}>
            <IconAdd className="h-4 w-4" /> Ajouter une personne
          </button>
        </div>

        <label className="flex items-center gap-2 px-0.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.consentObtained}
            onChange={(e) => set('consentObtained', e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Consentement éclairé obtenu (introductions faites, objectif de l'étude expliqué)
        </label>

        <SectionHeader>Observations du facilitateur/preneur de notes</SectionHeader>
        <div className="rounded-lg border border-[var(--outline)] p-3">
          <textarea
            className="input min-h-[64px] resize-y text-sm"
            value={f.facilitatorNotes ?? ''}
            onChange={(e) => set('facilitatorNotes', e.target.value)}
          />
        </div>

        <SectionHeader>
          <span className="flex flex-wrap items-center justify-between gap-2 normal-case">
            <span>Sujets / questions, notes et observations (matrice de saisie ou Q/R)</span>
            <button type="button" className="btn-text btn-sm shrink-0 normal-case" onClick={loadMatrixTemplate}>
              Charger le modèle standard
            </button>
          </span>
        </SectionHeader>
        <div className="space-y-2 rounded-lg border border-[var(--outline)] p-3">
          {f.qa.map((q, idx) => (
            <div key={idx} className="rounded-lg bg-[var(--surface-2)] p-2.5">
              <div className="mb-1.5 flex items-start gap-1.5">
                <span className="mt-2 shrink-0 text-xs font-bold text-[var(--text-dim)]">{idx + 1}.</span>
                <textarea
                  className="input min-h-[40px] flex-1 resize-y text-sm"
                  placeholder="Sujet / question / thème abordé"
                  value={q.question}
                  onChange={(e) => setQa(idx, { question: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn-sm mt-1 shrink-0 text-red-500"
                  title="Retirer"
                  onClick={() => removeQa(idx)}
                >
                  <IconDelete className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <textarea
                  className="input min-h-[64px] w-full resize-y text-sm"
                  placeholder="Notes / réponse"
                  value={q.answer ?? ''}
                  onChange={(e) => setQa(idx, { answer: e.target.value })}
                />
                <textarea
                  className="input min-h-[64px] w-full resize-y text-sm"
                  placeholder="Commentaires, idées, observations du chercheur"
                  value={q.researcherNotes ?? ''}
                  onChange={(e) => setQa(idx, { researcherNotes: e.target.value })}
                />
              </div>
            </div>
          ))}
          <button type="button" className="btn-text btn-sm" onClick={addQa}>
            <IconAdd className="h-4 w-4" /> Ajouter une ligne
          </button>
        </div>

        <p className="px-0.5 text-2xs italic text-[var(--text-dim)]">Modèle : {SOURCE_CREDIT}.</p>
      </div>
    </Modal>
  );
}
