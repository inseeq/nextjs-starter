const DAY_MS = 86_400_000;

/** Numbers from the API can arrive as strings (BIGNUMERIC, INT64). */
export function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function money(value: number, currency: string, { compact = false } = {}): string {
  const large = compact && Math.abs(value) >= 10_000;
  const digits = large ? 1 : compact || Math.abs(value) >= 100 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: large ? 'compact' : 'standard',
    minimumFractionDigits: large ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function count(value: number, { compact = false } = {}): string {
  return new Intl.NumberFormat('en-US', {
    notation: compact && Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: value < 0.1 ? 1 : 0 }).format(value);
}

export function ratio(part: number, whole: number): number | null {
  return whole ? part / whole : null;
}

function utc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, days: number): string {
  return new Date(utc(day).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** "Nov 8" for a YYYY-MM-DD day. */
export function shortDay(day: string): string {
  return utc(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** "Oct 10 to Nov 8, 2026". */
export function dayRange(start: string, end: string): string {
  const year = (day: string) => utc(day).getUTCFullYear();
  const startText = year(start) === year(end) ? shortDay(start) : `${shortDay(start)}, ${year(start)}`;
  return `${startText} to ${shortDay(end)}, ${year(end)}`;
}

/** "2 hours ago", for a timestamp. */
export function timeAgo(timestamp: string, now = Date.now()): string {
  const seconds = Math.round((new Date(timestamp).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return 'just now';
}

/** "Nov 9, 2026, 9:32 AM EST", for a tooltip. */
export function fullTime(timestamp: string, timeZone: string): string {
  return new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone });
}

/** "paid_social_meta" to "Paid social meta". */
export function humanize(key: string): string {
  const text = key.replaceAll('_', ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
