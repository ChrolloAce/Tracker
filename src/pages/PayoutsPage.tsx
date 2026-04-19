import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, ChevronLeft, ChevronDown, Users, DollarSign, Check, Eye, Search, RefreshCw,
  CircleDollarSign, Coins, Banknote, Gift, Layers, Target, Film, Wallet, Sparkles, CheckCircle2,
  X, ArrowRight, Settings2, Heart, Clock, AlertCircle, UserPlus, Trash2, Link2, Pencil, Calendar,
  Lock, CalendarDays, Loader2,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import Sidebar from '../components/layout/Sidebar';
import { Button } from '../components/ui/Button';
import PayoutStructureManager from '../components/PayoutStructureManager';
import VideoSliderSection from '../components/VideoSliderSection';
import { PayoutCalculationEngine, type PayoutCalculationResult } from '../services/PayoutCalculationEngine';
import type { PayoutStructure, PayoutComponentType } from '../types/payouts';
import type { Creator } from '../types/firestore';
import type { VideoSubmission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import CreatorLinksService from '../services/CreatorLinksService';
import SuperAdminService from '../services/SuperAdminService';
import AdminStripeService from '../services/AdminStripeService';
import { PlatformIcon } from '../components/ui/PlatformIcon';

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
  return Array.from(videoMap.values()).sort((a, b) => b.views - a.views);
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

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function toVideoSubmission(v: TrackedVideo, creator: CampaignCreator): VideoSubmission {
  return {
    id: v.id, url: v.url, platform: v.platform, thumbnail: v.thumbnail || '',
    title: v.title, uploader: creator.name, uploaderHandle: v.uploaderHandle || '',
    uploaderProfilePicture: v.uploaderProfilePicture || creator.photoURL,
    views: v.views, likes: v.likes, comments: v.comments,
    shares: v.shares, saves: v.saves,
    status: 'approved', dateSubmitted: new Date(), uploadDate: new Date(),
    crossPostGroupId: v.crossPostGroupId,
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
  const perf = PayoutCalculationEngine.calculatePerformance(cr.id, videos.map(v => toVideoSubmission(v, cr)));
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
      })),
    };
  });
}

// ==================== MAIN PAGE ====================

type View = 'list' | 'create' | 'detail';

export default function PayoutsPage() {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [campaigns, setCampaigns] = useState<PayoutCampaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<PayoutCampaign | null>(null);
  // Mirrors activeCampaign so updateCampaign can read the latest state synchronously — needed when
  // multiple parallel callers (e.g. all CreatorCards auto-loading videos on mount) each produce an
  // update from the same render's props. Without this, stale-closure reads cause last-write-wins
  // clobbering of sibling creators' data.
  const activeCampaignRef = useRef<PayoutCampaign | null>(null);
  activeCampaignRef.current = activeCampaign;
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

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

  const openCampaign = (c: PayoutCampaign) => { setActiveCampaign(c); setView('detail'); };
  const goBack = () => { setView('list'); setActiveCampaign(null); };

  const persistCampaign = async (u: PayoutCampaign) => {
    setSaveStatus('saving'); setSaveError(null);
    try {
      const newUpdatedAt = await saveCampaignToFirestore(orgId, projectId, u, userId);
      // Bump the in-memory baseline so the NEXT save's stale-write check uses this write's
      // timestamp, not the load timestamp. IMPORTANT: merge into `prev` rather than `u` —
      // another update may have fired while we awaited the save, and re-applying `u` would
      // clobber it (causing visible flicker/stutter). We only own the timestamp here.
      setActiveCampaign(prev => (prev && prev.id === u.id ? { ...prev, lastLoadedUpdatedAt: newUpdatedAt } : prev));
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

  // Accepts either a raw campaign (legacy call sites) or a functional updater. The updater form is
  // required for any flow that may fire in parallel (e.g. N CreatorCards loading videos at once):
  // it reads from `activeCampaignRef.current`, which we mutate eagerly below so subsequent calls
  // in the same tick see each other's work. `skipPersist` is for transient UI state (videos
  // loading/loaded) that is never written to Firestore anyway — skipping the save avoids pointless
  // stale-write-guard errors during page load.
  const updateCampaign = (
    u: PayoutCampaign | ((prev: PayoutCampaign) => PayoutCampaign),
    options?: { skipPersist?: boolean },
  ) => {
    const prev = activeCampaignRef.current;
    if (!prev) return;
    const next = typeof u === 'function' ? u(prev) : u;
    activeCampaignRef.current = next;
    setActiveCampaign(next);
    setCampaigns(cs => cs.map(c => c.id === next.id ? next : c));
    if (!options?.skipPersist) persistCampaign(next);
  };

  const createCampaign = (c: PayoutCampaign) => {
    setCampaigns([c, ...campaigns]);
    openCampaign(c);
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
        <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto">
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
          {/* Platform balance — always visible at the top. Admins need to know funds are sufficient
              before marking creators paid. Hidden on the create view to avoid visual clutter during
              campaign setup. */}
          {view !== 'create' && <PlatformBalanceCard payoutsEnabled={payoutsEnabled} />}
          {view === 'list' && <CampaignListView campaigns={campaigns} loading={loadingCampaigns} onOpen={openCampaign} onCreate={() => setView('create')} />}
          {view === 'create' && <CreateCampaignView orgId={orgId} projectId={projectId} userId={userId} onCreated={createCampaign} onCancel={goBack} />}
          {view === 'detail' && activeCampaign && <CampaignDetailView campaign={activeCampaign} orgId={orgId} projectId={projectId} userId={userId} actingUser={actingUser} payoutsEnabled={payoutsEnabled} onUpdate={updateCampaign} onBack={goBack} />}
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
function PlatformBalanceCard({ payoutsEnabled }: { payoutsEnabled: boolean }) {
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
        {/* Top-up button is hidden entirely when payouts are disabled — there's nothing useful
            to do with it yet. Admin still sees the balance (read-only) for informational purposes. */}
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

// ==================== LIST VIEW ====================

function CampaignListView({ campaigns, loading, onOpen, onCreate }: {
  campaigns: PayoutCampaign[]; loading: boolean; onOpen: (c: PayoutCampaign) => void; onCreate: () => void;
}) {
  const agg = campaigns.reduce(
    (acc, c) => {
      const total = c.creators.reduce((s, cr) => s + (cr.payoutResult?.totalPayout || 0), 0);
      const approved = c.creators.filter(cr => cr.payoutStatus === 'approved' || cr.payoutStatus === 'paid').length;
      const pending = c.creators.filter(cr => cr.payoutStatus === 'pending').length;
      const paid = c.creators.filter(cr => cr.payoutStatus === 'paid').length;
      acc.total += total;
      acc.creators += c.creators.length;
      acc.approved += approved;
      acc.pending += pending;
      acc.paid += paid;
      if (c.status === 'active') acc.active += 1;
      return acc;
    },
    { total: 0, creators: 0, approved: 0, pending: 0, paid: 0, active: 0 }
  );

  return (
    <div className="space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-gradient-to-br from-orange-500/10 via-surface-secondary to-surface-secondary p-6 md:p-8 shadow-theme">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-[0_4px_0_0_#c2410c]">
              <CircleDollarSign className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-content tracking-tight">Creator Payouts</h1>
              <p className="text-sm md:text-base text-content-muted mt-1 max-w-xl">
                Build payout campaigns, assign flexible structures (CPM, flat, bonuses, tiers), and approve creator payments — all in one place.
              </p>
            </div>
          </div>
          <Button onClick={onCreate} size="lg" className="shrink-0">
            <Plus className="w-5 h-5 mr-2" /> New Campaign
          </Button>
        </div>

        {/* KPI strip inside hero */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          <HeroStat icon={<Wallet className="w-4 h-4" />} label="Total Payouts" value={fmtMoney(agg.total)} tint="emerald" />
          <HeroStat icon={<Sparkles className="w-4 h-4" />} label="Active Campaigns" value={String(agg.active)} tint="orange" />
          <HeroStat icon={<Users className="w-4 h-4" />} label="Creators" value={String(agg.creators)} tint="neutral" />
          <HeroStat icon={<Clock className="w-4 h-4" />} label="Pending Approval" value={String(agg.pending)} tint="orange" />
        </div>
      </div>

      {/* CAMPAIGNS */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-content">Campaigns</h2>
          <p className="text-xs text-content-muted mt-0.5">{campaigns.length} total</p>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-surface-secondary border border-border-subtle animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyPayoutsState onCreate={onCreate} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} onOpen={() => onOpen(c)} />)}
        </div>
      )}
    </div>
  );
}

function HeroStat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: 'emerald' | 'orange' | 'neutral' }) {
  const tints = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    neutral: 'bg-surface-tertiary text-content-secondary',
  } as const;
  return (
    <div className="rounded-2xl bg-surface border border-border-subtle p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tints[tint]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">{label}</p>
        <p className="text-xl font-bold text-content leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onOpen }: { campaign: PayoutCampaign; onOpen: () => void }) {
  const total = campaign.creators.reduce((s, cr) => s + (cr.payoutResult?.totalPayout || 0), 0);
  const totalViews = campaign.creators.reduce(
    (s, cr) => s + videosInDateWindow(cr, campaign).reduce((s2, v) => s2 + v.views, 0),
    0,
  );
  const approved = campaign.creators.filter(cr => cr.payoutStatus === 'approved' || cr.payoutStatus === 'paid').length;
  const pct = campaign.creators.length > 0 ? (approved / campaign.creators.length) * 100 : 0;

  return (
    <button onClick={onOpen}
      className="text-left group relative overflow-hidden rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-5 hover:border-orange-300 dark:hover:border-orange-500/40 hover:-translate-y-0.5 transition-all">
      {/* accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-content text-base truncate group-hover:text-orange-500 transition-colors">{campaign.name}</h3>
          {campaign.description && <p className="text-xs text-content-muted mt-0.5 line-clamp-1">{campaign.description}</p>}
        </div>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      {/* Big total */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Total Payout</p>
          <p className={`text-3xl font-bold leading-none mt-1 ${total > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-content'}`}>
            {fmtMoney(total)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-content-muted">{fmt(totalViews)} views</p>
          <p className="text-xs text-content-muted mt-0.5">{campaign.creators.length} creators</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-content-muted mb-1.5">
          <span className="font-medium">Approval progress</span>
          <span><span className="text-content font-semibold">{approved}</span> / {campaign.creators.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Avatars */}
      {campaign.creators.length > 0 && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-subtle">
          <div className="flex -space-x-2">
            {campaign.creators.slice(0, 5).map(cr => cr.photoURL
              ? <img key={cr.id} src={cr.photoURL} className="w-7 h-7 rounded-full border-2 border-surface-secondary object-cover" alt="" />
              : <div key={cr.id} className="w-7 h-7 rounded-full border-2 border-surface-secondary bg-surface-tertiary flex items-center justify-center"><Users className="w-3 h-3 text-content-muted" /></div>
            )}
          </div>
          {campaign.creators.length > 5 && <span className="text-xs text-content-muted">+{campaign.creators.length - 5}</span>}
          <div className="flex-1" />
          <span className="text-xs text-content-muted flex items-center gap-1 group-hover:text-orange-500 transition-colors">
            Open <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      )}
    </button>
  );
}

function EmptyPayoutsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-surface-secondary border border-border-subtle shadow-theme py-20 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_6px_0_0_#c2410c]">
          <CircleDollarSign className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-content mb-2">Start paying your creators</h3>
        <p className="text-sm text-content-muted max-w-md mx-auto mb-7">
          Build a payout campaign, pick the creators you want to pay, choose a structure like CPM or flat fee, and approve in one click.
        </p>
        <Button onClick={onCreate} size="lg">
          <Plus className="w-5 h-5 mr-2" /> Create your first campaign
        </Button>
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId && projectId) {
      setLoading(true);
      CreatorLinksService.getAllCreators(orgId, projectId).then(setAllCreators).catch(console.error).finally(() => setLoading(false));
    }
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
                  return (
                    <button key={c.id} onClick={() => toggle(c.id)} type="button"
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${sel ? 'bg-orange-500/5' : 'hover:bg-surface-hover'}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-orange-500 border-orange-500 scale-105' : 'border-border-strong'}`}>
                        {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </div>
                      {c.photoURL
                        ? <img src={c.photoURL} className="w-10 h-10 rounded-full object-cover ring-2 ring-border-subtle" alt="" />
                        : <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center ring-2 ring-border-subtle"><Users className="w-5 h-5 text-content-muted" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-content truncate">{c.displayName}</p>
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

// ==================== DETAIL VIEW ====================

function CampaignDetailView({ campaign, orgId, projectId, userId, actingUser, payoutsEnabled, onUpdate, onBack }: {
  campaign: PayoutCampaign; orgId: string; projectId: string; userId: string;
  /** Identifier (email preferred, uid fallback) written to each audit-log entry. */
  actingUser: string;
  /** When false, Pay + bulk-pay buttons are disabled (Stripe Connect not live yet). Approve
   *  still works — no money moves during approval. */
  payoutsEnabled: boolean;
  onUpdate: (
    u: PayoutCampaign | ((prev: PayoutCampaign) => PayoutCampaign),
    options?: { skipPersist?: boolean },
  ) => void;
  onBack: () => void;
}) {
  const [pickerForCreator, setPickerForCreator] = useState<string | null>(null);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  // Which Pay flow is active (single-creator confirmation vs bulk confirmation). Null = no modal.
  const [payConfirmFor, setPayConfirmFor] = useState<string | null>(null);
  const [showBulkPayConfirm, setShowBulkPayConfirm] = useState(false);

  const totalEarnings = campaign.creators.reduce((s, c) => s + (c.payoutResult?.totalPayout || 0), 0);
  const totalViews = campaign.creators.reduce(
    (s, c) => s + videosInDateWindow(c, campaign).reduce((s2, v) => s2 + v.views, 0),
    0,
  );
  const approvedCount = campaign.creators.filter(c => c.payoutStatus === 'approved' || c.payoutStatus === 'paid').length;
  const pendingCount = campaign.creators.filter(c => c.payoutStatus === 'pending').length;
  const withStructure = campaign.creators.filter(c => c.structure).length;
  const calculable = campaign.creators.some(c => c.structure && c.videos.length > 0);

  const loadCreatorVideos = useCallback(async (creatorId: string) => {
    if (!orgId || !projectId) return;
    // Functional updater form — when N creator cards mount at once they each end up running this
    // in parallel. Reading from `prev` (the ref-backed latest state) means each update composes on
    // top of the previous creator's load rather than clobbering it. `skipPersist` also keeps these
    // transient loading/loaded/videos fields out of Firestore — they aren't persisted by the save
    // function anyway, so writing would only generate stale-write-guard errors.
    let shouldLoad = false;
    onUpdate(prev => {
      const cr = prev.creators.find(c => c.id === creatorId);
      if (!cr || cr.videosLoaded || cr.videosLoading) return prev;
      shouldLoad = true;
      return { ...prev, creators: prev.creators.map(c => c.id === creatorId ? { ...c, videosLoading: true } : c) };
    }, { skipPersist: true });
    if (!shouldLoad) return;
    try {
      const videos = await fetchCreatorVideos(orgId, projectId, creatorId);
      onUpdate(prev => ({
        ...prev,
        creators: prev.creators.map(c =>
          c.id === creatorId
            ? recalcCreator({ ...c, videos, videosLoaded: true, videosLoading: false }, prev)
            : c,
        ),
      }), { skipPersist: true });
    } catch {
      onUpdate(prev => ({
        ...prev,
        creators: prev.creators.map(c =>
          c.id === creatorId ? { ...c, videosLoaded: true, videosLoading: false } : c,
        ),
      }), { skipPersist: true });
    }
  }, [orgId, projectId, onUpdate]);

  const calculatePayouts = () => {
    onUpdate({ ...campaign, creators: campaign.creators.map(c => recalcCreator(c, campaign)) });
  };

  // Mutation helpers now double as audit loggers — every change writes a one-line history entry.
  // `actingUser` arrives from the parent (email preferred, uid fallback).
  const approveCreator = (id: string) => onUpdate({
    ...campaign,
    creators: campaign.creators.map(c => c.id === id ? logAction({ ...c, payoutStatus: 'approved' as const }, 'Approved', actingUser) : c),
  });
  const approveAll = () => onUpdate({
    ...campaign,
    creators: campaign.creators.map(c => c.payoutStatus === 'pending' ? logAction({ ...c, payoutStatus: 'approved' as const }, 'Approved (bulk)', actingUser) : c),
  });
  /** Final dollar amount a creator will be paid — manual override wins, otherwise engine result. */
  const finalAmountFor = (c: CampaignCreator): number => {
    if (c.payoutOverride?.amount !== undefined) return c.payoutOverride.amount;
    return c.payoutResult?.totalPayout ?? 0;
  };

  /** Build an immutable payment record. Captures amount, currency, actor, timestamp, and an
   *  idempotency key that will later be forwarded to Stripe so a retry can't double-charge. */
  const buildPaidSnapshot = (c: CampaignCreator): NonNullable<CampaignCreator['paidSnapshot']> => ({
    amount: finalAmountFor(c),
    currency: campaignCurrency(campaign),
    paidAt: new Date(),
    paidBy: actingUser,
    idempotencyKey: buildIdempotencyKey(campaign.id, c.id),
  });

  const markCreatorPaid = async (id: string) => {
    const creator = campaign.creators.find(c => c.id === id);
    if (!creator) return;
    // Idempotency guard against same-tab double-clicks — only 'approved' rows can advance.
    if (creator.payoutStatus !== 'approved') {
      alert(`This payout is ${creator.payoutStatus}, not approved. Nothing to pay.`);
      return;
    }
    const amount = finalAmountFor(creator);
    const minimum = campaignMinimumPayout(campaign);
    const currency = campaignCurrency(campaign);
    if (amount < minimum) {
      alert(`Cannot mark paid — amount ${fmtMoneyCurrency(amount, currency)} is below the minimum payout of ${fmtMoneyCurrency(minimum, currency)} for this campaign.`);
      return;
    }
    // Stripe gate — block mark-paid until the creator has finished Connect onboarding. Phase 2
    // will actually trigger a Stripe Transfer here; for now we just verify the creator is ready
    // so we don't pile up paid-snapshots for creators who can't actually receive money.
    try {
      const stripeStatus = await AdminStripeService.fetchCreatorStatus({ orgId, projectId, creatorId: id });
      if (stripeStatus.status !== 'complete') {
        const reason = stripeStatus.status === 'none' ? 'has not started Stripe onboarding'
                     : stripeStatus.status === 'pending' ? 'has not finished Stripe onboarding'
                     : 'has an issue with their Stripe account (action required)';
        alert(`Cannot mark paid — ${creator.name} ${reason}. Ask them to complete setup in their creator portal.`);
        return;
      }
    } catch (err: any) {
      alert(`Stripe status check failed: ${err?.message || 'unknown error'}. Try again.`);
      return;
    }

    // 1. Build + persist the snapshot with stripeTransferStatus='pending'. We flip the primary
    //    status to 'paid' up front so the state machine stays simple — the transfer outcome
    //    lives on the snapshot sub-field, not a fourth top-level status value. If the transfer
    //    fails, the row shows "Transfer failed · Retry"; status stays 'paid' so revert-paid is
    //    the escape hatch if the admin gives up.
    const baseSnapshot = buildPaidSnapshot(creator);
    const pendingSnapshot = { ...baseSnapshot, stripeTransferStatus: 'pending' as const };
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === id
        ? logAction(
            { ...c, payoutStatus: 'paid' as const, paidSnapshot: pendingSnapshot },
            'Marked paid', actingUser,
            `${fmtMoneyCurrency(baseSnapshot.amount, baseSnapshot.currency)} · ${baseSnapshot.idempotencyKey}`,
          )
        : c),
    });

    // 2. Fire the Stripe Transfer. The snapshot's idempotencyKey is forwarded as Stripe's
    //    `Idempotency-Key` header inside /api/stripe/transfer, so any retry returns the
    //    original transfer — can't double-charge.
    try {
      const result = await AdminStripeService.transferToCreator({ orgId, projectId, campaignId: campaign.id, creatorId: id });
      onUpdate({
        ...campaign,
        creators: campaign.creators.map(c => c.id === id
          ? logAction(
              { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferId: result.transferId, stripeTransferStatus: 'paid', stripeTransferError: undefined } },
              'Stripe transfer created', actingUser,
              `${result.transferId}${result.alreadyTransferred ? ' (idempotent — already existed)' : ''}`,
            )
          : c),
      });
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown transfer error';
      onUpdate({
        ...campaign,
        creators: campaign.creators.map(c => c.id === id
          ? logAction(
              { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferStatus: 'failed', stripeTransferError: errMsg } },
              'Stripe transfer FAILED', actingUser, errMsg,
            )
          : c),
      });
    }
  };

  /** Retry a failed transfer. Safe — reuses the snapshot's idempotencyKey so Stripe will
   *  return the original transfer if it actually succeeded on a previous attempt (rare but
   *  possible on network timeouts). If it was a real failure, Stripe runs the logic fresh. */
  const retryTransferForCreator = async (id: string) => {
    const creator = campaign.creators.find(c => c.id === id);
    if (!creator?.paidSnapshot) return;
    if (creator.paidSnapshot.stripeTransferStatus !== 'failed') {
      alert('Nothing to retry — this transfer is not in a failed state.');
      return;
    }
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === id
        ? { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferStatus: 'pending' as const, stripeTransferError: undefined } }
        : c),
    });
    try {
      const result = await AdminStripeService.transferToCreator({ orgId, projectId, campaignId: campaign.id, creatorId: id });
      onUpdate({
        ...campaign,
        creators: campaign.creators.map(c => c.id === id
          ? logAction(
              { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferId: result.transferId, stripeTransferStatus: 'paid', stripeTransferError: undefined } },
              'Stripe transfer retried — OK', actingUser, result.transferId,
            )
          : c),
      });
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown transfer error';
      onUpdate({
        ...campaign,
        creators: campaign.creators.map(c => c.id === id
          ? logAction(
              { ...c, paidSnapshot: { ...c.paidSnapshot!, stripeTransferStatus: 'failed', stripeTransferError: errMsg } },
              'Stripe transfer retry FAILED', actingUser, errMsg,
            )
          : c),
      });
    }
  };

  const markAllApprovedPaid = async () => {
    const currency = campaignCurrency(campaign);
    const minimum = campaignMinimumPayout(campaign);

    // Pre-flight: collect the approved creators, then check Stripe status in parallel. This is
    // the pre-money checkpoint — we want loud, visible rejection for anyone not ready rather
    // than silently skipping them.
    const approved = campaign.creators.filter(c => c.payoutStatus === 'approved');
    const belowMinimum: string[] = [];
    const eligibleForStripeCheck: CampaignCreator[] = [];
    for (const c of approved) {
      const amt = finalAmountFor(c);
      if (amt < minimum) {
        belowMinimum.push(`${c.name}: ${fmtMoneyCurrency(amt, currency)}`);
      } else {
        eligibleForStripeCheck.push(c);
      }
    }

    // Fan out Stripe status checks in parallel. Phase 2's transfer endpoint re-verifies
    // server-side so even if this client cache is stale the money path stays safe.
    let statusByCreatorId = new Map<string, 'none' | 'pending' | 'restricted' | 'complete'>();
    try {
      const results = await Promise.all(
        eligibleForStripeCheck.map(async c => {
          const r = await AdminStripeService.fetchCreatorStatus({ orgId, projectId, creatorId: c.id });
          return { id: c.id, name: c.name, status: r.status };
        }),
      );
      statusByCreatorId = new Map(results.map(r => [r.id, r.status]));
    } catch (err: any) {
      alert(`Stripe status check failed: ${err?.message || 'unknown error'}. Try again.`);
      return;
    }
    const stripeNotReady = eligibleForStripeCheck
      .filter(c => statusByCreatorId.get(c.id) !== 'complete')
      .map(c => `${c.name}: ${statusByCreatorId.get(c.id) ?? 'unknown'}`);
    const readyIds = new Set(
      eligibleForStripeCheck
        .filter(c => statusByCreatorId.get(c.id) === 'complete')
        .map(c => c.id),
    );

    if (belowMinimum.length + stripeNotReady.length > 0) {
      const goAhead = confirm(
        `${belowMinimum.length + stripeNotReady.length} creator${belowMinimum.length + stripeNotReady.length === 1 ? '' : 's'} will be SKIPPED:\n\n` +
        (belowMinimum.length > 0 ? `Below ${fmtMoneyCurrency(minimum, currency)} minimum:\n${belowMinimum.join('\n')}\n\n` : '') +
        (stripeNotReady.length > 0 ? `Stripe not ready:\n${stripeNotReady.join('\n')}\n\n` : '') +
        `Continue with the ${readyIds.size} that will be paid?`,
      );
      if (!goAhead) return;
    }
    if (readyIds.size === 0) return;

    // 1. Flip all eligible creators to 'paid' with transferStatus='pending' and snapshot. This
    //    is one write covering everyone so the UI updates in a single transition.
    const snapshotsByCreatorId = new Map<string, NonNullable<CampaignCreator['paidSnapshot']>>();
    const nextCreators = campaign.creators.map(c => {
      if (!readyIds.has(c.id)) return c;
      const base = buildPaidSnapshot(c);
      const snapshot = { ...base, stripeTransferStatus: 'pending' as const };
      snapshotsByCreatorId.set(c.id, snapshot);
      return logAction(
        { ...c, payoutStatus: 'paid' as const, paidSnapshot: snapshot },
        'Marked paid (bulk)', actingUser,
        `${fmtMoneyCurrency(base.amount, base.currency)} · ${base.idempotencyKey}`,
      );
    });
    onUpdate({ ...campaign, creators: nextCreators });

    // 2. Fan out Stripe transfers in parallel. Each one resolves independently — one failure
    //    doesn't block the others. All use their own idempotencyKey baked into the snapshot.
    const transferResults = await Promise.allSettled(
      Array.from(readyIds).map(async id => {
        const r = await AdminStripeService.transferToCreator({ orgId, projectId, campaignId: campaign.id, creatorId: id });
        return { id, ...r };
      }),
    );

    // 3. Merge all transfer outcomes into a single state update so we don't thrash renders.
    //    Built from THE CURRENT state via the functional setActiveCampaign + onUpdate pattern
    //    to avoid clobbering concurrent edits.
    const outcomeById = new Map<string, { transferId?: string; error?: string }>();
    for (let i = 0; i < transferResults.length; i++) {
      const id = Array.from(readyIds)[i];
      const outcome = transferResults[i];
      if (outcome.status === 'fulfilled') {
        outcomeById.set(id, { transferId: outcome.value.transferId });
      } else {
        outcomeById.set(id, { error: outcome.reason?.message || 'Unknown transfer error' });
      }
    }
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => {
        const outcome = outcomeById.get(c.id);
        if (!outcome || !c.paidSnapshot) return c;
        if (outcome.transferId) {
          return logAction(
            { ...c, paidSnapshot: { ...c.paidSnapshot, stripeTransferId: outcome.transferId, stripeTransferStatus: 'paid', stripeTransferError: undefined } },
            'Stripe transfer created (bulk)', actingUser, outcome.transferId,
          );
        }
        return logAction(
          { ...c, paidSnapshot: { ...c.paidSnapshot, stripeTransferStatus: 'failed', stripeTransferError: outcome.error } },
          'Stripe transfer FAILED (bulk)', actingUser, outcome.error,
        );
      }),
    });
  };

  // Reverse transitions — both confirmed since they alter audit-logged state.
  const unapproveCreator = (id: string) => {
    if (!confirm('Un-approve this payout and move it back to pending? This is recorded in the audit log.')) return;
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === id ? logAction({ ...c, payoutStatus: 'pending' as const }, 'Un-approved', actingUser) : c),
    });
  };
  const revertPaidCreator = (id: string) => {
    const creator = campaign.creators.find(c => c.id === id);
    // Phase 2 will harden this: if `stripeTransferId` is set, the money already left the platform
    // account and a UI revert would desync reconciliation. For now Stripe isn't wired, so the
    // snapshot is purely local — we can clear it freely.
    if (creator?.paidSnapshot?.stripeTransferId) {
      alert('Cannot revert — a Stripe transfer has already settled for this payout. Use Stripe dashboard to issue a refund/reversal.');
      return;
    }
    if (!confirm('Revert this payout from paid back to approved? The paid-snapshot record will be cleared. Recorded in the audit log.')) return;
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === id ? logAction({ ...c, payoutStatus: 'approved' as const, paidSnapshot: undefined }, 'Reverted from paid', actingUser) : c),
    });
  };
  const assignStructure = (cid: string, s: PayoutStructure) => {
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === cid ? logAction(recalcCreator({ ...c, structure: s }, campaign), 'Structure assigned', actingUser, s.name) : c),
    });
    setPickerForCreator(null);
  };
  const setOverride = (cid: string, amount: number, note?: string) => {
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === cid
        ? logAction(recalcCreator({ ...c, payoutOverride: { amount, ...(note ? { note } : {}) } }, campaign), 'Set manual override', actingUser, `$${amount.toFixed(2)}${note ? ` · ${note}` : ''}`)
        : c),
    });
  };
  const clearOverride = (cid: string) => {
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === cid
        ? logAction(recalcCreator({ ...c, payoutOverride: undefined }, campaign), 'Cleared manual override', actingUser)
        : c),
    });
  };
  const setCreatorStartDate = (cid: string, date: Date | undefined) => {
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => c.id === cid
        ? logAction(recalcCreator({ ...c, countVideosFromDate: date }, campaign), date ? 'Set payout start date' : 'Cleared payout start date', actingUser, date ? date.toLocaleDateString() : undefined)
        : c),
    });
  };
  const toggleExcludeVideo = (cid: string, videoId: string) => {
    onUpdate({
      ...campaign,
      creators: campaign.creators.map(c => {
        if (c.id !== cid) return c;
        const current = c.excludedVideoIds || [];
        const willExclude = !current.includes(videoId);
        const next = willExclude ? [...current, videoId] : current.filter(id => id !== videoId);
        return logAction(recalcCreator({ ...c, excludedVideoIds: next }, campaign), willExclude ? 'Excluded video' : 'Re-included video', actingUser, videoId);
      }),
    });
  };
  const removeCreator = (id: string) => {
    if (!confirm('Remove this creator from the campaign? Their tracked videos and payouts in other campaigns are untouched.')) return;
    onUpdate({ ...campaign, creators: campaign.creators.filter(c => c.id !== id) });
  };
  const addCreators = (newOnes: CampaignCreator[]) => {
    onUpdate({ ...campaign, creators: [...campaign.creators, ...newOnes] });
    setShowAddCreator(false);
  };
  const editCampaignMeta = (patch: Partial<Pick<PayoutCampaign, 'name' | 'description' | 'status' | 'startDate' | 'endDate' | 'currency' | 'minimumPayout'>>) => {
    const next: PayoutCampaign = { ...campaign, ...patch };
    // Recalc every creator since date-window changes can move videos in/out of eligibility.
    onUpdate({ ...next, creators: next.creators.map(c => recalcCreator(c, next)) });
  };

  const pickerCreator = pickerForCreator ? campaign.creators.find(c => c.id === pickerForCreator) : null;

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-content-muted hover:text-content transition-colors text-sm group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to campaigns
      </button>

      {/* HERO with big total */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-secondary via-surface-secondary to-orange-500/5 border border-border-subtle shadow-theme">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <CampaignStatusBadge status={campaign.status} />
              <span className="text-xs text-content-muted">Created {campaign.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {(campaign.startDate || campaign.endDate) && (
                <span className="text-xs text-content-muted">· Window: {campaign.startDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) || '—'} to {campaign.endDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) || '—'}</span>
              )}
              <span className="text-xs text-content-muted">· {campaignCurrency(campaign).toUpperCase()} · min {fmtMoneyCurrency(campaignMinimumPayout(campaign), campaignCurrency(campaign))}</span>
              <button onClick={() => setShowEditCampaign(true)}
                className="inline-flex items-center gap-1 text-xs text-content-muted hover:text-content transition-colors">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-content tracking-tight">{campaign.name}</h1>
            {campaign.description && <p className="text-sm text-content-muted mt-2 max-w-2xl">{campaign.description}</p>}
          </div>

          <div className="shrink-0 flex flex-col md:items-end">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Total to pay out</p>
            <p className="text-5xl md:text-6xl font-bold text-emerald-600 dark:text-emerald-500 leading-none mt-1">
              {fmtMoney(totalEarnings)}
            </p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DetailKPI icon={<Users className="w-5 h-5" />} label="Creators" value={String(campaign.creators.length)} tint="neutral" />
        <DetailKPI icon={<Eye className="w-5 h-5" />} label="Total Views" value={fmt(totalViews)} tint="neutral" />
        <DetailKPI icon={<Settings2 className="w-5 h-5" />} label="With Structure" value={`${withStructure} / ${campaign.creators.length}`} tint="orange" />
        <DetailKPI icon={<CheckCircle2 className="w-5 h-5" />} label="Approved" value={`${approvedCount} / ${campaign.creators.length}`} tint="emerald" />
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-4">
        <Button onClick={calculatePayouts} disabled={!calculable}>
          <Sparkles className="w-4 h-4 mr-1.5" /> Calculate Payouts
        </Button>
        {pendingCount > 0 && (
          <button onClick={approveAll} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white shadow-[0_2px_0_0_#047857] hover:shadow-[0_1px_0_0_#047857] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all">
            <CheckCircle2 className="w-4 h-4" /> Approve all ({pendingCount})
          </button>
        )}
        {campaign.creators.filter(c => c.payoutStatus === 'approved').length > 0 && (
          <button
            onClick={() => setShowBulkPayConfirm(true)}
            disabled={!payoutsEnabled}
            title={payoutsEnabled ? undefined : 'Disabled until Stripe Connect platform is activated'}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white shadow-[0_2px_0_0_#047857] hover:shadow-[0_1px_0_0_#047857] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_2px_0_0_#047857] disabled:hover:translate-y-0"
          >
            <Wallet className="w-4 h-4" /> Pay all {campaign.creators.filter(c => c.payoutStatus === 'approved').length} approved
          </button>
        )}
        <div className="flex-1" />
        {!calculable && withStructure < campaign.creators.length && (
          <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Assign structures to {campaign.creators.length - withStructure} more creator{campaign.creators.length - withStructure === 1 ? '' : 's'} to calculate
          </p>
        )}
      </div>

      {/* Creator rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-content">Creators</h2>
            <p className="text-xs text-content-muted mt-0.5">{campaign.creators.length} total</p>
          </div>
          <Button size="sm" onClick={() => setShowAddCreator(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Add creators
          </Button>
        </div>
        {campaign.creators.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-surface-secondary border border-dashed border-border-subtle">
            <Users className="w-8 h-8 mx-auto text-content-muted mb-2" />
            <p className="text-sm font-medium text-content">No creators in this campaign yet</p>
            <p className="text-xs text-content-muted mt-0.5 mb-4">Add creators to start assigning payout structures.</p>
            <Button size="sm" onClick={() => setShowAddCreator(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add creators
            </Button>
          </div>
        )}
        {campaign.creators.map(creator => (
          <CreatorCard
            key={creator.id}
            creator={creator}
            orgId={orgId}
            projectId={projectId}
            campaign={campaign}
            onLoadVideos={() => loadCreatorVideos(creator.id)}
            onApprove={() => approveCreator(creator.id)}
            onMarkPaid={() => setPayConfirmFor(creator.id)}
            onUnapprove={() => unapproveCreator(creator.id)}
            onRevertPaid={() => revertPaidCreator(creator.id)}
            onRetryTransfer={() => retryTransferForCreator(creator.id)}
            payoutsEnabled={payoutsEnabled}
            onOpenPicker={() => setPickerForCreator(creator.id)}
            onRemove={() => removeCreator(creator.id)}
            onSetOverride={(amount, note) => setOverride(creator.id, amount, note)}
            onClearOverride={() => clearOverride(creator.id)}
            onSetStartDate={(date) => setCreatorStartDate(creator.id, date)}
            onToggleExcludeVideo={(videoId) => toggleExcludeVideo(creator.id, videoId)}
            onVideosChange={(videos) => onUpdate({
              ...campaign,
              creators: campaign.creators.map(c =>
                c.id === creator.id ? recalcCreator({ ...c, videos }, campaign) : c
              ),
            })}
          />
        ))}
      </div>

      {/* Slide-over structure picker */}
      {pickerCreator && (
        <StructurePickerSlideOver
          creator={pickerCreator}
          orgId={orgId}
          projectId={projectId}
          userId={userId}
          onClose={() => setPickerForCreator(null)}
          onAssign={s => assignStructure(pickerCreator.id, s)}
        />
      )}

      {/* Slide-over: add creators to existing campaign */}
      {showAddCreator && (
        <AddCreatorsSlideOver
          campaign={campaign}
          orgId={orgId}
          projectId={projectId}
          onClose={() => setShowAddCreator(false)}
          onAdd={addCreators}
        />
      )}

      {/* Edit campaign modal — name, description, status, date window */}
      {showEditCampaign && (
        <EditCampaignModal
          campaign={campaign}
          onClose={() => setShowEditCampaign(false)}
          onSave={(patch) => { editCampaignMeta(patch); setShowEditCampaign(false); }}
        />
      )}

      {/* Single-creator pay confirmation. Only opened after the Pay button click — the actual
          transfer fires when the admin clicks Confirm. Pre-flight checks still run inside
          markCreatorPaid so this modal is purely consent; it can't bypass validation. */}
      {payConfirmFor && (() => {
        const c = campaign.creators.find(cr => cr.id === payConfirmFor);
        if (!c) return null;
        const amount = c.payoutOverride?.amount ?? c.payoutResult?.totalPayout ?? 0;
        return (
          <PayConfirmModal
            title={`Pay ${c.name}`}
            amount={amount}
            currency={campaignCurrency(campaign)}
            bodyLines={[
              `You're about to send ${c.name} ${fmtMoneyCurrency(amount, campaignCurrency(campaign))} from your Maktub Stripe balance.`,
              `Stripe will move the funds to their connected account, then release to their bank within 1–2 business days.`,
              `This is recorded in the audit log and cannot be undone from here once the transfer settles — reversals would require the Stripe dashboard.`,
            ]}
            onCancel={() => setPayConfirmFor(null)}
            onConfirm={() => { setPayConfirmFor(null); markCreatorPaid(c.id); }}
          />
        );
      })()}

      {/* Bulk pay confirmation — same UX but for "Pay all approved". The handler does its own
          pre-flight filtering so over-minimum / Stripe-not-ready creators get surfaced as
          skipped AFTER confirmation; this modal just gets consent for the bulk action itself. */}
      {showBulkPayConfirm && (() => {
        const approved = campaign.creators.filter(cr => cr.payoutStatus === 'approved');
        const approxTotal = approved.reduce((s, cr) => s + (cr.payoutOverride?.amount ?? cr.payoutResult?.totalPayout ?? 0), 0);
        return (
          <PayConfirmModal
            title={`Pay all ${approved.length} approved creator${approved.length === 1 ? '' : 's'}`}
            amount={approxTotal}
            currency={campaignCurrency(campaign)}
            bodyLines={[
              `About to pay ${approved.length} creator${approved.length === 1 ? '' : 's'} — total ${fmtMoneyCurrency(approxTotal, campaignCurrency(campaign))} from your Maktub Stripe balance.`,
              `Each creator's payment is independent. Anyone below the campaign's minimum payout or with incomplete Stripe setup will be skipped and shown in a follow-up screen.`,
              `Transfers settle to creator banks within 1–2 business days. Reversals would require the Stripe dashboard.`,
            ]}
            onCancel={() => setShowBulkPayConfirm(false)}
            onConfirm={() => { setShowBulkPayConfirm(false); markAllApprovedPaid(); }}
          />
        );
      })()}
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

function DetailKPI({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: 'neutral' | 'orange' | 'emerald' }) {
  const tints = {
    neutral: 'bg-surface-tertiary text-content-secondary',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  } as const;
  return (
    <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tints[tint]}`}>{icon}</div>
      <p className="text-2xl font-bold text-content mt-3 leading-tight">{value}</p>
      <p className="text-xs text-content-muted mt-0.5">{label}</p>
    </div>
  );
}

// ==================== CREATOR CARD ====================

function CreatorCard({ creator, orgId, projectId, campaign, onLoadVideos, onApprove, onMarkPaid, onUnapprove, onRevertPaid, onRetryTransfer, payoutsEnabled, onOpenPicker, onRemove, onSetOverride, onClearOverride, onSetStartDate, onToggleExcludeVideo, onVideosChange }: {
  creator: CampaignCreator;
  orgId: string; projectId: string;
  campaign: PayoutCampaign;
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCrossPostModal, setShowCrossPostModal] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState(false);

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
  const crossPostGroupCount = crossPostGroups.length;

  useEffect(() => {
    if (!creator.videosLoaded && !creator.videosLoading) onLoadVideos();
  }, [creator.videosLoaded, creator.videosLoading]);

  // Chip row + expanded slider show only videos inside the active payout window (campaign dates
  // combined with creator.countVideosFromDate). Excluded videos are kept in the slider so the admin
  // can re-include them, but out-of-window videos disappear entirely — they won't ever count.
  const windowVideos = videosInDateWindow(creator, campaign);
  const hiddenByDate = creator.videos.length - windowVideos.length;
  // Videos already shown in the cross-post groups section above shouldn't be duplicated in the slider.
  const crossPostedIds = new Set(crossPostGroups.flatMap(g => g.videos.map(v => v.id)));
  const standaloneVideos = windowVideos.filter(v => !crossPostedIds.has(v.id));
  const creatorViews = windowVideos.reduce((s, v) => s + v.views, 0);
  const creatorLikes = windowVideos.reduce((s, v) => s + v.likes, 0);
  const hasStructure = !!creator.structure;
  const hasPayout = !!creator.payoutResult;

  return (
    <div className="rounded-2xl bg-surface-secondary border border-border-subtle shadow-theme overflow-hidden transition-all">
      {/* Main row */}
      <div className="p-5 flex items-center gap-4">
        {/* Avatar */}
        {creator.photoURL
          ? <img src={creator.photoURL} className="w-12 h-12 rounded-full object-cover ring-2 ring-border-subtle flex-shrink-0" alt="" />
          : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 text-white font-semibold">
              {creator.name.charAt(0).toUpperCase()}
            </div>}

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-content truncate">{creator.name}</p>
          <p className="text-xs text-content-muted truncate">{creator.email || 'No email'}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Structure chip */}
            {hasStructure ? (
              <button onClick={onOpenPicker} className="group/chip inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-300/50 dark:border-orange-500/30 hover:bg-orange-500/15 transition-colors">
                <Settings2 className="w-3 h-3" /> {creator.structure!.name}
                <span className="text-content-muted group-hover/chip:text-orange-500 transition-colors">• change</span>
              </button>
            ) : (
              <button onClick={onOpenPicker} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-300/60 dark:border-orange-500/30 hover:bg-orange-500/20 transition-colors">
                <Plus className="w-3 h-3" /> Choose payout structure
              </button>
            )}
            {/* Per-creator payout start-date chip. Useful when a creator posted videos before
                joining this campaign that were already paid elsewhere. Editing mode swaps the
                chip for a native date input that commits on change. */}
            {editingStartDate ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-tertiary border border-border">
                <CalendarDays className="w-3 h-3 text-content-muted" />
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
                  className="bg-transparent text-content text-[11px] focus:outline-none w-[110px]"
                />
              </span>
            ) : creator.countVideosFromDate ? (
              <span className="group/chip inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-300/50 dark:border-orange-500/30">
                <button onClick={() => setEditingStartDate(true)} className="inline-flex items-center gap-1.5 hover:text-orange-700 dark:hover:text-orange-300 transition-colors">
                  <CalendarDays className="w-3 h-3" /> From {creator.countVideosFromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </button>
                <button onClick={() => onSetStartDate(undefined)} className="ml-0.5 text-content-muted hover:text-red-500 transition-colors" title="Clear start date">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <button onClick={() => setEditingStartDate(true)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-tertiary text-content-muted border border-border hover:bg-surface-hover hover:text-content transition-colors">
                <CalendarDays className="w-3 h-3" /> Pay from…
              </button>
            )}
            <span className="text-[11px] text-content-muted flex items-center gap-1"><Eye className="w-3 h-3" /> {fmt(creatorViews)}</span>
            <span className="text-[11px] text-content-muted flex items-center gap-1"><Heart className="w-3 h-3" /> {fmt(creatorLikes)}</span>
            <span className="text-[11px] text-content-muted flex items-center gap-1" title={hiddenByDate > 0 ? `${hiddenByDate} video${hiddenByDate === 1 ? '' : 's'} hidden (outside the payout date window)` : undefined}>
              <Film className="w-3 h-3" /> {windowVideos.length}{hiddenByDate > 0 ? ` of ${creator.videos.length}` : ''}
            </span>
            {crossPostGroupCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-300/50 dark:border-orange-500/30 text-[10px] font-bold">
                <Link2 className="w-2.5 h-2.5" /> {crossPostGroupCount} cross-post{crossPostGroupCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>

        {/* Payout + status */}
        <div className="shrink-0 text-right flex items-center gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">
              {creator.paidSnapshot ? 'Paid' : 'Payout'}
            </p>
            {/* Once paid, show the immutable snapshot amount — NOT the live payoutResult, which
                can drift if videos/structure change after payment. */}
            <p className={`text-2xl font-bold leading-tight ${creator.paidSnapshot ? 'text-emerald-600 dark:text-emerald-500' : hasPayout ? 'text-emerald-600 dark:text-emerald-500' : 'text-content-muted'}`}>
              {creator.paidSnapshot
                ? fmtMoneyCurrency(creator.paidSnapshot.amount, creator.paidSnapshot.currency)
                : hasPayout ? fmtMoney(creator.payoutResult!.totalPayout) : '—'}
            </p>
            {creator.paidSnapshot && (
              <p className="text-[10px] text-content-muted mt-0.5">
                {creator.paidSnapshot.paidAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · by '}{creator.paidSnapshot.paidBy.split('@')[0]}
              </p>
            )}
            <div className="mt-1 flex justify-end items-center gap-1.5 flex-wrap">
              {/* Transfer sub-state chip — only shown when there's a snapshot. The primary status
                  badge ("Paid") still appears next to it so the state machine stays visible; this
                  just disambiguates WITHIN the paid state. */}
              {creator.paidSnapshot?.stripeTransferStatus === 'pending' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-300/50 dark:border-orange-500/30">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing
                </span>
              )}
              {creator.paidSnapshot?.stripeTransferStatus === 'failed' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-300/50 dark:border-red-500/30">
                  <AlertCircle className="w-2.5 h-2.5" /> Transfer failed
                </span>
              )}
              <PayoutStatusBadge status={creator.payoutStatus} />
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)}
            className="w-9 h-9 rounded-xl bg-surface-tertiary hover:bg-surface-hover text-content-muted hover:text-content flex items-center justify-center transition-colors">
            <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Approve CTA when pending */}
      {creator.payoutStatus === 'pending' && (
        <div className="px-5 pb-4 -mt-1">
          <button onClick={onApprove}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-white shadow-[0_2px_0_0_#047857] hover:shadow-[0_1px_0_0_#047857] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve this payout
          </button>
        </div>
      )}

      {/* Mark-as-paid CTA when approved (between Approve → Stripe bridge; admin manually settles) */}
      {creator.payoutStatus === 'approved' && (
        <div className="px-5 pb-4 -mt-1 space-y-2">
          <button
            onClick={onMarkPaid}
            disabled={!payoutsEnabled}
            title={payoutsEnabled ? undefined : 'Disabled until Stripe Connect platform is activated'}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-white shadow-[0_2px_0_0_#047857] hover:shadow-[0_1px_0_0_#047857] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_2px_0_0_#047857] disabled:hover:translate-y-0"
          >
            <Wallet className="w-3.5 h-3.5" /> Pay {fmtMoneyCurrency(creator.payoutOverride?.amount ?? creator.payoutResult?.totalPayout ?? 0, campaignCurrency(campaign))}
          </button>
          {/* Reverse transition — deliberately small/ghost to signal this is a meaningful, logged state change. */}
          <button onClick={onUnapprove}
            className="w-full text-center text-[11px] font-semibold text-content-secondary hover:text-content transition-colors py-1">
            Un-approve
          </button>
        </div>
      )}

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
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white shadow-[0_2px_0_0_#991b1b] hover:shadow-[0_1px_0_0_#991b1b] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Retry transfer
            </button>
          </div>
        </div>
      )}

      {/* Revert-to-approved escape hatch when paid — in case an admin marked paid by mistake.
          Blocked in the parent's `revertPaidCreator` handler if a Stripe transfer has already
          succeeded (stripeTransferId set) — the money is already gone, reversal happens in Stripe. */}
      {creator.payoutStatus === 'paid' && (
        <div className="px-5 pb-4 -mt-1">
          <button onClick={onRevertPaid}
            className="w-full text-center text-[11px] font-semibold text-content-secondary hover:text-content transition-colors py-1">
            Revert to approved
          </button>
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border-subtle bg-surface-tertiary/30">
          {/* Breakdown */}
          {creator.payoutResult && creator.payoutResult.componentBreakdown.length > 0 && (
            <div className="p-5 border-b border-border-subtle">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted mb-3">Payout breakdown</p>
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
                {(creator.payoutResult.componentBreakdown.length > 1 || creator.payoutResult.appliedCap) && (
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-border-subtle">
                    <span className="font-semibold text-content">Total</span>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">{fmtMoneyExact(creator.payoutResult.totalPayout)}</span>
                  </div>
                )}
                {creator.payoutResult.appliedCap && (
                  <p className="text-xs text-content-muted italic flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Capped at {fmtMoneyExact(creator.payoutResult.appliedCap.maxPayout)} (was {fmtMoneyExact(creator.payoutResult.appliedCap.originalTotal)})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cross-post groups — compact, one row per group. Renders above the videos slider so
               linked content is shown once (not duplicated in the slider below). */}
          {crossPostGroups.length > 0 && (
            <div className="px-5 pt-5">
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
          <div className="p-5">
            <div className="flex items-center justify-between mb-3 gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Videos</p>
              {creator.videos.length >= 2 && crossPostGroups.length === 0 && (
                <button onClick={() => setShowCrossPostModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-content-secondary hover:text-content bg-surface-tertiary hover:bg-surface-hover rounded-lg border border-border transition-colors">
                  <Link2 className="w-3.5 h-3.5" /> Manage cross-posts
                </button>
              )}
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

          {/* Manual override — admin can bypass the engine and set a custom total */}
          <div className="border-t border-border-subtle px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Manual override</p>
              {creator.payoutOverride ? (
                <button onClick={onClearOverride}
                  className="text-[11px] font-semibold text-content-muted hover:text-red-500 transition-colors">
                  Clear override
                </button>
              ) : !showOverrideForm ? (
                <button onClick={() => setShowOverrideForm(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                  <Pencil className="w-3 h-3" /> Set custom amount
                </button>
              ) : null}
            </div>
            {creator.payoutOverride ? (
              <div className="text-xs text-content-secondary">
                Fixed at <span className="font-semibold text-emerald-600 dark:text-emerald-500">{fmtMoneyExact(creator.payoutOverride.amount)}</span>
                {creator.payoutOverride.note && <span className="text-content-muted"> — {creator.payoutOverride.note}</span>}
              </div>
            ) : showOverrideForm ? (
              <OverrideForm
                onCancel={() => setShowOverrideForm(false)}
                onSubmit={(amount, note) => { onSetOverride(amount, note); setShowOverrideForm(false); }}
              />
            ) : (
              <p className="text-xs text-content-muted">Ignore the template calculation and set a custom payout amount for this creator.</p>
            )}
          </div>

          {/* Activity / audit log */}
          {creator.history && creator.history.length > 0 && (
            <div className="border-t border-border-subtle px-5 py-3">
              <button onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-content-muted hover:text-content transition-colors">
                <span>Activity ({creator.history.length})</span>
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
          <div className="border-t border-border-subtle px-5 py-3 flex justify-end">
            <button onClick={onRemove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Remove from campaign
            </button>
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

// ==================== EDIT CAMPAIGN MODAL ====================

/** Modal for editing campaign meta: name, description, status, start/end dates.
 *  Date window changes trigger a full recalc since videos can move in/out of eligibility. */
function EditCampaignModal({ campaign, onClose, onSave }: {
  campaign: PayoutCampaign;
  onClose: () => void;
  onSave: (patch: Partial<Pick<PayoutCampaign, 'name' | 'description' | 'status' | 'startDate' | 'endDate' | 'currency' | 'minimumPayout'>>) => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [status, setStatus] = useState<PayoutCampaign['status']>(campaign.status);
  const toDateInput = (d?: Date) => d ? d.toISOString().slice(0, 10) : '';
  const [startStr, setStartStr] = useState(toDateInput(campaign.startDate));
  const [endStr, setEndStr] = useState(toDateInput(campaign.endDate));
  const [currency, setCurrency] = useState<string>(campaignCurrency(campaign));
  const [minimumPayoutStr, setMinimumPayoutStr] = useState<string>(
    campaign.minimumPayout !== undefined ? String(campaign.minimumPayout) : '',
  );
  // If any creator has already been paid, the currency is locked — changing it would corrupt
  // the paid-snapshot records which froze their currency at paid-time.
  const hasPaidCreators = campaign.creators.some(c => !!c.paidSnapshot);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const inp = 'w-full px-3.5 py-2.5 bg-surface-tertiary border border-border rounded-xl text-content text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-content-muted';
  const lbl = 'block text-[11px] font-semibold uppercase tracking-wider text-content-secondary mb-1.5';

  const handleSave = () => {
    const minParsed = minimumPayoutStr.trim() === '' ? undefined : Number(minimumPayoutStr);
    if (minParsed !== undefined && (Number.isNaN(minParsed) || minParsed < 0)) {
      alert('Minimum payout must be a non-negative number.');
      return;
    }
    onSave({
      name: name.trim() || campaign.name,
      description: description.trim(),
      status,
      startDate: startStr ? new Date(startStr + 'T00:00:00') : undefined,
      endDate: endStr ? new Date(endStr + 'T23:59:59') : undefined,
      currency: currency.toLowerCase(),
      minimumPayout: minParsed,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative bg-surface rounded-2xl shadow-2xl border border-border max-w-lg w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">Edit campaign</p>
              <p className="font-semibold text-content truncate">{campaign.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Campaign name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inp} resize-none`} />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as PayoutCampaign['status'])} className={inp}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-content-muted" />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">Campaign window (optional)</label>
            </div>
            <p className="text-[11px] text-content-muted mb-2">Only videos posted in this range contribute to payouts. Leave empty for no filter.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-content-muted mb-1">Start</label>
                <input type="date" value={startStr} onChange={e => setStartStr(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-content-muted mb-1">End</label>
                <input type="date" value={endStr} onChange={e => setEndStr(e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Payment settings — currency is frozen on paid-snapshots so we lock it once anyone's been paid. */}
          <div className="pt-3 border-t border-border-subtle">
            <div className="flex items-center gap-2 mb-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-content-muted" />
              <label className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">Payment settings</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-content-muted mb-1">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp} disabled={hasPaidCreators}>
                  <option value="usd">USD ($)</option>
                  <option value="eur">EUR (€)</option>
                  <option value="gbp">GBP (£)</option>
                  <option value="cad">CAD ($)</option>
                  <option value="aud">AUD ($)</option>
                  <option value="mxn">MXN ($)</option>
                </select>
                {hasPaidCreators && (
                  <p className="text-[10px] text-content-muted mt-1">Locked — at least one creator has been paid in this campaign.</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-content-muted mb-1">
                  Minimum payout <span className="text-content-muted lowercase">(default {fmtMoneyCurrency(DEFAULT_MINIMUM_PAYOUT_BY_CURRENCY[currency] ?? 1, currency)})</span>
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={minimumPayoutStr}
                  onChange={e => setMinimumPayoutStr(e.target.value)}
                  placeholder="Use default"
                  className={inp}
                />
                <p className="text-[10px] text-content-muted mt-1">Creators below this amount can't be marked paid.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}><Check className="w-4 h-4 mr-1.5" /> Save</Button>
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

function AddCreatorsSlideOver({ campaign, orgId, projectId, onClose, onAdd }: {
  campaign: PayoutCampaign; orgId: string; projectId: string;
  onClose: () => void; onAdd: (creators: CampaignCreator[]) => void;
}) {
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (orgId && projectId) {
      setLoading(true);
      CreatorLinksService.getAllCreators(orgId, projectId)
        .then(setAllCreators).catch(console.error).finally(() => setLoading(false));
    }
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
                    {c.photoURL
                      ? <img src={c.photoURL} className="w-10 h-10 rounded-full object-cover ring-2 ring-border-subtle" alt="" />
                      : <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center ring-2 ring-border-subtle"><Users className="w-5 h-5 text-content-muted" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-content truncate">{c.displayName}</p>
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

function CampaignStatusBadge({ status }: { status: string }) {
  const m: Record<string, { cls: string; icon: React.ReactNode }> = {
    draft:     { cls: 'bg-surface-tertiary text-content-muted border border-border',                                                                                icon: <Clock className="w-3 h-3" /> },
    active:    { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30',                              icon: <Sparkles className="w-3 h-3" /> },
    completed: { cls: 'bg-emerald-500 text-white border border-emerald-500',                                                                                        icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const v = m[status] || m.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${v.cls}`}>
      {v.icon}{status}
    </span>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  const m: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    not_calculated: { cls: 'bg-surface-tertiary text-content-muted border border-border',                                                                                 label: 'Not calculated', icon: <DollarSign className="w-3 h-3" /> },
    pending:        { cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30',                                    label: 'Pending',        icon: <Clock className="w-3 h-3" /> },
    approved:       { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30',                               label: 'Approved',       icon: <CheckCircle2 className="w-3 h-3" /> },
    paid:           { cls: 'bg-emerald-500 text-white border border-emerald-500',                                                                                         label: 'Paid',           icon: <Wallet className="w-3 h-3" /> },
  };
  const v = m[status] || m.not_calculated;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${v.cls}`}>
      {v.icon}{v.label}
    </span>
  );
}
