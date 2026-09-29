import { useMemo, useState, type FormEvent } from 'react';
import type { IconRef, Reminder, Repeat, RepeatKind } from '../lib/types';
import { PRESET_COLORS } from '../lib/emojis';
import { nextOccurrence, upcoming } from '../lib/recurrence';
import { describeRepeat, formatDateTime, fromLocalInput, toLocalInput, WEEK_ORDER, WEEKDAY_SHORT } from '../lib/format';
import { uid } from '../lib/storage';
import { Modal } from './Modal';
import { IconPicker } from './IconPicker';
import { IconView } from './IconView';

interface Props {
  initial?: Reminder;
  onSave: (r: Reminder) => void;
  onClose: () => void;
}

const REPEAT_OPTIONS: { kind: RepeatKind; label: string }[] = [
  { kind: 'none', label: 'Однократно' },
  { kind: 'hours', label: 'Часы' },
  { kind: 'days', label: 'Дни' },
  { kind: 'weekdays', label: 'Дни недели' },
  { kind: 'monthly', label: 'Месяц' },
  { kind: 'yearly', label: 'Год' },
];

const UNIT: Partial<Record<RepeatKind, string>> = { hours: 'ч', days: 'дн.', monthly: 'мес.', yearly: 'г.' };

function defaultStart(): number {
  const d = new Date(Date.now() + 10 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d.getTime();
}

export function ReminderEditor({ initial, onSave, onClose }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState<IconRef>(initial?.icon ?? { kind: 'emoji', value: '🔔' });
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [start, setStart] = useState(toLocalInput(initial?.startAt ?? defaultStart()));
  const [kind, setKind] = useState<RepeatKind>(initial?.repeat.kind ?? 'none');
  const [interval, setIntervalValue] = useState(initial?.repeat.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>(initial?.repeat.weekdays.length ? initial.repeat.weekdays : [1, 2, 3, 4, 5]);
  const [touched, setTouched] = useState(false);

  const startAt = fromLocalInput(start);
  const repeat: Repeat = useMemo(() => ({ kind, interval: Math.max(1, interval || 1), weekdays: [...weekdays].sort() }), [kind, interval, weekdays]);
  const preview = useMemo(() => (Number.isFinite(startAt) ? upcoming(startAt, repeat, Date.now(), 5) : []), [startAt, repeat]);

  const errors: string[] = [];
  if (!title.trim()) errors.push('Укажите заголовок');
  if (!Number.isFinite(startAt)) errors.push('Укажите дату и время');
  else if (kind === 'none' && startAt <= Date.now()) errors.push('Время однократного напоминания уже прошло');
  if (kind === 'weekdays' && weekdays.length === 0) errors.push('Выберите хотя бы один день недели');

  const shiftStart = (fn: (d: Date) => void) => {
    const d = new Date();
    fn(d);
    d.setSeconds(0, 0);
    setStart(toLocalInput(d.getTime()));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.length) return;
    const now = Date.now();
    const nextAt = nextOccurrence(startAt, repeat, now);
    onSave({
      id: initial?.id ?? uid(),
      title: title.trim(),
      description: description.trim(),
      icon,
      color,
      startAt,
      repeat,
      nextAt,
      snoozeUntil: null,
      status: initial?.status === 'paused' ? 'paused' : nextAt === null ? 'done' : 'active',
      lastFiredAt: initial?.lastFiredAt ?? null,
      fireCount: initial?.fireCount ?? 0,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  };

  return (
    <Modal
      title={initial ? 'Редактирование' : 'Новое напоминание'}
      onClose={onClose}
      wide
      footer={
        <>
          {touched && errors.length > 0 && <span className="error">{errors[0]}</span>}
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" form="reminder-form" className="btn btn-primary">
            {initial ? 'Сохранить' : 'Создать'}
          </button>
        </>
      }
    >
      <form id="reminder-form" className="editor" onSubmit={submit}>
        <div className="editor-main">
          <div className="editor-title-row">
            <IconView icon={icon} color={color} size={56} />
            <div className="field grow">
              <label htmlFor="r-title">Заголовок</label>
              <input id="r-title" autoFocus value={title} maxLength={120} placeholder="Например, выпить воды" onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="r-desc">Описание</label>
            <textarea id="r-desc" rows={3} value={description} maxLength={1000} placeholder="Необязательно — текст уведомления" onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="field">
            <label>Цвет</label>
            <div className="colors">
              {PRESET_COLORS.map((c) => (
                <button type="button" key={c} className={`swatch ${c === color ? 'selected' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
              <label className="swatch swatch-custom" title="Свой цвет" style={{ background: PRESET_COLORS.includes(color) ? undefined : color }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                {PRESET_COLORS.includes(color) && '+'}
              </label>
            </div>
          </div>

          <div className="field">
            <label htmlFor="r-start">{kind === 'none' ? 'Когда' : 'Начиная с'}</label>
            <div className="start-row">
              <input id="r-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              <div className="chips">
                <button type="button" className="chip" onClick={() => shiftStart((d) => d.setMinutes(d.getMinutes() + 15))}>+15 мин</button>
                <button type="button" className="chip" onClick={() => shiftStart((d) => d.setHours(d.getHours() + 1))}>+1 час</button>
                <button type="button" className="chip" onClick={() => shiftStart((d) => { d.setDate(d.getDate() + 1); d.setHours(9, 0); })}>Завтра 9:00</button>
              </div>
            </div>
          </div>

          <div className="field">
            <label>Повторение</label>
            <div className="segmented">
              {REPEAT_OPTIONS.map((o) => (
                <button type="button" key={o.kind} className={kind === o.kind ? 'active' : ''} onClick={() => setKind(o.kind)}>
                  {o.label}
                </button>
              ))}
            </div>

            {UNIT[kind] && (
              <div className="interval-row">
                <span>Каждые</span>
                <input type="number" min={1} max={kind === 'hours' ? 720 : 365} value={interval} onChange={(e) => setIntervalValue(parseInt(e.target.value, 10) || 1)} />
                <span>{UNIT[kind]}</span>
              </div>
            )}

            {kind === 'weekdays' && (
              <div className="weekdays">
                {WEEK_ORDER.map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={weekdays.includes(d) ? 'active' : ''}
                    onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                ))}
                <span className="weekday-presets">
                  <button type="button" className="link" onClick={() => setWeekdays([1, 2, 3, 4, 5])}>будни</button>
                  <button type="button" className="link" onClick={() => setWeekdays([0, 6])}>выходные</button>
                  <button type="button" className="link" onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])}>все</button>
                </span>
              </div>
            )}
          </div>

          <div className="preview">
            <div className="preview-title">
              {Number.isFinite(startAt) ? describeRepeat(repeat, startAt) : '—'} · ближайшие срабатывания
            </div>
            {preview.length ? (
              <ol>
                {preview.map((t) => (
                  <li key={t}>{formatDateTime(t)}</li>
                ))}
              </ol>
            ) : (
              <p className="muted">Нет будущих срабатываний</p>
            )}
          </div>
        </div>

        <div className="editor-side">
          <label>Иконка</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
      </form>
    </Modal>
  );
}
