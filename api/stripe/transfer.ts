/**
 * Stripe Connect — transfer money from the platform to a creator's connected account
 * POST /api/stripe/transfer
 *
 * This is THE money-movement endpoint. Called when an admin clicks "Mark as paid" on a creator
 * whose `paidSnapshot` already exists locally. The server:
 *   1. Verifies super-admin auth
 *   2. Re-reads the campaign + snapshot from Firestore (source of truth, not client-provided amount)
 *   3. Resolves the creator's Stripe Connect account via their share link
 *   4. Verifies the connected account can actually receive transfers (payouts_enabled)
 *   5. Calls `stripe.transfers.create()` using the snapshot's idempotencyKey — so if the admin
 *      retries on the same snapshot, Stripe returns the original transfer (no double-charge)
 *   6. Returns the transfer id and status for the client to persist on the snapshot
 *
 * Body:    { orgId, projectId, campaignId, creatorId }
 * Returns: { success, transferId, status: 'paid' } | { error, code? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../_utils/firebase-admin.js';
import { getStripe, StripeNotConfiguredError, isPayoutsStripeEnabled, PAYOUTS_DISABLED_ERROR_CODE, PAYOUTS_DISABLED_MESSAGE } from '../_utils/stripe-client.js';
import { requireSuperAdmin } from '../_utils/require-super-admin.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  // Transfers move real money on live mode. Refuse to proceed if Connect isn't enabled — the
  // Stripe API would reject anyway (no connected accounts exist), but this gives the UI a
  // clean "disabled" state to render instead of a raw Stripe error.
  if (!isPayoutsStripeEnabled()) {
    return res.status(503).json({ error: PAYOUTS_DISABLED_MESSAGE, code: PAYOUTS_DISABLED_ERROR_CODE });
  }

  try {
    const { orgId, projectId, campaignId, creatorId } = req.body || {};
    if (!orgId || !projectId || !campaignId || !creatorId) {
      return res.status(400).json({ error: 'orgId, projectId, campaignId, creatorId are required' });
    }

    // === 1. Read campaign + snapshot (server-authoritative) ===
    // Pulling amount from server-read Firestore, not from the request body, so a compromised
    // client can't inflate the transfer amount. The snapshot is our internal source of truth.
    const campaignRef = db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('payoutCampaigns').doc(campaignId);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) return res.status(404).json({ error: 'Campaign not found' });

    const campaignData = campaignSnap.data() as any;
    const creators: any[] = campaignData.creators || [];
    const creator = creators.find(c => c.id === creatorId);
    if (!creator) return res.status(404).json({ error: 'Creator not in campaign' });

    const snapshot = creator.paidSnapshot;
    if (!snapshot || typeof snapshot.amount !== 'number' || !snapshot.idempotencyKey) {
      return res.status(400).json({
        error: 'Creator has no paidSnapshot — mark them paid in the admin UI first (this writes the snapshot, then triggers the transfer).',
      });
    }

    // If a transfer already succeeded, don't re-create — the idempotency key in Stripe would
    // short-circuit anyway but returning early avoids a pointless API round-trip.
    if (snapshot.stripeTransferId && snapshot.stripeTransferStatus === 'paid') {
      return res.status(200).json({
        success: true,
        transferId: snapshot.stripeTransferId,
        status: 'paid',
        alreadyTransferred: true,
      });
    }

    // === 2. Resolve creator's Stripe Connect account ===
    // Cached on the share doc. Phase 1's creator-onboard endpoint wrote this field when the
    // creator first started Connect onboarding.
    const shareSnap = await db.collection('creatorShareLinks')
      .where('orgId', '==', orgId)
      .where('projectId', '==', projectId)
      .where('creatorId', '==', creatorId)
      .limit(5)
      .get();

    const shareWithAccount = shareSnap.docs.find(d => !!d.data().stripeConnectAccountId);
    if (!shareWithAccount) {
      return res.status(400).json({
        error: 'Creator has not set up Stripe Connect. Ask them to complete onboarding from their portal.',
        code: 'STRIPE_ACCOUNT_MISSING',
      });
    }
    const connectedAccountId = shareWithAccount.data().stripeConnectAccountId as string;

    // === 3. Verify the account can receive transfers ===
    // payouts_enabled === true means Stripe has verified the creator enough to send them money.
    // If false, transfers.create would error anyway — checking first gives a cleaner error.
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(connectedAccountId);
    if (!account.payouts_enabled) {
      return res.status(400).json({
        error: `Creator's Stripe account isn't ready for transfers (payouts_enabled=false). They may need to finish onboarding or resolve a requirement.`,
        code: 'PAYOUTS_NOT_ENABLED',
      });
    }

    // === 4. Create the transfer ===
    // amount is in the smallest currency unit — cents for USD. Math.round protects against
    // floating-point residue (e.g. 100.1 * 100 = 10009.999…).
    // The idempotency key comes FROM THE SNAPSHOT, not generated here — that's how we guarantee
    // a retry (e.g. after network timeout) returns the original transfer instead of creating a
    // second one.
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(snapshot.amount * 100),
        currency: (snapshot.currency || 'usd').toLowerCase(),
        destination: connectedAccountId,
        description: `Payout: ${campaignData.name || 'Campaign'} · ${creator.name || creatorId}`,
        metadata: {
          orgId,
          projectId,
          campaignId,
          creatorId,
          paidBy: snapshot.paidBy || user.email || user.userId,
          // Include the snapshot id itself for easy reverse-lookup in Stripe dashboard
          snapshotIdempotencyKey: snapshot.idempotencyKey,
        },
      }, {
        idempotencyKey: snapshot.idempotencyKey,
      });

      return res.status(200).json({
        success: true,
        transferId: transfer.id,
        status: 'paid' as const,
      });
    } catch (stripeErr: any) {
      // Surface Stripe's error message back to the client so the admin sees exactly why it
      // failed (e.g. "Amount exceeds available balance", "Destination account rejects USD").
      // We deliberately do NOT mark the snapshot as failed here — the client does that based
      // on this response, so the admin can retry cleanly with the same idempotency key.
      console.error('Stripe transfer failed:', stripeErr);
      return res.status(400).json({
        error: stripeErr?.message || 'Stripe transfer failed',
        code: stripeErr?.code || 'STRIPE_TRANSFER_ERROR',
        stripeRequestId: stripeErr?.requestId,
      });
    }
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) {
      return res.status(503).json({ error: 'Stripe is not configured on this server.' });
    }
    console.error('transfer endpoint failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
