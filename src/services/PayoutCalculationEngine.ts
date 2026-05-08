import type {
  PayoutStructure,
  PayoutComponent,
  PayoutMetric,
  PayoutCondition,
  CreatorPayoutRecord,
  TieredBonusPayoutComponent,
  BonusPayoutComponent,
  BonusCaps,
} from '../types/payouts';
import type { VideoSubmission } from '../types';
import { Timestamp } from 'firebase/firestore';
import { computePerVideoMetricInRange } from '../components/kpi/kpiDataProcessing';

/**
 * Performance metrics for a creator in a campaign
 */
export interface CreatorPerformance {
  creatorId: string;
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalEngagement: number;
  engagementRate: number;
  conversions?: number;
  videos: VideoSubmission[];
}

/**
 * Single video metrics (for per-video iteration)
 */
interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number;
  engagementRate: number;
  platform: string;
}

/**
 * Component calculation result
 */
export interface ComponentCalculation {
  componentId: string;
  componentName: string;
  type: string;
  amount: number;
  details: string;
  wasCapped?: boolean;
  originalAmount?: number;
  capType?: 'component' | 'perVideo' | 'perCampaign' | 'perPeriod' | 'structure';
}

/**
 * Payout calculation result
 */
export interface PayoutCalculationResult {
  creatorId: string;
  totalPayout: number;
  componentBreakdown: ComponentCalculation[];
  appliedCap?: {
    maxPayout: number;
    originalTotal: number;
    capType: 'structure' | 'perCampaign' | 'perPeriod';
  };
  performance: CreatorPerformance;
}

/**
 * Engine for calculating creator payouts based on flexible payout structures.
 *
 * Two-pass architecture:
 *   Pass 1 (per-video): bonus/per_video components with perVideo caps
 *   Pass 2 (aggregate): CPM, flat, base, conversion on summed metrics
 *
 * Cap enforcement order:
 *   1. Component-level caps (CPM cap, perVideo bonus cap)
 *   2. Component-level perCampaign bonus cap
 *   3. Structure-level caps (maxPayout / caps.perCampaign)
 *   4. Structure-level caps.perPeriod
 */
export class PayoutCalculationEngine {

  // ===================== MAIN ENTRY =====================

  static calculateCreatorPayout(
    creatorId: string,
    structure: PayoutStructure,
    performance: CreatorPerformance,
    overrides?: Record<string, any>,
    priorPayoutsInPeriod?: number,
  ): PayoutCalculationResult {
    const componentBreakdown: ComponentCalculation[] = [];
    let totalPayout = 0;

    structure.components.forEach((component, index) => {
      const key = component.id || `comp-${index}`;
      const effectiveComponent = overrides?.[key]
        ? { ...component, ...overrides[key] }
        : component;

      let calc: ComponentCalculation;

      // Per-video components: iterate videos, apply per-video caps, sum
      if (this.isPerVideoComponent(effectiveComponent)) {
        calc = this.calculatePerVideoComponent(effectiveComponent, performance, index);
      } else {
        calc = this.calculateAggregateComponent(effectiveComponent, performance, index);
      }

      if (calc.amount > 0 || calc.wasCapped) {
        componentBreakdown.push(calc);
        totalPayout += calc.amount;
      }
    });

    // Structure-level cap: maxPayout (legacy) or caps.perCampaign
    const structureCap = structure.caps?.perCampaign ?? structure.maxPayout;
    let appliedCap: PayoutCalculationResult['appliedCap'];

    if (structureCap && totalPayout > structureCap) {
      appliedCap = { maxPayout: structureCap, originalTotal: totalPayout, capType: 'perCampaign' };
      totalPayout = structureCap;
    }

    // Per-period cap (calendar month / rolling week)
    if (structure.caps?.perPeriod && priorPayoutsInPeriod !== undefined) {
      const periodBudget = structure.caps.perPeriod.amount;
      const remaining = Math.max(0, periodBudget - priorPayoutsInPeriod);
      if (totalPayout > remaining) {
        appliedCap = { maxPayout: remaining, originalTotal: totalPayout, capType: 'perPeriod' };
        totalPayout = remaining;
      }
    }

    return { creatorId, totalPayout, componentBreakdown, appliedCap, performance };
  }

  // ===================== PER-VIDEO PASS =====================

  private static isPerVideoComponent(component: PayoutComponent): boolean {
    if (component.type === 'per_video') return true;
    if (component.type === 'bonus') {
      const b = component as BonusPayoutComponent;
      // Stacking bonus: default to per-video unless explicitly set to creator_total
      if (b.per && b.per > 0) {
        return b.scope !== 'creator_total';
      }
      // Non-stacking bonus: only per-video if perVideo cap is set
      if (b.caps?.perVideo) return true;
    }
    if (component.type === 'bonus_tiered' && (component as TieredBonusPayoutComponent).caps?.perVideo) return true;
    return false;
  }

  private static calculatePerVideoComponent(
    component: PayoutComponent,
    performance: CreatorPerformance,
    index: number,
  ): ComponentCalculation {
    // Apply per-component crossPostPolicy: collapses cross-post groups into the right
    // number/shape of effective videos BEFORE the existing per-video loop runs.
    const videos = this.videosForComponent(component, performance.videos || []);
    let totalAmount = 0;
    let videosPaid = 0;
    const caps = (component as any).caps as BonusCaps | undefined;

    for (const video of videos) {
      const vm = this.videoToMetrics(video);
      let videoAmount = 0;

      if (component.type === 'per_video') {
        const maxVideos = component.maxVideos;
        if (maxVideos && videosPaid >= maxVideos) break;

        // Check quality threshold
        if (component.minQualityThreshold) {
          const val = this.getVideoMetric(vm, component.minQualityThreshold.metric as PayoutMetric);
          if (val < component.minQualityThreshold.value) continue;
        }
        videoAmount = component.amountPerVideo;
        videosPaid++;
      } else if (component.type === 'bonus') {
        const bonus = component as BonusPayoutComponent;
        const videoPerf = this.videoToCreatorPerformance(video);
        if (bonus.per && bonus.per > 0) {
          // Stacking mode: piecewise by rate tiers (base tier + optional higher bands)
          const metricValue = this.getMetricValue(bonus.condition.metric, videoPerf);
          const minThreshold = bonus.condition.value || 0;
          if (metricValue >= minThreshold) {
            videoAmount = this.calcStackingAmount(metricValue, bonus).amount;
          }
        } else if (this.checkCondition(bonus.condition as PayoutCondition, videoPerf)) {
          videoAmount = bonus.amount || 0;
        }
      } else if (component.type === 'bonus_tiered') {
        const tiered = component as TieredBonusPayoutComponent;
        const videoPerf = this.videoToCreatorPerformance(video);
        const result = this.calculateTieredBonus(tiered, videoPerf);
        videoAmount = result.amount;
      }

      // Apply per-video cap
      if (caps?.perVideo && videoAmount > caps.perVideo) {
        videoAmount = caps.perVideo;
      }

      totalAmount += videoAmount;
    }

    // Apply per-campaign bonus cap
    let wasCapped = false;
    let originalAmount: number | undefined;
    if (caps?.perCampaign && totalAmount > caps.perCampaign) {
      originalAmount = totalAmount;
      totalAmount = caps.perCampaign;
      wasCapped = true;
    }

    const details = this.buildPerVideoDetails(component, totalAmount, videos.length, videosPaid, caps);

    return {
      componentId: component.id || `comp-${index}`,
      componentName: component.name || `Component ${index + 1}`,
      type: component.type,
      amount: Math.round(totalAmount * 100) / 100,
      details,
      wasCapped,
      originalAmount,
      capType: wasCapped ? 'perCampaign' : undefined,
    };
  }

  private static buildPerVideoDetails(
    component: PayoutComponent,
    total: number,
    totalVideos: number,
    videosPaid: number,
    caps?: BonusCaps,
  ): string {
    let d = '';
    if (component.type === 'per_video') {
      const amt = (component as any).amountPerVideo;
      d = `$${this.formatMoney(amt)} per video × ${videosPaid} ${videosPaid === 1 ? 'video' : 'videos'} = $${this.formatMoney(total)}`;
    } else if (component.type === 'bonus') {
      const bonus = component as BonusPayoutComponent;
      if (bonus.per) {
        const hasTiers = bonus.rateTiers && bonus.rateTiers.length > 0;
        d = hasTiers
          ? `Tiered stacking bonus across ${videosPaid || totalVideos} videos = $${this.formatMoney(total)}`
          : `$${this.formatMoney(bonus.amount || 0)} per ${bonus.per.toLocaleString()} ${bonus.condition.metric}, across ${videosPaid || totalVideos} videos = $${this.formatMoney(total)}`;
      } else {
        d = `Bonus across ${videosPaid || totalVideos} videos = $${this.formatMoney(total)}`;
      }
    } else if (component.type === 'bonus_tiered') {
      d = `Tiered bonus across ${videosPaid || totalVideos} videos = $${this.formatMoney(total)}`;
    } else {
      d = `${videosPaid || totalVideos} videos = $${this.formatMoney(total)}`;
    }
    if (caps?.perVideo) d += ` (capped at $${this.formatMoney(caps.perVideo)}/video)`;
    if (caps?.perCampaign) d += ` (campaign cap $${this.formatMoney(caps.perCampaign)})`;
    return d;
  }

  // ===================== AGGREGATE PASS =====================

  private static calculateAggregateComponent(
    component: PayoutComponent,
    performance: CreatorPerformance,
    index: number,
  ): ComponentCalculation {
    let amount = 0;
    let details = '';
    let wasCapped = false;
    let originalAmount = 0;

    switch (component.type) {
      case 'base':
      case 'flat': {
        amount = (component as any).amount || 0;
        details = `Flat payment: $${amount}`;
        break;
      }

      case 'cpm': {
        const cpm = component as any;
        const metric = (cpm.metric || 'views') as PayoutMetric;
        const policy = cpm.crossPostPolicy || 'sum-all';
        const rate = cpm.rate || 0;
        const minThreshold = cpm.minThreshold || 0;

        // crossPostPolicy decides the effective metric total:
        //   'sum-all' (default) → sum across every platform copy (current behavior)
        //   'max-per-group' → per cross-post group use only the best-performing copy's metric
        let metricValue = this.getMetricValue(metric, performance);
        if (policy === 'max-per-group' && performance.videos?.length) {
          const groups = this.groupVideos(performance.videos);
          metricValue = groups.reduce((sum, g) => {
            const best = Math.max(...g.videos.map(v => this.getVideoMetric(this.videoToMetrics(v), metric)));
            return sum + best;
          }, 0);
        }

        amount = metricValue < minThreshold ? 0 : (metricValue / 1000) * rate;
        details = `${metricValue.toLocaleString()} ${cpm.metric || 'views'} × $${this.formatMoney(rate)} per 1,000 = $${this.formatMoney(amount)}`;
        if (policy === 'max-per-group') details += ' (max per cross-post group)';

        if (cpm.cap && amount > cpm.cap) {
          originalAmount = amount;
          amount = cpm.cap;
          wasCapped = true;
          details += ` (capped at $${this.formatMoney(cpm.cap)})`;
        }
        break;
      }

      case 'bonus': {
        const bonus = component as BonusPayoutComponent;
        if (bonus.per && bonus.per > 0) {
          // Stacking mode: piecewise by rate tiers (base tier + optional higher bands)
          const metricValue = this.getMetricValue(bonus.condition.metric, performance);
          const minThreshold = bonus.condition.value || 0;
          if (metricValue >= minThreshold) {
            const result = this.calcStackingAmount(metricValue, bonus);
            amount = result.amount;
            const hasTiers = bonus.rateTiers && bonus.rateTiers.length > 0;
            if (hasTiers) {
              const parts = result.breakdown.map(b =>
                `${b.bandLabel}: ${b.units} × $${this.formatMoney(b.rate)}/${b.per.toLocaleString()} = $${this.formatMoney(b.bandAmount)}`
              );
              details = `${metricValue.toLocaleString()} ${bonus.condition.metric} → ${parts.join(' · ')} = $${this.formatMoney(amount)}`;
            } else {
              const units = Math.floor(metricValue / bonus.per);
              details = `${units} × $${this.formatMoney(bonus.amount || 0)} per ${bonus.per.toLocaleString()} ${bonus.condition.metric} (${metricValue.toLocaleString()} total) = $${this.formatMoney(amount)}`;
            }
          } else {
            details = `${metricValue.toLocaleString()} ${bonus.condition.metric} (min ${minThreshold.toLocaleString()} not met)`;
          }
        } else if (this.checkCondition(bonus.condition as PayoutCondition, performance)) {
          amount = bonus.amount || 0;
          details = `Bonus: ${this.formatCondition(bonus.condition as PayoutCondition, performance)}`;
        }

        // Apply per-campaign cap on aggregate bonus
        if (bonus.caps?.perCampaign && amount > bonus.caps.perCampaign) {
          originalAmount = amount;
          amount = bonus.caps.perCampaign;
          wasCapped = true;
          details += ` (capped at $${this.formatMoney(bonus.caps.perCampaign)})`;
        }
        break;
      }

      case 'bonus_tiered': {
        const tierResult = this.calculateTieredBonus(component, performance);
        amount = tierResult.amount;
        details = tierResult.details;

        const tieredCaps = (component as TieredBonusPayoutComponent).caps;
        if (tieredCaps?.perCampaign && amount > tieredCaps.perCampaign) {
          originalAmount = amount;
          amount = tieredCaps.perCampaign;
          wasCapped = true;
          details += ` (capped at $${this.formatMoney(tieredCaps.perCampaign)})`;
        }
        break;
      }

      case 'conversion': {
        const conv = component as any;
        const conversions = performance.conversions || 0;
        if (conv.minConversions && conversions < conv.minConversions) {
          amount = 0;
          details = `Conversions: ${conversions.toLocaleString()} (min ${conv.minConversions.toLocaleString()} not met)`;
        } else {
          amount = conversions * (conv.amountPerConversion || 0);
          details = `Conversions: ${conversions.toLocaleString()} × $${this.formatMoney(conv.amountPerConversion || 0)} = $${this.formatMoney(amount)}`;
          if (conv.cap && amount > conv.cap) {
            originalAmount = amount;
            amount = conv.cap;
            wasCapped = true;
            details += ` (capped at $${this.formatMoney(conv.cap)})`;
          }
        }
        break;
      }

      case 'per_video': {
        // per_video without perVideo caps → simple aggregate calc
        const pv = component as any;
        const count = Math.min(performance.videoCount, pv.maxVideos || Infinity);
        amount = count * (pv.amountPerVideo || 0);
        details = `$${this.formatMoney(pv.amountPerVideo || 0)}/video × ${count} videos = $${this.formatMoney(amount)}`;
        break;
      }
    }

    return {
      componentId: component.id || `comp-${index}`,
      componentName: component.name || `Component ${index + 1}`,
      type: component.type,
      amount: Math.round(amount * 100) / 100,
      details,
      wasCapped,
      originalAmount: wasCapped ? originalAmount : undefined,
      capType: wasCapped ? 'component' : undefined,
    };
  }

  // ===================== HELPERS =====================

  private static calculateTieredBonus(
    component: PayoutComponent,
    performance: CreatorPerformance,
  ): { amount: number; details: string } {
    const tiered = component as TieredBonusPayoutComponent;
    if (!tiered.tiers || tiered.tiers.length === 0) {
      return { amount: 0, details: 'No tiers defined' };
    }

    const sortedTiers = [...tiered.tiers].sort((a, b) => b.threshold - a.threshold);
    const metric = tiered.metric || 'views';
    const metricValue = this.getMetricValue(metric, performance);

    for (const tier of sortedTiers) {
      if (metricValue >= tier.threshold) {
        return {
          amount: tier.amount,
          details: `Tier bonus: ${metricValue.toLocaleString()} ${metric} (≥ ${tier.threshold.toLocaleString()}) → $${this.formatMoney(tier.amount)}`,
        };
      }
    }
    return { amount: 0, details: 'No tier threshold met' };
  }

  private static checkCondition(condition: PayoutCondition, performance: CreatorPerformance): boolean {
    const metricValue = this.getMetricValue(condition.metric, performance);
    const target = condition.value;
    switch (condition.operator || '>=') {
      case '>=': return metricValue >= target;
      case '>':  return metricValue > target;
      case '<':  return metricValue < target;
      case '<=': return metricValue <= target;
      case '=':  return metricValue === target;
      default:   return metricValue >= target;
    }
  }

  private static getMetricValue(metric: PayoutMetric, performance: CreatorPerformance): number {
    switch (metric) {
      case 'views':          return performance.totalViews;
      case 'likes':          return performance.totalLikes;
      case 'comments':       return performance.totalComments;
      case 'shares':         return performance.totalShares;
      case 'saves':          return performance.totalSaves;
      case 'engagement_rate': return performance.engagementRate;
      case 'videos_posted':  return performance.videoCount;
      case 'conversions':    return performance.conversions || 0;
      case 'ig_reel_plays':  return performance.totalViews; // alias
      case 'yt_views':       return performance.totalViews; // alias
      case 'tt_views':       return performance.totalViews; // alias
      default:               return 0;
    }
  }

  private static getVideoMetric(vm: VideoMetrics, metric: PayoutMetric): number {
    switch (metric) {
      case 'views':          return vm.views;
      case 'likes':          return vm.likes;
      case 'comments':       return vm.comments;
      case 'shares':         return vm.shares;
      case 'saves':          return vm.saves;
      case 'engagement_rate': return vm.engagementRate;
      default:               return 0;
    }
  }

  private static videoToMetrics(video: VideoSubmission): VideoMetrics {
    const views = video.views || 0;
    const likes = video.likes || 0;
    const comments = video.comments || 0;
    const shares = (video as any).shares || 0;
    const saves = (video as any).saves || 0;
    const engagement = likes + comments + shares + saves;
    return {
      views, likes, comments, shares, saves, engagement,
      engagementRate: views > 0 ? (engagement / views) * 100 : 0,
      platform: video.platform || 'unknown',
    };
  }

  private static videoToCreatorPerformance(video: VideoSubmission): CreatorPerformance {
    const vm = this.videoToMetrics(video);
    return {
      creatorId: 'per-video',
      videoCount: 1,
      totalViews: vm.views,
      totalLikes: vm.likes,
      totalComments: vm.comments,
      totalShares: vm.shares,
      totalSaves: vm.saves,
      totalEngagement: vm.engagement,
      engagementRate: vm.engagementRate,
      videos: [video],
    };
  }

  // ===================== FORMATTING =====================

  private static formatCondition(condition: PayoutCondition, performance: CreatorPerformance): string {
    const value = this.getMetricValue(condition.metric, performance);
    const target = condition.value;
    return `${this.formatNumber(value)} ${this.getMetricLabel(condition.metric)} (target: ${this.formatNumber(target)})`;
  }

  private static getMetricLabel(metric: PayoutMetric): string {
    const labels: Record<PayoutMetric, string> = {
      views: 'views', likes: 'likes', comments: 'comments', shares: 'shares',
      saves: 'saves', engagement_rate: '% engagement', videos_posted: 'videos',
      conversions: 'conversions', ig_reel_plays: 'IG reel plays',
      yt_views: 'YT views', tt_views: 'TikTok views',
    };
    return labels[metric] || metric;
  }

  static formatNumber(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  }

  /** Money formatter with thousands separators: 1150 → "1,150.00". Pair with a leading "$". */
  static formatMoney(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ===================== CROSS-POST GROUPING =====================

  /** Group raw videos by crossPostGroupId. Ungrouped videos are returned as size-1 groups. */
  private static groupVideos(videos: VideoSubmission[]): Array<{ groupId: string | null; videos: VideoSubmission[] }> {
    const grouped = new Map<string, VideoSubmission[]>();
    const standalone: VideoSubmission[] = [];
    for (const v of videos) {
      const gid = (v as any).crossPostGroupId as string | undefined;
      if (gid) {
        const arr = grouped.get(gid) || [];
        arr.push(v);
        grouped.set(gid, arr);
      } else {
        standalone.push(v);
      }
    }
    const result: Array<{ groupId: string | null; videos: VideoSubmission[] }> = [];
    for (const [gid, vids] of grouped) result.push({ groupId: gid, videos: vids });
    for (const v of standalone) result.push({ groupId: null, videos: [v] });
    return result;
  }

  /** Transform raw video list into "effective" videos for a per-video component based on its
   *  crossPostPolicy. Standalone videos always pass through unchanged. */
  private static videosForComponent(component: PayoutComponent, videos: VideoSubmission[]): VideoSubmission[] {
    const groups = this.groupVideos(videos);
    const result: VideoSubmission[] = [];

    if (component.type === 'per_video') {
      const policy = component.crossPostPolicy || 'count-as-1';
      const cap = component.crossPostCap || 1;
      for (const g of groups) {
        if (g.videos.length === 1 || policy === 'count-as-each') {
          result.push(...g.videos);
        } else if (policy === 'count-with-cap') {
          // Emit up to cap copies (prioritize highest-view)
          const sorted = [...g.videos].sort((a, b) => (b.views || 0) - (a.views || 0));
          result.push(...sorted.slice(0, Math.max(1, cap)));
        } else {
          // count-as-1 — single representative (best copy)
          const best = [...g.videos].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
          result.push(best);
        }
      }
      return result;
    }

    if (component.type === 'bonus' || component.type === 'bonus_tiered') {
      const policy = (component as any).crossPostPolicy || 'max-per-group';
      if (policy === 'per-platform') return videos;
      for (const g of groups) {
        if (g.videos.length === 1) {
          result.push(g.videos[0]);
        } else {
          // Synthesize one merged video per group with either max or summed metrics
          const merge = (fn: (v: VideoSubmission) => number) =>
            policy === 'sum-per-group'
              ? g.videos.reduce((s, v) => s + fn(v), 0)
              : Math.max(...g.videos.map(fn));
          const base = g.videos[0];
          result.push({
            ...base,
            id: `group-${g.groupId}`,
            views: merge(v => v.views || 0),
            likes: merge(v => v.likes || 0),
            comments: merge(v => v.comments || 0),
            shares: merge(v => (v as any).shares || 0),
            saves: merge(v => (v as any).saves || 0),
            crossPostGroupId: g.groupId || undefined,
          } as VideoSubmission);
        }
      }
      return result;
    }

    return videos;
  }

  // ===================== STACKING BONUS (piecewise rate tiers) =====================

  /** Compute piecewise stacking payout. Base tier (amount/per from threshold 0) plus optional rateTiers.
   *  Each tier band is evaluated independently: floor(bandSize / per) × rate. */
  private static calcStackingAmount(metricValue: number, bonus: BonusPayoutComponent): {
    amount: number;
    breakdown: Array<{ bandLabel: string; units: number; rate: number; per: number; bandAmount: number }>;
  } {
    const baseTier = { threshold: 0, rate: bonus.amount || 0, per: bonus.per || 1 };
    const extra = bonus.rateTiers || [];
    const tiers = [baseTier, ...extra].sort((a, b) => a.threshold - b.threshold);

    const breakdown: Array<{ bandLabel: string; units: number; rate: number; per: number; bandAmount: number }> = [];
    let total = 0;
    for (let i = 0; i < tiers.length; i++) {
      const curr = tiers[i];
      const next = tiers[i + 1];
      const upper = next ? next.threshold : Infinity;
      const bandHigh = Math.min(upper, metricValue);
      const bandSize = Math.max(0, bandHigh - curr.threshold);
      if (bandSize <= 0) continue;
      const perUnit = curr.per || 1;
      const units = Math.floor(bandSize / perUnit);
      const bandAmount = units * curr.rate;
      total += bandAmount;
      const bandLabel = isFinite(upper)
        ? `${curr.threshold.toLocaleString()}–${upper.toLocaleString()}`
        : `≥${curr.threshold.toLocaleString()}`;
      breakdown.push({ bandLabel, units, rate: curr.rate, per: perUnit, bandAmount });
    }
    return { amount: total, breakdown };
  }

  // ===================== PUBLIC HELPERS =====================

  /**
   * Aggregate per-video metrics into a `CreatorPerformance` for the engine.
   *
   * `dateRange` (optional) bounds the math to snapshot-aware deltas inside
   * [start, end] — matching what the dashboard's KPI cards show. When passed:
   *   - views are computed via `computePerVideoMetricInRange(..., 'views', { excludeSparked: true })`
   *     so creators are paid on ORGANIC views only (sparked/paid views are
   *     subtracted, mirroring the dashboard's `organic` reporting mode).
   *   - likes/comments/shares/saves use the same snapshot-aware path WITHOUT
   *     spark exclusion (those metrics aren't inflated by paid promotion the
   *     same way).
   *
   * Without `dateRange` the function falls back to the OLD lifetime-sum
   * behavior so any caller that hasn't been migrated yet still compiles and
   * runs. New callers should always pass `dateRange` — the lifetime fallback
   * over-pays creators when a campaign window is set.
   *
   * `start: null` inside `dateRange` means "all time" (no lower bound) — this
   * still routes through the snapshot-aware path so spark subtraction works.
   */
  static calculatePerformance(
    creatorId: string,
    videos: VideoSubmission[],
    dateRange?: { start: Date | null; end: Date },
  ): CreatorPerformance {
    let totalViews: number;
    let totalLikes: number;
    let totalComments: number;
    let totalShares: number;
    let totalSaves: number;

    // When dateRange is provided we project each video onto its in-range values
    // BEFORE the per-video pass runs. The engine's per-video components (CPM,
    // per_video, bonuses, cross-post grouping) all read `video[metric]` directly
    // — without this projection they'd silently fall back to lifetime values
    // even though the aggregate totals on `performance` were date-bounded.
    let scaledVideos: VideoSubmission[] = videos;

    if (dateRange) {
      const { start, end } = dateRange;
      scaledVideos = videos.map(v => ({
        ...v,
        views: computePerVideoMetricInRange(v, 'views', start, end, { excludeSparked: true }),
        likes: computePerVideoMetricInRange(v, 'likes', start, end),
        comments: computePerVideoMetricInRange(v, 'comments', start, end),
        shares: computePerVideoMetricInRange(v, 'shares', start, end),
        saves: computePerVideoMetricInRange(v, 'saves', start, end),
      }));
      totalViews = scaledVideos.reduce((s, v) => s + (v.views || 0), 0);
      totalLikes = scaledVideos.reduce((s, v) => s + (v.likes || 0), 0);
      totalComments = scaledVideos.reduce((s, v) => s + (v.comments || 0), 0);
      totalShares = scaledVideos.reduce((s, v) => s + ((v as any).shares || 0), 0);
      totalSaves = scaledVideos.reduce((s, v) => s + ((v as any).saves || 0), 0);
    } else {
      // Lifetime fallback for legacy callers. New callers should pass `dateRange`.
      totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
      totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
      totalComments = videos.reduce((s, v) => s + (v.comments || 0), 0);
      totalShares = videos.reduce((s, v) => s + ((v as any).shares || 0), 0);
      totalSaves = videos.reduce((s, v) => s + ((v as any).saves || 0), 0);
    }

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    return {
      creatorId, videoCount: scaledVideos.length,
      totalViews, totalLikes, totalComments, totalShares, totalSaves,
      totalEngagement, engagementRate, videos: scaledVideos,
    };
  }

  static calculateBatchPayouts(
    assignments: Array<{
      creatorId: string;
      structure: PayoutStructure;
      performance: CreatorPerformance;
      overrides?: Record<string, any>;
      priorPayoutsInPeriod?: number;
    }>,
  ): PayoutCalculationResult[] {
    return assignments.map(a =>
      this.calculateCreatorPayout(a.creatorId, a.structure, a.performance, a.overrides, a.priorPayoutsInPeriod),
    );
  }

  static createPayoutRecord(
    campaignId: string,
    _orgId: string,
    _projectId: string,
    calculation: PayoutCalculationResult,
    _periodStart: Date,
    _periodEnd: Date,
  ): Omit<CreatorPayoutRecord, 'id'> {
    return {
      campaignId,
      creatorId: calculation.creatorId,
      calculatedAt: Timestamp.now() as any,
      componentPayouts: calculation.componentBreakdown.map((comp, idx) => ({
        componentType: comp.type as any,
        componentIndex: idx,
        description: comp.componentName,
        amount: comp.amount,
        details: { original: comp.details, wasCapped: comp.wasCapped, capType: comp.capType },
      })),
      subtotal: calculation.componentBreakdown.reduce((s, c) => s + c.amount, 0),
      total: calculation.totalPayout,
      capApplied: calculation.appliedCap?.maxPayout,
      performanceData: {
        views: calculation.performance.totalViews,
        likes: calculation.performance.totalLikes,
        comments: calculation.performance.totalComments,
        shares: calculation.performance.totalShares,
        saves: calculation.performance.totalSaves,
        videosPosted: calculation.performance.videoCount,
        engagementRate: calculation.performance.engagementRate,
      },
      status: 'pending',
    };
  }

  static estimatePayout(
    structure: PayoutStructure,
    estimatedMetrics: Partial<CreatorPerformance>,
  ): number {
    const videoCount = Math.max(1, estimatedMetrics.videoCount || 10);
    const totalViews = estimatedMetrics.totalViews ?? 100000;
    const totalLikes = estimatedMetrics.totalLikes ?? 5000;
    const totalComments = estimatedMetrics.totalComments ?? 500;
    const totalShares = estimatedMetrics.totalShares ?? 200;
    const totalSaves = estimatedMetrics.totalSaves ?? 1000;
    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;

    // Synthesize videos that sum to the totals so per-video passes
    // (per_video, stacking bonuses in per-video scope, tiered bonuses with perVideo cap)
    // produce meaningful estimates instead of $0.
    const syntheticVideos = Array.from({ length: videoCount }, (_, i) => ({
      id: `preview-${i}`,
      url: '',
      platform: 'tiktok',
      thumbnail: '',
      title: `Preview ${i + 1}`,
      uploader: 'Preview',
      uploaderHandle: '',
      status: 'approved',
      dateSubmitted: new Date(),
      uploadDate: new Date(),
      views: Math.floor(totalViews / videoCount),
      likes: Math.floor(totalLikes / videoCount),
      comments: Math.floor(totalComments / videoCount),
      shares: Math.floor(totalShares / videoCount),
      saves: Math.floor(totalSaves / videoCount),
    })) as unknown as VideoSubmission[];

    const performance: CreatorPerformance = {
      creatorId: 'preview',
      videoCount,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      totalEngagement: estimatedMetrics.totalEngagement ?? totalEngagement,
      engagementRate: estimatedMetrics.engagementRate ?? (totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0),
      videos: syntheticVideos,
    };
    return this.calculateCreatorPayout('preview', structure, performance).totalPayout;
  }
}
