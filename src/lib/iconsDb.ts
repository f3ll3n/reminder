import type { CustomIcon } from './types';

const DB_NAME = 'reminder-db';
const STORE = 'icons';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function getAllIcons(): Promise<CustomIcon[]> {
  const list = (await tx<CustomIcon[]>('readonly', (s) => s.getAll())) ?? [];
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putIcons(icons: CustomIcon[]): Promise<void> {
  await tx('readwrite', (s) => {
    icons.forEach((i) => s.put(i));
  });
}

export async function deleteIcon(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

const MAX_SIDE = 128;

/** Читает картинку и сжимает её в компактный data URL (PNG до 128px; SVG и небольшие GIF — как есть). */
export async function fileToIconDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  if (file.type === 'image/svg+xml' && file.size < 200_000) return original;
  if (file.type === 'image/gif' && file.size < 300_000) return original;

  const img = await loadImage(original);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = src;
  });
}
