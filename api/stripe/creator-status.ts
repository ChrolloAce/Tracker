/**
 * Stripe Connect — creator account status
 * POST /api/stripe/creator-status
 *
 * Polled from the creator's portal to reflect live Stripe Connect state (e.g. after they come
 * back from onboarding). Returns a compact status enum and flags so the UI can show "Set up
 * payments" / "Onboarding in progress" / "Action required" / "Ready".
 *
 * Body:    { token }
 * Returns: { success, status, detailsSubmitted, payoutsEnabled, chargesEnabled, requirements? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../_utils/firebase-admin.js';
import { getStripe, StripeNotConfiguredError } from '../_utils/stripe-client.js';

initializeFirebase();
const db = getFirestore();

export type CreatorStripeStatus = 'none' | 'pending' | 'restricted' | 'complete';

/**
 * Collapse Stripe's multi-axis account state into one of four UI-friendly buckets.
 *   - none        → no Stripe account yet
 *   - pending     → onboarding in progress, not yet ready to be paid
 *   - restricted  → something is wrong (missing docs, currently_due requirements)
 *   - complete    → ready to receive transfers
 */
function deriveStatus(account: {
  details_submitted?: boolean;
  payouts_enabled?: boolean;
  charges_enabled?: boolean;
  requirements?: { currently_due?: string[]; disabled_reason?: string | null };
}): CreatorStripeStatus {
  if (!account.details_submitted) return 'pending';
  if (!account.payouts_enabled) {
    // Disabled or currently_due → admin-visible "something went wrong" state.
    if (account.requirements?.disabled_reason) return 'restricted';
    if ((account.requirements?.currently_due?.length || 0) > 0) return 'restricted';
    return 'pending';
  }
  return 'complete';
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

    // Per-creator admin gate — same flag the portal UI reads. If the admin hasn't explicitly
    // enabled payouts for this creator yet, return an immediate 'none' status so the
    // StripeConnectBanner treats it the same as "not configured yet" and stays hidden. This
    // prevents a curl-the-API path from leaking the creator's Stripe account state.
    const { orgId, projectId, creatorId } = share;
    if (orgId && projectId && creatorId) {
      const creatorDoc = await db
        .collection('organizations').doc(orgId)
        .collection('projects').doc(projectId)
        .collection('creators').doc(creatorId)
        .get();
      if (!creatorDoc.exists || creatorDoc.data()?.payoutPortalEnabled !== true) {
        return res.status(200).json({
          success: true,
          status: 'none' as CreatorStripeStatus,
          detailsSubmitted: false,
          payoutsEnabled: false,
          chargesEnabled: false,
        });
      }
    }

    const accountId: string | undefined = share.stripeConnectAccountId;
    if (!accountId) {
      return res.status(200).json({
        success: true,
        status: 'none' as CreatorStripeStatus,
        detailsSubmitted: false,
        payoutsEnabled: false,
        chargesEnabled: false,
      });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    const status = deriveStatus(account);

    // Cache the derived status on the share doc so the admin view doesn't have to hit Stripe
    // for every creator on every render. Stale-but-close-enough; the admin can refresh.
    await shareRef.update({ stripeAccountStatus: status });

    return res.status(200).json({
      success: true,
      status,
      detailsSubmitted: account.details_submitted ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      chargesEnabled: account.charges_enabled ?? false,
      requirements: account.requirements ? {
        currentlyDue: account.requirements.currently_due || [],
        disabledReason: account.requirements.disabled_reason || null,
      } : undefined,
    });
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) {
      return res.status(503).json({ error: 'Payments are not available on this server yet.' });
    }
    console.error('creator-status failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
