import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, ChevronLeft, ChevronDown, Users, DollarSign, Check, Eye, Search, RefreshCw,
  Coins, Banknote, Gift, Layers, Target, Film, Wallet, Sparkles, CheckCircle2,
  X, ArrowRight, Clock, AlertCircle, UserPlus, Trash2, Link2, Pencil,
  Lock, CalendarDays, Loader2, Send, Calendar,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import Sidebar from '../components/layout/Sidebar';
import { Button } from '../components/ui/Button';
import PayoutStructureManager from '../components/PayoutStructureManager';
import VideoSliderSection from '../components/VideoSliderSection';
import { PayoutCalculationEngine, type PayoutCalculationResult, type CreatorPerformance } from '../services/PayoutCalculationEngine';
import type { PayoutStructure, PayoutComponentType, PayoutMetric } from '../types/payouts';
import type { Creator, TrackedAccount } from '../types/firestore';
import { AccountsDataService } from '../services/firestore/AccountsDataService';
import FirestoreDataService from '../services/FirestoreDataService';
import type { VideoSubmission, VideoSnapshot } from '../types';
import { useAuth } from '../contexts/AuthContext';
import CreatorLinksService from '../services/CreatorLinksService';
import SuperAdminService from '../services/SuperAdminService';
import AdminStripeService from '../services/AdminStripeService';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { CreatorPlatformBubbles } from '../components/creators/CreatorPlatformBubbles';

// ==================== TYPES ====================

interface TrackedVideo {
  id: string;
  title: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter';
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  url: string;
  thumbnail?: string;
  uploaderHandle?: string;
  uploaderProfilePicture?: string;
  /** Videos sharing this ID are the same content cross-posted to multiple platforms. */
  crossPostGroupId?: string;
  /** When the video was posted on the platform (scraped from Apify). */
  uploadDate?: Date;
  /** When the video was added to ViewTrack (creator submit or account sync). */
  dateAdded?: Date;
  /** Direct CDN URL of the video file (Apify-extracted). Powers hover-preview in the cross-post modal.
   *  May be expired or absent — UI falls back to thumbnail on load failure. */
  mediaUrl?: string;
  /** Historical metrics snapshots — required for snapshot-aware payout math (date-window deltas)
   *  and spark subtraction. Loaded via `FirestoreDataService.getVideoSnapshotsBatch` in
   *  `fetchCreatorVideos`. May be empty for legacy videos that pre-date snapshotting; engine
   *  falls back to lifetime values in that case. */
  snapshots?: VideoSnapshot[];
  /** When the video was marked as Sparked. Drives spark-subtraction math for organic-only
   *  payment math. See VideoDoc.sparkedAt. */
  sparkedAt?: Date;
  /** Manual ad-view log entries. Overrides `sparkedAt`-derived snapshot deltas when present.
   *  See VideoDoc.sparkViewLogs. */
  sparkViewLogs?: Array<{
    id: string;
    date: string;
    views: number;
    note?: string;
    loggedBy?: string;
    loggedAt?: Date;
  }>;
}

interface PayoutCampaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  creators: CampaignCreator[];
  /** Campaign window — videos outside this range don't contribute to payouts.
   *  Undefined means "all time" (no filter). */
  startDate?: Date;
  endDate?: Date;
  /** ISO-4217 currency code (lowercase). Every paid creator in this campaign uses this currency.
   *  Defaults to 'usd' when missing. Required to be explicit before Stripe transfers can happen. */
  currency?: string;
  /** Minimum payout, in the campaign's currency (same unit as `payoutResult.totalPayout` — dollars,
   *  not cents). Creators whose computed/override amount is below this cannot be marked paid.
   *  Stripe's own Connect minimum is ~$1 USD; we default higher to avoid dust payouts. */
  minimumPayout?: number;
  /** The `updatedAt` value we observed when this campaign was last loaded/saved. Used as a
   *  baseline to detect concurrent edits from another browser/tab before overwriting the doc.
   *  Not rendered in the UI. */
  lastLoadedUpdatedAt?: Date;
}

interface AuditEntry {
  action: string;
  at: Date;
  by: string;
  details?: string;
}

interface CampaignCreator {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  structure?: PayoutStructure;
  videos: TrackedVideo[];
  videosLoaded: boolean;
  videosLoading: boolean;
  payoutResult?: PayoutCalculationResult;
  payoutStatus: 'not_calculated' | 'pending' | 'approved' | 'paid';
  /** Admin-set manual amount. When present, engine's calculation is ignored and this is used. */
  payoutOverride?: { amount: number; note?: string };
  /** Videos flagged to exclude from payout calc (e.g. off-brief content). Ids reference TrackedVideo.id. */
  excludedVideoIds?: string[];
  /** Per-creator payout start date. Only videos uploaded on or after this date count — useful when
   *  a creator's earlier videos were already paid elsewhere. If both this and campaign.startDate are
   *  set, the LATER of the two wins (most restrictive). */
  countVideosFromDate?: Date;
  /** Immutable record of what this creator was actually paid. Written once when status flips to
   *  `paid`; cleared when reverted-from-paid (Phase 0; Phase 2 will gate revert if a Stripe
   *  transfer has settled). The `idempotencyKey` is passed to Stripe on the transfer call so a
   *  network retry cannot double-charge. Reconciliation runs off this field, NOT `payoutResult`
   *  (which can re-compute and change). */
  paidSnapshot?: {
    /** Paid amount in the campaign's currency. Same unit as `payoutResult.totalPayout` (dollars). */
    amount: number;
    /** ISO-4217 currency code, lowercase. Mirrored from `campaign.currency` at paid-time. */
    currency: string;
    /** When the admin clicked mark-paid. */
    paidAt: Date;
    /** Email (preferred) or uid of the admin who marked it paid. */
    paidBy: string;
    /** Stable key used as Stripe's `Idempotency-Key` so a retry of the same logical transfer
     *  is a no-op. Generated client-side at mark-paid time — format:
     *  `{campaignId}_{creatorId}_{ts_ms}_{6charRand}`. */
    idempotencyKey: string;
    /** Filled in by Phase 2 once the transfer successfully creates on Stripe. */
    stripeTransferId?: string;
    /** Pipeline state for the Stripe transfer itself. Absent until Phase 2. */
    stripeTransferStatus?: 'pending' | 'paid' | 'failed';
    /** Last error from Stripe, surfaced to the admin for retry. */
    stripeTransferError?: string;
  };
  /** Chronological log of mutations on this creator's payout (approvals, overrides, exclusions, etc.). */
  history?: AuditEntry[];
  /** Ledger of payouts already made to this creator, INCLUDING OFF-PLATFORM ones (Venmo, bank transfer,
   *  etc. that happened before Stripe was wired). Each entry captures a metric snapshot at the time of
   *  payment so audit trails are intact even if view counts change later. The NET OWED calculation is
   *  `gross - sum(priorPayouts.amount)` — so the admin only needs to pay the delta next time. */
  priorPayouts?: PriorPayoutEntry[];
}

interface PriorPayoutEntry {
  id: string;
  amount: number;
  /** ISO-4217 lowercase, mirrored from campaign.currency at record-time. */
  currency: string;
  paidAt: Date;
  /** How/where the payout happened. */
  method: 'bank_transfer' | 'venmo' | 'paypal' | 'wire' | 'cash' | 'stripe' | 'other';
  /** Free-text reference (bank txn ID, Venmo note, Stripe transfer ID, etc.). */
  reference?: string;
  notes?: string;
  /** Metric snapshot at time of payment — immutable audit trail. Captures every driver metric
   *  the structure might read so an auditor can always reconstruct the amount. Shares/saves/
   *  conversions matter for CPM-on-shares, CPM-on-saves, and per-conversion structures —
   *  without them stored here, the amount would be unexplained after the fact. */
  metricsAtPayout: {
    views: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    videoCount?: number;
    conversions?: number;
  };
  /** Email/uid of the admin who logged the entry. */
  recordedBy: string;
  recordedAt: Date;
}

// ==================== COMPONENT TYPE STYLING ====================

// Brand palette is black/orange/white. Component types are differentiated by icon + label.
const COMPONENT_META: Record<PayoutComponentType, { label: string; icon: typeof Coins }> = {
  base:         { label: 'Base Pay',       icon: Coins },
  flat:         { label: 'Flat Fee',       icon: Banknote },
  cpm:          { label: 'Per 1K Views',   icon: Sparkles },
  bonus:        { label: 'Bonus',          icon: Gift },
  bonus_tiered: { label: 'Tiered Bonus',   icon: Layers },
  conversion:   { label: 'Per Conversion', icon: Target },
  per_video:    { label: 'Per Video',      icon: Film },
};

const METHOD_LABEL: Record<PriorPayoutEntry['method'], string> = {
  bank_transfer: 'Bank transfer',
  venmo:         'Venmo',
  paypal:        'PayPal',
  wire:          'Wire',
  cash:          'Cash',
  stripe:        'Stripe (manual)',
  other:         'Other',
};

// ==================== HELPERS ====================

async function fetchCreatorVideos(orgId: string, projectId: string, creatorId: string): Promise<TrackedVideo[]> {
  const videosRef = collection(db, 'organizations', orgId, 'projects', projectId, 'videos');
  const videoMap = new Map<string, TrackedVideo>();
  const toVid = (id: string, d: any): TrackedVideo => ({
    id, title: d.videoTitle || d.title || 'Untitled', platform: d.platform || 'tiktok',
    views: d.views || 0, likes: d.likes || 0, comments: d.comments || 0,
    shares: d.shares || 0, saves: d.saves || 0, url: d.videoUrl || d.url || '',
    thumbnail: d.thumbnail, uploaderHandle: d.uploaderHandle,
    uploaderProfilePicture: d.uploaderProfilePicture,
    crossPostGroupId: d.crossPostGroupId,
    uploadDate: d.uploadDate?.toDate?.() || undefined,
    dateAdded: d.dateAdded?.toDate?.() || undefined,
    mediaUrl: d.mediaUrl || undefined,
    // Spark fields drive `excludeSparked` math downstream — pass them through
    // so payout calc can subtract paid views from creator earnings.
    sparkedAt: d.sparkedAt?.toDate?.() || undefined,
    sparkViewLogs: d.sparkViewLogs || undefined,
    // snapshots populated below in batch — leave undefined here.
  });

  const snap1 = await getDocs(query(videosRef, where('assignedCreatorId', '==', creatorId)));
  for (const doc of snap1.docs) videoMap.set(doc.id, toVid(doc.id, doc.data()));

  const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
  const linksSnap = await getDocs(query(linksRef, where('creatorId', '==', creatorId)));
  const accountIds = linksSnap.docs.map(d => d.data().accountId).filter(Boolean);
  for (let i = 0; i < accountIds.length; i += 30) {
    const snap = await getDocs(query(videosRef, where('trackedAccountId', 'in', accountIds.slice(i, i + 30))));
    for (const doc of snap.docs) if (!videoMap.has(doc.id)) videoMap.set(doc.id, toVid(doc.id, doc.data()));
  }

  // Load snapshots in a single batched call — same pattern as DashboardPage.
  // Snapshots power the date-window deltas inside `computePerVideoMetricInRange`,
  // so without them the payout engine silently falls back to lifetime totals
  // (which the dashboard does NOT show — that's the bug we're fixing).
  const allVideos = Array.from(videoMap.values());
  if (allVideos.length > 0) {
    try {
      const videoIds = allVideos.map(v => v.id);
      const snapshotsMap = await FirestoreDataService.getVideoSnapshotsBatch(orgId, projectId, videoIds);
      for (const v of allVideos) {
        v.snapshots = snapshotsMap.get(v.id) || [];
      }
    } catch (err) {
      console.error('[Payouts] Failed to load snapshots for creator videos — falling back to lifetime metrics:', err);
      // Leave snapshots undefined; helpers fall back to lifetime values.
    }
  }

  return allVideos.sort((a, b) => b.views - a.views);
}

/** Pull the YouTube video id from common URL shapes (shorts, watch, youtu.be, embed). */
function extractYouTubeId(url: string | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Pull a TikTok video id from /@user/video/123 or /v/123 style URLs. */
function extractTikTokId(url: string | undefined): string | null {
  if (!url) return null;
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /m\.tiktok\.com\/v\/(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/** Pull an Instagram shortcode from /p/, /reel/, /reels/, or /tv/ URLs.
 *  All variants embed via the /p/ path so we just return the shortcode. */
function extractInstagramShortcode(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function fmt(n: number): string {
  // Commas for thousands and hundreds of thousands — user wants exact precision there.
  // Abbreviate only once we hit millions so KPI tiles don't overflow.
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString('en-US');
}

/** Exact money formatter with commas, never abbreviates. Use for detail breakdowns. */
function fmtMoneyExact(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Currency defaults — campaign-level `currency` is used when set, these are fallbacks.
const DEFAULT_CURRENCY = 'usd';
const DEFAULT_MINIMUM_PAYOUT_BY_CURRENCY: Record<string, number> = {
  usd: 1, eur: 1, gbp: 1, cad: 1, aud: 1, mxn: 20,
};

/** Returns the campaign's effective currency, always lowercase. Falls back to `DEFAULT_CURRENCY`. */
function campaignCurrency(campaign: PayoutCampaign): string {
  return (campaign.currency || DEFAULT_CURRENCY).toLowerCase();
}

/** Minimum payout value that can be marked paid for this campaign, in campaign currency units
 *  (dollars, not cents). Explicit `minimumPayout` wins; otherwise the table default for the
 *  campaign's currency; otherwise 1. */
function campaignMinimumPayout(campaign: PayoutCampaign): number {
  if (typeof campaign.minimumPayout === 'number' && campaign.minimumPayout >= 0) {
    return campaign.minimumPayout;
  }
  return DEFAULT_MINIMUM_PAYOUT_BY_CURRENCY[campaignCurrency(campaign)] ?? 1;
}

/** Currency-aware money formatter. Uses `Intl.NumberFormat` so "usd" → "$1.23" and "eur" → "€1.23". */
function fmtMoneyCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return fmtMoneyExact(n);
  }
}

/** Stable idempotency key for a Stripe transfer. Must change whenever we intentionally want
 *  a fresh transfer (revert-then-repay) and must stay identical across network retries of the
 *  same logical call. Baking in the timestamp satisfies both. */
function buildIdempotencyKey(campaignId: string, creatorId: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${campaignId}_${creatorId}_${ts}_${rand}`;
}

/** Sum of all off-platform / prior payouts logged for a creator. */
function sumPriorPayouts(c: CampaignCreator): number {
  return (c.priorPayouts || []).reduce((s, p) => s + (p.amount || 0), 0);
}

/** Net amount still owed = gross (from calc engine) minus everything already paid (off-platform + on-platform). */
function netOwed(c: CampaignCreator): number {
  const gross = c.payoutOverride?.amount ?? c.payoutResult?.totalPayout ?? 0;
  const priorPaid = sumPriorPayouts(c);
  const platformPaid = c.paidSnapshot?.amount ?? 0;
  return Math.max(0, gross - priorPaid - platformPaid);
}

function toVideoSubmission(v: TrackedVideo, creator: CampaignCreator): VideoSubmission {
  return {
    id: v.id, url: v.url, platform: v.platform, thumbnail: v.thumbnail || '',
    title: v.title, uploader: creator.name, uploaderHandle: v.uploaderHandle || '',
    uploaderProfilePicture: v.uploaderProfilePicture || creator.photoURL,
    views: v.views, likes: v.likes, comments: v.comments,
    shares: v.shares, saves: v.saves,
    status: 'approved',
    // Use the real upload date so date-window math (computePerVideoMetricInRange)
    // can correctly bucket each video. Falling back to `new Date()` here meant
    // every video looked freshly-uploaded, breaking date-bounded payout math.
    dateSubmitted: v.dateAdded || v.uploadDate || new Date(),
    uploadDate: v.uploadDate || v.dateAdded || new Date(),
    crossPostGroupId: v.crossPostGroupId,
    // Snapshots + spark fields are required for snapshot-aware payout math
    // and `excludeSparked` (organic-only views). Without these the engine
    // silently uses lifetime values and over-pays creators.
    snapshots: v.snapshots,
    sparkedAt: v.sparkedAt,
    sparkViewLogs: v.sparkViewLogs,
  };
}

/** Append an entry to a creator's audit history. */
function logAction(cr: CampaignCreator, action: string, by: string, details?: string): CampaignCreator {
  const entry: AuditEntry = { action, at: new Date(), by, ...(details ? { details } : {}) };
  return { ...cr, history: [...(cr.history || []), entry] };
}

/** Which videos actually count for this creator's payout given the campaign's date window and the
 *  creator's manual exclusions? Used by the engine pass and the "videos counted" display. */
/** Videos that fall inside the active payout window — campaign.startDate..endDate AND
 *  creator.countVideosFromDate. Admins can still see these in the UI and toggle exclusions;
 *  we keep this separate from `eligibleVideos` (which additionally drops excludedVideoIds)
 *  so the expanded video list can show in-window-but-excluded rows with their toggle state. */
function videosInDateWindow(cr: CampaignCreator, campaign: PayoutCampaign | undefined): TrackedVideo[] {
  // Effective start is the LATER of campaign.startDate and creator.countVideosFromDate —
  // whichever is more restrictive. Either (or both) may be undefined.
  const campaignStart = campaign?.startDate?.getTime();
  const creatorStart = cr.countVideosFromDate?.getTime();
  const start = (campaignStart !== undefined && creatorStart !== undefined)
    ? Math.max(campaignStart, creatorStart)
    : (campaignStart ?? creatorStart);
  const end = campaign?.endDate?.getTime();
  return cr.videos.filter(v => {
    const t = v.uploadDate?.getTime();
    // Videos with no date are included (old data). Videos with date must fall inside the window.
    if (t === undefined) return true;
    if (start !== undefined && t < start) return false;
    if (end !== undefined && t > end) return false;
    return true;
  });
}

function eligibleVideos(cr: CampaignCreator, campaign: PayoutCampaign | undefined): TrackedVideo[] {
  const excluded = new Set(cr.excludedVideoIds || []);
  return videosInDateWindow(cr, campaign).filter(v => !excluded.has(v.id));
}

/** Recompute a creator's payoutResult from their structure + eligible videos.
 *  - Respects campaign date window and per-video exclusions.
 *  - Manual override short-circuits the engine (returns a synthetic single-component result).
 *  - Bumps `not_calculated` → `pending` so the Approve button surfaces; leaves `approved`/`paid` alone. */
function recalcCreator(cr: CampaignCreator, campaign?: PayoutCampaign): CampaignCreator {
  // Manual override wins over everything else
  if (cr.payoutOverride) {
    const override = cr.payoutOverride;
    const result: PayoutCalculationResult = {
      creatorId: cr.id,
      totalPayout: override.amount,
      componentBreakdown: [{
        componentId: 'override',
        componentName: 'Manual override',
        type: 'override',
        amount: override.amount,
        details: override.note ? `Admin override — ${override.note}` : 'Admin override — bypasses template calculation',
      }],
      performance: {
        creatorId: cr.id, videoCount: cr.videos.length,
        totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalSaves: 0,
        totalEngagement: 0, engagementRate: 0, videos: [],
      },
    };
    const payoutStatus = cr.payoutStatus === 'not_calculated' ? 'pending' as const : cr.payoutStatus;
    return { ...cr, payoutResult: result, payoutStatus };
  }

  const videos = eligibleVideos(cr, campaign);
  if (!cr.structure || videos.length === 0) return cr;
  // Build the campaign date window. The engine uses this to compute
  // snapshot-aware per-video metrics inside [start, end] AND to subtract
  // sparked (paid) views so creators are paid on ORGANIC views only —
  // matching what the dashboard shows in 'organic' reporting mode.
  // null start = "all time" (no lower bound).
  const dateRange = {
    start: campaign?.startDate ?? null,
    end: campaign?.endDate ?? new Date(),
  };
  const perf = PayoutCalculationEngine.calculatePerformance(
    cr.id,
    videos.map(v => toVideoSubmission(v, cr)),
    dateRange,
  );
  const result = PayoutCalculationEngine.calculateCreatorPayout(cr.id, cr.structure, perf);
  const payoutStatus = cr.payoutStatus === 'not_calculated' ? 'pending' as const : cr.payoutStatus;
  return { ...cr, payoutResult: result, payoutStatus };
}

// ==================== FIRESTORE PERSISTENCE ====================

function campaignCollectionPath(orgId: string, projectId: string) {
  return `organizations/${orgId}/projects/${projectId}/payoutCampaigns`;
}

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  // Treat Firestore Timestamps as opaque values — recursing into them turns the `Timestamp`
  // class into a plain `{seconds, nanoseconds}` map that Firestore doesn't rehydrate as a
  // Timestamp on read, which silently loses every nested Date field (creator start dates,
  // paid snapshots, history timestamps).
  if (obj instanceof Date) return obj;
  if (obj instanceof Timestamp) return obj;
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) cleaned[k] = stripUndefined(v);
    }
    return cleaned;
  }
  return obj;
}

/** Signals that the server copy of a campaign has a newer updatedAt than the one we last loaded —
 *  meaning another session wrote to it in the meantime. Callers catch this to show a friendly
 *  "refresh and retry" toast instead of silently overwriting the other session's changes. */
class StaleWriteError extends Error {
  constructor() {
    super('Campaign was modified elsewhere. Refresh and try again.');
    this.name = 'StaleWriteError';
  }
}

async function saveCampaignToFirestore(orgId: string, projectId: string, campaign: PayoutCampaign, userId: string): Promise<Date> {
  const path = campaignCollectionPath(orgId, projectId);
  const newUpdatedAt = Timestamp.now();
  const docData: Record<string, any> = {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    createdBy: userId,
    updatedAt: newUpdatedAt,
    creators: campaign.creators.map(c => {
      const entry: Record<string, any> = {
        id: c.id, name: c.name, email: c.email, payoutStatus: c.payoutStatus,
      };
      if (c.photoURL) entry.photoURL = c.photoURL;
      if (c.structure) {
        entry.structureId = c.structure.id;
        entry.structureSnapshot = c.structure;
      }
      if (c.payoutResult) {
        const { performance, ...rest } = c.payoutResult;
        entry.payoutResult = {
          ...rest,
          performance: { ...performance, videos: [] },
        };
      }
      if (c.payoutOverride) entry.payoutOverride = c.payoutOverride;
      if (c.excludedVideoIds?.length) entry.excludedVideoIds = c.excludedVideoIds;
      if (c.countVideosFromDate) entry.countVideosFromDate = Timestamp.fromDate(c.countVideosFromDate);
      if (c.paidSnapshot) {
        entry.paidSnapshot = {
          amount: c.paidSnapshot.amount,
          currency: c.paidSnapshot.currency,
          paidAt: Timestamp.fromDate(c.paidSnapshot.paidAt),
          paidBy: c.paidSnapshot.paidBy,
          idempotencyKey: c.paidSnapshot.idempotencyKey,
          ...(c.paidSnapshot.stripeTransferId ? { stripeTransferId: c.paidSnapshot.stripeTransferId } : {}),
          ...(c.paidSnapshot.stripeTransferStatus ? { stripeTransferStatus: c.paidSnapshot.stripeTransferStatus } : {}),
          ...(c.paidSnapshot.stripeTransferError ? { stripeTransferError: c.paidSnapshot.stripeTransferError } : {}),
        };
      }
      if (c.history?.length) {
        entry.history = c.history.map(h => ({
          action: h.action,
          at: Timestamp.fromDate(h.at),
          by: h.by,
          ...(h.details ? { details: h.details } : {}),
        }));
      }
      if (c.priorPayouts?.length) {
        entry.priorPayouts = c.priorPayouts.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          paidAt: Timestamp.fromDate(p.paidAt),
          method: p.method,
          ...(p.reference ? { reference: p.reference } : {}),
          ...(p.notes ? { notes: p.notes } : {}),
          metricsAtPayout: p.metricsAtPayout,
          recordedBy: p.recordedBy,
          recordedAt: Timestamp.fromDate(p.recordedAt),
        }));
      }
      return entry;
    }),
  };
  if (campaign.startDate) docData.startDate = Timestamp.fromDate(campaign.startDate);
  if (campaign.endDate) docData.endDate = Timestamp.fromDate(campaign.endDate);
  if (campaign.currency) docData.currency = campaign.currency.toLowerCase();
  if (typeof campaign.minimumPayout === 'number') docData.minimumPayout = campaign.minimumPayout;

  const ref = doc(db, path, campaign.id);
  try {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      docData.createdAt = newUpdatedAt;
      await setDoc(ref, stripUndefined(docData));
    } else {
      // Stale-write guard: if the server copy's updatedAt is newer than what we observed when we
      // loaded (or last saved), another session wrote to it. Bail out rather than clobber them.
      const serverUpdatedAt: Date | undefined = snapshot.data()?.updatedAt?.toDate?.();
      const baseline = campaign.lastLoadedUpdatedAt?.getTime();
      if (serverUpdatedAt && baseline !== undefined && serverUpdatedAt.getTime() > baseline) {
        throw new StaleWriteError();
      }
      await updateDoc(ref, stripUndefined(docData));
    }
  } catch (error) {
    if (error instanceof StaleWriteError) throw error;
    console.error('Failed to save campaign:', error);
    throw error;
  }
  return newUpdatedAt.toDate();
}

async function loadCampaignsFromFirestore(orgId: string, projectId: string): Promise<PayoutCampaign[]> {
  const path = campaignCollectionPath(orgId, projectId);
  const snap = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: data.id || d.id,
      name: data.name,
      description: data.description || '',
      status: (data.status || 'draft') as PayoutCampaign['status'],
      createdAt: data.createdAt?.toDate?.() || new Date(),
      startDate: data.startDate?.toDate?.() || undefined,
      endDate: data.endDate?.toDate?.() || undefined,
      currency: data.currency || undefined,
      minimumPayout: typeof data.minimumPayout === 'number' ? data.minimumPayout : undefined,
      lastLoadedUpdatedAt: data.updatedAt?.toDate?.() || undefined,
      creators: (data.creators || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email || '',
        photoURL: c.photoURL,
        structure: c.structureSnapshot || undefined,
        videos: [],
        videosLoaded: false,
        videosLoading: false,
        payoutStatus: c.payoutStatus || 'not_calculated',
        payoutResult: c.payoutResult ? {
          ...c.payoutResult,
          performance: { ...(c.payoutResult.performance || {}), videos: [] },
        } : (c.lastCalculatedAmount ? {
          creatorId: c.id,
          totalPayout: c.lastCalculatedAmount,
          componentBreakdown: [],
          performance: { creatorId: c.id, videoCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalSaves: 0, totalEngagement: 0, engagementRate: 0, videos: [] },
        } : undefined),
        payoutOverride: c.payoutOverride || undefined,
        excludedVideoIds: c.excludedVideoIds || undefined,
        countVideosFromDate: c.countVideosFromDate?.toDate?.() || undefined,
        paidSnapshot: c.paidSnapshot ? {
          amount: c.paidSnapshot.amount,
          currency: c.paidSnapshot.currency,
          paidAt: c.paidSnapshot.paidAt?.toDate?.() || new Date(),
          paidBy: c.paidSnapshot.paidBy,
          idempotencyKey: c.paidSnapshot.idempotencyKey,
          stripeTransferId: c.paidSnapshot.stripeTransferId,
          stripeTransferStatus: c.paidSnapshot.stripeTransferStatus,
          stripeTransferError: c.paidSnapshot.stripeTransferError,
        } : undefined,
        history: (c.history || []).map((h: any) => ({
          action: h.action,
          at: h.at?.toDate?.() || new Date(),
          by: h.by,
          details: h.details,
        })),
        priorPayouts: (c.priorPayouts || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency || 'usd',
          paidAt: p.paidAt?.toDate?.() || new Date(),
          method: p.method || 'other',
          reference: p.reference,
          notes: p.notes,
          metricsAtPayout: p.metricsAtPayout || { views: 0 },
          recordedBy: p.recordedBy,
          recordedAt: p.recordedAt?.toDate?.() || new Date(),
        })),
      })),
    };
  });
}

// ==================== MAIN PAGE ====================

type View = 'list' | 'create';
type PayoutsTab = 'payouts' | 'campaigns';

export default function PayoutsPage() {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [tab, setTab] = useState<PayoutsTab>('payouts');
  const [campaigns, setCampaigns] = useState<PayoutCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const orgId = currentOrgId || '';
  const projectId = currentProjectId || '';
  const userId = user?.uid || '';
  // Real identity used in all audit-log writes. Prefer email (human-readable in history) and
  // fall back to uid; 'unknown' is a last-resort sentinel and should never appear in practice
  // since unauthenticated users are bounced by the super-admin gate below.
  const actingUser = user?.email ?? user?.uid ?? 'unknown';

  // Gate the whole page behind super-admin. Matches the Sidebar filter so non-admins
  // won't even see the nav entry, but keep this check too in case someone pastes the URL.
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (orgId && projectId) {
      setLoadingCampaigns(true);
      loadCampaignsFromFirestore(orgId, projectId)
        .then(setCampaigns)
        .catch(console.error)
        .finally(() => setLoadingCampaigns(false));
    }
  }, [orgId, projectId, isSuperAdmin]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Stripe runtime config — tells us whether live Payouts features (top-up, Connect onboarding,
  // transfers) are currently operational. In prod with a live key but no Connect approval yet,
  // this returns `payoutsEnabled=false` and the UI renders a "coming soon" state on those
  // specific buttons while leaving the rest of the admin flows (create campaigns, approve,
  // manage structures) fully working. Defaults to disabled while loading so money-moving
  // buttons don't flash enabled before the config resolves.
  const [stripeConfig, setStripeConfig] = useState<{ payoutsEnabled: boolean; testMode: boolean } | null>(null);
  useEffect(() => {
    if (!isSuperAdmin) return;
    AdminStripeService.fetchConfig()
      .then(setStripeConfig)
      .catch(() => setStripeConfig({ payoutsEnabled: false, testMode: false }));
  }, [isSuperAdmin]);
  const payoutsEnabled = stripeConfig?.payoutsEnabled === true;

  const goBack = () => setView('list');

  const persistCampaign = async (u: PayoutCampaign) => {
    setSaveStatus('saving'); setSaveError(null);
    try {
      const newUpdatedAt = await saveCampaignToFirestore(orgId, projectId, u, userId);
      // Bump the in-memory baseline so the NEXT save's stale-write check uses this write's
      // timestamp, not the load timestamp.
      setCampaigns(prev => prev.map(c => c.id === u.id ? { ...c, lastLoadedUpdatedAt: newUpdatedAt } : c));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
    } catch (error: any) {
      console.error('Save failed:', error);
      setSaveStatus('error');
      if (error instanceof StaleWriteError) {
        setSaveError('Someone else edited this campaign. Please refresh the page and try again.');
      } else {
        setSaveError(error?.message || 'Failed to save changes');
      }
    }
  };

  /** Mutate one campaign by id and (unless `skipPersist`) write to Firestore.
   *  Functional updater receives the latest state via the setter — safe for
   *  parallel calls across different campaigns (e.g. N rows auto-loading videos
   *  at once). `skipPersist` is for transient UI state (videos loading/loaded)
   *  that is never written to Firestore anyway. */
  const updateCampaignById = (
    campaignId: string,
    u: PayoutCampaign | ((prev: PayoutCampaign) => PayoutCampaign),
    options?: { skipPersist?: boolean },
  ) => {
    let computed: PayoutCampaign | null = null;
    setCampaigns(cs => cs.map(c => {
      if (c.id !== campaignId) return c;
      const next = typeof u === 'function' ? u(c) : u;
      computed = next;
      return next;
    }));
    if (computed && !options?.skipPersist) persistCampaign(computed);
  };

  const createCampaign = (c: PayoutCampaign) => {
    setCampaigns(prev => [c, ...prev]);
    setView('list');
    persistCampaign(c);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar onCollapsedChange={setSidebarCollapsed} isMobileOpen={mobileMenuOpen} onMobileToggle={setMobileMenuOpen} />
        <main className="flex-1 transition-all duration-300" style={{ marginLeft: sidebarCollapsed ? '4rem' : '16rem' }}>
          <div className="p-4 md:p-8 lg:p-10 max-w-2xl mx-auto">
            <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-8 md:p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-content">Payouts is currently in restricted access.</h1>
              <p className="text-sm text-content-muted mt-2">If you need access, ping the team.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar onCollapsedChange={setSidebarCollapsed} isMobileOpen={mobileMenuOpen} onMobileToggle={setMobileMenuOpen} />
      <main className="flex-1 transition-all duration-300" style={{ marginLeft: sidebarCollapsed ? '4rem' : '16rem' }}>
        {/* Fixed top bar: platform balance always visible while scrolling. Sits
            above content, offset right of the sidebar via the same dynamic
            margin the main column uses (4rem collapsed / 16rem expanded). */}
        {view !== 'create' && (
          <div
            className="fixed top-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border-subtle transition-all duration-300"
            style={{ left: sidebarCollapsed ? '4rem' : '16rem' }}
          >
            <div className="px-4 md:px-8 lg:px-10 py-3 max-w-[1400px] mx-auto">
              <PlatformBalanceCard payoutsEnabled={payoutsEnabled} compact />
            </div>
          </div>
        )}

        <div
          className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto"
          // Push the page body down enough that the fixed balance bar doesn't
          // overlap content. Skipped on the create view (no fixed bar there).
          style={view !== 'create' ? { paddingTop: '6.5rem' } : undefined}
        >
          {/* Live-mode-without-Connect banner. Explains to admins that campaign creation + approval
              still work, but real money movement is paused until Stripe Connect is activated. */}
          {stripeConfig && !payoutsEnabled && (
            <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-4 mb-6 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-content">Payments paused — Stripe Connect approval pending</p>
                <p className="text-xs text-content-secondary mt-1 leading-relaxed">
                  You can create campaigns, approve creators, and manage payout structures normally. "Top up balance", creator payment setup, and "Pay" are disabled until Stripe approves your Connect platform. Once approved, set <code className="px-1 py-0.5 rounded bg-surface-tertiary text-[10px]">STRIPE_CONNECT_ENABLED=true</code> in Vercel Prod env and these features will light up with no code changes.
                </p>
              </div>
            </div>
          )}
          {view === 'list' && (
            <div className="space-y-5">
              {/* Page header — title swaps to match the active tab; the tab strip
                  below pivots between "Payouts" (per-creator payout rows) and
                  "Campaigns" (campaign-level config table). Same layout, same
                  toolbar pattern, so they feel like two views of one page. */}
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-content tracking-tight">
                    {tab === 'payouts' ? 'Payouts' : 'Campaigns'}
                  </h1>
                  <p className="text-sm text-content-muted mt-1">
                    {tab === 'payouts'
                      ? 'Track creator payout statuses across campaigns.'
                      : 'Configure the campaigns that drive your payouts.'}
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-tertiary/40 border border-border-subtle">
                  {([['payouts', 'Payouts'], ['campaigns', 'Campaigns']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === key ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'payouts' ? (
                <FlatPayoutsView
                  campaigns={campaigns}
                  loading={loadingCampaigns}
                  orgId={orgId}
                  projectId={projectId}
                  userId={userId}
                  actingUser={actingUser}
                  payoutsEnabled={payoutsEnabled}
                  onUpdateCampaign={updateCampaignById}
                  onCreateCampaign={() => setView('create')}
                />
              ) : (
                <CampaignsTableView
                  campaigns={campaigns}
                  loading={loadingCampaigns}
                  onCreateCampaign={() => setView('create')}
                  onEditCampaign={(c) => setEditingCampaignId(c.id)}
                />
              )}
            </div>
          )}
          {view === 'create' && <CreateCampaignView orgId={orgId} projectId={projectId} userId={userId} onCreated={createCampaign} onCancel={goBack} />}

          {/* Edit campaign drawer — opens from a Campaigns table row click. Reads
              the latest campaign from `campaigns` so concurrent updates from
              other places (e.g. payout actions) stay in sync while open. */}
          {editingCampaignId && (() => {
            const c = campaigns.find(x => x.id === editingCampaignId);
            if (!c) return null;
            return (
              <EditCampaignDrawer
                campaign={c}
                onClose={() => setEditingCampaignId(null)}
                onSave={(patch) => {
                  updateCampaignById(c.id, prev => ({ ...prev, ...patch }));
                  setEditingCampaignId(null);
                }}
              />
            );
          })()}
        </div>
      </main>

      {saveStatus !== 'idle' && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-theme border text-sm font-medium z-50 ${
          saveStatus === 'saving' ? 'bg-surface-secondary border-border text-content' :
          saveStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' :
          'bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400'
        }`}>
          {saveStatus === 'saving' && <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</span>}
          {saveStatus === 'saved' && <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Saved</span>}
          {saveStatus === 'error' && (
            <div>
              <div className="font-semibold">Save failed</div>
              <div className="text-xs opacity-80 mt-0.5">{saveError}</div>
              <button onClick={() => { setSaveStatus('idle'); setSaveError(null); }} className="text-xs underline mt-1">Dismiss</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== PLATFORM BALANCE CARD ====================

/**
 * Always-visible header card showing the Maktub Stripe balance. The admin can see at a glance
 * whether the platform has enough funds to mark creators paid, and top up via hosted Checkout
 * without leaving the page. Fetches on mount and after returning from a successful Checkout
 * (URL `?topup=success`).
 */
function PlatformBalanceCard({ payoutsEnabled, compact = false }: { payoutsEnabled: boolean; compact?: boolean }) {
  const [balance, setBalance] = useState<{ available: Array<{amount: number; currency: string}>; pending: Array<{amount: number; currency: string}>; livemode: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTopup, setShowTopup] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const b = await AdminStripeService.fetchPlatformBalance();
      setBalance(b);
    } catch (e: any) {
      // 503 means Stripe isn't configured yet — surface an informative message rather than
      // a raw error so admins know why the card is empty.
      if (/503|not configured/i.test(String(e?.message))) {
        setError('Stripe is not configured on this server yet.');
      } else {
        setError(e?.message || 'Failed to load balance');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Detect return from Checkout — URL has ?topup=success. Refresh and strip the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topup = params.get('topup');
    if (topup === 'success') {
      refresh();
      params.delete('topup');
      params.delete('amount');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } else if (topup === 'cancel') {
      params.delete('topup');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [refresh]);

  // Render an at-a-glance row of currency amounts. Stripe can hold multiple currencies so we
  // map each array entry rather than assuming USD.
  const fmtEntries = (entries: Array<{amount: number; currency: string}>) => {
    if (!entries || entries.length === 0) return fmtMoneyCurrency(0, 'usd');
    return entries.map(e => fmtMoneyCurrency(e.amount, e.currency)).join(' · ');
  };

  // Compact variant: lower-profile horizontal layout for the fixed top bar.
  // No icon, no card chrome — just the label + balance + pending + actions.
  if (compact) {
    return (
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Platform balance</p>
            {balance && !balance.livemode && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-400/30">Test mode</span>
            )}
          </div>
          {loading ? (
            <p className="text-lg font-bold text-content-muted leading-tight">—</p>
          ) : error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : balance ? (
            <div className="flex items-baseline gap-2 flex-wrap leading-tight">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-500 tabular-nums">
                {fmtEntries(balance.available)}
              </span>
              {balance.pending.some(p => p.amount > 0) && (
                <span className="text-[11px] text-content-muted">
                  + {fmtEntries(balance.pending)} pending
                </span>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover transition-colors disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {payoutsEnabled && (
            <Button size="sm" onClick={() => setShowTopup(true)} disabled={!!error}>
              <Plus className="w-4 h-4 mr-1.5" /> Top up
            </Button>
          )}
        </div>
        {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-5 mb-6 flex items-center gap-4 flex-wrap">
      <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
        <Wallet className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Platform balance</p>
          {balance && !balance.livemode && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-400/30">Test mode</span>
          )}
        </div>
        {loading ? (
          <p className="text-2xl font-bold text-content-muted mt-1">—</p>
        ) : error ? (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        ) : balance ? (
          <>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 mt-1 leading-tight">
              {fmtEntries(balance.available)}
            </p>
            {balance.pending.some(p => p.amount > 0) && (
              <p className="text-xs text-content-muted mt-0.5">
                + {fmtEntries(balance.pending)} pending (clears in 1–2 business days)
              </p>
            )}
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        {payoutsEnabled && (
          <Button size="sm" onClick={() => setShowTopup(true)} disabled={!!error}>
            <Plus className="w-4 h-4 mr-1.5" /> Top up
          </Button>
        )}
      </div>
      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </div>
  );
}

/** Amount-entry modal. Submits to create-topup-session and opens the Stripe Checkout URL in
 *  a new tab so the admin doesn't lose their place on the Payouts page. */
function TopupModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState<string>('500');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, submitting]);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await AdminStripeService.createTopupSession(n);
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to start top-up');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Top up balance</p>
              <p className="font-semibold text-content">Fund creator payouts</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-content-secondary mb-1.5">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted">$</span>
              <input
                type="number" min="0.5" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-surface-tertiary border border-border rounded-xl text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-content-muted mt-1.5">
              You'll be redirected to Stripe to enter card details. Funds arrive instantly in test mode,
              or after card clearance (typically same day) in production.
            </p>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="p-4 border-t border-border-subtle flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1.5" />}
            Continue to Stripe
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== FLAT PAYOUTS VIEW ====================

/**
 * Multi-select dropdown for filtering by campaign. Closes on outside click.
 * Stays compact when nothing's selected ("All campaigns"); shows the single
 * campaign's name when only one is picked, or "N campaigns" otherwise.
 */
function CampaignMultiSelect({
  campaigns, selected, onChange,
}: {
  campaigns: PayoutCampaign[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const label = selected.size === 0
    ? 'All campaigns'
    : selected.size === 1
      ? campaigns.find(c => selected.has(c.id))?.name || '1 campaign'
      : `${selected.size} campaigns`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary border text-sm transition-colors ${open || selected.size > 0 ? 'border-orange-500' : 'border-border-subtle hover:border-border'}`}
      >
        <Target className="w-4 h-4 text-content-muted" />
        <span className={selected.size > 0 ? 'text-content font-medium max-w-[160px] truncate' : 'text-content-muted'}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={dropdownRef} className="absolute top-full mt-1 left-0 w-72 max-h-72 overflow-y-auto rounded-xl bg-surface-secondary border border-border shadow-xl z-30 p-1">
          {selected.size > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="w-full px-3 py-2 text-left text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-surface-tertiary rounded-lg transition-colors"
            >
              Clear all
            </button>
          )}
          {campaigns.length === 0 ? (
            <p className="px-3 py-2 text-xs text-content-muted">No campaigns yet</p>
          ) : (
            campaigns.map(c => {
              const isSel = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    const next = new Set(selected);
                    if (isSel) next.delete(c.id); else next.add(c.id);
                    onChange(next);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-colors ${isSel ? 'bg-orange-500/10' : 'hover:bg-surface-tertiary'}`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSel ? 'bg-orange-500 border-orange-500' : 'border-border-strong'}`}>
                    {isSel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-content truncate">{c.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Creator multi-select dropdown. Mirrors CampaignMultiSelect's pattern (trigger
 * button, outside-click close, checkbox rows) so the toolbar feels uniform —
 * stacked PFP avatar in each row keeps it visually anchored to the rest of
 * the creator-identity treatment we use across the app.
 */
function CreatorMultiSelect({
  creators, selected, onChange,
}: {
  creators: CampaignCreator[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const label = selected.size === 0
    ? 'Select creators'
    : selected.size === 1
      ? creators.find(c => selected.has(c.id))?.name || '1 creator'
      : `${selected.size} creators`;

  const filtered = search
    ? creators.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase()))
    : creators;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary border text-sm transition-colors ${open || selected.size > 0 ? 'border-orange-500' : 'border-border-subtle hover:border-border'}`}
      >
        <Users className="w-4 h-4 text-content-muted" />
        <span className={selected.size > 0 ? 'text-content font-medium max-w-[160px] truncate' : 'text-content-muted'}>{label}</span>
        <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={dropdownRef} className="absolute top-full mt-1 left-0 w-80 max-h-80 overflow-hidden rounded-xl bg-surface-secondary border border-border shadow-xl z-30 flex flex-col">
          <div className="p-2 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search creators..."
                className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-surface-tertiary border border-border-subtle text-xs text-content placeholder:text-content-muted focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1">
            {selected.size > 0 && (
              <button
                onClick={() => onChange(new Set())}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-surface-tertiary rounded-lg transition-colors"
              >
                Clear all
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-content-muted">{creators.length === 0 ? 'No creators yet' : 'No matches'}</p>
            ) : (
              filtered.map(c => {
                const isSel = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      const next = new Set(selected);
                      if (isSel) next.delete(c.id); else next.add(c.id);
                      onChange(next);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg transition-colors ${isSel ? 'bg-orange-500/10' : 'hover:bg-surface-tertiary'}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSel ? 'bg-orange-500 border-orange-500' : 'border-border-strong'}`}>
                      {isSel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <CreatorAccountStack creator={c} max={2} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm text-content truncate">{c.name}</p>
                        <CreatorPlatformBubbles items={c.videos} max={3} />
                      </div>
                      <p className="text-[11px] text-content-muted truncate">{c.email || 'No email'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Flat all-creators-across-all-campaigns view. The new entry point for /payouts:
 * one table, one row per (creator, campaign) pair. Status tabs at the top
 * (All / Pending / Approved / Paid) act as a primary filter; below them, search
 * by creator name/email and a multi-select campaign filter narrow further.
 *
 * Replaces the old two-screen flow (campaign list → click into campaign detail).
 * Per-row actions and the click-to-expand breakdown are reused from CreatorCard;
 * the row gets `showCampaignColumn` so the Campaign cell renders here but stays
 * suppressed in any single-campaign context where it'd be redundant.
 *
 * Add Creator FAB only renders when the user has narrowed to a single campaign,
 * since otherwise we wouldn't know which campaign to add the creator(s) to.
 */
function FlatPayoutsView({
  campaigns, loading, orgId, projectId, userId, actingUser, payoutsEnabled,
  onUpdateCampaign, onCreateCampaign,
}: {
  campaigns: PayoutCampaign[];
  loading: boolean;
  orgId: string; projectId: string; userId: string; actingUser: string;
  payoutsEnabled: boolean;
  onUpdateCampaign: (
    campaignId: string,
    u: PayoutCampaign | ((prev: PayoutCampaign) => PayoutCampaign),
    options?: { skipPersist?: boolean },
  ) => void;
  onCreateCampaign: () => void;
}) {
  // Status vocabulary mirrors viral.app (Upcoming / Due / Canceled / Paid) but maps onto our
  // existing data model: pending+not_calculated → upcoming (still under review/setup), approved
  // → due (approved, ready to send), paid → paid. We don't model canceled yet — bucket exists
  // for parity and reads 0 until we add cancellation.
  type StatusBucket = 'all' | 'upcoming' | 'due' | 'canceled' | 'paid';
  const bucketFor = (s: CampaignCreator['payoutStatus']): Exclude<StatusBucket, 'all'> => {
    if (s === 'paid') return 'paid';
    if (s === 'approved') return 'due';
    return 'upcoming';
  };

  const [statusFilter, setStatusFilter] = useState<StatusBucket>('all');
  const [campaignFilter, setCampaignFilter] = useState<Set<string>>(new Set());
  const [creatorFilter, setCreatorFilter] = useState<Set<string>>(new Set());
  const [creatorSearch, setCreatorSearch] = useState('');
  const [showAddCreatorFor, setShowAddCreatorFor] = useState<string | null>(null);
  /** When the "Add creators" button can't resolve a single campaign target
   *  (multiple campaigns exist + no single-campaign filter), surface a small
   *  picker so the admin chooses which campaign to add into before the
   *  slide-over opens. */
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const addCreatorsTriggerRef = useRef<HTMLButtonElement>(null);
  const campaignPickerRef = useRef<HTMLDivElement>(null);
  const [pickerForCreatorId, setPickerForCreatorId] = useState<{ campaignId: string; creatorId: string } | null>(null);
  const [payConfirmFor, setPayConfirmFor] = useState<{ campaignId: string; creatorId: string } | null>(null);
  // Bulk selection — keys are `${campaignId}:${creatorId}` so the same person
  // appearing in two campaigns gets two distinct checkboxes (each row is its
  // own (campaign, creator) pair). When non-empty, the bulk action bar
  // surfaces above the table with "Apply structure to N selected".
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const rowKey = (campaignId: string, creatorId: string) => `${campaignId}:${creatorId}`;

  useEffect(() => {
    if (!showCampaignPicker) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        addCreatorsTriggerRef.current && !addCreatorsTriggerRef.current.contains(t) &&
        campaignPickerRef.current && !campaignPickerRef.current.contains(t)
      ) setShowCampaignPicker(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showCampaignPicker]);

  // Background-load videos for every visible row so the table shows real
  // amounts on first paint instead of waiting for the admin to expand each
  // row. Concurrency-capped + dedup-tracked so we don't fan out hundreds of
  // parallel Firestore reads on big projects, and so re-renders don't
  // re-queue the same creator twice.
  const queuedLoadsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading) return;
    const work = campaigns.flatMap(c => c.creators
      .filter(cr => !cr.videosLoaded && !cr.videosLoading && !queuedLoadsRef.current.has(`${c.id}:${cr.id}`))
      .map(cr => ({ campaign: c, creator: cr })));
    if (work.length === 0) return;

    const CONCURRENCY = 4;
    let cancelled = false;
    let cursor = 0;

    const runNext = async (): Promise<void> => {
      if (cancelled) return;
      const idx = cursor++;
      if (idx >= work.length) return;
      const { campaign, creator } = work[idx];
      const key = `${campaign.id}:${creator.id}`;
      queuedLoadsRef.current.add(key);
      try {
        await makeHandlers(campaign, creator.id).onLoadVideos();
      } catch {
        // Swallow — onLoadVideos already records the failure and surfaces
        // it on the row; the next runNext keeps the queue moving.
      }
      return runNext();
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, work.length) }, runNext);
    Promise.all(workers).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
    // Re-runs when campaigns shape changes (new creators added, etc.) but
    // queuedLoadsRef gates duplicate work for already-seen IDs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns, loading]);

  // Apply a structure to every currently-selected row in one pass. Groups by
  // campaign so each campaign gets a single onUpdateCampaign call (not one
  // per creator) — keeps Firestore writes batched and avoids a re-render
  // storm on the campaign list.
  const applyBulkStructure = useCallback((structure: PayoutStructure) => {
    if (selectedRowKeys.size === 0) return;
    const byCampaign = new Map<string, Set<string>>();
    selectedRowKeys.forEach(k => {
      const [cid, crid] = k.split(':');
      const set = byCampaign.get(cid) || new Set<string>();
      set.add(crid);
      byCampaign.set(cid, set);
    });
    byCampaign.forEach((creatorIds, cid) => {
      onUpdateCampaign(cid, prev => ({
        ...prev,
        creators: prev.creators.map(x =>
          creatorIds.has(x.id) ? recalcCreator({ ...x, structure }, prev) : x,
        ),
      }));
    });
    setSelectedRowKeys(new Set());
    setBulkPickerOpen(false);
  }, [selectedRowKeys, onUpdateCampaign]);

  // Flatten + filter. `nonStatusRows` ignores the status tab so totals stay
  // stable across tab switches — they reflect the active campaign/creator/search
  // scope but show all four status buckets.
  const allRows = campaigns.flatMap(c => c.creators.map(cr => ({ campaign: c, creator: cr })));
  const passesNonStatus = (r: { campaign: PayoutCampaign; creator: CampaignCreator }) => {
    if (campaignFilter.size > 0 && !campaignFilter.has(r.campaign.id)) return false;
    if (creatorFilter.size > 0 && !creatorFilter.has(r.creator.id)) return false;
    if (creatorSearch) {
      const q = creatorSearch.toLowerCase();
      if (!r.creator.name.toLowerCase().includes(q) &&
          !(r.creator.email || '').toLowerCase().includes(q)) return false;
    }
    return true;
  };
  const nonStatusRows = allRows.filter(passesNonStatus);
  const filteredRows = nonStatusRows.filter(r =>
    statusFilter === 'all' || bucketFor(r.creator.payoutStatus) === statusFilter
  );
  const counts = {
    all: nonStatusRows.length,
    upcoming: nonStatusRows.filter(r => bucketFor(r.creator.payoutStatus) === 'upcoming').length,
    due: nonStatusRows.filter(r => bucketFor(r.creator.payoutStatus) === 'due').length,
    canceled: 0,
    paid: nonStatusRows.filter(r => bucketFor(r.creator.payoutStatus) === 'paid').length,
  };

  // Totals strip — sums per-bucket money across the visible (filter-scoped)
  // rows. Paid uses paidSnapshot.amount (immutable record); upcoming/due use
  // netOwed (live calculation). Currency is fixed per campaign — when totals
  // mix campaigns with different currencies we just label "mixed" since
  // summing across currencies isn't meaningful.
  function bucketTotal(bucket: 'upcoming' | 'due' | 'paid') {
    const rows = nonStatusRows.filter(r => bucketFor(r.creator.payoutStatus) === bucket);
    let amount = 0;
    const currencies = new Set<string>();
    for (const r of rows) {
      const cur = campaignCurrency(r.campaign);
      const a = bucket === 'paid'
        ? (r.creator.paidSnapshot?.amount ?? 0)
        : (r.creator.payoutResult ? netOwed(r.creator) : 0);
      amount += a;
      if (a > 0) currencies.add(cur);
    }
    return { count: rows.length, amount, currency: currencies.size === 1 ? Array.from(currencies)[0] : currencies.size === 0 ? DEFAULT_CURRENCY : 'mixed' };
  }
  const totals = {
    upcoming: bucketTotal('upcoming'),
    due: bucketTotal('due'),
    paid: bucketTotal('paid'),
  };

  // Unique creators across all campaigns — feeds the creator multi-select filter.
  const uniqueCreators = (() => {
    const seen = new Map<string, CampaignCreator>();
    for (const r of allRows) if (!seen.has(r.creator.id)) seen.set(r.creator.id, r.creator);
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Build a per-row handler bundle. All mutations route through `onUpdateCampaign`
  // (which the parent wires to `updateCampaignById`) using functional updaters so
  // parallel operations across different rows / campaigns don't clobber each other.
  function makeHandlers(campaign: PayoutCampaign, creatorId: string) {
    const updateCreator = (mutator: (cr: CampaignCreator) => CampaignCreator) =>
      onUpdateCampaign(campaign.id, prev => ({
        ...prev,
        creators: prev.creators.map(c => c.id === creatorId ? mutator(c) : c),
      }));
    return {
      onLoadVideos: async () => {
        let shouldLoad = false;
        onUpdateCampaign(campaign.id, prev => {
          const cr = prev.creators.find(c => c.id === creatorId);
          if (!cr || cr.videosLoading) return prev;
          // Allow re-loading even when videosLoaded is already true — this is
          // how the drawer's Retry button gets back into a loading state after
          // a previous failure.
          shouldLoad = true;
          return { ...prev, creators: prev.creators.map(c => c.id === creatorId ? { ...c, videosLoading: true, videosLoaded: false } : c) };
        }, { skipPersist: true });
        if (!shouldLoad) return;
        try {
          const videos = await fetchCreatorVideos(orgId, projectId, creatorId);
          onUpdateCampaign(campaign.id, prev => ({
            ...prev,
            creators: prev.creators.map(c => c.id === creatorId
              ? recalcCreator({ ...c, videos, videosLoaded: true, videosLoading: false }, prev)
              : c),
          }), { skipPersist: true });
        } catch (err) {
          // Surface the failure in the console so it's debuggable, and mark
          // the creator as loaded with empty videos so the drawer renders the
          // "couldn't load" hint instead of spinning forever.
          console.error(`[Payouts] Failed to load videos for creator ${creatorId}:`, err);
          onUpdateCampaign(campaign.id, prev => ({
            ...prev,
            creators: prev.creators.map(c => c.id === creatorId ? { ...c, videosLoaded: true, videosLoading: false } : c),
          }), { skipPersist: true });
        }
      },
      onApprove: () => updateCreator(c => logAction({ ...c, payoutStatus: 'approved' as const }, 'Approved', actingUser)),
      onMarkPaid: () => setPayConfirmFor({ campaignId: campaign.id, creatorId }),
      onUnapprove: () => {
        if (!confirm('Un-approve this payout and move it back to pending? This is recorded in the audit log.')) return;
        updateCreator(c => logAction({ ...c, payoutStatus: 'pending' as const }, 'Un-approved', actingUser));
      },
      onRevertPaid: () => {
        if (!confirm('Revert this paid status back to approved? Only allowed if the Stripe transfer has not yet succeeded.')) return;
        updateCreator(c => {
          if (c.paidSnapshot?.stripeTransferId) {
            alert('Cannot revert — the Stripe transfer has already settled. Reversals must be done in the Stripe dashboard.');
            return c;
          }
          const { paidSnapshot: _ps, ...rest } = c;
          return logAction({ ...rest, payoutStatus: 'approved' as const }, 'Reverted from paid', actingUser);
        });
      },
      onRetryTransfer: async () => {
        try {
          const result = await AdminStripeService.transferToCreator({ orgId, projectId, campaignId: campaign.id, creatorId });
          updateCreator(c => logAction(
            { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferId: result.transferId, stripeTransferStatus: 'paid' as const, stripeTransferError: undefined } },
            'Stripe transfer retried', actingUser, result.transferId,
          ));
        } catch (err: any) {
          updateCreator(c => logAction(
            { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferStatus: 'failed' as const, stripeTransferError: err?.message || 'Retry failed' } },
            'Stripe transfer retry FAILED', actingUser, err?.message || 'unknown',
          ));
        }
      },
      onOpenPicker: () => setPickerForCreatorId({ campaignId: campaign.id, creatorId }),
      onRemove: () => {
        if (!confirm(`Remove this creator from ${campaign.name}?`)) return;
        onUpdateCampaign(campaign.id, prev => ({
          ...prev,
          creators: prev.creators.filter(c => c.id !== creatorId),
        }));
      },
      onSetOverride: (amount: number, note?: string) => updateCreator(c => logAction(
        { ...c, payoutOverride: { amount, ...(note ? { note } : {}) } },
        'Set manual override', actingUser, `${amount}${note ? ` — ${note}` : ''}`,
      )),
      onClearOverride: () => updateCreator(c => {
        const { payoutOverride: _o, ...rest } = c;
        return logAction(rest, 'Cleared manual override', actingUser);
      }),
      onSetStartDate: (date: Date | undefined) => updateCreator(c => logAction(
        recalcCreator({ ...c, countVideosFromDate: date }, campaign),
        date ? 'Set payout start date' : 'Cleared payout start date',
        actingUser,
        date ? date.toLocaleDateString() : undefined,
      )),
      onToggleExcludeVideo: (videoId: string) => updateCreator(c => {
        const ex = c.excludedVideoIds || [];
        const isExcluded = ex.includes(videoId);
        const next = isExcluded ? ex.filter(id => id !== videoId) : [...ex, videoId];
        return logAction(
          recalcCreator({ ...c, excludedVideoIds: next }, campaign),
          isExcluded ? 'Re-included video' : 'Excluded video', actingUser, videoId,
        );
      }),
      onVideosChange: (videos: TrackedVideo[]) => updateCreator(c => recalcCreator({ ...c, videos }, campaign)),
      onLogPriorPayout: (entry: Omit<PriorPayoutEntry, 'id' | 'recordedBy' | 'recordedAt'>) => updateCreator(c => {
        const newEntry: PriorPayoutEntry = {
          ...entry,
          id: `pp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          recordedBy: actingUser,
          recordedAt: new Date(),
        };
        return logAction(
          recalcCreator({ ...c, priorPayouts: [...(c.priorPayouts || []), newEntry] }, campaign),
          'Logged prior payout', actingUser, `${entry.amount} ${entry.method}`,
        );
      }),
      onRemovePriorPayout: (id: string) => updateCreator(c => recalcCreator(
        { ...c, priorPayouts: (c.priorPayouts || []).filter(p => p.id !== id) },
        campaign,
      )),
      // Edit the campaign-level billing period from a payout row. All
      // creators on this campaign share the same window, so the change
      // applies to every row of this campaign at once.
      onUpdatePeriod: (start: Date | undefined, end: Date | undefined) =>
        onUpdateCampaign(campaign.id, prev => ({ ...prev, startDate: start, endDate: end })),
    };
  }

  return (
    <div className="space-y-5">
      {/* Status tabs — viral.app vocabulary: Upcoming / Due / Canceled / Paid.
          Mapped from our status field via bucketFor(). All tab keeps its
          escape-hatch role of "show me everything". */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-tertiary/40 border border-border-subtle w-fit">
        {([
          ['all', 'All', counts.all],
          ['upcoming', 'Upcoming', counts.upcoming],
          ['due', 'Due', counts.due],
          ['canceled', 'Canceled', counts.canceled],
          ['paid', 'Paid', counts.paid],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${statusFilter === key ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'}`}
          >
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${statusFilter === key ? 'bg-surface-tertiary text-content-secondary' : 'bg-surface-tertiary/60 text-content-muted'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Filter row — Select creators + Select campaigns multi-selects on the left
          (search input is folded into them now), New campaign pushed to the right.
          The button uses the brand-orange neo-brutalism vocabulary so it carries
          the visual weight of a primary action, sized to match the toolbar. */}
      <div className="flex items-center gap-3 flex-wrap">
        <CreatorMultiSelect creators={uniqueCreators} selected={creatorFilter} onChange={setCreatorFilter} />
        <CampaignMultiSelect campaigns={campaigns} selected={campaignFilter} onChange={setCampaignFilter} />
        <div className="relative w-full sm:w-auto sm:flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            value={creatorSearch}
            onChange={e => setCreatorSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-secondary border border-border-subtle text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        {/* Primary action: Add creators. Resolves the target campaign in this
            order: single-campaign filter → only campaign that exists → picker.
            When a picker is needed it pops out below the button so the user
            stays in the toolbar context. */}
        <div className="ml-auto relative">
          <button
            ref={addCreatorsTriggerRef}
            onClick={() => {
              if (campaignFilter.size === 1) {
                setShowAddCreatorFor(Array.from(campaignFilter)[0]);
              } else if (campaigns.length === 1) {
                setShowAddCreatorFor(campaigns[0].id);
              } else if (campaigns.length === 0) {
                onCreateCampaign();
              } else {
                setShowCampaignPicker(s => !s);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white font-bold text-sm border border-orange-700 shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all"
          >
            <UserPlus className="w-4 h-4" /> Add creators
            {campaigns.length > 1 && campaignFilter.size !== 1 && (
              <ChevronDown className={`w-4 h-4 transition-transform ${showCampaignPicker ? 'rotate-180' : ''}`} />
            )}
          </button>
          {showCampaignPicker && (
            <div ref={campaignPickerRef} className="absolute top-full mt-1 right-0 w-72 max-h-72 overflow-y-auto rounded-xl bg-surface-secondary border border-border shadow-xl z-30 p-1">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted">Add creators to…</p>
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setShowCampaignPicker(false); setShowAddCreatorFor(c.id); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-surface-tertiary transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-content truncate">{c.name}</p>
                    <p className="text-[11px] text-content-muted truncate">{c.creators.length} creator{c.creators.length === 1 ? '' : 's'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Totals strip — shown above the table so the admin sees the money
          aggregates at a glance before scanning rows. Each tile is also a
          shortcut to that status bucket (clicking jumps the status tab). */}
      {!loading && nonStatusRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ['upcoming', 'Upcoming', totals.upcoming, 'text-content'],
            ['due',      'Due',      totals.due,      'text-orange-600 dark:text-orange-400'],
            ['paid',     'Paid',     totals.paid,     'text-emerald-600 dark:text-emerald-500'],
          ] as const).map(([key, label, t, accent]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`text-left rounded-xl bg-surface-secondary border p-3.5 transition-all hover:border-orange-500 ${statusFilter === key ? 'border-orange-500 shadow-[0_3px_0_0_#c2410c]' : 'border-border-subtle'}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${accent}`}>
                {t.currency === 'mixed' ? 'Mixed' : fmtMoneyCurrency(t.amount, t.currency)}
              </p>
              <p className="text-[11px] text-content-muted mt-0.5">{t.count} creator{t.count === 1 ? '' : 's'}</p>
            </button>
          ))}
          <div className="text-left rounded-xl bg-surface-secondary border border-border-subtle p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted">Total</p>
            <p className="text-xl font-bold text-content mt-0.5">
              {totals.upcoming.currency === totals.due.currency && totals.due.currency === totals.paid.currency && totals.upcoming.currency !== 'mixed'
                ? fmtMoneyCurrency(totals.upcoming.amount + totals.due.amount + totals.paid.amount, totals.upcoming.currency)
                : 'Mixed'}
            </p>
            <p className="text-[11px] text-content-muted mt-0.5">{nonStatusRows.length} creator{nonStatusRows.length === 1 ? '' : 's'}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="rounded-2xl bg-surface-secondary border border-border shadow-theme p-12 text-center text-content-muted text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading campaigns...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl bg-surface-secondary border border-border shadow-theme p-12 text-center">
          <Users className="w-8 h-8 mx-auto text-content-muted mb-2" />
          <p className="text-sm font-medium text-content">{allRows.length === 0 ? 'No creators yet' : 'No creators match your filters'}</p>
          <p className="text-xs text-content-muted mt-1">{allRows.length === 0 ? 'Create a campaign and add creators to start tracking payouts.' : 'Adjust the filters or status tab to see more.'}</p>
          {allRows.length === 0 && (
            <Button size="sm" onClick={onCreateCampaign} className="mt-4">
              <Plus className="w-4 h-4 mr-1.5" /> New campaign
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-secondary border border-border shadow-theme overflow-hidden">
          {/* Bulk action bar — appears when at least one row is selected.
              The "Apply structure" button reuses the existing slide-over so
              admins get the same picker experience whether they're assigning
              to one or to many. */}
          {selectedRowKeys.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-orange-500/10 border-b border-orange-500/30">
              <div className="text-sm font-semibold text-content">
                {selectedRowKeys.size} selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBulkPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Apply structure to {selectedRowKeys.size}
                </button>
                <button
                  onClick={() => setSelectedRowKeys(new Set())}
                  className="px-3 py-1.5 rounded-lg border border-border-subtle text-content-muted hover:text-content hover:border-border-strong text-xs font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="hidden md:flex items-center bg-surface-tertiary/40 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
              <div className="sticky left-0 bg-surface-tertiary/40 w-[40px] flex-shrink-0 pl-4 pr-1 py-2.5 flex items-center">
                <input
                  type="checkbox"
                  checked={filteredRows.length > 0 && filteredRows.every(r => selectedRowKeys.has(rowKey(r.campaign.id, r.creator.id)))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const next = new Set(selectedRowKeys);
                      filteredRows.forEach(r => next.add(rowKey(r.campaign.id, r.creator.id)));
                      setSelectedRowKeys(next);
                    } else {
                      const next = new Set(selectedRowKeys);
                      filteredRows.forEach(r => next.delete(rowKey(r.campaign.id, r.creator.id)));
                      setSelectedRowKeys(next);
                    }
                  }}
                  className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
                />
              </div>
              <div className="sticky left-[40px] bg-surface-tertiary/40 w-[260px] flex-shrink-0 pl-1 pr-2 py-2.5">Creator</div>
              <div className="flex-1 min-w-[200px] px-3 py-2.5">Campaign</div>
              <div className="w-[180px] flex-shrink-0 px-3 py-2.5">Billing Period</div>
              <div className="w-[140px] flex-shrink-0 px-3 py-2.5">Amount</div>
              <div className="w-[120px] flex-shrink-0 px-3 py-2.5">Status</div>
              <div className="sticky right-0 bg-surface-tertiary/40 w-[120px] flex-shrink-0 pl-2 pr-5 py-2.5 text-right">Action</div>
            </div>
            <div className="border-t border-border-subtle divide-y divide-border-subtle">
              {filteredRows.map(({ campaign, creator }) => {
                const handlers = makeHandlers(campaign, creator.id);
                const k = rowKey(campaign.id, creator.id);
                const checked = selectedRowKeys.has(k);
                return (
                  <div key={`${campaign.id}-${creator.id}`} className={`flex items-stretch ${checked ? 'bg-orange-500/5' : ''}`}>
                    <div className="w-[40px] flex-shrink-0 flex items-start pt-5 pl-4 pr-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedRowKeys(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(k);
                            else next.delete(k);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CreatorCard
                        creator={creator}
                        orgId={orgId}
                        projectId={projectId}
                        campaign={campaign}
                        showCampaignColumn
                        payoutsEnabled={payoutsEnabled}
                        {...handlers}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bulk structure picker — same slide-over, just a synthetic creator
          for the picker prop (it only uses creator.name for the title). */}
      {bulkPickerOpen && (
        <StructurePickerSlideOver
          creator={{
            id: '_bulk',
            name: `${selectedRowKeys.size} creator${selectedRowKeys.size === 1 ? '' : 's'}`,
            email: '',
            videos: [],
            videosLoaded: false,
            videosLoading: false,
            payoutStatus: 'pending',
          }}
          orgId={orgId}
          projectId={projectId}
          userId={userId}
          onClose={() => setBulkPickerOpen(false)}
          onAssign={applyBulkStructure}
        />
      )}

      {/* Structure picker */}
      {pickerForCreatorId && (() => {
        const c = campaigns.find(cmp => cmp.id === pickerForCreatorId.campaignId);
        const cr = c?.creators.find(x => x.id === pickerForCreatorId.creatorId);
        if (!c || !cr) return null;
        return (
          <StructurePickerSlideOver
            creator={cr}
            orgId={orgId}
            projectId={projectId}
            userId={userId}
            onClose={() => setPickerForCreatorId(null)}
            onAssign={s => {
              onUpdateCampaign(c.id, prev => ({
                ...prev,
                creators: prev.creators.map(x => x.id === cr.id ? recalcCreator({ ...x, structure: s }, prev) : x),
              }));
              setPickerForCreatorId(null);
            }}
          />
        );
      })()}

      {/* Pay confirmation modal — runs the same Stripe pre-flight + transfer flow
          as the per-campaign view, just routed through updateCampaignById. */}
      {payConfirmFor && (() => {
        const c = campaigns.find(cmp => cmp.id === payConfirmFor.campaignId);
        const cr = c?.creators.find(x => x.id === payConfirmFor.creatorId);
        if (!c || !cr) return null;
        const amount = netOwed(cr);
        const minimum = campaignMinimumPayout(c);
        const cur = campaignCurrency(c);
        return (
          <PayConfirmModal
            title={`Pay ${cr.name}`}
            amount={amount}
            currency={cur}
            bodyLines={[
              `You're about to send ${cr.name} ${fmtMoneyCurrency(amount, cur)} from your Maktub Stripe balance.`,
              `Stripe will move the funds to their connected account, then release to their bank within 1–2 business days.`,
              `This is recorded in the audit log and cannot be undone from here once the transfer settles — reversals would require the Stripe dashboard.`,
            ]}
            onCancel={() => setPayConfirmFor(null)}
            onConfirm={async () => {
              setPayConfirmFor(null);
              if (cr.payoutStatus !== 'approved') {
                alert(`This payout is ${cr.payoutStatus}, not approved. Nothing to pay.`);
                return;
              }
              if (amount < minimum) {
                alert(`Cannot mark paid — amount ${fmtMoneyCurrency(amount, cur)} is below the minimum payout of ${fmtMoneyCurrency(minimum, cur)} for this campaign.`);
                return;
              }
              try {
                const stripeStatus = await AdminStripeService.fetchCreatorStatus({ orgId, projectId, creatorId: cr.id });
                if (stripeStatus.status !== 'complete') {
                  const reason = stripeStatus.status === 'none' ? 'has not started Stripe onboarding'
                    : stripeStatus.status === 'pending' ? 'has not finished Stripe onboarding'
                    : 'has an issue with their Stripe account (action required)';
                  alert(`Cannot mark paid — ${cr.name} ${reason}. Ask them to complete setup in their creator portal.`);
                  return;
                }
              } catch (err: any) {
                alert(`Stripe status check failed: ${err?.message || 'unknown error'}. Try again.`);
                return;
              }
              const baseSnapshot = {
                amount,
                currency: cur,
                paidAt: new Date(),
                paidBy: actingUser,
                idempotencyKey: buildIdempotencyKey(c.id, cr.id),
                stripeTransferStatus: 'pending' as const,
              };
              onUpdateCampaign(c.id, prev => ({
                ...prev,
                creators: prev.creators.map(x => x.id === cr.id
                  ? logAction(
                      { ...x, payoutStatus: 'paid' as const, paidSnapshot: baseSnapshot },
                      'Marked paid', actingUser,
                      `${fmtMoneyCurrency(amount, baseSnapshot.currency)} · ${baseSnapshot.idempotencyKey}`,
                    )
                  : x),
              }));
              try {
                const result = await AdminStripeService.transferToCreator({ orgId, projectId, campaignId: c.id, creatorId: cr.id });
                onUpdateCampaign(c.id, prev => ({
                  ...prev,
                  creators: prev.creators.map(x => x.id === cr.id
                    ? logAction(
                        { ...x, paidSnapshot: { ...x.paidSnapshot!, stripeTransferId: result.transferId, stripeTransferStatus: 'paid' as const, stripeTransferError: undefined } },
                        'Stripe transfer created', actingUser,
                        `${result.transferId}${result.alreadyTransferred ? ' (idempotent — already existed)' : ''}`,
                      )
                    : x),
                }));
              } catch (err: any) {
                onUpdateCampaign(c.id, prev => ({
                  ...prev,
                  creators: prev.creators.map(x => x.id === cr.id
                    ? logAction(
                        { ...x, paidSnapshot: { ...x.paidSnapshot!, stripeTransferStatus: 'failed' as const, stripeTransferError: err?.message || 'Unknown transfer error' } },
                        'Stripe transfer FAILED', actingUser, err?.message || 'unknown',
                      )
                    : x),
                }));
              }
            }}
          />
        );
      })()}

      {/* Add creators slide-over — opens with whatever campaign was resolved
          by the toolbar button (filter-of-one, only-one, or picker). */}
      {showAddCreatorFor && (() => {
        const target = campaigns.find(c => c.id === showAddCreatorFor);
        if (!target) return null;
        return (
          <AddCreatorsSlideOver
            campaign={target}
            orgId={orgId}
            projectId={projectId}
            onClose={() => setShowAddCreatorFor(null)}
            onAdd={(newOnes) => {
              onUpdateCampaign(target.id, prev => ({
                ...prev,
                creators: [...prev.creators, ...newOnes],
              }));
              setShowAddCreatorFor(null);
            }}
          />
        );
      })()}
    </div>
  );
}


// ==================== CAMPAIGNS TABLE VIEW ====================

/**
 * Sister tab to FlatPayoutsView. Lists every campaign as a row with the same
 * column DNA viral.app uses for its campaigns table: name + cadence subtitle,
 * creator stack + count, target (total tracked videos), validity (created → end),
 * active period (campaign date window), base payout sum, fixed salary sum.
 *
 * Fields like "base payout" and "fixed salary" are derived by walking each
 * creator's assigned PayoutStructure and summing components by type — gives a
 * directionally-correct campaign-level number rather than just per-creator data.
 */
function CampaignsTableView({
  campaigns, loading, onCreateCampaign, onEditCampaign,
}: {
  campaigns: PayoutCampaign[];
  loading: boolean;
  onCreateCampaign: () => void;
  /** Open edit drawer for the clicked campaign. */
  onEditCampaign: (c: PayoutCampaign) => void;
}) {
  const [search, setSearch] = useState('');
  const [creatorFilter, setCreatorFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<PayoutCampaign['status']>>(new Set());
  const [statusOpen, setStatusOpen] = useState(false);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        statusTriggerRef.current && !statusTriggerRef.current.contains(t) &&
        statusDropRef.current && !statusDropRef.current.contains(t)
      ) setStatusOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [statusOpen]);

  // Unique creators across all campaigns — feeds the creator multi-select filter.
  const uniqueCreators = (() => {
    const seen = new Map<string, CampaignCreator>();
    for (const c of campaigns) for (const cr of c.creators) if (!seen.has(cr.id)) seen.set(cr.id, cr);
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const rows = campaigns.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) return false;
    }
    if (creatorFilter.size > 0 && !c.creators.some(cr => creatorFilter.has(cr.id))) return false;
    if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false;
    return true;
  });

  const fmtRange = (start?: Date, end?: Date) => {
    if (!start && !end) return null;
    const s = start ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
    const e = end ? end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'open';
    return `${s} – ${e}`;
  };

  // Roll structure components into a campaign-level total. Sums every creator's
  // assigned structure by type — base + per_video for "base payout", flat for
  // "fixed salary". Returns undefined when no creators have a structure yet so
  // the cell can render "—" instead of "$0.00".
  const sumByTypes = (c: PayoutCampaign, types: PayoutComponentType[]): number | undefined => {
    let any = false;
    let sum = 0;
    for (const cr of c.creators) {
      if (!cr.structure) continue;
      for (const comp of cr.structure.components) {
        if (!types.includes(comp.type as PayoutComponentType)) continue;
        const a = (comp as { amount?: number }).amount;
        if (typeof a === 'number') { sum += a; any = true; }
      }
    }
    return any ? sum : undefined;
  };

  const fmtMoneyOrDash = (v: number | undefined, currency: string) =>
    v === undefined ? <span className="text-content-muted">—</span> : fmtMoneyCurrency(v, currency);

  return (
    <div className="space-y-5">
      {/* Filter row — symmetry with FlatPayoutsView: multi-selects + search on
          left, primary action right. Status replaces "campaigns" filter since
          we're already listing campaigns. */}
      <div className="flex items-center gap-3 flex-wrap">
        <CreatorMultiSelect creators={uniqueCreators} selected={creatorFilter} onChange={setCreatorFilter} />
        <div className="relative">
          <button
            ref={statusTriggerRef}
            onClick={() => setStatusOpen(!statusOpen)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary border text-sm transition-colors ${statusOpen || statusFilter.size > 0 ? 'border-orange-500' : 'border-border-subtle hover:border-border'}`}
          >
            <Sparkles className="w-4 h-4 text-content-muted" />
            <span className={statusFilter.size > 0 ? 'text-content font-medium' : 'text-content-muted'}>
              {statusFilter.size === 0 ? 'Current Campaigns' : statusFilter.size === 1 ? Array.from(statusFilter)[0] : `${statusFilter.size} statuses`}
            </span>
            <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
          {statusOpen && (
            <div ref={statusDropRef} className="absolute top-full mt-1 left-0 w-56 rounded-xl bg-surface-secondary border border-border shadow-xl z-30 p-1">
              {(['draft', 'active', 'completed'] as const).map(s => {
                const isSel = statusFilter.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => {
                      const next = new Set(statusFilter);
                      if (isSel) next.delete(s); else next.add(s);
                      setStatusFilter(next);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-colors capitalize ${isSel ? 'bg-orange-500/10' : 'hover:bg-surface-tertiary'}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSel ? 'bg-orange-500 border-orange-500' : 'border-border-strong'}`}>
                      {isSel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-content">{s}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="relative w-full sm:w-auto sm:flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or notes"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-secondary border border-border-subtle text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <button
          onClick={onCreateCampaign}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white font-bold text-sm border border-orange-700 shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-surface-secondary border border-border shadow-theme p-12 text-center text-content-muted text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading campaigns...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-surface-secondary border border-border shadow-theme p-12 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-content-muted mb-2" />
          <p className="text-sm font-medium text-content">{campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match your filters'}</p>
          <p className="text-xs text-content-muted mt-1">{campaigns.length === 0 ? 'Create your first payout campaign to get started.' : 'Adjust the filters to see more.'}</p>
          {campaigns.length === 0 && (
            <Button size="sm" onClick={onCreateCampaign} className="mt-4">
              <Plus className="w-4 h-4 mr-1.5" /> Create Campaign
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface-secondary border border-border shadow-theme overflow-hidden">
          <div className="overflow-x-auto">
            <div className="hidden md:flex items-center bg-surface-tertiary/40 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
              <div className="sticky left-0 bg-surface-tertiary/40 w-[260px] flex-shrink-0 pl-5 pr-2 py-2.5">Campaign</div>
              <div className="w-[140px] flex-shrink-0 px-3 py-2.5">Creators</div>
              <div className="w-[110px] flex-shrink-0 px-3 py-2.5">Target</div>
              <div className="w-[180px] flex-shrink-0 px-3 py-2.5">Validity</div>
              <div className="w-[180px] flex-shrink-0 px-3 py-2.5">Active Period</div>
              <div className="w-[140px] flex-shrink-0 px-3 py-2.5">Base Payout</div>
              <div className="flex-1 min-w-[140px] px-3 py-2.5">Fixed Salary</div>
            </div>
            <div className="border-t border-border-subtle divide-y divide-border-subtle">
              {rows.map(c => {
                const cur = campaignCurrency(c);
                const totalVideos = c.creators.reduce((s, cr) => s + cr.videos.length, 0);
                const validity = fmtRange(c.createdAt, c.endDate);
                const activePeriod = fmtRange(c.startDate, c.endDate);
                const basePayout = sumByTypes(c, ['base', 'per_video']);
                const fixedSalary = sumByTypes(c, ['flat']);
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEditCampaign(c)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEditCampaign(c); } }}
                    className="group/row flex items-center cursor-pointer hover:bg-surface-tertiary/30 transition-colors"
                  >
                    <div className="sticky left-0 z-[1] bg-surface-secondary group-hover/row:bg-surface-tertiary/30 transition-colors flex items-center gap-3 pl-5 pr-2 py-3.5 w-[260px] flex-shrink-0 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-content truncate">{c.name}</p>
                        <p className="text-xs text-content-muted truncate capitalize">{c.status}{c.endDate ? ' · Fixed Window' : ' · Open Window'}</p>
                      </div>
                    </div>
                    <div className="w-[140px] flex-shrink-0 px-3 py-3.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <CampaignCreatorStack creators={c.creators} />
                        <span className="text-xs text-content-muted">{c.creators.length}</span>
                      </div>
                    </div>
                    <div className="w-[110px] flex-shrink-0 px-3 py-3.5 min-w-0">
                      <p className="text-sm text-content">{totalVideos > 0 ? `${fmt(totalVideos)} videos` : <span className="text-content-muted">—</span>}</p>
                    </div>
                    <div className="w-[180px] flex-shrink-0 px-3 py-3.5 min-w-0">
                      <p className="text-xs text-content truncate inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-content-muted" />
                        {validity || <span className="text-content-muted">—</span>}
                      </p>
                    </div>
                    <div className="w-[180px] flex-shrink-0 px-3 py-3.5 min-w-0">
                      <p className="text-xs text-content truncate inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-content-muted" />
                        {activePeriod || <span className="text-content-muted">All time</span>}
                      </p>
                    </div>
                    <div className="w-[140px] flex-shrink-0 px-3 py-3.5 min-w-0">
                      <p className="text-sm font-semibold text-content">{fmtMoneyOrDash(basePayout, cur)}</p>
                    </div>
                    <div className="flex-1 min-w-[140px] px-3 py-3.5 min-w-0">
                      <p className="text-sm font-semibold text-content">{fmtMoneyOrDash(fixedSalary, cur)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Stacked avatar of a campaign's creators — uses the first linked-account
 * profile picture per creator (via CreatorAccountStack's primary avatar logic).
 * Stays compact: shows up to `max` creator avatars, then a +N chip. Used in
 * the Campaigns table's Creators column.
 */
function CampaignCreatorStack({ creators, max = 3 }: { creators: CampaignCreator[]; max?: number }) {
  const shown = creators.slice(0, max);
  const extra = Math.max(0, creators.length - shown.length);
  return (
    <div className="flex -space-x-2">
      {shown.map(cr => {
        const initial = (cr.name || '?').slice(0, 1).toUpperCase();
        const pic = cr.videos.find(v => v.uploaderProfilePicture)?.uploaderProfilePicture;
        return (
          <div key={cr.id} className="relative w-7 h-7 rounded-full bg-surface-tertiary ring-2 ring-surface-secondary overflow-hidden flex items-center justify-center text-[10px] font-bold text-content-muted">
            {pic ? (
              <img
                src={pic}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : initial}
          </div>
        );
      })}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full bg-surface-tertiary ring-2 ring-surface-secondary flex items-center justify-center text-[10px] font-bold text-content-muted">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ==================== EDIT CAMPAIGN DRAWER ====================

/**
 * Slide-in drawer for editing a campaign's metadata. Mirrors the visual
 * vocabulary of CreatorCard's drawer (right-side, max-w-2xl, dark backdrop).
 * Edits campaign-level fields only — name, description, status, date window,
 * currency, minimum payout. Per-creator edits live in the Payouts row drawer.
 *
 * Saves through `onSave(patch)` so the parent stays in control of the actual
 * campaign mutation pipeline (firestore write, optimistic state, etc.). Local
 * draft state means the user can cancel without persisting partial edits.
 */
function EditCampaignDrawer({ campaign, onClose, onSave }: {
  campaign: PayoutCampaign;
  onClose: () => void;
  onSave: (patch: Partial<PayoutCampaign>) => void;
}) {
  const toInput = (d?: Date) => d ? d.toISOString().slice(0, 10) : '';
  const fromInput = (s: string): Date | undefined => s ? new Date(s + 'T00:00:00') : undefined;

  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || '');
  const [status, setStatus] = useState<PayoutCampaign['status']>(campaign.status);
  const [startDate, setStartDate] = useState(toInput(campaign.startDate));
  const [endDate, setEndDate] = useState(toInput(campaign.endDate));
  const [currency, setCurrency] = useState((campaign.currency || DEFAULT_CURRENCY).toLowerCase());
  const [minimumPayout, setMinimumPayout] = useState<string>(
    campaign.minimumPayout !== undefined ? String(campaign.minimumPayout) : ''
  );

  const dirty =
    name !== campaign.name ||
    description !== (campaign.description || '') ||
    status !== campaign.status ||
    startDate !== toInput(campaign.startDate) ||
    endDate !== toInput(campaign.endDate) ||
    currency !== (campaign.currency || DEFAULT_CURRENCY).toLowerCase() ||
    minimumPayout !== (campaign.minimumPayout !== undefined ? String(campaign.minimumPayout) : '');

  const canSave = dirty && name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const minNum = minimumPayout.trim() === '' ? undefined : Number(minimumPayout);
    onSave({
      name: name.trim(),
      description: description.trim(),
      status,
      startDate: fromInput(startDate),
      endDate: fromInput(endDate),
      currency,
      minimumPayout: minNum !== undefined && !Number.isNaN(minNum) ? minNum : undefined,
    });
  };

  const lbl = 'block text-xs font-bold text-content mb-1.5';
  const inp = 'w-full px-3 py-2 bg-surface-tertiary border border-border-subtle rounded-lg text-content text-sm focus:outline-none focus:border-orange-500 placeholder:text-content-muted transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="w-full max-w-2xl bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Edit campaign</p>
              <p className="font-semibold text-content truncate">{campaign.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className={lbl}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="e.g. Q2 TikTok Push" />
          </div>

          <div>
            <label className={lbl}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="A short note about what this campaign is for..." />
          </div>

          <div>
            <label className={lbl}>Status</label>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-tertiary/40 border border-border-subtle w-fit">
              {(['draft', 'active', 'completed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${status === s ? 'bg-surface text-content shadow-sm' : 'text-content-muted hover:text-content'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>End date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} />
            </div>
          </div>
          <p className="text-[11px] text-content-muted -mt-3">
            Videos uploaded outside this window won't contribute to payouts. Leave blank for "all time".
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
                <option value="usd">USD ($)</option>
                <option value="eur">EUR (€)</option>
                <option value="gbp">GBP (£)</option>
                <option value="cad">CAD ($)</option>
                <option value="aud">AUD ($)</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Minimum payout</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={minimumPayout}
                onChange={e => setMinimumPayout(e.target.value)}
                placeholder={String(DEFAULT_MINIMUM_PAYOUT_BY_CURRENCY[currency] ?? 1)}
                className={inp}
              />
            </div>
          </div>
          <p className="text-[11px] text-content-muted -mt-3">
            Creators below this amount can't be marked paid. Stripe's own Connect minimum is ~$1 USD.
          </p>

          <div className="rounded-xl bg-surface-tertiary/40 border border-border-subtle p-3.5 space-y-1">
            <p className="text-xs font-bold text-content">{campaign.creators.length} creator{campaign.creators.length === 1 ? '' : 's'} attached</p>
            <p className="text-[11px] text-content-muted">To add or remove creators, open the Payouts tab and filter by this campaign — the floating action gives you full control there.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border-subtle p-4 flex items-center justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <button
            onClick={save}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white font-bold text-sm border border-orange-700 shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-[0_3px_0_0_#c2410c] disabled:hover:translate-y-0"
          >
            <Check className="w-4 h-4" /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== CREATE VIEW ====================

function CreateCampaignView({ orgId, projectId, onCreated, onCancel }: {
  orgId: string; projectId: string; userId: string;
  onCreated: (c: PayoutCampaign) => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  // Map of creatorId → linked TrackedAccount[]. Lets each row render
  // the creator's actual TikTok / IG / YT profile pictures (stacked
  // avatars) instead of just the auth user's photoURL — same pattern
  // as the AddCreatorsSlideOver below.
  const [creatorAccounts, setCreatorAccounts] = useState<Map<string, TrackedAccount[]>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !projectId) return;
    setLoading(true);
    Promise.all([
      CreatorLinksService.getAllCreators(orgId, projectId),
      getDocs(collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks')),
      AccountsDataService.getTrackedAccounts(orgId, projectId).catch(() => [] as TrackedAccount[]),
    ])
      .then(([creators, linksSnap, accounts]) => {
        setAllCreators(creators);
        const accById = new Map(accounts.map(a => [a.id, a]));
        const map = new Map<string, TrackedAccount[]>();
        linksSnap.docs.forEach(d => {
          const link = d.data() as { creatorId: string; accountId: string };
          const acc = accById.get(link.accountId);
          if (!acc) return;
          const arr = map.get(link.creatorId) || [];
          arr.push(acc);
          map.set(link.creatorId, arr);
        });
        setCreatorAccounts(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, projectId]);

  const filtered = allCreators.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.displayName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const toggle = (id: string) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };
  const toggleAll = () => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(c => c.id))); };

  const canCreate = name.trim().length > 0 && selectedIds.size > 0;

  const create = () => {
    if (!canCreate) return;
    const selected = allCreators.filter(c => selectedIds.has(c.id));
    onCreated({
      id: `campaign_${Date.now()}`, name: name.trim(), description: description.trim(),
      status: 'draft', createdAt: new Date(),
      creators: selected.map(c => ({
        id: c.id, name: c.displayName || 'Unknown', email: c.email || '', photoURL: c.photoURL,
        videos: [], videosLoaded: false, videosLoading: false, payoutStatus: 'not_calculated',
      })),
    });
  };

  const inp = 'w-full px-3.5 py-2.5 bg-surface-tertiary border border-border rounded-xl text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-content-muted transition-all';
  const lbl = 'block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-2';

  return (
    <div className="space-y-6 pb-24">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-content-muted hover:text-content transition-colors text-sm group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to campaigns
      </button>

      <div>
        <h1 className="text-3xl font-bold text-content tracking-tight">New Payout Campaign</h1>
        <p className="text-sm text-content-muted mt-1">Name it, pick creators, and you're off.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* LEFT: info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-content">Campaign info</h3>
            </div>
            <div>
              <label className={lbl}>Campaign name</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="e.g. Q2 TikTok Push" />
            </div>
            <div>
              <label className={lbl}>Description <span className="text-content-muted font-normal normal-case tracking-normal">(optional)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="A short note about what this campaign is for..." />
            </div>
          </div>

          {/* Live summary card */}
          <div className="rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-300/50 dark:border-orange-500/20 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-2">Summary</p>
            <p className="text-2xl font-bold text-content">{selectedIds.size} creator{selectedIds.size === 1 ? '' : 's'}</p>
            <p className="text-xs text-content-muted mt-1">{name.trim() || <span className="italic">Name your campaign</span>}</p>
            <p className="text-[11px] text-content-muted mt-4">Payout structures can be assigned per creator once the campaign exists.</p>
          </div>
        </div>

        {/* RIGHT: creator picker */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme overflow-hidden">
            <div className="p-5 border-b border-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-content">Choose creators</h3>
                  <span className="text-xs text-content-muted">({selectedIds.size} selected)</span>
                </div>
                {filtered.length > 0 && (
                  <button onClick={toggleAll} className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    {selectedIds.size === filtered.length ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} className={`${inp} pl-9`} placeholder="Search by name or email..." />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2.5 py-16 text-content-muted text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading creators...
              </div>
            ) : allCreators.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-tertiary flex items-center justify-center">
                  <Users className="w-7 h-7 text-content-muted" />
                </div>
                <p className="text-sm font-medium text-content">No creators yet</p>
                <p className="text-xs text-content-muted mt-1 max-w-xs mx-auto">
                  Add creators via share links first — then come back to build a payout campaign.
                </p>
              </div>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto divide-y divide-border-subtle">
                {filtered.map(c => {
                  const sel = selectedIds.has(c.id);
                  const accounts = creatorAccounts.get(c.id) || [];
                  return (
                    <button key={c.id} onClick={() => toggle(c.id)} type="button"
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${sel ? 'bg-orange-500/5' : 'hover:bg-surface-hover'}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-orange-500 border-orange-500 scale-105' : 'border-border-strong'}`}>
                        {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </div>
                      <AddCreatorsAccountStack
                        accounts={accounts}
                        fallbackChar={(c.displayName || c.email || 'C').charAt(0).toUpperCase()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-content truncate">{c.displayName}</p>
                          <CreatorPlatformBubbles items={accounts} max={3} />
                        </div>
                        <p className="text-xs text-content-muted truncate">{c.email || 'No email'}</p>
                      </div>
                      <p className="text-xs text-content-muted flex items-center gap-1 flex-shrink-0">
                        <Users className="w-3 h-3" /> {c.linkedAccountsCount || 0}
                      </p>
                    </button>
                  );
                })}
                {filtered.length === 0 && <div className="text-center py-8 text-content-muted text-sm">No creators match "{search}"</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-surface/95 backdrop-blur-sm border-t border-border-subtle px-4 md:px-8 py-3.5 flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-content-muted">Selected:</span>{' '}
          <span className="font-semibold text-content">{selectedIds.size}</span>
          {!name.trim() && <span className="ml-3 text-xs text-orange-600 dark:text-orange-400 inline-flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Name required</span>}
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={create} disabled={!canCreate}>
            Create campaign <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}


/**
 * Admin-facing confirmation modal for paying one or more creators. Keeps the destructive
 * "this moves real money" step behind an explicit Confirm click. Renders the exact total
 * amount + plain-English explanation of what happens next (platform → Stripe → bank).
 */
function PayConfirmModal({ title, amount, currency, bodyLines, onCancel, onConfirm }: {
  title: string;
  amount: number;
  currency: string;
  bodyLines: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border max-w-lg w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Confirm payment</p>
              <p className="font-semibold text-content truncate">{title}</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Amount</p>
            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-500 mt-1">
              {fmtMoneyCurrency(amount, currency)}
            </p>
          </div>
          <ul className="space-y-2">
            {bodyLines.map((line, i) => (
              <li key={i} className="text-sm text-content-secondary flex gap-2 leading-relaxed">
                <span className="text-orange-500 font-bold flex-shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 border-t border-border-subtle flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>
            <Check className="w-4 h-4 mr-1.5" /> Confirm &amp; pay
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== CREATOR ACCOUNT STACK ====================

/**
 * Stacked-avatar identity for a creator. Replaces the single "creator profile picture"
 * pattern with one avatar per linked tracked account (TikTok / Instagram / YouTube / X).
 *
 * - Accounts are derived from the creator's tracked videos by `(platform, uploaderHandle)`,
 *   taking the first non-empty `uploaderProfilePicture` we see for that account.
 * - Up to `max` avatars render overlapped; beyond that, a `+N` chip occupies the last slot.
 * - When videos haven't loaded yet (or there are no derivable accounts), falls back to a
 *   single neutral circle with the creator's initial — keeps row height stable.
 * - Each avatar has a tiny platform-icon corner badge so admins can tell which network
 *   each handle lives on without hovering.
 */
/**
 * Single account avatar with a built-in `<img>` error fallback.
 *
 * The browser's default broken-image glyph is hideous and tends to fire whenever
 * a CDN-hosted profile picture link expires (TikTok / IG profile pic URLs rotate
 * frequently). When that happens we swap to a neutral initial circle so the row
 * stays clean. The platform-icon corner badge still renders either way so the
 * admin can always tell which network the handle belongs to.
 */
function AccountAvatar({ pic, fallbackChar, title }: { pic?: string; fallbackChar: string; title?: string }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!pic && !failed;
  return (
    <div className="w-full h-full" title={title}>
      {showImg ? (
        <img
          src={pic}
          alt={fallbackChar}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-content-muted">
          {fallbackChar}
        </div>
      )}
    </div>
  );
}

function CreatorAccountStack({ creator, max = 3 }: { creator: CampaignCreator; max?: number }) {
  const accounts = (() => {
    const seen = new Map<string, { platform: TrackedVideo['platform']; handle: string; pic?: string }>();
    for (const v of creator.videos) {
      const handle = v.uploaderHandle || '';
      const key = `${v.platform}::${handle}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { platform: v.platform, handle, pic: v.uploaderProfilePicture });
      } else if (!existing.pic && v.uploaderProfilePicture) {
        existing.pic = v.uploaderProfilePicture;
      }
    }
    return Array.from(seen.values());
  })();

  if (accounts.length === 0) {
    return (
      <div className="w-9 h-9 rounded-full bg-surface-tertiary border border-border-subtle flex items-center justify-center text-content-muted text-xs font-semibold flex-shrink-0">
        {creator.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  const visible = accounts.slice(0, max);
  const overflow = accounts.length - visible.length;

  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {visible.map((a, i) => (
        // Outer wrapper is `relative` only — NOT `overflow-hidden`. The avatar
        // image lives in an inner clipped circle; the platform badge is a
        // sibling so it can hang off the corner without being chopped.
        <div key={`${a.platform}-${a.handle}-${i}`} className="relative w-9 h-9">
          <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-surface-secondary bg-surface-tertiary">
            <AccountAvatar
              pic={a.pic}
              fallbackChar={(a.handle || a.platform).charAt(0).toUpperCase()}
              title={a.handle ? `@${a.handle} · ${a.platform}` : a.platform}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-surface-secondary ring-2 ring-surface-secondary flex items-center justify-center">
            <PlatformIcon platform={a.platform} size="sm" />
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative w-9 h-9 rounded-full ring-2 ring-surface-secondary bg-surface-tertiary flex items-center justify-center text-[11px] font-semibold text-content-secondary"
          title={`${overflow} more account${overflow === 1 ? '' : 's'}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ==================== CREATOR CARD ====================

function CreatorCard({ creator, orgId, projectId, campaign, showCampaignColumn = false, onLoadVideos, onApprove, onMarkPaid, onUnapprove, onRevertPaid, onRetryTransfer, payoutsEnabled, onOpenPicker, onRemove, onSetOverride, onClearOverride, onSetStartDate, onToggleExcludeVideo, onVideosChange, onLogPriorPayout, onRemovePriorPayout, onUpdatePeriod }: {
  creator: CampaignCreator;
  orgId: string; projectId: string;
  campaign: PayoutCampaign;
  /** When true, render a Campaign cell between the sticky-left identity column
   *  and the Structure column. Used by the flat all-creators-across-campaigns
   *  view; left off in any single-campaign-context view (would be redundant). */
  showCampaignColumn?: boolean;
  onLoadVideos: () => void; onApprove: () => void; onMarkPaid: () => void;
  /** Flip status from `approved` → `pending`. Confirm dialog + audit log handled in parent. */
  onUnapprove: () => void;
  /** Flip status from `paid` → `approved`. Confirm dialog + audit log handled in parent. */
  onRevertPaid: () => void;
  /** Retry a failed Stripe transfer. Reuses the snapshot's idempotency key so Stripe dedupes. */
  onRetryTransfer: () => void;
  /** When false, the Pay button is disabled (Connect not activated). Approve still works. */
  payoutsEnabled: boolean;
  onOpenPicker: () => void; onRemove: () => void;
  onSetOverride: (amount: number, note?: string) => void;
  onClearOverride: () => void;
  /** Sets (or clears, via undefined) the per-creator "only count videos from this date" filter. */
  onSetStartDate: (date: Date | undefined) => void;
  onToggleExcludeVideo: (videoId: string) => void;
  onVideosChange: (videos: TrackedVideo[]) => void;
  /** Append a new prior-payout entry (off-platform payout already made). */
  onLogPriorPayout: (entry: Omit<PriorPayoutEntry, 'id' | 'recordedBy' | 'recordedAt'>) => void;
  /** Remove a prior-payout entry by id (e.g. mis-entry correction). */
  onRemovePriorPayout: (id: string) => void;
  /** Edit the campaign's billing period (startDate / endDate) inline from
   *  the row's Billing Period cell. Both args are optional — pass undefined
   *  on either side to clear that boundary ("open window"). */
  onUpdatePeriod: (start: Date | undefined, end: Date | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCrossPostModal, setShowCrossPostModal] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);
  const [showLogPayoutModal, setShowLogPayoutModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(false);

  // Build cross-post groups map for display — groups videos with the same crossPostGroupId.
  // The admin sees these whether they came from the creator portal (auto-tagged at submit)
  // or were manually linked in the admin modal; both paths write the same field.
  const crossPostGroups = (() => {
    const map = new Map<string, TrackedVideo[]>();
    for (const v of creator.videos) {
      if (!v.crossPostGroupId) continue;
      const arr = map.get(v.crossPostGroupId) || [];
      arr.push(v);
      map.set(v.crossPostGroupId, arr);
    }
    // Only show groups with ≥ 2 videos (a single-video group isn't a cross-post)
    return Array.from(map.entries())
      .filter(([, vids]) => vids.length >= 2)
      .map(([id, videos], i) => ({
        id,
        label: String.fromCharCode(65 + (i % 26)),
        videos,
        combinedViews: videos.reduce((s, v) => s + (v.views || 0), 0),
      }));
  })();

  // Lazy-load videos when the user opens the details drawer. Loading on row
  // mount used to fire N parallel Firestore queries (one per creator card),
  // which would overwhelm the connection and leave some creators stuck in
  // `videosLoading: true` forever. Loading on demand keeps the table fast and
  // ensures the load only happens when the user actually wants to see videos.
  useEffect(() => {
    if (!expanded) return;
    if (creator.videosLoaded || creator.videosLoading) return;
    onLoadVideos();
  }, [expanded, creator.videosLoaded, creator.videosLoading]);

  // Chip row + expanded slider show only videos inside the active payout window (campaign dates
  // combined with creator.countVideosFromDate). Excluded videos are kept in the slider so the admin
  // can re-include them, but out-of-window videos disappear entirely — they won't ever count.
  const windowVideos = videosInDateWindow(creator, campaign);
  const hiddenByDate = creator.videos.length - windowVideos.length;
  // Videos already shown in the cross-post groups section above shouldn't be duplicated in the slider.
  const crossPostedIds = new Set(crossPostGroups.flatMap(g => g.videos.map(v => v.id)));
  const standaloneVideos = windowVideos.filter(v => !crossPostedIds.has(v.id));
  const creatorViews = windowVideos.reduce((s, v) => s + v.views, 0);
  const hasStructure = !!creator.structure;
  const hasPayout = !!creator.payoutResult;

  // Pre-compute the action button label/icon/handler for the current status so
  // the JSX below stays compact. The amount lives INSIDE the button text — the
  // row no longer carries a separate "Net owed" column.
  const amountLabel = hasPayout ? fmtMoneyCurrency(netOwed(creator), campaignCurrency(campaign)) : '';
  const paidLabel = creator.paidSnapshot
    ? fmtMoneyCurrency(creator.paidSnapshot.amount, creator.paidSnapshot.currency)
    : '';

  return (
    <div className="bg-surface-secondary">
      {/* Collapsed row. Hover + cursor live on this row only (NOT the outer wrapper)
          so they don't bleed into the expanded panel below. The row uses no outer
          padding — sticky-left/right cells carry their own pl-5/pr-5 so the sticky
          backgrounds extend to the card edge cleanly when the table scrolls. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
        className="group/row flex items-center cursor-pointer hover:bg-surface-tertiary/30 transition-colors"
      >
        {/* Sticky LEFT — identity (account stack + name + email). Pins to the
            left edge of the scroll container so the creator stays visible when
            the table scrolls horizontally. */}
        <div className="sticky left-0 z-[1] bg-surface-secondary group-hover/row:bg-surface-tertiary/30 transition-colors flex items-center gap-3 pl-5 pr-2 py-3.5 w-[260px] flex-shrink-0">
          <CreatorAccountStack creator={creator} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-semibold text-content truncate">{creator.name}</p>
              <CreatorPlatformBubbles items={creator.videos} max={3} />
            </div>
            <p className="text-xs text-content-muted truncate">{creator.email || 'No email'}</p>
          </div>
        </div>

        {/* Campaign — bold campaign name + structure name (or "Choose structure"
            CTA) as the cadence-style subtitle. Mirrors viral.app's "Monthly · Fixed
            Window" subtitle pattern: campaign on top, modifier on bottom. Only
            rendered in flat all-campaigns view; suppressed otherwise. */}
        {showCampaignColumn ? (
          <div className="flex-1 min-w-[200px] px-3 py-3.5 min-w-0">
            <p className="text-sm font-semibold text-content truncate">{campaign.name}</p>
            {hasStructure ? (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
                className="text-xs text-content-muted hover:text-orange-500 transition-colors truncate block max-w-full text-left mt-0.5"
                title="Change structure"
              >
                {creator.structure!.name}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline mt-0.5 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Choose structure
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 min-w-[200px] px-3 py-3.5 min-w-0">
            {hasStructure ? (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
                className="block max-w-full text-left text-sm font-semibold text-content hover:text-orange-500 transition-colors truncate"
              >
                {creator.structure!.name}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPicker(); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Choose structure
              </button>
            )}
            <p className="text-xs text-content-muted truncate mt-0.5">
              {windowVideos.length} {windowVideos.length === 1 ? 'video' : 'videos'} · {fmt(creatorViews)} views
            </p>
          </div>
        )}

        {/* Billing Period — campaign date window. Click to edit inline; the
            change applies to every creator on this campaign (since the
            window is campaign-level). "All time" = no window set. */}
        <div className="w-[180px] flex-shrink-0 px-3 py-3.5 min-w-0 relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setEditingPeriod(v => !v)}
            className="text-left w-full text-xs text-content hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate"
            title="Edit billing period"
          >
            {campaign.startDate || campaign.endDate
              ? `${campaign.startDate ? campaign.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'} – ${campaign.endDate ? campaign.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'open'}`
              : <span className="text-content-muted">All time</span>}
          </button>
          {creator.paidSnapshot?.stripeTransferStatus === 'pending' && (
            <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">Processing transfer…</p>
          )}
          {creator.paidSnapshot?.stripeTransferStatus === 'failed' && (
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">Transfer failed</p>
          )}

          {editingPeriod && (
            <PeriodEditPopover
              start={campaign.startDate}
              end={campaign.endDate}
              onClose={() => setEditingPeriod(false)}
              onSave={(s, e) => { onUpdatePeriod(s, e); setEditingPeriod(false); }}
            />
          )}
        </div>

        {/* Amount — net owed in its own column with a small clock icon, mirroring
            viral.app. The Send button below carries no amount label so it can stay
            a tight icon-only square. */}
        <div className="w-[140px] flex-shrink-0 px-3 py-3.5 min-w-0">
          {hasPayout ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-content">
              <Clock className="w-3.5 h-3.5 text-content-muted" />
              {creator.payoutStatus === 'paid' ? paidLabel : amountLabel}
            </p>
          ) : (
            <p className="text-xs text-content-muted">Not calculated</p>
          )}
        </div>

        {/* Status pill */}
        <div className="w-[120px] flex-shrink-0 px-3 py-3.5">
          <PayoutStatusBadge status={creator.payoutStatus} />
        </div>

        {/* Sticky RIGHT — small dark Send icon button only. The whole row is
            clickable to open the details drawer (no separate ⋯). The Send button
            is icon-only (the amount lives in its own column now), matching
            viral.app's compact action area exactly. */}
        <div
          className="sticky right-0 z-[1] bg-surface-secondary group-hover/row:bg-surface-tertiary/30 transition-colors flex items-center justify-end gap-1 pl-2 pr-5 py-3.5 w-[120px] flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {creator.payoutStatus === 'pending' && hasPayout && (
            <button
              onClick={onApprove}
              title={`Approve ${amountLabel}`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-content text-surface hover:bg-content/90 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {creator.payoutStatus === 'approved' && (
            <button
              onClick={onMarkPaid}
              disabled={!payoutsEnabled}
              title={payoutsEnabled ? `Send ${amountLabel}` : 'Disabled until Stripe Connect is activated'}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-content text-surface hover:bg-content/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          {creator.payoutStatus === 'paid' && (
            <div
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              title={creator.paidSnapshot ? `Paid ${creator.paidSnapshot.paidAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} by ${creator.paidSnapshot.paidBy.split('@')[0]}` : 'Paid'}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {!hasPayout && creator.payoutStatus === 'pending' && (
            <span className="text-[11px] font-medium text-content-muted px-1">Calc</span>
          )}
        </div>
      </div>

      {/* Failed-transfer remediation — bright so the admin sees it's actionable. Shown as a
          banner above the revert option so "Retry" is the default next action; revert is the
          escape hatch if retries keep failing. */}
      {creator.paidSnapshot?.stripeTransferStatus === 'failed' && (
        <div className="px-5 pb-3">
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-xs space-y-1.5">
            <p className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Stripe transfer failed
            </p>
            {creator.paidSnapshot.stripeTransferError && (
              <p className="text-content-secondary">{creator.paidSnapshot.stripeTransferError}</p>
            )}
            <button onClick={onRetryTransfer}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Retry transfer
            </button>
          </div>
        </div>
      )}

      {/* Details drawer — opens when the user clicks the row or hits the
          "Details" button in the action area. Slides in from the right like our
          other slide-overs (StructurePicker / AddCreators) so the breakdown,
          prior payouts, videos, override, and audit log don't crowd the table. */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setExpanded(false)} />
          <div className="w-full max-w-2xl bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-up">
            {/* Drawer header */}
            <div className="flex items-center justify-between p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3 min-w-0">
                <CreatorAccountStack creator={creator} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted truncate">{campaign.name}</p>
                  <p className="font-semibold text-content truncate">{creator.name}</p>
                </div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Total payment due — leads the drawer so the user sees the
              answer first, then scans the breakdown below to understand
              how it was calculated. */}
          {creator.payoutResult && creator.payoutResult.componentBreakdown.length > 0 && (
            <>
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total owed</p>
                <p className="text-3xl md:text-4xl font-bold text-emerald-600 dark:text-emerald-500 leading-none mt-1.5">
                  {fmtMoneyExact(creator.payoutResult.totalPayout)}
                </p>
                {creator.payoutResult.appliedCap && (
                  <p className="text-xs text-content-muted italic flex items-center gap-1 mt-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Capped at {fmtMoneyExact(creator.payoutResult.appliedCap.maxPayout)} (was {fmtMoneyExact(creator.payoutResult.appliedCap.originalTotal)})
                  </p>
                )}
              </div>

              {/* Breakdown — supports the headline total above. */}
              <div>
                <p className="text-xs font-bold text-content mb-2">Breakdown</p>
                <div className="space-y-2">
                  {creator.payoutResult.componentBreakdown.map((comp, i) => {
                    const meta = COMPONENT_META[comp.type as PayoutComponentType] || COMPONENT_META.base;
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="rounded-xl bg-surface border border-border p-3.5 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{meta.label}</span>
                              <span className="text-sm font-semibold text-content">{comp.componentName}</span>
                            </div>
                            <p className="text-xs text-content-muted mt-0.5">{comp.details}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {comp.wasCapped && <p className="text-[10px] text-content-muted italic">capped from {fmtMoneyExact(comp.originalAmount ?? 0)}</p>}
                          <p className="text-lg font-bold text-content">{fmtMoneyExact(comp.amount)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Reverse-state escape hatches — Un-approve (approved → pending) and
                      Revert (paid → approved). Tucked at the end so the row stays tight. */}
                  {(creator.payoutStatus === 'approved' || creator.payoutStatus === 'paid') && (
                    <div className="pt-3 mt-2 border-t border-border-subtle">
                      {creator.payoutStatus === 'approved' && (
                        <button
                          onClick={onUnapprove}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:translate-y-0.5 text-white text-xs font-bold rounded-lg shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] transition-all"
                        >
                          ← Un-approve this payout
                        </button>
                      )}
                      {creator.payoutStatus === 'paid' && (
                        <button
                          onClick={onRevertPaid}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:translate-y-0.5 text-white text-xs font-bold rounded-lg shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] transition-all"
                        >
                          ← Revert to approved
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Prior payouts — off-platform payments already made. Shown above cross-posts so the
               admin sees the "already paid" context before diving into video detail. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-content">Prior payouts</p>
              <button onClick={() => setShowLogPayoutModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                <Plus className="w-3 h-3" /> Log payout
              </button>
            </div>

            {(creator.priorPayouts?.length ?? 0) === 0 ? (
              <p className="text-xs text-content-muted">None logged yet — record off-platform payments (Venmo, bank, etc.) so net owed stays accurate.</p>
            ) : (
              <div className="space-y-2">
                {creator.priorPayouts!.map(p => (
                  <div key={p.id} className="rounded-xl bg-surface border border-border p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-content">{fmtMoneyCurrency(p.amount, p.currency)}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-tertiary text-content-secondary border border-border">
                          {METHOD_LABEL[p.method] || p.method}
                        </span>
                        <span className="text-xs text-content-muted">
                          {p.paidAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-content-muted mt-1">
                        For {p.metricsAtPayout.views.toLocaleString()} views
                        {p.metricsAtPayout.videoCount !== undefined && ` · ${p.metricsAtPayout.videoCount} videos`}
                        {p.reference && ` · ${p.reference}`}
                      </p>
                      {p.notes && <p className="text-xs text-content-secondary mt-1 italic">"{p.notes}"</p>}
                    </div>
                    <button onClick={() => {
                      if (confirm(`Remove this ${fmtMoneyCurrency(p.amount, p.currency)} prior payout entry? (This only removes the record — it does not reverse any actual payment you made.)`)) {
                        onRemovePriorPayout(p.id);
                      }
                    }}
                      className="p-1.5 text-content-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                      title="Remove entry">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Net owed summary — only shown if prior payouts exist, since otherwise "Net owed" == gross */}
                {creator.payoutResult && (
                  <div className="rounded-xl bg-orange-500/5 border border-orange-300/40 dark:border-orange-500/25 p-4 mt-2">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Gross owed</p>
                        <p className="text-lg font-bold text-content mt-0.5">{fmtMoneyCurrency(creator.payoutOverride?.amount ?? creator.payoutResult.totalPayout, campaignCurrency(campaign))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Already paid</p>
                        <p className="text-lg font-bold text-content-secondary mt-0.5">−{fmtMoneyCurrency(sumPriorPayouts(creator) + (creator.paidSnapshot?.amount ?? 0), campaignCurrency(campaign))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Net owed now</p>
                        <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-0.5">{fmtMoneyCurrency(netOwed(creator), campaignCurrency(campaign))}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Log Prior Payout modal — opens on click */}
          {showLogPayoutModal && (
            <LogPriorPayoutModal
              creator={creator}
              campaign={campaign}
              onCancel={() => setShowLogPayoutModal(false)}
              onSubmit={entry => {
                onLogPriorPayout(entry);
                setShowLogPayoutModal(false);
              }}
            />
          )}

          {/* Cross-post groups — compact, one row per group. Renders above the videos slider so
               linked content is shown once (not duplicated in the slider below). */}
          {crossPostGroups.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                  <Link2 className="w-3 h-3" /> Cross-posted ({crossPostGroups.length} {crossPostGroups.length === 1 ? 'group' : 'groups'})
                </p>
                <button onClick={() => setShowCrossPostModal(true)}
                  className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                  Manage
                </button>
              </div>
              <div className="rounded-xl border border-orange-300/40 dark:border-orange-500/25 bg-orange-500/[0.04] divide-y divide-orange-300/30 dark:divide-orange-500/20 overflow-hidden">
                {crossPostGroups.map(g => {
                  const platforms = Array.from(new Set(g.videos.map(v => v.platform).filter(Boolean))) as Array<'instagram' | 'tiktok' | 'youtube' | 'twitter'>;
                  return (
                    <div key={g.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{g.label}</div>
                      {/* Overlapping thumbnail stack — visually conveys "linked together" without taking a full row */}
                      <div className="flex -space-x-2 flex-shrink-0">
                        {g.videos.slice(0, 4).map(v => (
                          <div key={v.id} className="relative w-8 h-11 rounded-md overflow-hidden bg-surface-tertiary border border-orange-300/60 dark:border-orange-500/40 ring-1 ring-surface-secondary">
                            {v.thumbnail ? (
                              <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-3 h-3 text-content-muted" />
                              </div>
                            )}
                          </div>
                        ))}
                        {g.videos.length > 4 && (
                          <div className="w-8 h-11 rounded-md bg-surface-tertiary border border-orange-300/60 dark:border-orange-500/40 ring-1 ring-surface-secondary flex items-center justify-center text-[9px] font-bold text-content-muted">
                            +{g.videos.length - 4}
                          </div>
                        )}
                      </div>
                      {/* Platform icons row */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {platforms.map(p => <PlatformIcon key={p} platform={p} size="xs" />)}
                      </div>
                      <p className="text-[11px] text-content-secondary min-w-0 flex-1">
                        <span className="font-semibold text-content">{g.videos.length} copies</span>
                        <span className="text-content-muted"> · </span>
                        <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(g.combinedViews)} combined</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Videos */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-3 gap-3">
              <p className="text-xs font-bold text-content">Videos</p>
              <div className="flex items-center gap-2">
                {/* Retry — only meaningful after a finished load (loaded=true).
                    Manually re-triggers fetchCreatorVideos so a transient
                    Firestore failure can be recovered without closing/reopening
                    the drawer. */}
                {creator.videosLoaded && !creator.videosLoading && (
                  <button onClick={onLoadVideos}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-content-muted hover:text-content bg-surface-tertiary hover:bg-surface-hover rounded-lg border border-border transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Reload
                  </button>
                )}
                {creator.videos.length >= 2 && crossPostGroups.length === 0 && (
                  <button onClick={() => setShowCrossPostModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-content-secondary hover:text-content bg-surface-tertiary hover:bg-surface-hover rounded-lg border border-border transition-colors">
                    <Link2 className="w-3.5 h-3.5" /> Manage cross-posts
                  </button>
                )}
              </div>
            </div>
            {creator.videosLoading ? (
              <div className="flex items-center gap-3 py-6">
                <RefreshCw className="w-4 h-4 text-content-muted animate-spin" />
                <span className="text-sm text-content-muted">Loading {creator.name}'s videos...</span>
              </div>
            ) : standaloneVideos.length > 0 ? (
              <>
                <VideoSliderSection
                  videos={standaloneVideos.map(v => toVideoSubmission(v, creator))}
                  maxVideos={20}
                />
                {hiddenByDate > 0 && (
                  <p className="text-[11px] text-content-muted mt-2 flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" />
                    {hiddenByDate} video{hiddenByDate === 1 ? '' : 's'} hidden — outside the payout date window
                  </p>
                )}
              </>
            ) : windowVideos.length > 0 ? (
              <p className="text-sm text-content-muted py-3">
                All {windowVideos.length} video{windowVideos.length === 1 ? '' : 's'} are shown above as cross-posts.
              </p>
            ) : creator.videosLoaded ? (
              <p className="text-sm text-content-muted py-3">
                {creator.videos.length > 0
                  ? `All ${creator.videos.length} video${creator.videos.length === 1 ? '' : 's'} fall outside the payout date window.`
                  : 'No tracked videos for this creator yet.'}
              </p>
            ) : null}
          </div>

          {/* Adjustments group — pay-from-date and manual override. Both are
              "tweak the engine output" controls; grouping them under one header
              cuts the chrome in half. */}
          <div>
            <p className="text-xs font-bold text-content mb-2">Adjustments</p>
            <div className="rounded-xl bg-surface border border-border-subtle divide-y divide-border-subtle">
              {/* Pay from date */}
              <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs text-content-muted shrink-0">Pay from</span>
                {editingStartDate ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={creator.countVideosFromDate ? creator.countVideosFromDate.toISOString().slice(0, 10) : ''}
                    onBlur={() => setEditingStartDate(false)}
                    onChange={(e) => {
                      const v = e.target.value;
                      onSetStartDate(v ? new Date(v + 'T00:00:00') : undefined);
                      setEditingStartDate(false);
                    }}
                    className="bg-transparent text-xs text-content focus:outline-none ml-auto w-[120px]"
                  />
                ) : creator.countVideosFromDate ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => setEditingStartDate(true)}
                      className="text-xs font-semibold text-content hover:text-orange-500 transition-colors">
                      {creator.countVideosFromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </button>
                    <button onClick={() => onSetStartDate(undefined)}
                      className="text-[11px] text-content-muted hover:text-red-500 transition-colors">Clear</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingStartDate(true)}
                    className="ml-auto text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    Set date
                  </button>
                )}
              </div>
              {/* Manual override */}
              <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs text-content-muted shrink-0">Override</span>
                {creator.payoutOverride ? (
                  <div className="flex items-center gap-2 ml-auto min-w-0">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 truncate">
                      {fmtMoneyExact(creator.payoutOverride.amount)}{creator.payoutOverride.note ? ` — ${creator.payoutOverride.note}` : ''}
                    </span>
                    <button onClick={onClearOverride}
                      className="text-[11px] text-content-muted hover:text-red-500 transition-colors shrink-0">Clear</button>
                  </div>
                ) : showOverrideForm ? (
                  <div className="ml-auto">
                    <OverrideForm
                      onCancel={() => setShowOverrideForm(false)}
                      onSubmit={(amount, note) => { onSetOverride(amount, note); setShowOverrideForm(false); }}
                    />
                  </div>
                ) : (
                  <button onClick={() => setShowOverrideForm(true)}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    <Pencil className="w-3 h-3" /> Set custom amount
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Activity / audit log */}
          {creator.history && creator.history.length > 0 && (
            <div>
              <button onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-xs font-bold text-content hover:text-orange-500 transition-colors">
                <span>Activity <span className="text-content-muted font-normal">({creator.history.length})</span></span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
              {showHistory && (
                <ul className="mt-2 space-y-1.5">
                  {[...creator.history].reverse().map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="text-content-muted whitespace-nowrap">{h.at.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-content-secondary"><span className="font-semibold text-content">{h.action}</span> by {h.by}{h.details ? <span className="text-content-muted"> · {h.details}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Danger zone */}
          <div className="flex justify-end pt-1">
            <button onClick={onRemove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Remove from campaign
            </button>
          </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage cross-posts modal */}
      {showCrossPostModal && (
        <ManageCrossPostsModal
          creator={creator}
          orgId={orgId}
          projectId={projectId}
          campaign={campaign}
          onClose={() => setShowCrossPostModal(false)}
          onVideosChange={onVideosChange}
          onToggleExcludeVideo={onToggleExcludeVideo}
        />
      )}
    </div>
  );
}

// ==================== OVERRIDE FORM ====================

/** Inline form for setting a manual payout override on a creator. */
/** Inline editor for the campaign-level billing period. Anchored to the
 *  Billing Period cell on a payout row; closes on outside-click. Either
 *  date can be left blank to leave that side of the window open. */
function PeriodEditPopover({ start, end, onClose, onSave }: {
  start: Date | undefined;
  end: Date | undefined;
  onClose: () => void;
  onSave: (start: Date | undefined, end: Date | undefined) => void;
}) {
  const toInput = (d: Date | undefined) => d ? d.toISOString().slice(0, 10) : '';
  const fromInput = (s: string): Date | undefined => s ? new Date(s + 'T00:00:00') : undefined;

  const [startStr, setStartStr] = useState(toInput(start));
  const [endStr, setEndStr] = useState(toInput(end));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [onClose]);

  const inp = 'w-full px-2 py-1.5 bg-surface-tertiary border border-border rounded-lg text-content text-xs focus:outline-none focus:ring-2 focus:ring-orange-500';

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-30 w-[260px] rounded-xl bg-surface-secondary border border-border shadow-2xl p-3"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted mb-2">Billing period</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-content-muted mb-1">Start</label>
          <input type="date" value={startStr} onChange={e => setStartStr(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-[10px] text-content-muted mb-1">End</label>
          <input type="date" value={endStr} onChange={e => setEndStr(e.target.value)} className={inp} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 gap-2">
        <button
          onClick={() => { setStartStr(''); setEndStr(''); }}
          className="text-[11px] text-content-muted hover:text-content"
        >
          Clear (all time)
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs text-content-muted hover:text-content"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(fromInput(startStr), fromInput(endStr))}
            className="px-3 py-1 text-xs font-bold text-white bg-orange-500 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function OverrideForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (amount: number, note?: string) => void }) {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [note, setNote] = useState('');

  const inp = 'w-full px-3 py-1.5 bg-surface-tertiary border border-border rounded-lg text-content text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-content-muted';

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2">
        <div className="flex-shrink-0">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-content-muted mb-1">Amount ($)</label>
          <input type="text" inputMode="decimal" autoFocus
            value={amount === undefined ? '' : amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            onChange={e => {
              const raw = e.target.value.replace(/,/g, '');
              if (raw === '') { setAmount(undefined); return; }
              if (!/^\d*\.?\d*$/.test(raw)) return;
              const n = Number(raw);
              if (!isNaN(n) && n >= 0) setAmount(n);
            }}
            placeholder="0.00"
            className={`${inp} w-28`} />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-content-muted mb-1">Note (optional)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="e.g. negotiated bonus"
            className={inp} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1 text-xs font-semibold text-content-muted hover:text-content transition-colors">Cancel</button>
        <button type="button" onClick={() => { if (amount !== undefined && amount >= 0) onSubmit(amount, note.trim() || undefined); }}
          disabled={amount === undefined}
          className="px-3 py-1 text-xs font-semibold rounded-lg bg-orange-500 text-white disabled:opacity-50 hover:bg-orange-600 transition-colors">
          Apply override
        </button>
      </div>
    </div>
  );
}

// ==================== LOG PRIOR PAYOUT MODAL ====================

/** Set of metrics a structure's components read — we show inputs for just these, nothing else. */
function deriveDriverMetrics(structure: PayoutStructure | undefined): { needsVideos: boolean; needsConversions: boolean; metricFields: PayoutMetric[] } {
  if (!structure) return { needsVideos: true, needsConversions: false, metricFields: ['views'] };
  const metricSet = new Set<PayoutMetric>();
  let needsVideos = false;
  let needsConversions = false;
  for (const c of structure.components) {
    switch (c.type) {
      case 'base': case 'flat': break; // no metric
      case 'cpm': metricSet.add((c as any).metric || 'views'); break;
      case 'bonus': metricSet.add(c.condition.metric); break;
      case 'bonus_tiered': metricSet.add((c as any).metric || 'views'); break;
      case 'per_video': needsVideos = true; break;
      case 'conversion': needsConversions = true; break;
    }
  }
  if (metricSet.size === 0 && !needsVideos && !needsConversions) metricSet.add('views');
  return { needsVideos, needsConversions, metricFields: Array.from(metricSet) };
}

/** Build a synthetic CreatorPerformance to run through the engine. For per-video components, we
 *  create N "average" videos so the engine's per-video iteration produces sensible aggregate output.
 *  Perfect for components that operate on totals; approximate but transparent for per-video caps/bonuses. */
function buildSyntheticPerformance(inputs: { views: number; likes: number; comments: number; shares: number; saves: number; videoCount: number; conversions: number }): CreatorPerformance {
  const n = Math.max(1, inputs.videoCount);
  const perVid = {
    views: inputs.videoCount > 0 ? inputs.views / n : 0,
    likes: inputs.videoCount > 0 ? inputs.likes / n : 0,
    comments: inputs.videoCount > 0 ? inputs.comments / n : 0,
    shares: inputs.videoCount > 0 ? inputs.shares / n : 0,
    saves: inputs.videoCount > 0 ? inputs.saves / n : 0,
  };
  const videos: VideoSubmission[] = Array.from({ length: Math.max(0, inputs.videoCount) }, (_, i) => ({
    id: `synthetic_${i}`, url: '', platform: 'tiktok' as const, thumbnail: '',
    title: `Synthetic ${i}`, uploader: '', uploaderHandle: '', status: 'approved' as const,
    views: perVid.views, likes: perVid.likes, comments: perVid.comments,
    shares: perVid.shares, saves: perVid.saves,
    dateSubmitted: new Date(), uploadDate: new Date(),
  }));
  const totalEngagement = inputs.likes + inputs.comments + inputs.shares + inputs.saves;
  return {
    creatorId: 'estimate',
    videoCount: inputs.videoCount,
    totalViews: inputs.views,
    totalLikes: inputs.likes,
    totalComments: inputs.comments,
    totalShares: inputs.shares,
    totalSaves: inputs.saves,
    totalEngagement,
    engagementRate: inputs.views > 0 ? (totalEngagement / inputs.views) * 100 : 0,
    conversions: inputs.conversions,
    videos,
  };
}

/** Modal for logging an off-platform payout. Drives the amount off metric inputs via the real
 *  payout engine (forward-only, same code path as the live owed calculation). The admin can still
 *  override the amount — override is tracked so we can surface "estimate vs actual" discrepancies. */
function LogPriorPayoutModal({ creator, campaign, onCancel, onSubmit }: {
  creator: CampaignCreator;
  campaign: PayoutCampaign;
  onCancel: () => void;
  onSubmit: (entry: Omit<PriorPayoutEntry, 'id' | 'recordedBy' | 'recordedAt'>) => void;
}) {
  const defaultCurrency = campaignCurrency(campaign);
  const hasStructure = !!creator.structure;
  const drivers = deriveDriverMetrics(creator.structure);

  // Current values (defaults for inputs — admin tweaks to reflect values at time of payment)
  const curViews = creator.payoutResult?.performance.totalViews ?? creator.videos.reduce((s, v) => s + v.views, 0);
  const curLikes = creator.payoutResult?.performance.totalLikes ?? creator.videos.reduce((s, v) => s + v.likes, 0);
  const curComments = creator.payoutResult?.performance.totalComments ?? creator.videos.reduce((s, v) => s + v.comments, 0);
  const curShares = creator.payoutResult?.performance.totalShares ?? creator.videos.reduce((s, v) => s + (v.shares || 0), 0);
  const curSaves = creator.payoutResult?.performance.totalSaves ?? creator.videos.reduce((s, v) => s + (v.saves || 0), 0);
  const curVideoCount = creator.videos.length;

  // Driver metric inputs — numeric strings for smoother UX
  const [views, setViews] = useState<string>(String(curViews));
  const [likes, setLikes] = useState<string>(String(curLikes));
  const [comments, setComments] = useState<string>(String(curComments));
  const [shares, setShares] = useState<string>(String(curShares));
  const [saves, setSaves] = useState<string>(String(curSaves));
  const [videoCount, setVideoCount] = useState<string>(String(curVideoCount));
  const [conversions, setConversions] = useState<string>('0');

  // Other fields
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PriorPayoutEntry['method']>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Amount: tracks whether admin overrode the estimate
  const [manualAmount, setManualAmount] = useState<number | undefined>(undefined);
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);

  const inp = 'w-full px-3 py-2 bg-surface-tertiary border border-border rounded-lg text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-content-muted';
  const lbl = 'block text-xs font-semibold uppercase tracking-wider text-content-muted mb-1';

  // Live estimate via the REAL engine — same calc path as the live owed calculation.
  const estimate = (() => {
    if (!creator.structure) return null;
    try {
      const perf = buildSyntheticPerformance({
        views: Number(views) || 0,
        likes: Number(likes) || 0,
        comments: Number(comments) || 0,
        shares: Number(shares) || 0,
        saves: Number(saves) || 0,
        videoCount: Number(videoCount) || 0,
        conversions: Number(conversions) || 0,
      });
      return PayoutCalculationEngine.calculateCreatorPayout('estimate', creator.structure, perf);
    } catch (e) {
      console.error('Estimate failed:', e);
      return null;
    }
  })();

  const estimatedAmount = estimate?.totalPayout ?? 0;
  const effectiveAmount = amountManuallyEdited && manualAmount !== undefined ? manualAmount : estimatedAmount;
  const discrepancy = amountManuallyEdited && manualAmount !== undefined ? manualAmount - estimatedAmount : 0;

  const canSubmit = effectiveAmount > 0;

  const submit = () => {
    if (!canSubmit) return;
    // Persist EVERY driver metric we collected, not just views/likes/comments/videoCount.
    // For structures that pay on shares, saves, or conversions, dropping those values would
    // break the audit trail — an auditor reopening the entry wouldn't be able to reconstruct
    // why the amount is what it is. Only include keys that had a numeric value collected to
    // keep Firestore docs tight (stripUndefined on save also handles zero-vs-missing).
    const metricsAtPayout: PriorPayoutEntry['metricsAtPayout'] = {
      views: Number(views) || 0,
    };
    const likesN = Number(likes); if (Number.isFinite(likesN) && likesN > 0) metricsAtPayout.likes = likesN;
    const commentsN = Number(comments); if (Number.isFinite(commentsN) && commentsN > 0) metricsAtPayout.comments = commentsN;
    const sharesN = Number(shares); if (Number.isFinite(sharesN) && sharesN > 0) metricsAtPayout.shares = sharesN;
    const savesN = Number(saves); if (Number.isFinite(savesN) && savesN > 0) metricsAtPayout.saves = savesN;
    const videoCountN = Number(videoCount); if (Number.isFinite(videoCountN) && videoCountN > 0) metricsAtPayout.videoCount = videoCountN;
    const conversionsN = Number(conversions); if (Number.isFinite(conversionsN) && conversionsN > 0) metricsAtPayout.conversions = conversionsN;

    onSubmit({
      amount: Math.round(effectiveAmount * 100) / 100,
      currency: defaultCurrency,
      paidAt: new Date(paidAt + 'T12:00:00'),
      method,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      metricsAtPayout,
    });
  };

  // Build dynamic input list based on what the structure actually needs.
  const metricInputs: Array<{ key: string; label: string; value: string; setValue: (s: string) => void }> = [];
  if (drivers.metricFields.includes('views')) metricInputs.push({ key: 'views', label: 'Views', value: views, setValue: setViews });
  if (drivers.metricFields.includes('likes')) metricInputs.push({ key: 'likes', label: 'Likes', value: likes, setValue: setLikes });
  if (drivers.metricFields.includes('comments')) metricInputs.push({ key: 'comments', label: 'Comments', value: comments, setValue: setComments });
  if (drivers.metricFields.includes('shares')) metricInputs.push({ key: 'shares', label: 'Shares', value: shares, setValue: setShares });
  if (drivers.metricFields.includes('saves')) metricInputs.push({ key: 'saves', label: 'Saves', value: saves, setValue: setSaves });
  if (drivers.needsVideos || drivers.metricFields.includes('videos_posted')) metricInputs.push({ key: 'videoCount', label: 'Videos', value: videoCount, setValue: setVideoCount });
  if (drivers.needsConversions) metricInputs.push({ key: 'conversions', label: 'Conversions', value: conversions, setValue: setConversions });
  if (metricInputs.length === 0) metricInputs.push({ key: 'views', label: 'Views', value: views, setValue: setViews });

  // Warn when per-video iteration may produce approximate results (perVideo caps w/ stacking).
  const hasPerVideoApprox = !!creator.structure?.components.some(c =>
    (c.type === 'bonus' || c.type === 'bonus_tiered') && (c as any).caps?.perVideo
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-surface-secondary border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border-subtle sticky top-0 bg-surface-secondary z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-content">Log a prior payout</h3>
              <p className="text-xs text-content-muted mt-0.5">
                Record a payout you made to <span className="font-semibold text-content">{creator.name}</span> outside the platform.
              </p>
            </div>
            <button onClick={onCancel} className="p-2 text-content-muted hover:text-content rounded-lg hover:bg-surface-hover">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Metrics at time of payment — drives the estimated amount */}
          {hasStructure ? (
            <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-content">Metrics at time of payment</p>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Drives estimate</span>
              </div>
              <p className="text-[11px] text-content-muted mb-3">
                Prefilled with current counts. Change these to what the creator had WHEN you paid them.
              </p>
              <div className={`grid gap-3 ${metricInputs.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {metricInputs.map(({ key, label, value, setValue }) => (
                  <div key={key}>
                    <label className={lbl}>{label}</label>
                    <input type="number" min="0" value={value}
                      onChange={e => { setValue(e.target.value); if (!amountManuallyEdited) { /* estimate recalcs via the effect */ } }}
                      className={inp} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 dark:border-amber-500/30 p-3 text-xs text-content-secondary">
              This creator has no payout structure assigned. Enter the amount manually below.
            </div>
          )}

          {/* Amount — live-driven by engine, overridable */}
          <div className="rounded-xl bg-orange-500/5 border border-orange-300/40 dark:border-orange-500/25 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className={lbl}>Amount paid ({defaultCurrency.toUpperCase()})</label>
              {amountManuallyEdited && (
                <button type="button"
                  onClick={() => { setManualAmount(undefined); setAmountManuallyEdited(false); }}
                  className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                  Reset to estimate
                </button>
              )}
            </div>
            <input type="text" inputMode="decimal"
              value={amountManuallyEdited && manualAmount !== undefined
                ? manualAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                : estimatedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              onChange={e => {
                const raw = e.target.value.replace(/,/g, '');
                if (raw === '') { setManualAmount(undefined); setAmountManuallyEdited(false); return; }
                if (!/^\d*\.?\d*$/.test(raw)) return;
                const n = Number(raw);
                if (!isNaN(n) && n >= 0) { setManualAmount(n); setAmountManuallyEdited(true); }
              }}
              className={`${inp} text-2xl font-bold`} />
            {amountManuallyEdited && Math.abs(discrepancy) > 0.01 && (
              <p className={`text-[11px] mt-2 ${Math.abs(discrepancy) > estimatedAmount * 0.1 ? 'text-amber-600 dark:text-amber-400' : 'text-content-muted'}`}>
                {discrepancy > 0 ? '▲' : '▼'} {fmtMoneyCurrency(Math.abs(discrepancy), defaultCurrency)} vs. estimate ({fmtMoneyCurrency(estimatedAmount, defaultCurrency)})
              </p>
            )}
          </div>

          {/* Breakdown preview */}
          {estimate && estimate.componentBreakdown.length > 0 && (
            <div className="rounded-xl bg-surface border border-border-subtle overflow-hidden">
              <div className="px-4 py-2 border-b border-border-subtle bg-surface-tertiary/50">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">How the estimate was calculated</p>
              </div>
              <div className="p-3 space-y-2">
                {estimate.componentBreakdown.map((comp, i) => {
                  const meta = COMPONENT_META[comp.type as PayoutComponentType] || COMPONENT_META.base;
                  return (
                    <div key={i} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase text-content-muted">{meta.label}</span>
                          <span className="font-medium text-content">{comp.componentName}</span>
                        </div>
                        <p className="text-content-muted mt-0.5">{comp.details}</p>
                      </div>
                      <span className="font-bold text-content flex-shrink-0">{fmtMoneyExact(comp.amount)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-border-subtle">
                  <span className="text-xs font-semibold text-content">Estimated total</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">{fmtMoneyExact(estimatedAmount)}</span>
                </div>
              </div>
              {hasPerVideoApprox && (
                <div className="px-3 py-2 border-t border-border-subtle bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠ Per-video bonus caps use aggregate averages for the estimate. Verify the amount matches what you actually paid — override if needed.
                </div>
              )}
            </div>
          )}

          {/* Payment details */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Date paid</label>
              <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Method</label>
              <select value={method} onChange={e => setMethod(e.target.value as any)} className={inp}>
                {(Object.entries(METHOD_LABEL) as Array<[PriorPayoutEntry['method'], string]>).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Reference (optional)</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="Bank txn ID, Venmo note, etc." className={inp} />
          </div>

          <div>
            <label className={lbl}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any context for future reference..." className={inp} />
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle flex items-center justify-between sticky bottom-0 bg-surface-secondary">
          <p className="text-xs text-content-muted">
            {amountManuallyEdited ? 'Amount manually overridden' : 'Amount auto-calculated from structure'}
            {!hasStructure && ' · no structure assigned'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={submit} disabled={!canSubmit}>
              <Check className="w-4 h-4 mr-1.5" /> Log {fmtMoneyCurrency(effectiveAmount, defaultCurrency)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ==================== CROSS-POST VIDEO CARD (with hover preview) ====================

/** Compact video card used inside ManageCrossPostsModal columns. On hover, overlays the
 *  thumbnail with the actual playing video so admins can confirm visually that two videos
 *  are the same content before linking them. Falls back to thumbnail if no playable source. */
function CrossPostVideoCard({ v, isSelected, groupLabel, disabled, isExcluded, onClick, onToggleExclude }: {
  v: TrackedVideo;
  isSelected: boolean;
  groupLabel: string | null;
  disabled: boolean;
  isExcluded: boolean;
  onClick: () => void;
  onToggleExclude: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLButtonElement>(null);

  const youtubeId = v.platform === 'youtube' ? extractYouTubeId(v.url) : null;
  const tiktokId = v.platform === 'tiktok' ? extractTikTokId(v.url) : null;
  const igShortcode = v.platform === 'instagram' ? extractInstagramShortcode(v.url) : null;
  const canPreview = !previewError && (!!v.mediaUrl || !!youtubeId || !!tiktokId || !!igShortcode);

  const handleMouseEnter = () => {
    if (cardRef.current) setCardRect(cardRef.current.getBoundingClientRect());
    setHovered(true);
  };

  // Floating popup geometry — 9:16 at a size where platform chrome looks reasonable.
  const POPUP_W = 240;
  const POPUP_H = 427;
  let popupLeft = 0;
  let popupTop = 0;
  if (cardRect && typeof window !== 'undefined') {
    // Prefer right side of card; fall back to left if that'd overflow viewport.
    const rightSide = cardRect.right + 12;
    popupLeft = (rightSide + POPUP_W + 16 <= window.innerWidth)
      ? rightSide
      : Math.max(8, cardRect.left - POPUP_W - 12);
    popupTop = Math.max(8, Math.min(cardRect.top, window.innerHeight - POPUP_H - 8));
  }

  return (
    <>
      <button ref={cardRef} onClick={onClick} type="button" disabled={disabled}
        className={`relative w-full flex gap-2.5 p-2 pr-8 rounded-xl border-2 transition-all text-left disabled:opacity-50 ${
          isSelected
            ? 'border-orange-500 bg-orange-500/5 ring-2 ring-orange-500/20'
            : isExcluded
              ? 'border-border-subtle bg-surface opacity-60'
              : groupLabel
                ? 'border-orange-300/60 dark:border-orange-500/40 bg-surface'
                : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover'
        }`}>
        {/* Static thumbnail — hover ONLY here triggers the preview popup, not the title/meta/checkbox area. */}
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setHovered(false)}
          className="w-[64px] h-[114px] flex-shrink-0 bg-surface-tertiary rounded-lg overflow-hidden relative"
        >
          {v.thumbnail ? (
            <img src={v.thumbnail} alt="" className={`w-full h-full object-cover ${isExcluded ? 'grayscale' : ''}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-content-muted">
              <Film className="w-5 h-5" />
            </div>
          )}
          {groupLabel && (
            <div className="absolute top-1 left-1 z-10 px-1 py-0.5 rounded bg-orange-500 text-white text-[9px] font-bold flex items-center gap-0.5">
              <Link2 className="w-2 h-2" /> {groupLabel}
            </div>
          )}
          {/* Small play indicator in corner if preview is available */}
          {canPreview && (
            <div className="absolute bottom-1 right-1 z-10 w-4 h-4 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <div className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[4px] border-l-white ml-0.5" />
            </div>
          )}
        </div>
        {/* Meta */}
        <div className="flex-1 min-w-0 flex flex-col py-0.5">
          <p className={`text-xs line-clamp-3 leading-tight ${isExcluded ? 'line-through text-content-muted' : 'text-content'}`}>{v.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {isExcluded && <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-red-500/10 text-red-500">Excluded</span>}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <p className="text-[11px] text-content-muted flex items-center gap-1">
              <Eye className="w-3 h-3" /> {fmt(v.views)}
            </p>
            {/* Exclude toggle — stop event propagation so the card's select click doesn't also fire */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleExclude(); }}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                isExcluded
                  ? 'text-content-muted hover:text-content hover:bg-surface-hover'
                  : 'text-red-500/70 hover:text-red-500 hover:bg-red-500/10'
              }`}
              title={isExcluded ? 'Include in payout' : 'Exclude from payout'}
            >
              {isExcluded ? 'Include' : 'Exclude'}
            </button>
          </div>
        </div>
        {/* Selection indicator */}
        <div className={`absolute top-2 right-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          isSelected
            ? 'bg-orange-500 border-orange-500'
            : 'bg-surface border-border-strong'
        }`}>
          {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </div>
      </button>

      {/* Floating preview popup — portaled to body to escape the modal's overflow-hidden.
           Rendered at 240×427 so platform chrome (TT watermark, IG header, etc.) stays in
           a reasonable proportion instead of dominating a tiny 64px frame. */}
      {hovered && canPreview && cardRect && createPortal(
        <div
          className="fixed z-[9999] rounded-xl overflow-hidden shadow-2xl ring-2 ring-orange-500 bg-black pointer-events-none animate-fade-in"
          style={{
            top: `${popupTop}px`,
            left: `${popupLeft}px`,
            width: `${POPUP_W}px`,
            height: `${POPUP_H}px`,
          }}
        >
          {v.mediaUrl ? (
            <video
              src={v.mediaUrl}
              autoPlay muted loop playsInline preload="metadata"
              className="w-full h-full object-cover"
              onError={() => setPreviewError(true)}
            />
          ) : youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media"
              title={v.title}
            />
          ) : tiktokId ? (
            <iframe
              src={`https://www.tiktok.com/player/v1/${tiktokId}?autoplay=1&muted=1&loop=1&music_info=0&description=0&controls=0&rel=0&native_context_menu=0&closed_caption=0`}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              title={v.title}
            />
          ) : igShortcode ? (
            <iframe
              src={`https://www.instagram.com/p/${igShortcode}/embed/`}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media"
              title={v.title}
            />
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
}

// ==================== MANAGE CROSS-POSTS MODAL ====================

/** Modal for manually grouping a creator's videos as cross-posts (same content, different platforms).
 *  Writes `crossPostGroupId` to each selected VideoDoc and notifies parent so payout recalcs. */
function ManageCrossPostsModal({ creator, orgId, projectId, campaign, onClose, onVideosChange, onToggleExcludeVideo }: {
  creator: CampaignCreator; orgId: string; projectId: string;
  campaign: PayoutCampaign;
  onClose: () => void; onVideosChange: (videos: TrackedVideo[]) => void;
  onToggleExcludeVideo: (videoId: string) => void;
}) {
  const excludedIds = new Set(creator.excludedVideoIds || []);
  // Only videos inside the active payout window are cross-post candidates — if a video can't
  // count toward payout, there's no reason to show it here (and it'd be confusing to let admins
  // group videos that will never surface in the calculation). Respects both campaign-level and
  // per-creator start dates.
  const visibleVideos = videosInDateWindow(creator, campaign);
  const hiddenByDateCount = creator.videos.length - visibleVideos.length;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Per-column sort. Default is post date (newest first) — what admins usually want
  // for "most recent cross-posts rise to the top so I can group them fast".
  const [sortKey, setSortKey] = useState<'uploadDate' | 'dateAdded' | 'views' | 'likes'>('uploadDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, saving]);

  // Lock body scroll while the modal is open so wheel events on non-scrollable
  // areas (header, instructions, empty columns) don't bleed through to the page behind.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Assign human-readable group labels (A, B, C...) so grouped videos are visually associated
  const groupLabels = (() => {
    const labels = new Map<string, string>();
    let i = 0;
    for (const v of visibleVideos) {
      if (v.crossPostGroupId && !labels.has(v.crossPostGroupId)) {
        labels.set(v.crossPostGroupId, String.fromCharCode(65 + (i % 26)));
        i++;
      }
    }
    return labels;
  })();

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedVideos = visibleVideos.filter(v => selectedIds.has(v.id));
  const canLink = selectedVideos.length >= 2;
  const canUngroup = selectedVideos.some(v => !!v.crossPostGroupId);

  const writeGroupId = async (videoIds: string[], groupId: string | null) => {
    await Promise.all(videoIds.map(id => {
      const ref = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', id);
      return updateDoc(ref, { crossPostGroupId: groupId });
    }));
  };

  const handleLink = async () => {
    if (!canLink) return;
    setSaving(true);
    try {
      const newGroupId = `xp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const ids = Array.from(selectedIds);
      await writeGroupId(ids, newGroupId);
      const nextVideos = creator.videos.map(v =>
        selectedIds.has(v.id) ? { ...v, crossPostGroupId: newGroupId } : v
      );
      onVideosChange(nextVideos);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Failed to link cross-post:', err);
      alert('Failed to link cross-post: ' + (err?.message || 'Check console'));
    } finally {
      setSaving(false);
    }
  };

  const handleUngroup = async () => {
    if (!canUngroup) return;
    setSaving(true);
    try {
      const ids = selectedVideos.filter(v => v.crossPostGroupId).map(v => v.id);
      await writeGroupId(ids, null);
      const toClear = new Set(ids);
      const nextVideos = creator.videos.map(v =>
        toClear.has(v.id) ? { ...v, crossPostGroupId: undefined } : v
      );
      onVideosChange(nextVideos);
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Failed to ungroup:', err);
      alert('Failed to ungroup: ' + (err?.message || 'Check console'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !saving && onClose()}>
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border max-w-6xl w-full max-h-[85vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Manage cross-posts</p>
              <p className="font-semibold text-content truncate">{creator.name}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving}
            className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions + sort bar */}
        <div className="px-5 py-4 border-b border-border-subtle bg-surface-tertiary/40">
          <p className="text-sm text-content-secondary leading-relaxed">
            Select videos that are the <span className="font-semibold text-content">same content posted across different platforms</span>, then click <span className="font-semibold text-content">Link as cross-post</span>.
          </p>
          <p className="text-xs text-content-muted mt-1.5">
            How cross-posts affect payout math depends on each component's "Cross-post handling" policy in the assigned template.
          </p>
          {hiddenByDateCount > 0 && (
            <p className="text-xs text-content-muted mt-1.5 flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3" />
              Showing {visibleVideos.length} of {creator.videos.length} videos — {hiddenByDateCount} hidden (outside the payout date window)
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Sort by</span>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)}
              className="px-2.5 py-1 text-xs bg-surface border border-border rounded-lg text-content focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="uploadDate">Post date</option>
              <option value="dateAdded">Date added</option>
              <option value="views">Views</option>
              <option value="likes">Likes</option>
            </select>
            <button type="button" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              title={sortDir === 'desc' ? 'Highest / newest first' : 'Lowest / oldest first'}
              className="px-2 py-1 text-xs bg-surface border border-border rounded-lg text-content-secondary hover:text-content hover:bg-surface-hover transition-colors">
              {sortDir === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        {/* Platform columns — one per platform, each independently scrollable.
             Makes cross-post matching obvious: find the same content across columns.
             Container is itself a flex-col with min-h-0 so percentage/flex heights cascade properly down to each column body's overflow-y-auto. */}
        <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col">
          {visibleVideos.length === 0 ? (
            <div className="text-center py-12 text-content-muted text-sm">
              {creator.videos.length > 0
                ? `All ${creator.videos.length} video${creator.videos.length === 1 ? '' : 's'} fall outside the payout date window.`
                : 'No videos for this creator.'}
            </div>
          ) : (() => {
            // Group videos by platform, preserving the user's preferred column order (TT → IG → YT → X).
            // Always show TikTok, Instagram, YouTube as columns even if empty — easier to see platform gaps.
            // Twitter/X only appears if there's at least one twitter video.
            const order: Array<TrackedVideo['platform']> = ['tiktok', 'instagram', 'youtube', 'twitter'];
            const platformLabels: Record<TrackedVideo['platform'], string> = {
              tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', twitter: 'X',
            };
            const byPlatform: Record<string, TrackedVideo[]> = {};
            for (const v of visibleVideos) {
              (byPlatform[v.platform] ||= []).push(v);
            }
            // Sort each column's videos by the active sort key + direction.
            // Dates fall back to 0 so undated videos land at the bottom in desc order.
            const getSortValue = (v: TrackedVideo): number => {
              if (sortKey === 'uploadDate') return v.uploadDate?.getTime?.() ?? 0;
              if (sortKey === 'dateAdded') return v.dateAdded?.getTime?.() ?? 0;
              if (sortKey === 'likes') return v.likes || 0;
              return v.views || 0;
            };
            const dirMul = sortDir === 'desc' ? -1 : 1;
            for (const p of Object.keys(byPlatform)) {
              byPlatform[p].sort((a, b) => (getSortValue(a) - getSortValue(b)) * dirMul);
            }
            const columns = order.filter(p => p !== 'twitter' || (byPlatform[p]?.length || 0) > 0);

            return (
              // flex-1 + min-h-0 makes this row consume the full container height (instead of falling
              // back to content-based sizing, which broke the column body scroll).
              <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
                {columns.map(platform => {
                  const videos = byPlatform[platform] || [];
                  return (
                    // min-h-0 is critical — without it a flex child defaults to `min-height: auto` which
                    // makes it grow to fit content, defeating the overflow-y-auto on the body below.
                    <div key={platform} className="flex flex-col flex-1 min-w-0 min-h-0 bg-surface-tertiary/40 rounded-xl border border-border-subtle overflow-hidden">
                      {/* Column header */}
                      <div className="px-3 py-2.5 border-b border-border-subtle bg-surface/60 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlatformIcon platform={platform} size="sm" />
                          <p className="text-xs font-bold uppercase tracking-wider text-content">{platformLabels[platform]}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-content-muted px-1.5 py-0.5 rounded bg-surface-tertiary">{videos.length}</span>
                      </div>
                      {/* Column body — min-h-0 lets this scrollable flex child shrink below content so overflow-y-auto actually engages */}
                      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-2">
                        {videos.length === 0 ? (
                          <div className="text-center py-10 text-xs text-content-muted">No {platformLabels[platform]} videos</div>
                        ) : (
                          videos.map(v => (
                            <CrossPostVideoCard
                              key={v.id}
                              v={v}
                              isSelected={selectedIds.has(v.id)}
                              groupLabel={v.crossPostGroupId ? (groupLabels.get(v.crossPostGroupId) ?? null) : null}
                              disabled={saving}
                              isExcluded={excludedIds.has(v.id)}
                              onClick={() => toggle(v.id)}
                              onToggleExclude={() => onToggleExcludeVideo(v.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Action bar */}
        <div className="p-4 border-t border-border-subtle bg-surface/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="text-sm text-content">
            <span className="font-semibold">{selectedIds.size}</span>{' '}
            <span className="text-content-muted">selected</span>
            {!canLink && selectedIds.size === 1 && (
              <span className="ml-3 text-xs text-content-muted">Select 2+ to link</span>
            )}
          </div>
          <div className="flex gap-2">
            {canUngroup && (
              <Button variant="secondary" onClick={handleUngroup} disabled={saving}>
                <Link2 className="w-4 h-4 mr-1.5 rotate-45" /> Ungroup
              </Button>
            )}
            <Button onClick={handleLink} disabled={!canLink || saving}>
              {saving ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Link2 className="w-4 h-4 mr-1.5" />}
              Link as cross-post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== STRUCTURE PICKER SLIDE-OVER ====================

function StructurePickerSlideOver({ creator, orgId, projectId, userId, onClose, onAssign }: {
  creator: CampaignCreator; orgId: string; projectId: string; userId: string;
  onClose: () => void; onAssign: (s: PayoutStructure) => void;
}) {
  // Close on escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      {/* panel */}
      <div className="w-full max-w-2xl bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3 min-w-0">
            {creator.photoURL
              ? <img src={creator.photoURL} className="w-10 h-10 rounded-full object-cover ring-2 ring-border-subtle" alt="" />
              : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold">
                  {creator.name.charAt(0).toUpperCase()}
                </div>}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Payout structure</p>
              <p className="font-semibold text-content truncate">for {creator.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-0">
          <PayoutStructureManager
            orgId={orgId}
            projectId={projectId}
            userId={userId}
            selectedStructureId={creator.structure?.id}
            onSelect={onAssign}
          />
        </div>
      </div>
    </div>
  );
}

// ==================== ADD CREATORS SLIDE-OVER ====================

/**
 * Stacked-avatar identity for the AddCreators slide-over rows. Different shape
 * than `CreatorAccountStack` (which derives accounts from videos in a campaign
 * context); here we already have the resolved `TrackedAccount[]` from the link
 * join. Keeps the same visual treatment (3 max, +N overflow, platform corner
 * badge sitting outside the rounded clip) so the whole app feels consistent.
 */
function AddCreatorsAccountStack({ accounts, fallbackChar, max = 3 }: {
  accounts: TrackedAccount[]; fallbackChar: string; max?: number;
}) {
  if (accounts.length === 0) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center ring-2 ring-border-subtle text-content-muted text-sm font-semibold flex-shrink-0">
        {fallbackChar}
      </div>
    );
  }
  const visible = accounts.slice(0, max);
  const overflow = accounts.length - visible.length;
  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {visible.map((a, i) => (
        <div key={`${a.id}-${i}`} className="relative w-10 h-10" title={`@${a.username} · ${a.platform}`}>
          <div className="w-full h-full rounded-full ring-2 ring-border-subtle bg-surface-tertiary overflow-hidden">
            <AccountAvatar
              pic={a.profilePicture}
              fallbackChar={(a.username || a.platform).charAt(0).toUpperCase()}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-surface ring-2 ring-surface flex items-center justify-center">
            <PlatformIcon platform={a.platform as any} size="sm" />
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative w-10 h-10 rounded-full ring-2 ring-border-subtle bg-surface-tertiary flex items-center justify-center text-xs font-semibold text-content-secondary"
          title={`${overflow} more account${overflow === 1 ? '' : 's'}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function AddCreatorsSlideOver({ campaign, orgId, projectId, onClose, onAdd }: {
  campaign: PayoutCampaign; orgId: string; projectId: string;
  onClose: () => void; onAdd: (creators: CampaignCreator[]) => void;
}) {
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  // creatorId → list of linked tracked-account objects, used to render the
  // stacked-avatar identity in each row (matching the rest of the app).
  const [creatorAccounts, setCreatorAccounts] = useState<Map<string, TrackedAccount[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!orgId || !projectId) return;
    setLoading(true);
    // Fan out the three reads in parallel: creator profiles, the creator↔account
    // join table, and all tracked accounts. Then build the
    // creatorId → TrackedAccount[] map locally so the row UI can render the
    // same stacked-avatar identity it shows everywhere else.
    Promise.all([
      CreatorLinksService.getAllCreators(orgId, projectId),
      getDocs(collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks')),
      AccountsDataService.getTrackedAccounts(orgId, projectId).catch(() => [] as TrackedAccount[]),
    ])
      .then(([creators, linksSnap, accounts]) => {
        setAllCreators(creators);
        const accById = new Map(accounts.map(a => [a.id, a]));
        const map = new Map<string, TrackedAccount[]>();
        linksSnap.docs.forEach(d => {
          const link = d.data() as { creatorId: string; accountId: string };
          const acc = accById.get(link.accountId);
          if (!acc) return;
          const arr = map.get(link.creatorId) || [];
          arr.push(acc);
          map.set(link.creatorId, arr);
        });
        setCreatorAccounts(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, projectId]);

  const existingIds = new Set(campaign.creators.map(c => c.id));
  const available = allCreators.filter(c => !existingIds.has(c.id));
  const filtered = available.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.displayName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const toggle = (id: string) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };
  const toggleAll = () => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(c => c.id))); };

  const handleAdd = () => {
    const selected = available.filter(c => selectedIds.has(c.id));
    const newCreators: CampaignCreator[] = selected.map(c => ({
      id: c.id, name: c.displayName || 'Unknown', email: c.email || '', photoURL: c.photoURL,
      videos: [], videosLoaded: false, videosLoading: false, payoutStatus: 'not_calculated',
    }));
    onAdd(newCreators);
  };

  const inp = 'w-full px-3.5 py-2.5 bg-surface-tertiary border border-border rounded-xl text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-content-muted transition-all';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="w-full max-w-2xl bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Add creators</p>
              <p className="font-semibold text-content truncate">to {campaign.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 border-b border-border-subtle">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} className={`${inp} pl-9`} placeholder="Search by name or email..." />
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-content-muted">{filtered.length} available · <span className="text-content font-semibold">{selectedIds.size}</span> selected</span>
              <button onClick={toggleAll} className="font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                {selectedIds.size === filtered.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-16 text-content-muted text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading creators...
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-surface-tertiary flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-content-muted" />
              </div>
              <p className="text-sm font-medium text-content">Every creator is already here</p>
              <p className="text-xs text-content-muted mt-1 max-w-xs mx-auto">All creators in this project are already part of this campaign.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-content-muted text-sm">No match for "{search}"</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {filtered.map(c => {
                const sel = selectedIds.has(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(c.id)} type="button"
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${sel ? 'bg-orange-500/5' : 'hover:bg-surface-hover'}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-orange-500 border-orange-500 scale-105' : 'border-border-strong'}`}>
                      {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <AddCreatorsAccountStack
                      accounts={creatorAccounts.get(c.id) || []}
                      fallbackChar={(c.displayName || c.email || 'C').charAt(0).toUpperCase()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-content truncate">{c.displayName}</p>
                        <CreatorPlatformBubbles items={creatorAccounts.get(c.id) || []} max={3} />
                      </div>
                      <p className="text-xs text-content-muted truncate">{c.email || 'No email'}</p>
                    </div>
                    <p className="text-xs text-content-muted flex items-center gap-1 flex-shrink-0">
                      <Users className="w-3 h-3" /> {c.linkedAccountsCount || 0}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {available.length > 0 && (
          <div className="p-5 border-t border-border-subtle bg-surface/95 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-content">
                <span className="font-semibold">{selectedIds.size}</span>{' '}
                <span className="text-content-muted">selected</span>
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleAdd} disabled={selectedIds.size === 0}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== BADGES ====================


function PayoutStatusBadge({ status }: { status: string }) {
  const m: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    not_calculated: { cls: 'bg-surface-tertiary text-content border border-border-strong shadow-[0_2px_0_0_var(--border-strong,#475569)]', label: 'Not calculated', icon: <DollarSign className="w-3 h-3" /> },
    pending:        { cls: 'bg-orange-500 text-white border border-orange-700 shadow-[0_2px_0_0_#c2410c]',                                label: 'Pending',        icon: <Clock className="w-3 h-3" /> },
    approved:       { cls: 'bg-emerald-500 text-white border border-emerald-700 shadow-[0_2px_0_0_#047857]',                              label: 'Approved',       icon: <CheckCircle2 className="w-3 h-3" /> },
    paid:           { cls: 'bg-content text-surface border border-content shadow-[0_2px_0_0_#000]',                                       label: 'Paid',           icon: <Wallet className="w-3 h-3" /> },
  };
  const v = m[status] || m.not_calculated;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap ${v.cls}`}>
      {v.icon}{v.label}
    </span>
  );
}
