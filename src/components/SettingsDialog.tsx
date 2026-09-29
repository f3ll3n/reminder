import { useRef, useState } from 'react';
import type { CustomIcon, Reminder, Settings } from '../lib/types';
import type { Permission } from '../lib/notify';
import { normalizeReminder } from '../lib/storage';
import { useIcons } from '../iconsContext';
import { CustomIconsGrid } from './IconPicker';
import { Modal } from './Modal';
import { Icon } from './Icons';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  permission: Permission;
  onRequestPermission: () => void;
  onTestNotification: () => void;
  reminders: Reminder[];
  onImport: (list: Reminder[]) => void;
  onClose: () => void;
}

interface Backup {
  app: 'reminder';
  version: 1;
  exportedAt: string;
  reminders: Reminder[];
  icons: CustomIcon[];
  settings: Settings;
}

const PERMISSION_TEXT: Record<Permission, string> = {
  granted: 'Разрешены',
  denied: 'Заблокированы — разрешите уведомления для этого сайта в настройках браузера (значок слева от адреса)',
  default: 'Не запрошены',
  unsupported: 'Браузер не поддерживает уведомления',
};

export function SettingsDialog({ settings, onChange, permission, onRequestPermission, onTestNotification, reminders, onImport, onClose }: Props) {
  const { icons, importIcons } = useIcons();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const exportBackup = () => {
    const data: Backup = { app: 'reminder', version: 1, exportedAt: new Date().toISOString(), reminders, icons, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reminder-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<Backup>;
      if (!Array.isArray(data.reminders)) throw new Error('bad format');
      await importIcons(Array.isArray(data.icons) ? data.icons : []);
      onImport(data.reminders.map(normalizeReminder));
      setMessage(`Импортировано: ${data.reminders.length} напоминаний, ${data.icons?.length ?? 0} картинок`);
    } catch {
      setMessage('Не удалось прочитать файл — нужен JSON, экспортированный из Reminder');
    }
  };

  return (
    <Modal title="Настройки" onClose={onClose} wide>
      <div className="settings">
        <section>
          <h3>Уведомления Windows</h3>
          <p className={`perm perm-${permission}`}>Статус: {PERMISSION_TEXT[permission]}</p>
          <div className="row">
            {permission === 'default' && (
              <button className="btn btn-primary" onClick={onRequestPermission}>
                <Icon name="bell" size={16} /> Разрешить уведомления
              </button>
            )}
            <button className="btn" onClick={onTestNotification} disabled={permission !== 'granted'}>
              <Icon name="send" size={16} /> Тестовое уведомление
            </button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={settings.sound} onChange={(e) => onChange({ ...settings, sound: e.target.checked })} />
            <span>Звуковой сигнал в приложении</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.persistent} onChange={(e) => onChange({ ...settings, persistent: e.target.checked })} />
            <span>Не скрывать уведомление автоматически (остаётся, пока не закроете)</span>
          </label>
          <label className="toggle">
            <span>Отложить на</span>
            <input
              type="number"
              min={1}
              max={240}
              value={settings.snoozeMinutes}
              onChange={(e) => onChange({ ...settings, snoozeMinutes: Math.min(240, Math.max(1, parseInt(e.target.value, 10) || 10)) })}
            />
            <span>мин</span>
          </label>
          <p className="hint">
            Напоминания проверяются, пока открыта хотя бы одна вкладка приложения (её можно свернуть). Пропущенные за время, когда вкладка была закрыта,
            придут один раз при следующем открытии. Чтобы уведомления не перекрывались режимом «Не беспокоить», проверьте «Параметры Windows → Система →
            Уведомления».
          </p>
        </section>

        <section>
          <h3>Мои картинки</h3>
          <CustomIconsGrid />
        </section>

        <section>
          <h3>Резервная копия</h3>
          <p className="hint">Все данные хранятся только в этом браузере. Экспорт сохраняет напоминания, картинки и настройки в один JSON-файл.</p>
          <div className="row">
            <button className="btn" onClick={exportBackup}>
              <Icon name="download" size={16} /> Экспорт
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Импорт
            </button>
          </div>
          {message && <p className="hint">{message}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importBackup(f);
              e.target.value = '';
            }}
          />
        </section>
      </div>
    </Modal>
  );
}
