/**
 * Public Creator Payouts
 * POST /api/public-creator-payouts
 *
 * Returns a creator's payout entries across all campaigns in their project, keyed by
 * the public share token. Read-only — no mutations. Lets the creator see their pending
 * / approved / paid status inside the `/c/:token` portal.
 *
 * Body:    { token }
 * Returns: { success, payouts: PayoutSummary[] } | { error }
 *
 * A payout entry is filtered out if the campaign is still in `draft` status, so admins
 * can configure campaigns without exposing them to creators prematurely.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';
import { buildDealSummary } from './_utils/deal-summary.js';

initializeFirebase();
const db = getFirestore();

// Per-token rate limits for this read endpoint. More generous than the submit
// endpoint because polling the payouts page is a reasonable creator behavior.
// Counters live on the same creatorShareLinks/{token} doc but under distinct
// field names so they don't clobber the submit-endpoint counters.
const MAX_PAYOUTS_PER_MINUTE = 60;
const MAX_PAYOUTS_PER_DAY = 600;

// Typed error used inside the rate-limit transaction to break out with a specific
// HTTP status + optional retry-after. Using a class lets us `instanceof` check
// and distinguish rate-limit bounces from unexpected Firestore errors.
class RateLimitError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface PayoutSummary {
  campaignId: string;
  campaignName: string;
  campaignDescription: string;
  campaignStatus: 'draft' | 'active' | 'completed';
  campaignCreatedAt: string;
  status: 'not_calculated' | 'pending' | 'approved' | 'paid';
  amount: number | null;
  currency: string;
  note?: string;
  structureName?: string;
  /** Server-generated human-readable bullets explaining the creator's deal. We hide internal
   *  structure component types, metric keys, etc. — only the "how do I earn?" translation
   *  makes it through. Empty array is fine; UI falls back to a generic label. */
  dealSummary: string[];
  /** Paid-snapshot metadata so the creator UI can show the immutable paid amount + date.
   *  Only populated when status === 'paid'. */
  paidAt?: string;
  paidAmount?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token is required' });

    const shareRef = db.collection('creatorShareLinks').doc(token);
    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) return res.status(404).json({ error: 'Invalid share link' });

    const share = shareDoc.data()!;
    if (share.revoked) return res.status(410).json({ error: 'This share link has been revoked' });

    const { orgId, projectId, creatorId } = share;
    if (!orgId || !projectId || !creatorId) {
      return res.status(500).json({ error: 'Share link is missing required fields' });
    }

    // ==================== RATE LIMITING ====================
    // Atomic read-check-increment so two concurrent pollers can't both squeeze
    // through on a stale count. Bucket fields are distinct from submit-side
    // counters so they don't collide.
    //   - payoutCountMinute / payoutCountMinuteBucket  — "yyyy-mm-ddThh:mm"
    //   - payoutCountToday2 / payoutCountDayBucket2    — "yyyy-mm-dd"
    // The "2" suffix on the daily fields avoids any accidental overlap with
    // the submit endpoint's `submitCountToday` / `submitCountDayBucket`.
    const now = new Date();
    const minuteBucket = now.toISOString().slice(0, 16); // e.g. "2026-04-12T01:23"
    const dayBucket = now.toISOString().slice(0, 10);    // e.g. "2026-04-12"

    try {
      await db.runTransaction(async (tx) => {
        const txDoc = await tx.get(shareRef);
        // Share existed outside the transaction; if it vanished in between we
        // still want to surface a meaningful error rather than silently passing.
        if (!txDoc.exists) {
          throw new RateLimitError(404, 'Invalid share link');
        }
        const txShare = txDoc.data()!;
        if (txShare.revoked) {
          throw new RateLimitError(410, 'This share link has been revoked');
        }

        const currentMinute = txShare.payoutCountMinuteBucket === minuteBucket
          ? (txShare.payoutCountMinute || 0)
          : 0;
        const currentDay = txShare.payoutCountDayBucket2 === dayBucket
          ? (txShare.payoutCountToday2 || 0)
          : 0;

        if (currentMinute >= MAX_PAYOUTS_PER_MINUTE) {
          throw new RateLimitError(
            429,
            `Rate limit reached: ${MAX_PAYOUTS_PER_MINUTE} requests per minute. Try again shortly.`,
            60,
          );
        }
        if (currentDay >= MAX_PAYOUTS_PER_DAY) {
          throw new RateLimitError(
            429,
            `Daily limit reached: ${MAX_PAYOUTS_PER_DAY} requests per day. Try again tomorrow.`,
            86400,
          );
        }

        tx.update(shareRef, {
          payoutCountMinute: currentMinute + 1,
          payoutCountMinuteBucket: minuteBucket,
          payoutCountToday2: currentDay + 1,
          payoutCountDayBucket2: dayBucket,
          lastPayoutFetchAt: Timestamp.now(),
        });
      });
    } catch (rateErr: any) {
      if (rateErr instanceof RateLimitError) {
        const body: { error: string; retryAfter?: number } = { error: rateErr.message };
        if (rateErr.retryAfter !== undefined) body.retryAfter = rateErr.retryAfter;
        return res.status(rateErr.status).json(body);
      }
      throw rateErr;
    }

    // Firestore can't filter arrays-of-objects by nested field directly, so fetch all campaigns
    // in the project and filter in memory. Payout campaign docs are small (metadata + creator list).
    const campaignsSnap = await db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('payoutCampaigns')
      .get();

    const payouts: PayoutSummary[] = [];
    for (const doc of campaignsSnap.docs) {
      const data = doc.data() as any;
      // Hide drafts from creators — admins may still be setting them up
      if (data.status === 'draft') continue;

      const myEntry = (data.creators || []).find((c: any) => c.id === creatorId);
      if (!myEntry) continue;

      const amount = myEntry.payoutOverride?.amount ?? myEntry.payoutResult?.totalPayout ?? null;

      // Deal summary — server generates a readable list of terms from the frozen structure.
      // Internal component types, metric keys, structure name etc. stay server-side.
      const dealSummary = buildDealSummary(
        myEntry.structureSnapshot,
        {
          startDate: data.startDate,
          endDate: data.endDate,
          currency: data.currency,
          minimumPayout: data.minimumPayout,
        },
        {
          countVideosFromDate: myEntry.countVideosFromDate,
        },
      );

      // Paid snapshot: if the admin has already paid, surface the frozen amount + date so the
      // creator sees what they were actually paid (not the live calc which can drift).
      const paidAt = myEntry.paidSnapshot?.paidAt?.toDate?.()?.toISOString?.();
      const paidAmount = typeof myEntry.paidSnapshot?.amount === 'number' ? myEntry.paidSnapshot.amount : undefined;

      payouts.push({
        campaignId: data.id || doc.id,
        campaignName: data.name || 'Untitled',
        campaignDescription: data.description || '',
        campaignStatus: (data.status || 'active') as PayoutSummary['campaignStatus'],
        campaignCreatedAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
        status: (myEntry.payoutStatus || 'not_calculated') as PayoutSummary['status'],
        amount,
        currency: (data.currency || 'usd').toLowerCase(),
        note: myEntry.payoutOverride?.note,
        structureName: myEntry.structureSnapshot?.name,
        dealSummary,
        paidAt,
        paidAmount,
      });
    }

    // Newest first
    payouts.sort((a, b) => b.campaignCreatedAt.localeCompare(a.campaignCreatedAt));

    return res.status(200).json({ success: true, payouts });
  } catch (err: any) {
    console.error('public-creator-payouts failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
