import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import type { Project, QualitativeInquiry, QuipsStatus } from '@/lib/types';
import { IconChecklist, IconDownload, IconPrint } from '@/lib/icons';
import clsx from 'clsx';

/**
 * Types de données de la fiche QuIPS officielle (USAID/IDEAL) :
 * processus / produit / résultat / impact / contexte / thème transversal.
 */
const DATA_TYPES = ['Processus', 'Produit', 'Résultat', 'Impact', 'Contexte', 'Thème transversal'];

const STATUS_LABEL: Record<QuipsStatus, string> = { DRAFT: 'Brouillon', FINAL: 'Finalisée' };

const SOURCE_CREDIT = 'Qualitative Inquiry Planning Sheet (QuIPS) — USAID / IDEAL';

type FormState = Omit<QualitativeInquiry, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>;

const EMPTY: FormState = {
  code: '',
  title: '',
  status: 'DRAFT',
  sourceDocuments: '',
  evidenceGaps: '',
  collaborators: '',
  reviewers: '',
  stakeholders: '',
  purpose: '',
  objectives: '',
  researchQuestions: '',
  dataTypes: [],
  dataSources: '',
  samplingStrategy: '',
  dataCollectionTools: '',
  teamComposition: '',
  frequencyTiming: '',
  trainingRequirements: '',
  dataManagement: '',
  implementationTimeline: '',
  dataAnalysisPlan: '',
  disaggregatedBy: '',
  deliverables: '',
  utilizationApplication: '',
  limitationsRisks: '',
  ethicalReviewStatus: '',
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

const ta = 'input min-h-[64px] resize-y text-sm';

/** Sérialise la fiche en texte brut (pour export/téléchargement), fidèle au gabarit officiel. */
function toPlainText(f: FormState): string {
  const v = (s?: string | null) => (s && s.trim() ? s.trim() : '—');
  return [
    `LA FICHE DE PLANIFICATION D'ENQUÊTE QUALITATIVE (QuIPS)`,
    `Suivi qualitatif / Enquête qualitative # : ${f.code || '—'} — ${f.title || '—'}`,
    `Statut : ${STATUS_LABEL[f.status ?? 'DRAFT']}`,
    ``,
    `TRAVAIL PRÉPARATOIRE`,
    `-- Documents sources et lacunes dans les données probantes --`,
    `Documents sources : ${v(f.sourceDocuments)}`,
    `Lacune(s) dans les données probantes : ${v(f.evidenceGaps)}`,
    `-- Équipe et parties prenantes --`,
    `Collaborateurs : ${v(f.collaborators)}`,
    `Réviseurs : ${v(f.reviewers)}`,
    `Parties prenantes : ${v(f.stakeholders)}`,
    ``,
    `SECTION 1 : BUT, OBJECTIFS ET QUESTIONS DE RECHERCHE`,
    `But : ${v(f.purpose)}`,
    `Objectif(s) : ${v(f.objectives)}`,
    `Question(s) de recherche / d'enquête : ${v(f.researchQuestions)}`,
    `Type de données : ${f.dataTypes.length ? f.dataTypes.join(', ') : '—'}`,
    ``,
    `SECTION 2 : CONCEPTION ET MÉTHODOLOGIE`,
    `Sources des données et méthodes d'enquête : ${v(f.dataSources)}`,
    `Stratégie d'échantillonnage et critères de sélection : ${v(f.samplingStrategy)}`,
    `Outils de collecte de données : ${v(f.dataCollectionTools)}`,
    ``,
    `SECTION 3 : PLAN DE MISE EN ŒUVRE`,
    `Composition de l'équipe de l'étude : ${v(f.teamComposition)}`,
    `Fréquence et timing : ${v(f.frequencyTiming)}`,
    `Exigences relatives à la formation : ${v(f.trainingRequirements)}`,
    `Enregistrement des données, gestion des données et assurance de la qualité : ${v(f.dataManagement)}`,
    `Calendrier de mise en œuvre : ${v(f.implementationTimeline)}`,
    ``,
    `SECTION 4 : ANALYSE DES DONNÉES, LIVRABLES ET APPLICATION`,
    `Plan d'analyse des données : ${v(f.dataAnalysisPlan)}`,
    `Ventilées par : ${v(f.disaggregatedBy)}`,
    `Livrables : ${v(f.deliverables)}`,
    `Utilisation / application : ${v(f.utilizationApplication)}`,
    ``,
    `SECTION 5 : INFORMATIONS SUPPLÉMENTAIRES`,
    `Limites et risques : ${v(f.limitationsRisks)}`,
    `Statut de l'évaluation éthique / consentement éclairé : ${v(f.ethicalReviewStatus)}`,
    ``,
    `Modèle : ${SOURCE_CREDIT}`,
  ].join('\n');
}

export default function QuipsModal({
  open,
  onClose,
  project,
  quips,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** Fiche a editer, ou `null` pour une nouvelle fiche. */
  quips: QualitativeInquiry | null;
  onSaved: () => void;
}) {
  const [f, setF] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const editing = !!quips?.id;

  useEffect(() => {
    if (!open) return;
    setF(quips ? { ...EMPTY, ...quips, dataTypes: quips.dataTypes ?? [] } : EMPTY);
  }, [open, quips]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((cur) => ({ ...cur, [key]: value }));
  }
  function toggleType(t: string) {
    set('dataTypes', f.dataTypes.includes(t) ? f.dataTypes.filter((x) => x !== t) : [...f.dataTypes, t]);
  }

  async function save() {
    if (!f.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...f, code: f.code || null };
      if (editing && quips) {
        await api.patch(`/meal/quips/${quips.id}`, payload);
      } else {
        await api.post(`/meal/projects/${project.id}/quips`, payload);
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
    a.download = `${(f.code ? `${f.code}_` : '') + (f.title || 'QuIPS')}.txt`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Ouvre une mise en page imprimable dans un nouvel onglet (fidèle au gabarit officiel QuIPS). */
  function printSheet() {
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (!win) return;
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const row = (label: string, value?: string | null, hint?: string) =>
      `<tr><td class="lbl">${esc(label)}${hint ? ` <span class="hint">${esc(hint)}</span>` : ''}</td></tr><tr><td class="val">${esc(value && value.trim() ? value : '—')}</td></tr>`;
    const section = (title: string) => `<tr><td class="sec">${esc(title)}</td></tr>`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.title || 'QuIPS')}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:24px;}
  h1{font-size:15px;margin:0 0 10px;}
  table{width:100%;border-collapse:collapse;margin-bottom:6px;}
  td{border:1px solid #999;padding:5px 8px;vertical-align:top;}
  td.banner{background:#0b3d91;color:#fff;font-weight:bold;font-size:13px;}
  td.sec{background:#404040;color:#fff;font-weight:bold;text-transform:uppercase;font-size:10.5px;}
  td.lbl{background:#e2e2e2;font-weight:bold;font-size:10.5px;}
  td.lbl .hint{font-weight:normal;font-style:italic;text-transform:none;}
  td.val{background:#fff;white-space:pre-wrap;min-height:18px;}
  .credit{margin-top:10px;font-size:9px;color:#666;font-style:italic;}
  @media print { body{margin:10mm;} }
</style></head><body>
<h1>La fiche de planification d'enquête qualitative (QuIPS)</h1>
<table>
  <tr><td class="banner">Suivi qualitatif / Enquête qualitative # ${esc(f.code || '—')} — ${esc(f.title || 'Sans titre')}</td></tr>
  ${section('Travail préparatoire')}
  ${section('Documents sources et lacunes dans les données probantes')}
  ${row('Documents sources', f.sourceDocuments, "documents consultés lors de l'examen documentaire")}
  ${row('Lacune(s) dans les données probantes', f.evidenceGaps)}
  ${section('Équipe et parties prenantes')}
  ${row('Collaborateurs', f.collaborators)}
  ${row('Réviseurs', f.reviewers)}
  ${row('Parties prenantes', f.stakeholders)}
  ${section('Section 1 : But, objectifs et questions de recherche')}
  ${row('But', f.purpose)}
  ${row("Objectif(s)", f.objectives)}
  ${row("Question(s) de recherche / d'enquête", f.researchQuestions)}
  ${row('Type de données', f.dataTypes.join(', '))}
  ${section('Section 2 : Conception et méthodologie')}
  ${row("Sources des données et méthodes d'enquête", f.dataSources)}
  ${row("Stratégie d'échantillonnage et critères de sélection", f.samplingStrategy)}
  ${row('Outils de collecte de données', f.dataCollectionTools)}
  ${section('Section 3 : Plan de mise en œuvre')}
  ${row("Composition de l'équipe de l'étude", f.teamComposition)}
  ${row('Fréquence et timing', f.frequencyTiming)}
  ${row('Exigences relatives à la formation', f.trainingRequirements)}
  ${row('Enregistrement des données, gestion des données et assurance de la qualité', f.dataManagement)}
  ${row('Calendrier de mise en œuvre', f.implementationTimeline)}
  ${section('Section 4 : Analyse des données, livrables et application')}
  ${row("Plan d'analyse des données", f.dataAnalysisPlan)}
  ${row('Ventilées par', f.disaggregatedBy, 'ex. genre, âge, handicap, degré de pauvreté, composition de la famille')}
  ${row('Livrables', f.deliverables)}
  ${row('Utilisation / application', f.utilizationApplication)}
  ${section('Section 5 : Informations supplémentaires')}
  ${row('Limites et risques', f.limitationsRisks)}
  ${row("Statut de l'évaluation éthique / consentement éclairé", f.ethicalReviewStatus)}
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
          <IconChecklist className="h-5 w-5 text-[var(--accent)]" />
          {editing ? 'Fiche QuIPS' : 'Nouvelle fiche QuIPS'}
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
        {/* Bandeau « Suivi qualitatif / Enquête qualitative # », comme l'entete de la fiche officielle */}
        <div className="grid gap-2 rounded-lg bg-[var(--accent)] p-3 text-white sm:grid-cols-[160px_1fr]">
          <label className="block">
            <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-white/80">QM/QS #</span>
            <input
              className="input bg-white/10 text-white placeholder:text-white/60"
              placeholder="Code"
              value={f.code ?? ''}
              onChange={(e) => set('code', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-white/80">
              Suivi qualitatif / enquête qualitative
            </span>
            <input
              autoFocus
              className="input bg-white/10 text-white placeholder:text-white/60"
              placeholder="Insérez le titre du suivi qualitatif ou de l'enquête"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-semibold text-[var(--text-dim)]">Statut :</span>
          {(['DRAFT', 'FINAL'] as QuipsStatus[]).map((s) => (
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

        <SectionHeader>Travail préparatoire</SectionHeader>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <span className="text-2xs font-bold text-[var(--text-dim)]">
            Documents sources et lacunes dans les données probantes
          </span>
          <Row
            label="Documents sources"
            hint="(consultés dans le cadre de l'examen documentaire afin d'identifier les lacunes en matière de données probantes)"
          >
            <textarea className={ta} value={f.sourceDocuments ?? ''} onChange={(e) => set('sourceDocuments', e.target.value)} />
          </Row>
          <Row label="Lacune(s) dans les données probantes" hint="(énumérez toutes les lacunes identifiées)">
            <textarea className={ta} value={f.evidenceGaps ?? ''} onChange={(e) => set('evidenceGaps', e.target.value)} />
          </Row>
        </div>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <span className="text-2xs font-bold text-[var(--text-dim)]">Équipe et parties prenantes</span>
          <Row label="Collaborateurs">
            <textarea className={ta} value={f.collaborators ?? ''} onChange={(e) => set('collaborators', e.target.value)} />
          </Row>
          <Row label="Réviseurs">
            <textarea className={ta} value={f.reviewers ?? ''} onChange={(e) => set('reviewers', e.target.value)} />
          </Row>
          <Row label="Parties prenantes">
            <textarea className={ta} value={f.stakeholders ?? ''} onChange={(e) => set('stakeholders', e.target.value)} />
          </Row>
        </div>

        <SectionHeader>Section 1 — But, objectifs et questions de recherche</SectionHeader>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <Row label="But">
            <textarea className={ta} value={f.purpose ?? ''} onChange={(e) => set('purpose', e.target.value)} />
          </Row>
          <Row label="Objectif(s)">
            <textarea className={ta} value={f.objectives ?? ''} onChange={(e) => set('objectives', e.target.value)} />
          </Row>
          <Row label="Question(s) de recherche / d'enquête">
            <textarea className={ta} value={f.researchQuestions ?? ''} onChange={(e) => set('researchQuestions', e.target.value)} />
          </Row>
          <Row label="Type de données">
            <div className="flex flex-wrap gap-1.5">
              {DATA_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                    f.dataTypes.includes(t)
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                      : 'border-[var(--outline)] text-[var(--text-dim)] hover:text-[var(--text)]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
        </div>

        <SectionHeader>Section 2 — Conception et méthodologie</SectionHeader>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <Row label="Sources des données et méthodes d'enquête">
            <textarea className={ta} value={f.dataSources ?? ''} onChange={(e) => set('dataSources', e.target.value)} />
          </Row>
          <Row label="Stratégie d'échantillonnage et critères de sélection">
            <textarea className={ta} value={f.samplingStrategy ?? ''} onChange={(e) => set('samplingStrategy', e.target.value)} />
          </Row>
          <Row label="Outils de collecte de données">
            <textarea className={ta} value={f.dataCollectionTools ?? ''} onChange={(e) => set('dataCollectionTools', e.target.value)} />
          </Row>
        </div>

        <SectionHeader>Section 3 — Plan de mise en œuvre</SectionHeader>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <Row label="Composition de l'équipe de l'étude">
            <textarea className={ta} value={f.teamComposition ?? ''} onChange={(e) => set('teamComposition', e.target.value)} />
          </Row>
          <Row label="Fréquence et timing">
            <textarea className={ta} value={f.frequencyTiming ?? ''} onChange={(e) => set('frequencyTiming', e.target.value)} />
          </Row>
          <Row label="Exigences relatives à la formation">
            <textarea className={ta} value={f.trainingRequirements ?? ''} onChange={(e) => set('trainingRequirements', e.target.value)} />
          </Row>
          <Row label="Enregistrement des données, gestion des données et assurance de la qualité">
            <textarea className={ta} value={f.dataManagement ?? ''} onChange={(e) => set('dataManagement', e.target.value)} />
          </Row>
          <Row label="Calendrier de mise en œuvre">
            <textarea className={ta} value={f.implementationTimeline ?? ''} onChange={(e) => set('implementationTimeline', e.target.value)} />
          </Row>
        </div>

        <SectionHeader>Section 4 — Analyse des données, livrables et application</SectionHeader>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <Row label="Plan d'analyse des données">
            <textarea className={ta} value={f.dataAnalysisPlan ?? ''} onChange={(e) => set('dataAnalysisPlan', e.target.value)} />
          </Row>
          <Row label="Ventilées par" hint="(par exemple, genre, âge, handicap, degré de pauvreté, composition de la famille)">
            <textarea className={ta} value={f.disaggregatedBy ?? ''} onChange={(e) => set('disaggregatedBy', e.target.value)} />
          </Row>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Row label="Livrables">
              <textarea className={ta} value={f.deliverables ?? ''} onChange={(e) => set('deliverables', e.target.value)} />
            </Row>
            <Row label="Utilisation / application">
              <textarea className={ta} value={f.utilizationApplication ?? ''} onChange={(e) => set('utilizationApplication', e.target.value)} />
            </Row>
          </div>
        </div>

        <SectionHeader>Section 5 — Informations supplémentaires</SectionHeader>
        <div className="space-y-2.5 rounded-lg border border-[var(--outline)] p-3">
          <Row label="Limites et risques">
            <textarea className={ta} value={f.limitationsRisks ?? ''} onChange={(e) => set('limitationsRisks', e.target.value)} />
          </Row>
          <Row label="Statut de l'évaluation éthique / consentement éclairé">
            <textarea className={ta} value={f.ethicalReviewStatus ?? ''} onChange={(e) => set('ethicalReviewStatus', e.target.value)} />
          </Row>
        </div>

        <p className="px-0.5 text-2xs italic text-[var(--text-dim)]">Modèle : {SOURCE_CREDIT}.</p>
      </div>
    </Modal>
  );
}
