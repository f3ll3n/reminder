import type { IconRef } from '../lib/types';
import { useIcons } from '../iconsContext';

interface Props {
  icon: IconRef;
  color: string;
  size?: number;
}

export function IconView({ icon, color, size = 44 }: Props) {
  const { map } = useIcons();
  const custom = icon.kind === 'custom' ? map.get(icon.id) : undefined;
  return (
    <span
      className="icon-view"
      style={{ width: size, height: size, borderRadius: size * 0.28, background: `color-mix(in srgb, ${color} 22%, transparent)`, borderColor: color }}
    >
      {icon.kind === 'emoji' ? (
        <span className="emoji" style={{ fontSize: size * 0.55 }}>{icon.value}</span>
      ) : custom ? (
        <img src={custom.dataUrl} alt={custom.name} style={{ width: size * 0.72, height: size * 0.72 }} />
      ) : (
        <span className="emoji" style={{ fontSize: size * 0.5 }} title="Картинка удалена">❔</span>
      )}
    </span>
  );
}
