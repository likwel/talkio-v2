import { useEffect, useRef, useState } from 'react';
import type { FormField } from '@/lib/types';
import { IconLocation, IconClose } from '@/lib/icons';
import Select from '@/components/Select';

/** Correspondance type de champ -> type d'`<input>` HTML natif. */
const NATIVE_INPUT: Partial<Record<FormField['type'], string>> = {
  DATE: 'date',
  DATETIME: 'datetime-local',
  TIME: 'time',
  EMAIL: 'email',
  PHONE: 'tel',
  URL: 'url',
};

interface Props {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  onGeo?: (c: { latitude?: number; longitude?: number }) => void;
  /** Champ calculé : affiché en lecture seule. */
  readOnly?: boolean;
  /** Message de contrainte non respectée. */
  errorText?: string | null;
}

/** Rendu d'un champ de formulaire d'enquête (partagé : saisie interne + lien public). */
export default function FormFieldInput({ field, value, onChange, onGeo, readOnly, errorText }: Props) {
  const label = (
    <span className="block text-sm font-medium">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
      {field.helpText && (
        <span className="mt-0.5 block text-xs font-normal text-[var(--text-dim)]">{field.helpText}</span>
      )}
    </span>
  );
  const err = errorText ? (
    <span className="mt-1 block text-xs font-medium text-red-600">{errorText}</span>
  ) : null;

  const numberLike = (step?: number) => (
    <label className="block">
      {label}
      <input
        className="input mt-1"
        type="number"
        inputMode={step === 1 ? 'numeric' : 'decimal'}
        step={step ?? 'any'}
        placeholder={field.placeholder}
        min={field.minValue ?? undefined}
        max={field.maxValue ?? undefined}
        value={value ?? ''}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        required={field.required}
      />
      {err}
    </label>
  );

  switch (field.type) {
    case 'NOTE':
      return (
        <div className="rounded-lg border border-dashed border-[var(--outline)] bg-[var(--surface-2)] px-3 py-2">
          <span className="block text-sm font-medium">{field.label}</span>
          {field.helpText && (
            <span className="mt-0.5 block text-xs text-[var(--text-dim)]">{field.helpText}</span>
          )}
        </div>
      );

    case 'TEXTAREA':
      return (
        <label className="block">
          {label}
          <textarea
            className="input mt-1"
            rows={3}
            placeholder={field.placeholder}
            value={value ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
          {err}
        </label>
      );

    case 'NUMBER':
    case 'DECIMAL':
      return numberLike(undefined);
    case 'INTEGER':
      return numberLike(1);

    case 'RANGE': {
      const min = field.minValue ?? 0;
      const max = field.maxValue ?? 10;
      const step = field.rangeStep ?? 1;
      const cur = value === '' || value == null ? min : Number(value);
      return (
        <div className="block">
          {label}
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              className="h-2 flex-1 accent-[var(--accent)]"
              min={min}
              max={max}
              step={step}
              value={cur}
              disabled={readOnly}
              onChange={(e) => onChange(Number(e.target.value))}
            />
            <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{cur}</span>
          </div>
          <div className="flex justify-between text-2xs text-[var(--text-dim)]">
            <span>{min}</span>
            <span>{max}</span>
          </div>
          {err}
        </div>
      );
    }

    case 'DATE':
    case 'DATETIME':
    case 'TIME':
    case 'EMAIL':
    case 'PHONE':
    case 'URL':
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1"
            type={NATIVE_INPUT[field.type] ?? 'text'}
            placeholder={field.placeholder}
            value={value ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
          {err}
        </label>
      );

    case 'BARCODE':
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1 font-mono"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            placeholder={field.placeholder || 'Code-barres / QR (saisie manuelle)'}
            value={value ?? ''}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
          {err}
        </label>
      );

    case 'RATING': {
      const cur = Number(value) || 0;
      return (
        <div className="block">
          {label}
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={readOnly}
                onClick={() => onChange(cur === n ? 0 : n)}
                className={
                  'grid h-8 w-8 place-items-center rounded-md text-lg transition ' +
                  (n <= cur ? 'text-amber-400' : 'text-[var(--outline)] hover:text-amber-300')
                }
                aria-label={`${n} sur 5`}
              >
                ★
              </button>
            ))}
          </div>
          {err}
        </div>
      );
    }

    case 'ACKNOWLEDGE':
      return (
        <label className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-3 py-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={value === true || value === 'OK'}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </span>
        </label>
      );

    case 'BOOLEAN':
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={!!value}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );

    case 'SELECT': {
      if (field.appearance === 'minimal' || field.appearance === 'likert') {
        return (
          <div className="block">
            {label}
            <div
              className={
                field.appearance === 'likert'
                  ? 'mt-1.5 flex flex-wrap gap-2'
                  : 'mt-1.5 flex flex-col gap-1.5'
              }
            >
              {field.options.map((o) => (
                <label
                  key={o}
                  className={
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ' +
                    (String(value) === o
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--outline)] hover:bg-black/5 dark:hover:bg-white/5')
                  }
                >
                  <input
                    type="radio"
                    className="accent-[var(--accent)]"
                    name={field.key}
                    checked={String(value) === o}
                    disabled={readOnly}
                    onChange={() => onChange(o)}
                  />
                  {o}
                </label>
              ))}
            </div>
            {err}
          </div>
        );
      }
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
          {err}
        </div>
      );
    }

    case 'MULTISELECT': {
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <div>
          {label}
          <div
            className={
              field.appearance === 'columns'
                ? 'mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3'
                : 'mt-1.5 flex flex-wrap gap-3'
            }
          >
            {field.options.map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={arr.includes(o)}
                  disabled={readOnly}
                  onChange={() => toggle(o)}
                />
                {o}
              </label>
            ))}
          </div>
          {err}
        </div>
      );
    }

    case 'GEOPOINT':
      return (
        <div>
          {label}
          <button
            type="button"
            className="btn-outlined mt-1"
            disabled={readOnly}
            onClick={() =>
              navigator.geolocation.getCurrentPosition((pos) => {
                const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                onChange(`${c.latitude},${c.longitude}`);
                onGeo?.(c);
              })
            }
          >
            <IconLocation className="h-4 w-4" /> Capturer ma position
          </button>
          {value && <span className="ml-2 text-xs text-[var(--text-dim)]">{value}</span>}
          {err}
        </div>
      );

    case 'SIGNATURE':
      return (
        <div className="block">
          {label}
          <SignaturePad value={value} onChange={onChange} disabled={readOnly} />
          {err}
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
            capture="environment"
            disabled={readOnly}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return onChange('');
              const r = new FileReader();
              r.onload = () => onChange(r.result);
              r.readAsDataURL(f);
            }}
          />
          {typeof value === 'string' && value.startsWith('data:image') && (
            <img src={value} alt="" className="mt-2 max-h-40 rounded-lg border border-[var(--outline)]" />
          )}
          {err}
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
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
          {err}
        </label>
      );
  }
}

/** Zone de dessin de signature -> data URL PNG. */
function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (typeof value === 'string' && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent) => {
    if (disabled) return;
    setDrawing(true);
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing || disabled) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    onChange(ref.current!.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    onChange('');
  };

  return (
    <div className="mt-1">
      <canvas
        ref={ref}
        width={480}
        height={160}
        className="w-full touch-none rounded-lg border border-[var(--outline)] bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      {!disabled && (
        <button type="button" className="btn-text btn-sm mt-1" onClick={clear}>
          <IconClose className="h-4 w-4" /> Effacer
        </button>
      )}
    </div>
  );
}
