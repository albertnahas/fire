const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function money(v: number, currency = 'USD', maxFrac = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  }).format(Math.round(v));
}

/** Compact form for axes and dense tables: $1.24M, $890k. */
export function compact(v: number, currency = 'USD'): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  const sym = symbolFor(currency);
  if (a >= 1e9) return `${sign}${sym}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${sign}${sym}${Math.round(a / 1e3)}k`;
  return `${sign}${sym}${Math.round(a)}`;
}

export function symbolFor(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
      .formatToParts(1);
    return parts.find((p) => p.type === 'currency')?.value ?? '$';
  } catch {
    return '$';
  }
}

export function pct(v: number, frac = 1): string {
  return `${(v * 100).toFixed(frac)}%`;
}

export function longDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthYear(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** "9 years, 4 months" — the phrasing people actually use. */
export function duration(months: number): string {
  const y = Math.floor(months / 12);
  const m = Math.round(months % 12);
  if (y === 0) return `${m} month${m === 1 ? '' : 's'}`;
  if (m === 0) return `${y} year${y === 1 ? '' : 's'}`;
  return `${y} year${y === 1 ? '' : 's'}, ${m} month${m === 1 ? '' : 's'}`;
}

export const WEEKS_PER_MONTH = 52.1775 / 12;

export interface Countdown {
  weeks: number;
  workWeeks: number;
  mondays: number;
  workDays: number;
  months: number;
  paychecks: number;
}

/**
 * The countdown, in the units a working life is actually measured in.
 * Work weeks strip out 5 weeks a year of holiday and public days off.
 */
export function countdown(months: number): Countdown {
  const weeks = months * WEEKS_PER_MONTH;
  const years = months / 12;
  return {
    weeks: Math.round(weeks),
    workWeeks: Math.round(weeks - years * 5),
    mondays: Math.round(weeks),
    workDays: Math.round((weeks - years * 5) * 5),
    months: Math.round(months),
    paychecks: Math.round(months * 2),
  };
}
