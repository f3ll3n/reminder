import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CustomIcon } from './lib/types';
import { deleteIcon, fileToIconDataUrl, getAllIcons, putIcons } from './lib/iconsDb';
import { uid } from './lib/storage';

interface IconsApi {
  icons: CustomIcon[];
  map: Map<string, CustomIcon>;
  ready: boolean;
  addFiles: (files: FileList | File[]) => Promise<{ added: CustomIcon[]; failed: string[] }>;
  importIcons: (icons: CustomIcon[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const IconsContext = createContext<IconsApi | null>(null);

export function IconsProvider({ children }: { children: ReactNode }) {
  const [icons, setIcons] = useState<CustomIcon[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      setIcons(await getAllIcons());
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Синхронизация между вкладками
    const ch = 'BroadcastChannel' in window ? new BroadcastChannel('reminder-icons') : null;
    if (ch) ch.onmessage = () => void reload();
    return () => ch?.close();
  }, [reload]);

  const broadcast = () => {
    if (!('BroadcastChannel' in window)) return;
    const ch = new BroadcastChannel('reminder-icons');
    ch.postMessage('changed');
    ch.close();
  };

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const added: CustomIcon[] = [];
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        failed.push(file.name);
        continue;
      }
      try {
        const dataUrl = await fileToIconDataUrl(file);
        added.push({ id: uid(), name: file.name.replace(/\.[^.]+$/, ''), dataUrl, createdAt: Date.now() + added.length });
      } catch {
        failed.push(file.name);
      }
    }
    if (added.length) {
      await putIcons(added);
      setIcons((prev) => [...prev, ...added]);
      broadcast();
    }
    return { added, failed };
  }, []);

  const importIcons = useCallback(
    async (list: CustomIcon[]) => {
      const valid = list.filter((i) => i && typeof i.id === 'string' && typeof i.dataUrl === 'string' && i.dataUrl.startsWith('data:image/'));
      if (!valid.length) return;
      await putIcons(valid.map((i) => ({ ...i, name: i.name ?? 'icon', createdAt: i.createdAt ?? Date.now() })));
      await reload();
      broadcast();
    },
    [reload],
  );

  const remove = useCallback(async (id: string) => {
    await deleteIcon(id);
    setIcons((prev) => prev.filter((i) => i.id !== id));
    broadcast();
  }, []);

  const map = useMemo(() => new Map(icons.map((i) => [i.id, i])), [icons]);

  return <IconsContext.Provider value={{ icons, map, ready, addFiles, importIcons, remove }}>{children}</IconsContext.Provider>;
}

export function useIcons(): IconsApi {
  const ctx = useContext(IconsContext);
  if (!ctx) throw new Error('useIcons вне IconsProvider');
  return ctx;
}
