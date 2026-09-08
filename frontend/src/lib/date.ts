// Petites fonctions de dates (semaine commencant le lundi), sans dependance externe.

export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = lundi
  return addDays(x, -day);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Grille du mois : 6 semaines de 7 jours, lundi -> dimanche. */
export function monthGrid(anchor: Date): Date[] {
  const first = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

const FMT_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const FMT_DAY_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const FMT_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const FMT_TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const FMT_RANGE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

export const fmtDayShort = (d: Date) => FMT_DAY.format(d).replace('.', '');
export const fmtDayLong = (d: Date) => FMT_DAY_LONG.format(d);
export const fmtMonthYear = (d: Date) => FMT_MONTH_YEAR.format(d);
export const fmtTime = (d: Date) => FMT_TIME.format(d);

export function fmtWeekRange(anchor: Date): string {
  const days = weekDays(anchor);
  const a = days[0];
  const b = days[6];
  if (a.getMonth() === b.getMonth()) {
    return `${FMT_MONTH_YEAR.format(a)}`;
  }
  return `${FMT_RANGE.format(a)} – ${FMT_RANGE.format(b)} ${b.getFullYear()}`;
}

/** Convertit une valeur Date en chaine "yyyy-MM-ddThh:mm" pour input datetime-local. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export function fromLocalInput(s: string): Date {
  return new Date(s);
}

/** Minutes depuis minuit (utile pour positionner un evenement dans la grille). */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
