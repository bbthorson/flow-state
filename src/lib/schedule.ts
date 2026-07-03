import { ScheduleTriggerDetails } from '@/types';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Minutes since midnight for a 'HH:MM' string (NaN-safe: returns 0 on bad input). */
export function toMinutes(time: string): number {
  const [h, m] = (time || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Current local time as 'HH:MM'. */
export function nowHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

/** Human-readable summary of a schedule trigger, e.g. "Weekdays at 09:00". */
export function formatSchedule(details: Partial<ScheduleTriggerDetails>): string {
  const time = details.time || '--:--';
  const days = details.days ?? [];

  if (days.length === 0 || days.length === 7) return `Every day at ${time}`;

  const sorted = [...days].sort((a, b) => a - b);
  const setEq = (a: number[]) => a.length === sorted.length && a.every((d) => sorted.includes(d));

  if (setEq(WEEKDAYS)) return `Weekdays at ${time}`;
  if (setEq(WEEKEND)) return `Weekends at ${time}`;

  return `${sorted.map((d) => DAY_LABELS[d]).join(', ')} at ${time}`;
}
