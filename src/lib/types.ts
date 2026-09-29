export type RepeatKind = 'none' | 'hours' | 'days' | 'weekdays' | 'monthly' | 'yearly';

export interface Repeat {
  kind: RepeatKind;
  /** Шаг для hours / days / monthly / yearly */
  interval: number;
  /** Дни недели для kind = 'weekdays' в формате Date.getDay(): 0 = вс, 1 = пн … 6 = сб */
  weekdays: number[];
}

export type IconRef = { kind: 'emoji'; value: string } | { kind: 'custom'; id: string };

export type ReminderStatus = 'active' | 'paused' | 'done';

export interface Reminder {
  id: string;
  title: string;
  description: string;
  icon: IconRef;
  color: string;
  /** Первое срабатывание (задаёт и время суток для периодических) */
  startAt: number;
  repeat: Repeat;
  /** Следующее плановое срабатывание, null — больше не сработает */
  nextAt: number | null;
  /** Отложенное срабатывание (snooze) */
  snoozeUntil: number | null;
  status: ReminderStatus;
  lastFiredAt: number | null;
  fireCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CustomIcon {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface Settings {
  sound: boolean;
  /** Не скрывать уведомление Windows автоматически */
  persistent: boolean;
  snoozeMinutes: number;
}
