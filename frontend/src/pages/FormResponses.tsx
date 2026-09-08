import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FormDef, FormResponse } from '@/lib/types';
import { IconBack, IconDownload } from '@/lib/icons';

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
  return String(v);
}

export default function FormResponses() {
  const { formId } = useParams();

  const form = useQuery({
    queryKey: ['form', formId],
    enabled: !!formId,
    queryFn: async () => (await api.get<FormDef>(`/forms/${formId}`)).data,
  });
  const responses = useQuery({
    queryKey: ['form-responses', formId],
    enabled: !!formId,
    queryFn: async () => (await api.get<FormResponse[]>(`/forms/${formId}/responses`)).data,
  });

  const fields = form.data?.fields ?? [];

  // Statistiques simples par champ numerique / choix
  const stats = useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      const vals = (responses.data ?? [])
        .map((r) => r.answers.find((a) => a.fieldId === f.id)?.value)
        .filter((v) => v !== undefined && v !== null && v !== '');
      if (f.type === 'NUMBER' && vals.length) {
        const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
        const avg = nums.reduce((s, n) => s + n, 0) / (nums.length || 1);
        out[f.id!] = `moy. ${avg.toFixed(1)} · min ${Math.min(...nums)} · max ${Math.max(...nums)}`;
      } else if ((f.type === 'SELECT' || f.type === 'BOOLEAN') && vals.length) {
        const counts = new Map<string, number>();
        vals.forEach((v) => counts.set(String(v), (counts.get(String(v)) ?? 0) + 1));
        out[f.id!] = [...counts.entries()].map(([k, n]) => `${k}: ${n}`).join(' · ');
      }
    }
    return out;
  }, [fields, responses.data]);

  if (form.isLoading) return <div className="p-6 text-[var(--text-dim)]">Chargement…</div>;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/forms" className="icon-btn" aria-label="Retour">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-normal sm:text-[22px]">{form.data?.title}</h1>
        <span className="chip">{responses.data?.length ?? 0} reponse(s)</span>
        <button
          className="btn-tonal ml-auto h-9"
          onClick={() => form.data && downloadCsv(form.data.id, form.data.title)}
        >
          <IconDownload className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-dim)]">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Date</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Par</th>
              {fields.map((f) => (
                <th key={f.id} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {f.label}
                  {stats[f.id!] && <div className="font-normal normal-case text-[var(--text-dim)]">{stats[f.id!]}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {responses.data?.map((r) => (
              <tr key={r.id} className="border-t border-[var(--outline)]">
                <td className="whitespace-nowrap px-3 py-2 text-[var(--text-dim)]">
                  {new Date(r.submittedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{r.submittedBy?.fullName ?? 'Anonyme'}</td>
                {fields.map((f) => (
                  <td key={f.id} className="px-3 py-2">
                    {cellValue(r.answers.find((a) => a.fieldId === f.id)?.value)}
                  </td>
                ))}
              </tr>
            ))}
            {responses.data?.length === 0 && (
              <tr>
                <td colSpan={fields.length + 2} className="px-3 py-8 text-center text-[var(--text-dim)]">
                  Aucune reponse pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
