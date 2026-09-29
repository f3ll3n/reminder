import type { Repeat, Reminder } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1, base.getHours(), base.getMinutes(), 0, 0);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(base.getDate(), lastDay));
  return d;
}

/** Первое срабатывание строго позже `after`. null — срабатываний больше нет. */
export function nextOccurrence(startAt: number, repeat: Repeat, after: number): number | null {
  const start = new Date(startAt);
  const n = Math.max(1, Math.floor(repeat.interval || 1));

  switch (repeat.kind) {
    case 'none':
      return startAt > after ? startAt : null;

    case 'hours': {
      if (startAt > after) return startAt;
      const step = n * HOUR;
      return startAt + (Math.floor((after - startAt) / step) + 1) * step;
    }

    case 'days': {
      if (startAt > after) return startAt;
      // setDate сохраняет локальное время суток при переходе на летнее/зимнее время
      const k = Math.max(0, Math.floor((after - startAt) / (n * DAY)) - 1);
      const d = new Date(start);
      d.setDate(d.getDate() + k * n);
      while (d.getTime() <= after) d.setDate(d.getDate() + n);
      return d.getTime();
    }

    case 'weekdays': {
      const days = new Set(repeat.weekdays);
      if (days.size === 0) return null;
      const base = new Date(Math.max(after, startAt));
      for (let i = 0; i <= 7; i++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, start.getHours(), start.getMinutes());
        const t = d.getTime();
        if (t > after && t >= startAt && days.has(d.getDay())) return t;
      }
      return null;
    }

    case 'monthly':
    case 'yearly': {
      if (startAt > after) return startAt;
      const step = repeat.kind === 'monthly' ? n : n * 12;
      const a = new Date(after);
      const monthsDiff = (a.getFullYear() - start.getFullYear()) * 12 + (a.getMonth() - start.getMonth());
      let k = Math.max(0, Math.floor(monthsDiff / step) - 1);
      let d = addMonthsClamped(start, k * step);
      while (d.getTime() <= after) d = addMonthsClamped(start, ++k * step);
      return d.getTime();
    }
  }
}

export function upcoming(startAt: number, repeat: Repeat, from: number, count: number): number[] {
  const out: number[] = [];
  let cursor = from;
  while (out.length < count) {
    const next = nextOccurrence(startAt, repeat, cursor);
    if (next === null) break;
    out.push(next);
    cursor = next;
  }
  return out;
}

/** Момент, когда напоминание должно сработать (с учётом snooze). */
export function dueAt(r: Reminder): number | null {
  if (r.status !== 'active') return null;
  if (r.snoozeUntil !== null && (r.nextAt === null || r.snoozeUntil < r.nextAt)) return r.snoozeUntil;
  return r.nextAt;
}
