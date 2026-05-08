import React from 'react';
import { PlatformIcon } from '../ui/PlatformIcon';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

/**
 * Compact pill-row showing every platform a creator publishes on.
 * Sits next to the creator's name everywhere creators are displayed
 * (payouts table, multi-select dropdown, slideover picker, creators
 * admin table) so the user can scan platforms at a glance without
 * having to read account handles.
 *
 * Pass platforms directly, or a list of items each carrying a
 * `.platform` field (videos, accounts) and the component will derive
 * the unique set itself. Renders up to `max` platforms (default 3) and
 * appends a `+N` pill for overflow — same pattern as the existing
 * account-avatar stacks elsewhere in the app.
 */
interface CreatorPlatformBubblesProps {
  platforms?: Platform[];
  /** Convenience: pass any list of items with a `platform` field and we'll
   *  dedupe to unique platforms. Avoids duplicating the same one-liner at
   *  every call site. */
  items?: Array<{ platform?: string | null }>;
  max?: number;
  size?: 'xs' | 'sm';
  className?: string;
}

const isPlatform = (p: any): p is Platform =>
  p === 'instagram' || p === 'tiktok' || p === 'youtube' || p === 'twitter';

export const CreatorPlatformBubbles: React.FC<CreatorPlatformBubblesProps> = ({
  platforms,
  items,
  max = 3,
  size = 'xs',
  className = '',
}) => {
  // Derive the unique platform set. Explicit `platforms` prop wins;
  // otherwise pull from `items[].platform`. Order is insertion order
  // so a creator who publishes mostly on TikTok shows TikTok first.
  const unique: Platform[] = (() => {
    if (platforms && platforms.length > 0) {
      const seen = new Set<Platform>();
      const out: Platform[] = [];
      for (const p of platforms) {
        if (isPlatform(p) && !seen.has(p)) {
          seen.add(p);
          out.push(p);
        }
      }
      return out;
    }
    const seen = new Set<Platform>();
    const out: Platform[] = [];
    for (const it of items || []) {
      const p = it.platform;
      if (isPlatform(p) && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    return out;
  })();

  if (unique.length === 0) return null;

  const visible = unique.slice(0, max);
  const overflow = unique.length - visible.length;
  // Bubble + icon dimensions track the size prop. xs = 18px bubble,
  // sm = 22px bubble. Keeps the row compact next to a single line of
  // text without overpowering the name.
  const bubbleClass = size === 'xs' ? 'w-[18px] h-[18px]' : 'w-[22px] h-[22px]';

  return (
    <div className={`inline-flex items-center gap-1 flex-shrink-0 ${className}`}>
      {visible.map(p => (
        <div
          key={p}
          className={`${bubbleClass} rounded-full bg-surface-tertiary border border-border-subtle flex items-center justify-center`}
          title={p}
        >
          <PlatformIcon platform={p} size="xs" />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`${bubbleClass} rounded-full bg-surface-tertiary border border-border-subtle flex items-center justify-center text-[9px] font-semibold text-content-muted`}
          title={`+${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};
