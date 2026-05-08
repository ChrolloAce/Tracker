import { CreatorLabel } from '../../types/firestore';

/**
 * Compact pill row of labels assigned to a creator. Used inline next to the
 * creator's name in CreatorsTable and the dashboard creator chip. Keep these
 * deliberately tiny — they sit alongside other metadata and shouldn't dominate.
 */

const COLOR_CLASSES: Record<string, string> = {
  orange: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  violet: 'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  slate: 'bg-slate-500/15 text-slate-300 border border-slate-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  pink: 'bg-pink-500/15 text-pink-400 border border-pink-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
  red: 'bg-red-500/15 text-red-400 border border-red-500/25',
};

export const LABEL_COLOR_OPTIONS: Array<{ value: string; swatch: string }> = [
  { value: 'orange', swatch: 'bg-orange-500' },
  { value: 'violet', swatch: 'bg-violet-500' },
  { value: 'slate', swatch: 'bg-slate-500' },
  { value: 'emerald', swatch: 'bg-emerald-500' },
  { value: 'blue', swatch: 'bg-blue-500' },
  { value: 'pink', swatch: 'bg-pink-500' },
  { value: 'amber', swatch: 'bg-amber-500' },
  { value: 'cyan', swatch: 'bg-cyan-500' },
  { value: 'red', swatch: 'bg-red-500' },
];

export function getLabelColorClass(color: string): string {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.slate;
}

export function CreatorLabelBadges({
  labels,
  max = 3,
  size = 'sm',
}: {
  labels: CreatorLabel[];
  max?: number;
  size?: 'xs' | 'sm';
}) {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, max);
  const overflow = labels.length - visible.length;
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map(l => (
        <span
          key={l.id}
          className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${getLabelColorClass(l.color)}`}
          title={l.name}
        >
          {l.name}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`inline-flex items-center rounded-full font-semibold ${sizeClass} bg-surface-tertiary text-content-muted border border-border`}
          title={labels.slice(max).map(l => l.name).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export default CreatorLabelBadges;
