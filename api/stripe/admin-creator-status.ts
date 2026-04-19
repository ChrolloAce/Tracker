/**
 * Stripe Connect — admin reads a creator's account status
 * POST /api/stripe/admin-creator-status
 *
 * Super-admin–only. Resolves a creator's Stripe account status given `{orgId, projectId, creatorId}`.
 * The admin UI calls this to decide whether "Mark paid" is enabled. We don't fetch on every render —
 * only when the admin explicitly requests a refresh — so the Stripe API call budget is controlled.
 *
 * Body:    { orgId, projectId, creatorId }
 * Returns: { success, status, detailsSubmitted, payoutsEnabled, accountId? } | { error }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebase } from '../_utils/firebase-admin.js';
import { getStripe, StripeNotConfiguredError } from '../_utils/stripe-client.js';
import { requireSuperAdmin } from '../_utils/require-super-admin.js';
import type { CreatorStripeStatus } from './creator-status.js';

initializeFirebase();
const db = getFirestore();

function deriveStatus(account: {
  details_submitted?: boolean;
  payouts_enabled?: boolean;
  requirements?: { currently_due?: string[]; disabled_reason?: string | null };
}): CreatorStripeStatus {
  if (!account.details_submitted) return 'pending';
  if (!account.payouts_enabled) {
    if (account.requirements?.disabled_reason) return 'restricted';
    if ((account.requirements?.currently_due?.length || 0) > 0) return 'restricted';
    return 'pending';
  }
  return 'complete';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireSuperAdmin(req, res);
  if (!user) return; // response already written

  try {
    const { orgId, projectId, creatorId } = req.body || {};
    if (!orgId || !projectId || !creatorId) {
      return res.status(400).json({ error: 'orgId, projectId, creatorId are required' });
    }

    // Look up the share token(s) for this creator to resolve their Stripe account id.
    // Creators can have multiple active tokens (rare but possible — e.g. re-issued link);
    // pick the first one that has a Stripe account attached.
    const snap = await db.collection('creatorShareLinks')
      .where('orgId', '==', orgId)
      .where('projectId', '==', projectId)
      .where('creatorId', '==', creatorId)
      .limit(10)
      .get();

    const tokenDoc = snap.docs.find(d => !!d.data().stripeConnectAccountId);

    if (!tokenDoc) {
      return res.status(200).json({
        success: true,
        status: 'none' as CreatorStripeStatus,
        detailsSubmitted: false,
        payoutsEnabled: false,
        chargesEnabled: false,
      });
    }

    const accountId = tokenDoc.data().stripeConnectAccountId as string;
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    const status = deriveStatus(account);

    // Keep the token doc's cached status fresh too.
    await tokenDoc.ref.update({ stripeAccountStatus: status });

    return res.status(200).json({
      success: true,
      status,
      accountId,
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
      return res.status(503).json({ error: 'Stripe is not configured on this server.' });
    }
    console.error('admin-creator-status failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
