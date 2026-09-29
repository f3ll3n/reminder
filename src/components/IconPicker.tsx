import { useRef, useState, type DragEvent } from 'react';
import type { IconRef } from '../lib/types';
import { EMOJI_CATEGORIES } from '../lib/emojis';
import { useIcons } from '../iconsContext';
import { Icon } from './Icons';

interface Props {
  value: IconRef;
  onChange: (icon: IconRef) => void;
}

const firstGrapheme = (s: string): string => {
  const trimmed = s.trim();
  if (!trimmed) return '';
  if ('Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const first = seg.segment(trimmed)[Symbol.iterator]().next().value;
    return first?.segment ?? '';
  }
  return Array.from(trimmed)[0] ?? '';
};

export function IconPicker({ value, onChange }: Props) {
  const [tab, setTab] = useState<'emoji' | 'custom'>(value.kind === 'custom' ? 'custom' : 'emoji');
  const [category, setCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [manual, setManual] = useState('');
  const emojis = EMOJI_CATEGORIES.find((c) => c.id === category)!.emojis;

  return (
    <div className="icon-picker">
      <div className="tabs">
        <button type="button" className={tab === 'emoji' ? 'active' : ''} onClick={() => setTab('emoji')}>
          <Icon name="smile" size={16} /> Эмодзи
        </button>
        <button type="button" className={tab === 'custom' ? 'active' : ''} onClick={() => setTab('custom')}>
          <Icon name="image" size={16} /> Мои картинки
        </button>
      </div>

      {tab === 'emoji' ? (
        <>
          <div className="emoji-cats" role="tablist">
            {EMOJI_CATEGORIES.map((c) => (
              <button type="button" key={c.id} title={c.label} className={c.id === category ? 'active' : ''} onClick={() => setCategory(c.id)}>
                <span className="emoji">{c.icon}</span>
              </button>
            ))}
          </div>
          <div className="emoji-grid">
            {emojis.map((e) => (
              <button
                type="button"
                key={e}
                className={value.kind === 'emoji' && value.value === e ? 'selected' : ''}
                onClick={() => onChange({ kind: 'emoji', value: e })}
              >
                <span className="emoji">{e}</span>
              </button>
            ))}
          </div>
          <div className="emoji-manual">
            <input
              value={manual}
              placeholder="Любой эмодзи: вставьте или нажмите Win + ."
              onChange={(e) => {
                setManual(e.target.value);
                const g = firstGrapheme(e.target.value);
                if (g && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g)) onChange({ kind: 'emoji', value: g });
              }}
            />
          </div>
        </>
      ) : (
        <CustomIconsGrid selectedId={value.kind === 'custom' ? value.id : undefined} onSelect={(id) => onChange({ kind: 'custom', id })} />
      )}
    </div>
  );
}

interface GridProps {
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function CustomIconsGrid({ selectedId, onSelect }: GridProps) {
  const { icons, addFiles, remove } = useIcons();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | File[]) => {
    setError('');
    const { added, failed } = await addFiles(files);
    if (failed.length) setError(`Не удалось добавить: ${failed.join(', ')}`);
    if (added.length && onSelect) onSelect(added[added.length - 1].id);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`custom-icons ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <div className="custom-grid">
        <button type="button" className="custom-add" onClick={() => inputRef.current?.click()} title="Загрузить картинки">
          <Icon name="upload" />
          <span>Загрузить</span>
        </button>
        {icons.map((i) => (
          <div key={i.id} className={`custom-item ${selectedId === i.id ? 'selected' : ''}`} title={i.name}>
            <button type="button" className="custom-pick" onClick={() => onSelect?.(i.id)} disabled={!onSelect}>
              <img src={i.dataUrl} alt={i.name} />
            </button>
            <button
              type="button"
              className="custom-del"
              title="Удалить картинку"
              onClick={() => {
                if (confirm(`Удалить картинку «${i.name}»? Напоминания с ней покажут значок-заглушку.`)) void remove(i.id);
              }}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>
      <p className="hint">
        PNG, JPG, GIF, SVG, WebP — можно выбрать несколько файлов или перетащить сюда. Картинки уменьшаются до 128px и хранятся только в этом браузере (IndexedDB).
      </p>
      {error && <p className="error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
