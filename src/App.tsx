import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Reminder, RepeatKind, Settings } from './lib/types';
import { dueAt, nextOccurrence } from './lib/recurrence';
import { dayDiff, describeRepeat, formatDateTime, plural } from './lib/format';
import { loadReminders, loadSettings, REMINDERS_KEY, saveReminders, saveSettings, SETTINGS_KEY, uid } from './lib/storage';
import { notificationPermission, playChime, requestPermission, showReminderNotification, type Permission } from './lib/notify';
import { useIcons } from './iconsContext';
import { ReminderCard } from './components/ReminderCard';
import { ReminderEditor } from './components/ReminderEditor';
import { SettingsDialog } from './components/SettingsDialog';
import { Toasts, type Toast } from './components/Toasts';
import { Icon } from './components/Icons';

type StatusFilter = 'all' | 'active' | 'paused' | 'done';
type SortKey = 'next' | 'title' | 'created' | 'lastFired';

interface Filters {
  query: string;
  status: StatusFilter;
  repeat: 'all' | RepeatKind;
  color: string | null;
  sort: SortKey;
  dir: 'asc' | 'desc';
}

const FILTERS_KEY = 'reminder.filters.v1';
const DEFAULT_FILTERS: Filters = { query: '', status: 'all', repeat: 'all', color: null, sort: 'next', dir: 'asc' };

function loadFilters(): Filters {
  try {
    return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTERS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_FILTERS;
  }
}

const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Все', active: 'Активные', paused: 'На паузе', done: 'Завершённые' };
const REPEAT_LABELS: Record<'all' | RepeatKind, string> = {
  all: 'Любой повтор',
  none: 'Однократные',
  hours: 'Каждые n часов',
  days: 'Каждые n дней',
  weekdays: 'По дням недели',
  monthly: 'Ежемесячные',
  yearly: 'Ежегодные',
};
const SORT_LABELS: Record<SortKey, string> = { next: 'По ближайшему', title: 'По названию', created: 'По дате создания', lastFired: 'По последнему срабатыванию' };

const MISSED_THRESHOLD = 2 * 60_000;
const TICK_MS = 5_000;

function groupOf(r: Reminder, now: number): string {
  const due = dueAt(r);
  if (due === null) return 'Не запланировано';
  const d = dayDiff(due, now);
  if (d <= 0) return 'Сегодня';
  if (d === 1) return 'Завтра';
  if (d < 7) return 'На этой неделе';
  if (d < 31) return 'В этом месяце';
  return 'Позже';
}

export default function App() {
  const { map: customIcons } = useIcons();
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permission, setPermission] = useState<Permission>(notificationPermission);
  const [now, setNow] = useState(Date.now);
  const [isLeader, setIsLeader] = useState(() => !('locks' in navigator));

  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const iconsRef = useRef(customIcons);
  iconsRef.current = customIcons;

  // ---------- хранение и синхронизация между вкладками ----------
  useEffect(() => {
    const json = JSON.stringify(reminders);
    if (localStorage.getItem(REMINDERS_KEY) !== json) saveReminders(reminders);
  }, [reminders]);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)), [filters]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REMINDERS_KEY) setReminders(loadReminders());
      if (e.key === SETTINGS_KEY) setSettings(loadSettings());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Только одна вкладка (лидер) проверяет расписание, чтобы не было дублей уведомлений
  useEffect(() => {
    if (!('locks' in navigator)) return;
    const ac = new AbortController();
    let release: (() => void) | undefined;
    navigator.locks
      .request('reminder-scheduler', { signal: ac.signal }, () => {
        setIsLeader(true);
        return new Promise<void>((resolve) => (release = resolve));
      })
      .catch(() => {});
    return () => {
      ac.abort();
      release?.();
      setIsLeader(false);
    };
  }, []);

  // ---------- тосты ----------
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const pushToast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = uid();
      setToasts((list) => [...list.slice(-4), { ...t, id }]);
      if (t.timeout) setTimeout(() => dismissToast(id), t.timeout);
    },
    [dismissToast],
  );

  // ---------- действия ----------
  const snooze = useCallback((id: string, minutes = settingsRef.current.snoozeMinutes) => {
    setReminders((list) =>
      list.map((r) => (r.id === id ? { ...r, status: 'active', snoozeUntil: Date.now() + minutes * 60_000, updatedAt: Date.now() } : r)),
    );
  }, []);

  const notify = useCallback(
    (r: Reminder, missedAt?: number) => {
      const base = r.description || describeRepeat(r.repeat, r.startAt);
      const body = missedAt ? `Пропущено: ${formatDateTime(missedAt)}\n${base}` : base;
      void showReminderNotification(r, body, settingsRef.current, iconsRef.current);
      if (settingsRef.current.sound) playChime();
      pushToast({
        title: r.title,
        body,
        icon: r.icon,
        color: r.color,
        actions: [
          { label: `Отложить на ${settingsRef.current.snoozeMinutes} мин`, run: () => snooze(r.id) },
          { label: 'Готово', primary: true, run: () => {} },
        ],
      });
    },
    [pushToast, snooze],
  );

  const tick = useCallback(() => {
    const t = Date.now();
    const fired: { r: Reminder; missedAt?: number }[] = [];
    const next = remindersRef.current.map((r) => {
      const due = dueAt(r);
      if (due === null || due > t) return r;
      fired.push({ r, missedAt: t - due > MISSED_THRESHOLD ? due : undefined });
      // Если пропущено несколько срабатываний — уведомляем один раз и переходим к следующему будущему
      const nextAt = r.nextAt !== null && r.nextAt <= t ? nextOccurrence(r.startAt, r.repeat, t) : r.nextAt;
      return {
        ...r,
        nextAt,
        snoozeUntil: null,
        status: nextAt === null ? ('done' as const) : ('active' as const),
        lastFiredAt: t,
        fireCount: r.fireCount + 1,
      };
    });
    if (!fired.length) return;
    remindersRef.current = next;
    setReminders(next);
    fired.slice(0, 5).forEach(({ r, missedAt }) => notify(r, missedAt));
    if (fired.length > 5) pushToast({ title: `И ещё ${fired.length - 5} ${plural(fired.length - 5, ['напоминание', 'напоминания', 'напоминаний'])}`, timeout: 10_000 });
  }, [notify, pushToast]);

  useEffect(() => {
    if (!isLeader) return;
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLeader, tick]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setPermission(notificationPermission());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Кнопка «Отложить» в уведомлении Windows (через service worker)
  const isLeaderRef = useRef(isLeader);
  isLeaderRef.current = isLeader;
  useEffect(() => {
    const handle = (action: string, id: string | null) => {
      if (action === 'snooze' && id) snooze(id);
    };
    const params = new URLSearchParams(location.search);
    if (params.get('action')) {
      handle(params.get('action')!, params.get('id'));
      history.replaceState(null, '', location.pathname);
    }
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'notification-action' && isLeaderRef.current) handle(e.data.action, e.data.id);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [snooze]);

  const askPermission = async () => setPermission(await requestPermission());

  const save = (r: Reminder) => {
    setReminders((list) => (list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]));
    setEditing(null);
    if (permission === 'default') void askPermission();
  };

  const toggle = (r: Reminder) => {
    if (r.status === 'active') {
      setReminders((list) => list.map((x) => (x.id === r.id ? { ...x, status: 'paused', snoozeUntil: null, updatedAt: Date.now() } : x)));
      return;
    }
    const nextAt = nextOccurrence(r.startAt, r.repeat, Date.now());
    if (nextAt === null) {
      setEditing(r); // однократное в прошлом — нужно выбрать новое время
      return;
    }
    setReminders((list) => list.map((x) => (x.id === r.id ? { ...x, status: 'active', nextAt, updatedAt: Date.now() } : x)));
  };

  const remove = (r: Reminder) => {
    const index = reminders.findIndex((x) => x.id === r.id);
    setReminders((list) => list.filter((x) => x.id !== r.id));
    pushToast({
      title: `«${r.title}» удалено`,
      timeout: 6000,
      actions: [
        {
          label: 'Вернуть',
          primary: true,
          run: () =>
            setReminders((list) => {
              const copy = [...list];
              copy.splice(Math.min(index, copy.length), 0, r);
              return copy;
            }),
        },
      ],
    });
  };

  const duplicate = (r: Reminder) => {
    const t = Date.now();
    const nextAt = nextOccurrence(r.startAt, r.repeat, t);
    setReminders((list) => [
      ...list,
      { ...r, id: uid(), title: `${r.title} (копия)`, nextAt, snoozeUntil: null, status: nextAt === null ? 'done' : r.status, lastFiredAt: null, fireCount: 0, createdAt: t, updatedAt: t },
    ]);
  };

  const importReminders = (list: Reminder[]) => {
    const t = Date.now();
    setReminders((current) => {
      const byId = new Map(current.map((r) => [r.id, r]));
      list.forEach((r) => {
        const nextAt = r.status === 'active' ? nextOccurrence(r.startAt, r.repeat, t) : r.nextAt;
        byId.set(r.id, { ...r, nextAt, status: r.status === 'active' && nextAt === null ? 'done' : r.status });
      });
      return [...byId.values()];
    });
  };

  const testNotification = (r?: Reminder) => {
    const sample = r ?? ({ id: 'test', title: 'Проверка уведомлений', icon: { kind: 'emoji', value: '🔔' }, color: '#6366f1' } as const);
    const body = r ? r.description || describeRepeat(r.repeat, r.startAt) : 'Так будут выглядеть напоминания';
    if (permission !== 'granted') {
      void askPermission();
    }
    void showReminderNotification(sample, body, settings, customIcons);
    if (settings.sound) playChime();
  };

  // ---------- фильтрация и сортировка ----------
  const counts = useMemo(() => {
    const c = { all: reminders.length, active: 0, paused: 0, done: 0 };
    reminders.forEach((r) => c[r.status]++);
    return c;
  }, [reminders]);

  const usedColors = useMemo(() => [...new Set(reminders.map((r) => r.color))], [reminders]);

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = reminders.filter(
      (r) =>
        (filters.status === 'all' || r.status === filters.status) &&
        (filters.repeat === 'all' || r.repeat.kind === filters.repeat) &&
        (!filters.color || r.color === filters.color) &&
        (!q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)),
    );
    const key = (r: Reminder): number | string => {
      switch (filters.sort) {
        case 'next':
          return dueAt(r) ?? Number.MAX_SAFE_INTEGER;
        case 'title':
          return r.title.toLowerCase();
        case 'created':
          return r.createdAt;
        case 'lastFired':
          return r.lastFiredAt ?? 0;
      }
    };
    const dir = filters.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      const cmp = typeof ka === 'string' ? ka.localeCompare(kb as string, 'ru') : ka - (kb as number);
      return cmp * dir || a.createdAt - b.createdAt;
    });
  }, [reminders, filters]);

  const grouped = filters.sort === 'next' && filters.dir === 'asc';
  const sections = useMemo(() => {
    if (!grouped) return [{ label: '', items: visible }];
    const out: { label: string; items: Reminder[] }[] = [];
    visible.forEach((r) => {
      const g = groupOf(r, now);
      const last = out[out.length - 1];
      if (last?.label === g) last.items.push(r);
      else out.push({ label: g, items: [r] });
    });
    return out;
  }, [visible, grouped, now]);

  const todayCount = reminders.filter((r) => {
    const d = dueAt(r);
    return d !== null && dayDiff(d, now) === 0;
  }).length;
  const filtersActive = filters.query || filters.status !== 'all' || filters.repeat !== 'all' || filters.color;
  const setF = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">
            <Icon name="bell" size={20} />
          </span>
          <div>
            <h1>Reminder</h1>
            <p className="muted">
              {counts.active} {plural(counts.active, ['активное', 'активных', 'активных'])} · сегодня {todayCount}
            </p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-icon" title="Настройки" onClick={() => setShowSettings(true)}>
            <Icon name="settings" />
          </button>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> Новое напоминание
          </button>
        </div>
      </header>

      {permission !== 'granted' && (
        <div className={`banner ${permission === 'denied' ? 'banner-warn' : ''}`}>
          <Icon name="bell" />
          {permission === 'default' && (
            <>
              <span>Разрешите уведомления, чтобы напоминания приходили в центр уведомлений Windows.</span>
              <button className="btn btn-sm btn-primary" onClick={askPermission}>
                Разрешить
              </button>
            </>
          )}
          {permission === 'denied' && <span>Уведомления заблокированы. Разрешите их в настройках сайта (значок слева от адресной строки) — пока напоминания видны только внутри приложения.</span>}
          {permission === 'unsupported' && <span>Этот браузер не поддерживает системные уведомления — напоминания будут показаны только внутри приложения.</span>}
        </div>
      )}

      <section className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input value={filters.query} placeholder="Поиск по заголовку и описанию" onChange={(e) => setF({ query: e.target.value })} />
        </div>

        <div className="segmented">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
            <button key={s} className={filters.status === s ? 'active' : ''} onClick={() => setF({ status: s })}>
              {STATUS_LABELS[s]} <span className="count">{counts[s]}</span>
            </button>
          ))}
        </div>

        <div className="toolbar-row">
          <select value={filters.repeat} onChange={(e) => setF({ repeat: e.target.value as Filters['repeat'] })} aria-label="Тип повтора">
            {(Object.keys(REPEAT_LABELS) as (keyof typeof REPEAT_LABELS)[]).map((k) => (
              <option key={k} value={k}>
                {REPEAT_LABELS[k]}
              </option>
            ))}
          </select>

          <select value={filters.sort} onChange={(e) => setF({ sort: e.target.value as SortKey })} aria-label="Сортировка">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
          <button className="btn-icon" title={filters.dir === 'asc' ? 'По возрастанию' : 'По убыванию'} onClick={() => setF({ dir: filters.dir === 'asc' ? 'desc' : 'asc' })}>
            <Icon name={filters.dir === 'asc' ? 'sortAsc' : 'sortDesc'} />
          </button>

          {usedColors.length > 1 && (
            <div className="color-filter" aria-label="Фильтр по цвету">
              {usedColors.map((c) => (
                <button
                  key={c}
                  className={`swatch swatch-sm ${filters.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  title="Фильтр по цвету"
                  onClick={() => setF({ color: filters.color === c ? null : c })}
                />
              ))}
            </div>
          )}

          {filtersActive && (
            <button className="link" onClick={() => setF({ query: '', status: 'all', repeat: 'all', color: null })}>
              Сбросить фильтры
            </button>
          )}
        </div>
      </section>

      <main className="queue">
        {reminders.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">⏰</div>
            <h2>Напоминаний пока нет</h2>
            <p className="muted">Создайте первое — однократное или повторяющееся каждые n часов, дней, по дням недели, раз в месяц или год.</p>
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} /> Новое напоминание
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🔍</div>
            <p className="muted">Ничего не найдено</p>
          </div>
        ) : (
          sections.map((s) => (
            <section key={s.label || 'all'} className="group">
              {s.label && (
                <h2 className="group-title">
                  {s.label} <span className="count">{s.items.length}</span>
                </h2>
              )}
              <div className="cards">
                {s.items.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    now={now}
                    onEdit={() => setEditing(r)}
                    onToggle={() => toggle(r)}
                    onDelete={() => remove(r)}
                    onDuplicate={() => duplicate(r)}
                    onTest={() => testNotification(r)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <button className="fab" onClick={() => setEditing('new')} aria-label="Новое напоминание">
        <Icon name="plus" size={24} />
      </button>

      {editing && <ReminderEditor initial={editing === 'new' ? undefined : editing} onSave={save} onClose={() => setEditing(null)} />}
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          permission={permission}
          onRequestPermission={askPermission}
          onTestNotification={() => testNotification()}
          reminders={reminders}
          onImport={importReminders}
          onClose={() => setShowSettings(false)}
        />
      )}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
