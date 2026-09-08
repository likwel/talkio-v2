import type { FormField } from '@/lib/types';
import { IconLocation } from '@/lib/icons';
import Select from '@/components/Select';

interface Props {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  onGeo: (c: { latitude?: number; longitude?: number }) => void;
}

/** Rendu d'un champ de formulaire d'enquete (partage saisie interne + lien public). */
export default function FormFieldInput({ field, value, onChange, onGeo }: Props) {
  const label = (
    <span className="block text-sm font-medium">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
      {field.helpText && (
        <span className="mt-0.5 block text-xs font-normal text-[var(--text-dim)]">{field.helpText}</span>
      )}
    </span>
  );

  switch (field.type) {
    case 'TEXTAREA':
      return (
        <label className="block">
          {label}
          <textarea
            className="input mt-1"
            rows={3}
            placeholder={field.placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </label>
      );
    case 'NUMBER':
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1"
            type="number"
            placeholder={field.placeholder}
            min={field.minValue ?? undefined}
            max={field.maxValue ?? undefined}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            required={field.required}
          />
        </label>
      );
    case 'DATE':
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1"
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </label>
      );
    case 'BOOLEAN':
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case 'SELECT':
      return (
        <div className="block">
          {label}
          <Select
            className="mt-1"
            aria-label={field.label}
            placeholder="—"
            value={value ?? ''}
            onChange={onChange}
            options={field.options.map((o) => ({ value: o, label: o }))}
          />
        </div>
      );
    case 'MULTISELECT':
      return (
        <div>
          {label}
          <div className="mt-1 flex flex-wrap gap-3">
            {field.options.map((o) => {
              const arr: string[] = Array.isArray(value) ? value : [];
              return (
                <label key={o} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={arr.includes(o)}
                    onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                  />
                  {o}
                </label>
              );
            })}
          </div>
        </div>
      );
    case 'GEOPOINT':
      return (
        <div>
          {label}
          <button
            type="button"
            className="btn-outlined mt-1"
            onClick={() =>
              navigator.geolocation.getCurrentPosition((pos) => {
                const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                onChange(`${c.latitude},${c.longitude}`);
                onGeo(c);
              })
            }
          >
            <IconLocation className="h-4 w-4" /> Capturer ma position
          </button>
          {value && <span className="ml-2 text-xs text-[var(--text-dim)]">{value}</span>}
        </div>
      );
    case 'PHOTO':
      return (
        <label className="block">
          {label}
          <input
            className="mt-1 block text-sm"
            type="file"
            accept="image/*"
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
          />
        </label>
      );
    default:
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1"
            placeholder={field.placeholder}
            pattern={field.pattern || undefined}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </label>
      );
  }
}
