import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { FormDef, FormResponse, ReviewState } from '@/lib/types';
import { shapeResponse, repeatSections } from '@/lib/formLogic';
import { IconBack, IconDownload, IconClose, IconDelete, IconCheck, IconPlace } from '@/lib/icons';
import { useDialog } from '@/context/DialogContext';
import Pagination, { usePagination } from '@/components/Pagination';

async function downloadCsv(formId: string, title: string) {
  const res = await api.get(`/forms/${formId}/export.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function cellValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'string' && v.startsWith('data:image')) return '[image]';
  return String(v);
}

const REVIEW: Record<ReviewState, { label: string; style: string }> = {
  PENDING: { label: 'En attente', style: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
  APPROVED: { label: 'Approuvée', style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  REJECTED: { label: 'Rejetée', style: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  FLAGGED: { label: 'Signalée', style: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
};
const FILTERS: { id: '' | ReviewState; label: string }[] = [
  { id: '', label: 'Toutes' },
  { id: 'PENDING', label: 'En attente' },
  { id: 'APPROVED', label: 'Approuvées' },
  { id: 'REJECTED', label: 'Rejetées' },
  { id: 'FLAGGED', label: 'Signalées' },
];

export default function FormResponses() {
  const { formId } = useParams();
  const qc = useQueryClient();
  const dialog = useDialog();
  const [filter, setFilter] = useState<'' | ReviewState>('');
  const [openId, setOpenId] = useState<string | null>(null);

  const form = useQuery({
    queryKey: ['form', formId],
    enabled: !!formId,
    queryFn: async () => (await api.get<FormDef>(`/forms/${formId}`)).data,
  });
  const responses = useQuery({
    queryKey: ['form-responses', formId, filter],
    enabled: !!formId,
    queryFn: async () =>
      (await api.get<FormResponse[]>(`/forms/${formId}/responses`, { params: filter ? { review: filter } : {} })).data,
  });

  const review = useMutation({
    mutationFn: async (v: { id: string; reviewState: ReviewState; reviewNote?: string | null }) =>
      (await api.patch(`/forms/${formId}/responses/${v.id}/review`, {
        reviewState: v.reviewState,
        reviewNote: v.reviewNote ?? null,
      })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form-responses', formId] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/forms/${formId}/responses/${id}`),
    onSuccess: () => {
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ['form-responses', formId] });
    },
  });

  const fd = form.data;
  const flatFields = useMemo(() => {
    if (!fd) return [];
    const repeatKeys = new Set(repeatSections(fd).map((s) => s.key));
    return (fd.fields ?? []).filter((f) => f.type !== 'NOTE' && !(f.sectionKey && repeatKeys.has(f.sectionKey)));
  }, [fd]);

  const rows = responses.data ?? [];
  const pg = usePagination(rows, 25, `${formId}${filter}`);
  const openResp = rows.find((r) => r.id === openId) ?? null;

  async function confirmDelete(id: string) {
    const ok = await dialog.confirm({
      title: 'Supprimer la réponse',
      message: 'Cette soumission sera définitivement supprimée.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) remove.mutate(id);
  }

  if (form.isLoading) return <div className="p-6 text-[var(--text-dim)]">Chargement…</div>;

  return (
    <div className="page space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/meal?tab=forms" className="icon-btn" aria-label="Retour">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="page-title truncate">{fd?.title}</h1>
        <span className="chip">{rows.length} réponse(s)</span>
        <button className="btn-tonal ml-auto" onClick={() => fd && downloadCsv(fd.id, fd.title)}>
          <IconDownload className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-sm font-semibold">
        {FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            onClick={() => setFilter(f.id)}
            className={clsx(
              'rounded-md px-3 py-1.5 transition',
              filter === f.id ? 'bg-[var(--surface)] shadow-elevation-1' : 'text-[var(--text-dim)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-dim)]">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Date</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Statut</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Par</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">E-mail</th>
              {flatFields.map((f) => (
                <th key={f.id ?? f.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {pg.slice.map((r) => {
              const shaped = fd ? shapeResponse(fd, r) : { flat: {}, repeats: {} };
              const rs = r.reviewState ?? 'PENDING';
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-[var(--outline)] hover:bg-[var(--surface-2)]"
                  onClick={() => setOpenId(r.id)}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--text-dim)]">
                    {new Date(r.submittedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-3 py-2">
                    <span className={clsx('rounded-md px-2 py-0.5 text-2xs font-semibold', REVIEW[rs].style)}>
                      {REVIEW[rs].label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{r.submittedBy?.fullName ?? 'Anonyme'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--text-dim)]">{r.email ?? '—'}</td>
                  {flatFields.map((f) => (
                    <td key={f.id ?? f.key} className="px-3 py-2">
                      {cellValue(shaped.flat[f.key])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button
                      className="icon-btn-sm text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDelete(r.id);
                      }}
                      title="Supprimer"
                    >
                      <IconDelete className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={flatFields.length + 5} className="px-3 py-8 text-center text-[var(--text-dim)]">
                  Aucune réponse {filter ? 'dans ce filtre' : 'pour le moment'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={pg.page}
        pageCount={pg.pageCount}
        onChange={pg.setPage}
        total={pg.total}
        start={pg.start}
        end={pg.end}
      />

      {openResp && fd && (
        <ResponseDrawer
          form={fd}
          resp={openResp}
          onClose={() => setOpenId(null)}
          onReview={(reviewState, reviewNote) => review.mutate({ id: openResp.id, reviewState, reviewNote })}
          onDelete={() => confirmDelete(openResp.id)}
          busy={review.isPending || remove.isPending}
        />
      )}
    </div>
  );
}

function ResponseDrawer({
  form,
  resp,
  onClose,
  onReview,
  onDelete,
  busy,
}: {
  form: FormDef;
  resp: FormResponse;
  onClose: () => void;
  onReview: (s: ReviewState, note: string | null) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const shaped = useMemo(() => shapeResponse(form, resp), [form, resp]);
  const [note, setNote] = useState(resp.reviewNote ?? '');
  const flatFields = (form.fields ?? []).filter(
    (f) => !f.sectionKey || !repeatSections(form).some((s) => s.key === f.sectionKey),
  );

  const renderVal = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('data:image')) {
      return <img src={v} alt="" className="mt-1 max-h-40 rounded-lg border border-[var(--outline)]" />;
    }
    return <span className="text-sm">{cellValue(v)}</span>;
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-[var(--surface)] shadow-elevation-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--outline)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">Réponse</div>
            <div className="text-2xs text-[var(--text-dim)]">
              {new Date(resp.submittedAt).toLocaleString('fr-FR')} · v{resp.formVersion ?? 1}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-[var(--outline)] p-3 text-xs">
            <div>
              <span className="text-[var(--text-dim)]">Par :</span> {resp.submittedBy?.fullName ?? 'Anonyme'}
            </div>
            {resp.email && (
              <div>
                <span className="text-[var(--text-dim)]">E-mail :</span> {resp.email}
              </div>
            )}
            {(resp.latitude != null || resp.longitude != null) && (
              <a
                className="mt-1 inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
                href={`https://www.openstreetmap.org/?mlat=${resp.latitude}&mlon=${resp.longitude}#map=16/${resp.latitude}/${resp.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <IconPlace className="h-3.5 w-3.5" /> {resp.latitude?.toFixed(5)}, {resp.longitude?.toFixed(5)}
              </a>
            )}
          </div>

          <div className="space-y-2">
            {flatFields.map((f) => (
              <div key={f.id ?? f.key}>
                <div className="text-2xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">{f.label}</div>
                {renderVal(shaped.flat[f.key])}
              </div>
            ))}
          </div>

          {repeatSections(form).map((s) => {
            const entries = shaped.repeats[s.key] ?? [];
            if (!entries.length) return null;
            const children = (form.fields ?? []).filter((f) => f.sectionKey === s.key);
            return (
              <div key={s.key}>
                <div className="mb-1 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                  {s.title} ({entries.length})
                </div>
                <div className="space-y-2">
                  {entries.map((entry, i) => (
                    <div key={i} className="rounded-lg border border-[var(--outline)] bg-[var(--surface-2)] p-2.5">
                      <div className="mb-1 text-2xs font-semibold text-[var(--text-dim)]">
                        {(s.repeatLabel || 'Entrée')} #{i + 1}
                      </div>
                      {children.map((cf) => (
                        <div key={cf.key} className="text-xs">
                          <span className="text-[var(--text-dim)]">{cf.label} :</span> {cellValue(entry[cf.key])}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Revue */}
          <div className="rounded-lg border border-[var(--outline)] p-3">
            <div className="mb-2 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">Revue qualité</div>
            <textarea
              className="input mb-2 text-sm"
              rows={2}
              placeholder="Note de revue (optionnel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary btn-sm"
                disabled={busy}
                onClick={() => onReview('APPROVED', note || null)}
              >
                <IconCheck className="h-4 w-4" /> Approuver
              </button>
              <button
                className="btn-outlined btn-sm"
                disabled={busy}
                onClick={() => onReview('FLAGGED', note || null)}
              >
                Signaler
              </button>
              <button
                className="btn-outlined btn-sm text-red-600"
                disabled={busy}
                onClick={() => onReview('REJECTED', note || null)}
              >
                Rejeter
              </button>
              <button className="btn-text btn-sm" disabled={busy} onClick={() => onReview('PENDING', note || null)}>
                Remettre en attente
              </button>
            </div>
            {resp.reviewedBy && (
              <p className="mt-2 text-2xs text-[var(--text-dim)]">
                Dernière revue par {resp.reviewedBy.fullName}
                {resp.reviewedAt ? ` · ${new Date(resp.reviewedAt).toLocaleString('fr-FR')}` : ''}
              </p>
            )}
          </div>

          <button className="btn-outlined btn-sm w-full text-red-600" onClick={onDelete} disabled={busy}>
            <IconDelete className="h-4 w-4" /> Supprimer la réponse
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
