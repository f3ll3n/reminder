import type { IconRef } from '../lib/types';
import { IconView } from './IconView';
import { Icon } from './Icons';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  icon?: IconRef;
  color?: string;
  actions?: { label: string; primary?: boolean; run: () => void }[];
  /** мс до автоскрытия; undefined — висит, пока не закроют */
  timeout?: number;
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" style={{ ['--accent' as string]: t.color ?? 'var(--primary)' }}>
          {t.icon && <IconView icon={t.icon} color={t.color ?? '#6366f1'} size={40} />}
          <div className="toast-body">
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
            {t.actions && (
              <div className="toast-actions">
                {t.actions.map((a) => (
                  <button
                    key={a.label}
                    className={`btn btn-sm ${a.primary ? 'btn-primary' : ''}`}
                    onClick={() => {
                      a.run();
                      onDismiss(t.id);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn-icon btn-sm" onClick={() => onDismiss(t.id)} aria-label="Закрыть">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
