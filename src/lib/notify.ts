import type { CustomIcon, IconRef, Reminder, Settings } from './types';
import { loadImage } from './iconsDb';

export type Permission = NotificationPermission | 'unsupported';

export function notificationPermission(): Permission {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestPermission(): Promise<Permission> {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

const iconCache = new Map<string, string>();

/** Рисует иконку напоминания (эмодзи или картинку на цветном фоне) в PNG для уведомления Windows. */
export async function renderIconPng(icon: IconRef, color: string, custom: Map<string, CustomIcon>): Promise<string | undefined> {
  const key = `${icon.kind}:${icon.kind === 'emoji' ? icon.value : icon.id}:${color}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  try {
    const size = 192;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 40);
    ctx.fill();
    if (icon.kind === 'emoji') {
      ctx.font = `${size * 0.6}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon.value, size / 2, size / 2 + size * 0.04);
    } else {
      const data = custom.get(icon.id);
      if (data) {
        const img = await loadImage(data.dataUrl);
        const box = size * 0.72;
        const s = Math.min(box / (img.naturalWidth || box), box / (img.naturalHeight || box));
        const w = (img.naturalWidth || box) * s;
        const h = (img.naturalHeight || box) * s;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      }
    }
    const url = c.toDataURL('image/png');
    iconCache.set(key, url);
    return url;
  } catch {
    return undefined;
  }
}

type ExtendedOptions = NotificationOptions & {
  actions?: { action: string; title: string }[];
  renotify?: boolean;
};

export async function showReminderNotification(
  r: Pick<Reminder, 'id' | 'title' | 'icon' | 'color'>,
  body: string,
  settings: Settings,
  custom: Map<string, CustomIcon>,
): Promise<void> {
  if (notificationPermission() !== 'granted') return;
  const icon = await renderIconPng(r.icon, r.color, custom);
  const options: ExtendedOptions = {
    body,
    icon,
    tag: r.id,
    renotify: true,
    requireInteraction: settings.persistent,
    data: { id: r.id },
  };

  // Через service worker уведомление Windows получает кнопку «Отложить»
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg?.active) {
    options.actions = [{ action: 'snooze', title: `Отложить на ${settings.snoozeMinutes} мин` }];
    await reg.showNotification(r.title, options);
    return;
  }
  const n = new Notification(r.title, options);
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

let audioCtx: AudioContext | null = null;

export function playChime(): void {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const t0 = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch {
    /* звук недоступен — не критично */
  }
}
