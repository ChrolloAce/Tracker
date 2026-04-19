/**
 * Build a human-readable list of deal terms from a PayoutStructure snapshot.
 *
 * Server-side only. Given the structureSnapshot that was frozen onto a creator when the admin
 * assigned them a structure, this produces an array of short readable sentences the creator
 * portal can render as "Your deal:" bullets. Hides all internal component types, ids, metric
 * names, etc. — surfaces only what matters to the creator: "how do I earn money?"
 *
 * Safe with malformed/partial snapshots — if a component is missing fields it's skipped rather
 * than crashing the endpoint. Creators should never see error messages here; worst case is an
 * empty array (UI falls back to a generic "You'll earn based on your tracked videos" label).
 */

// Field names vary across component types — some use `amount`, others `amountPerVideo` or
// `amountPerConversion`. Pre-flight for all the keys we read below so a missing/renamed field
// never crashes the endpoint.
type AnyComponent = {
  type: string;
  name?: string;
  amount?: number;               // base, flat, bonus, bonus_tiered
  amountPerVideo?: number;       // per_video
  amountPerConversion?: number;  // conversion
  rate?: number;                 // cpm
  per?: number;                  // bonus (stacking mode)
  metric?: string;               // cpm, bonus_tiered
  maxVideos?: number;            // per_video
  tiers?: Array<{ threshold: number; amount: number }>;
  rateTiers?: Array<{ threshold: number; rate: number; per: number }>;
  /** bonus uses condition.metric, NOT the top-level metric field (which doesn't exist on bonus). */
  condition?: { value?: number; metric?: string; operator?: string };
  crossPostPolicy?: string;
  crossPostCap?: number;
  caps?: { perVideo?: number; perCampaign?: number };
};

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

/** Turn a metric key into a noun creators understand. Falls back to the raw key. */
function metricLabel(metric: string | undefined): string {
  if (!metric) return 'views';
  const map: Record<string, string> = {
    views: 'views',
    likes: 'likes',
    comments: 'comments',
    shares: 'shares',
    saves: 'saves',
    conversions: 'conversions',
    videos_posted: 'videos posted',
    engagement_rate: 'engagement',
    ig_reel_plays: 'Instagram plays',
    yt_views: 'YouTube views',
    tt_views: 'TikTok views',
  };
  return map[metric] || metric.replace(/_/g, ' ');
}

/** Render a short explanation of a single component. Returns null if the component is malformed. */
function describeComponent(c: AnyComponent, currency: string): string | null {
  switch (c.type) {
    case 'flat':
    case 'base': {
      if (typeof c.amount !== 'number') return null;
      return `${fmtMoney(c.amount, currency)} base fee for participating`;
    }

    case 'cpm': {
      if (typeof c.rate !== 'number') return null;
      return `${fmtMoney(c.rate, currency)} per 1,000 ${metricLabel(c.metric)}`;
    }

    case 'per_video': {
      // Actual field name in VideoPayoutComponent is `amountPerVideo` — NOT `amount`.
      // Falling back to `amount` so the helper is resilient if older docs used that shape.
      const amt = typeof c.amountPerVideo === 'number' ? c.amountPerVideo
                : typeof c.amount === 'number' ? c.amount
                : null;
      if (amt === null) return null;
      const cap = c.maxVideos && c.maxVideos > 0 ? ` (up to ${c.maxVideos} videos)` : '';
      return `${fmtMoney(amt, currency)} per video${cap}`;
    }

    case 'conversion': {
      // Actual field name in ConversionPayoutComponent is `amountPerConversion` — NOT `amount`.
      const amt = typeof c.amountPerConversion === 'number' ? c.amountPerConversion
                : typeof c.amount === 'number' ? c.amount
                : null;
      if (amt === null) return null;
      return `${fmtMoney(amt, currency)} per conversion`;
    }

    case 'bonus': {
      // BonusPayoutComponent keeps its metric under `condition.metric` — there's no top-level
      // `metric` field on this type. Fall back to c.metric only if the frozen snapshot was
      // written from an older shape.
      const bonusMetric = c.condition?.metric || c.metric;

      // Stacking bonus (ongoing earn-per-metric) vs one-time (threshold reached once)
      const isStacking = typeof c.per === 'number' && c.per > 0;

      if (isStacking) {
        if (typeof c.amount !== 'number' || typeof c.per !== 'number') return null;
        let base = `${fmtMoney(c.amount, currency)} per ${fmtNum(c.per)} ${metricLabel(bonusMetric)}`;
        // Rate tiers stack on top — describe them as escalating rates above thresholds
        if (Array.isArray(c.rateTiers) && c.rateTiers.length > 0) {
          const tierParts = c.rateTiers
            .filter(t => typeof t.threshold === 'number' && typeof t.rate === 'number' && typeof t.per === 'number' && t.per > 0)
            .map(t => `${fmtMoney(t.rate, currency)} per ${fmtNum(t.per)} above ${fmtNum(t.threshold)}`);
          if (tierParts.length > 0) {
            base += ` (boosted to ${tierParts.join('; ')})`;
          }
        }
        return base;
      }

      // One-time bonus at a threshold
      if (typeof c.amount !== 'number') return null;
      const threshold = c.condition?.value;
      if (typeof threshold === 'number') {
        return `${fmtMoney(c.amount, currency)} bonus when your ${metricLabel(bonusMetric)} hit ${fmtNum(threshold)}`;
      }
      return `${fmtMoney(c.amount, currency)} bonus`;
    }

    case 'bonus_tiered': {
      if (!Array.isArray(c.tiers) || c.tiers.length === 0) return null;
      const valid = c.tiers
        .filter(t => typeof t.threshold === 'number' && typeof t.amount === 'number')
        .sort((a, b) => a.threshold - b.threshold);
      if (valid.length === 0) return null;
      const parts = valid.map(t => `${fmtMoney(t.amount, currency)} at ${fmtNum(t.threshold)}`);
      return `Milestone bonuses for ${metricLabel(c.metric)} — ${parts.join(', ')}`;
    }

    default:
      return null;
  }
}

/**
 * Main entry — build the deal summary for a creator's entry in a campaign.
 *
 * Inputs:
 *   - structureSnapshot: the structure frozen onto the creator at assignment time
 *   - campaign:          the parent campaign (for date window, currency, caps)
 *   - creator:           the creator entry (for per-creator start date)
 */
export function buildDealSummary(
  structureSnapshot: any | undefined,
  campaign: { startDate?: any; endDate?: any; currency?: string; minimumPayout?: number } | undefined,
  creator: { countVideosFromDate?: any } | undefined,
): string[] {
  const currency = (campaign?.currency || 'usd').toLowerCase();
  const lines: string[] = [];

  // ==== Component breakdown ====
  const components: AnyComponent[] = Array.isArray(structureSnapshot?.components) ? structureSnapshot.components : [];
  for (const c of components) {
    const line = describeComponent(c, currency);
    if (line) lines.push(line);
    // Per-component caps (rare but possible) — surface separately so earning math is clear
    if (c.caps?.perVideo && typeof c.caps.perVideo === 'number') {
      lines.push(`Capped at ${fmtMoney(c.caps.perVideo, currency)} per video for this bonus`);
    }
    if (c.caps?.perCampaign && typeof c.caps.perCampaign === 'number') {
      lines.push(`Capped at ${fmtMoney(c.caps.perCampaign, currency)} total for this bonus`);
    }
  }

  // ==== Structure-level caps ====
  const maxPayout = structureSnapshot?.maxPayout;
  if (typeof maxPayout === 'number' && maxPayout > 0) {
    lines.push(`Maximum total payout: ${fmtMoney(maxPayout, currency)}`);
  }
  const structureCaps = structureSnapshot?.caps;
  if (structureCaps?.perCampaign && typeof structureCaps.perCampaign === 'number') {
    lines.push(`Maximum earnings for this deal: ${fmtMoney(structureCaps.perCampaign, currency)}`);
  }

  // ==== Date window ====
  // Prefer the creator's personal start date if it's set; fall back to the campaign's.
  const asDate = (d: any): Date | undefined => {
    if (!d) return undefined;
    if (typeof d?.toDate === 'function') return d.toDate();
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const creatorStart = asDate(creator?.countVideosFromDate);
  const campaignStart = asDate(campaign?.startDate);
  const campaignEnd = asDate(campaign?.endDate);
  const effectiveStart = creatorStart && campaignStart
    ? (creatorStart.getTime() > campaignStart.getTime() ? creatorStart : campaignStart)
    : (creatorStart || campaignStart);

  if (effectiveStart || campaignEnd) {
    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (effectiveStart && campaignEnd) {
      lines.push(`Counts videos posted ${fmtDate(effectiveStart)} – ${fmtDate(campaignEnd)}`);
    } else if (effectiveStart) {
      lines.push(`Counts videos posted ${fmtDate(effectiveStart)} onwards`);
    } else if (campaignEnd) {
      lines.push(`Counts videos posted up to ${fmtDate(campaignEnd)}`);
    }
  }

  // ==== Minimum payout warning ====
  if (typeof campaign?.minimumPayout === 'number' && campaign.minimumPayout > 0) {
    lines.push(`You need to earn at least ${fmtMoney(campaign.minimumPayout, currency)} to get paid out for this period.`);
  }

  return lines;
}
