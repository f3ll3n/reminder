import type { Repeat } from './types';

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** Порядок отображения: пн … вс (значения — Date.getDay()) */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function describeRepeat(repeat: Repeat, startAt: number): string {
  const n = Math.max(1, repeat.interval || 1);
  const start = new Date(startAt);
  switch (repeat.kind) {
    case 'none':
      return 'Однократно';
    case 'hours':
      return n === 1 ? 'Каждый час' : `Каждые ${n} ${plural(n, ['час', 'часа', 'часов'])}`;
    case 'days':
      return n === 1 ? 'Каждый день' : `Каждые ${n} ${plural(n, ['день', 'дня', 'дней'])}`;
    case 'weekdays': {
      const set = new Set(repeat.weekdays);
      if (set.size === 0) return 'Дни недели не выбраны';
      if (set.size === 7) return 'Каждый день';
      if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'По будням';
      if (set.size === 2 && set.has(0) && set.has(6)) return 'По выходным';
      return 'По ' + WEEK_ORDER.filter((d) => set.has(d)).map((d) => WEEKDAY_SHORT[d]).join(', ');
    }
    case 'monthly':
      return (n === 1 ? 'Ежемесячно' : `Каждые ${n} ${plural(n, ['месяц', 'месяца', 'месяцев'])}`) + `, ${start.getDate()} числа`;
    case 'yearly':
      return (n === 1 ? 'Ежегодно' : `Каждые ${n} ${plural(n, ['год', 'года', 'лет'])}`) + `, ${start.getDate()} ${MONTHS_GEN[start.getMonth()]}`;
  }
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const dateNoYearFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayDiff(ts: number, now = Date.now()): number {
  return Math.round((startOfDay(new Date(ts)) - startOfDay(new Date(now))) / 86_400_000);
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const diff = dayDiff(ts);
  const time = timeFmt.format(d);
  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Завтра, ${time}`;
  if (diff === -1) return `Вчера, ${time}`;
  if (d.getFullYear() === new Date().getFullYear()) return `${dateNoYearFmt.format(d)}, ${time}`;
  return `${dateFmt.format(d)}, ${time}`;
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = ts - now;
  const min = Math.round(Math.abs(diff) / 60_000);
  if (min < 1) return diff >= 0 ? 'меньше чем через минуту' : 'только что';
  let s: string;
  if (min < 60) s = `${min} ${plural(min, ['минуту', 'минуты', 'минут'])}`;
  else if (min < 60 * 24) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    s = `${h} ч` + (m && h < 6 ? ` ${m} мин` : '');
  } else {
    const d = Math.round(min / 1440);
    s = `${d} ${plural(d, ['день', 'дня', 'дней'])}`;
  }
  return diff >= 0 ? `через ${s}` : `${s} назад`;
}

export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number {
  return new Date(v).getTime();
}
