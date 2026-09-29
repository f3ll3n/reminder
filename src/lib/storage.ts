import type { Reminder, Settings } from './types';

export const REMINDERS_KEY = 'reminder.items.v1';
export const SETTINGS_KEY = 'reminder.settings.v1';

export const DEFAULT_SETTINGS: Settings = { sound: true, persistent: false, snoozeMinutes: 10 };

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(normalizeReminder) : [];
  } catch {
    return [];
  }
}

export function saveReminders(list: Reminder[]): void {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/** Заполняет поля, которых может не быть в старых или импортированных данных. */
export function normalizeReminder(r: Partial<Reminder>): Reminder {
  const now = Date.now();
  return {
    id: r.id ?? uid(),
    title: r.title ?? 'Без названия',
    description: r.description ?? '',
    icon: r.icon ?? { kind: 'emoji', value: '🔔' },
    color: r.color ?? '#6366f1',
    startAt: r.startAt ?? now,
    repeat: { kind: 'none', interval: 1, weekdays: [], ...r.repeat },
    nextAt: r.nextAt ?? null,
    snoozeUntil: r.snoozeUntil ?? null,
    status: r.status ?? 'active',
    lastFiredAt: r.lastFiredAt ?? null,
    fireCount: r.fireCount ?? 0,
    createdAt: r.createdAt ?? now,
    updatedAt: r.updatedAt ?? now,
  };
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
