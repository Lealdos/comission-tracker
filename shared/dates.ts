// All dates are plain "YYYY-MM-DD" strings and months are "YYYY-MM".
// Arithmetic happens in UTC so a deal never shifts a day because of the viewer's timezone.

const DAY_MS = 86_400_000;

export function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUTC(new Date(toUTC(date).getTime() + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / DAY_MS);
}

/** Completed years from `from` to `on`; the anniversary itself counts as a full year. */
export function fullYearsBetween(from: string, on: string): number {
  const a = toUTC(from);
  const b = toUTC(on);
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  const beforeAnniversary =
    b.getUTCMonth() < a.getUTCMonth() ||
    (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate());
  if (beforeAnniversary) years--;
  return Math.max(0, years);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Last calendar day of the month, e.g. "2026-02" -> "2026-02-28". */
export function monthEnd(month: string): string {
  return addDays(monthStart(nextMonth(month)), -1);
}

/** Every date in `month` that falls on `weekday` (0 = Sunday … 5 = Friday). */
export function weekdaysInMonth(month: string, weekday: number): string[] {
  const out: string[] = [];
  const end = monthEnd(month);
  for (let d = monthStart(month); d <= end; d = addDays(d, 1)) {
    if (toUTC(d).getUTCDay() === weekday) out.push(d);
  }
  return out;
}

/** Today's date in the viewer's local timezone. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
