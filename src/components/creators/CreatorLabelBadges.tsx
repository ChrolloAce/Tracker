import { CreatorLabel } from '../../types/firestore';

/**
 * Compact pill row of labels assigned to a creator. Used inline next to the
 * creator's name in CreatorsTable and the dashboard creator chip. Keep these
 * deliberately tiny — they sit alongside other metadata and shouldn't dominate.
 */

// Light-mode-first defaults (visible on white) plus dark: overrides for the
// dark theme. The previous /15 alpha backgrounds + 400 text were invisible on
// a white surface — now light mode uses solid -100 fills with -800 text and
// dark mode keeps the muted glassy look.
const COLOR_CLASSES: Record<string, string> = {
  orange:  'bg-orange-100  text-orange-800  border border-orange-200  dark:bg-orange-500/15  dark:text-orange-300  dark:border-orange-500/30',
  violet:  'bg-violet-100  text-violet-800  border border-violet-200  dark:bg-violet-500/15  dark:text-violet-300  dark:border-violet-500/30',
  slate:   'bg-slate-100   text-slate-800   border border-slate-200   dark:bg-slate-500/15   dark:text-slate-200   dark:border-slate-500/30',
  emerald: 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  blue:    'bg-blue-100    text-blue-800    border border-blue-200    dark:bg-blue-500/15    dark:text-blue-300    dark:border-blue-500/30',
  pink:    'bg-pink-100    text-pink-800    border border-pink-200    dark:bg-pink-500/15    dark:text-pink-300    dark:border-pink-500/30',
  amber:   'bg-amber-100   text-amber-900   border border-amber-200   dark:bg-amber-500/15   dark:text-amber-300   dark:border-amber-500/30',
  cyan:    'bg-cyan-100    text-cyan-800    border border-cyan-200    dark:bg-cyan-500/15    dark:text-cyan-300    dark:border-cyan-500/30',
  red:     'bg-red-100     text-red-800     border border-red-200     dark:bg-red-500/15     dark:text-red-300     dark:border-red-500/30',
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
