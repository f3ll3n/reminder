import type { Reminder } from '../lib/types';
import { dueAt } from '../lib/recurrence';
import { describeRepeat, formatDateTime, formatRelative } from '../lib/format';
import { IconView } from './IconView';
import { Icon } from './Icons';

interface Props {
  reminder: Reminder;
  now: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTest: () => void;
}

export function ReminderCard({ reminder: r, now, onEdit, onToggle, onDelete, onDuplicate, onTest }: Props) {
  const due = dueAt(r);
  const snoozed = r.status === 'active' && r.snoozeUntil !== null && due === r.snoozeUntil;
  const soon = due !== null && due - now < 60 * 60_000;

  return (
    <article className={`card status-${r.status}`} style={{ ['--accent' as string]: r.color }}>
      <button className="card-icon" onClick={onEdit} aria-label="Открыть">
        <IconView icon={r.icon} color={r.color} size={48} />
      </button>

      <div className="card-body" onDoubleClick={onEdit}>
        <div className="card-title-row">
          <h3 title={r.title}>{r.title}</h3>
          {r.status === 'paused' && <span className="badge">на паузе</span>}
          {r.status === 'done' && <span className="badge badge-done">завершено</span>}
          {snoozed && <span className="badge badge-snooze">отложено</span>}
        </div>
        {r.description && <p className="card-desc">{r.description}</p>}
        <div className="card-meta">
          <span className={`meta ${soon ? 'meta-soon' : ''}`}>
            <Icon name="clock" size={14} />
            {due !== null ? (
              <>
                {formatDateTime(due)} <span className="muted">· {formatRelative(due, now)}</span>
              </>
            ) : r.status === 'paused' ? (
              'не запланировано'
            ) : r.lastFiredAt ? (
              <>сработало {formatDateTime(r.lastFiredAt)}</>
            ) : (
              'нет срабатываний'
            )}
          </span>
          <span className="meta">
            <Icon name="repeat" size={14} />
            {describeRepeat(r.repeat, r.startAt)}
          </span>
        </div>
      </div>

      <div className="card-actions">
        <button className="btn-icon" title={r.status === 'paused' ? 'Возобновить' : r.status === 'done' ? 'Запустить снова' : 'Пауза'} onClick={onToggle}>
          <Icon name={r.status === 'active' ? 'pause' : 'play'} />
        </button>
        <button className="btn-icon" title="Проверить уведомление" onClick={onTest}>
          <Icon name="send" />
        </button>
        <button className="btn-icon" title="Редактировать" onClick={onEdit}>
          <Icon name="edit" />
        </button>
        <button className="btn-icon" title="Дублировать" onClick={onDuplicate}>
          <Icon name="copy" />
        </button>
        <button className="btn-icon danger" title="Удалить" onClick={onDelete}>
          <Icon name="trash" />
        </button>
      </div>
    </article>
  );
}
