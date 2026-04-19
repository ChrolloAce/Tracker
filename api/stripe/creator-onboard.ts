/**
 * Stripe Connect — creator onboarding entry point
 * POST /api/stripe/creator-onboard
 *
 * Called from the creator's public portal (`/c/:token`) when they click "Set up payments".
 * Auth is the share token itself, same pattern as the other public endpoints in this repo.
 *
 * Flow:
 *   1. Validate the share token → resolves creator identity
 *   2. If the creator already has a Stripe Express account, reuse it. Otherwise create one.
 *   3. Generate an Account Link (hosted Stripe onboarding URL) and return it.
 *   4. Persist `stripeConnectAccountId` on the share doc as the source of truth for this creator.
 *
 * Body:    { token }
 * Returns: { success, onboardingUrl, accountId } | { error }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../_utils/firebase-admin.js';
import { getStripe, StripeNotConfiguredError, isPayoutsStripeEnabled, PAYOUTS_DISABLED_ERROR_CODE, PAYOUTS_DISABLED_MESSAGE } from '../_utils/stripe-client.js';
import { getFrontendUrl } from '../_utils/base-url.js';

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Block account creation on live mode without Connect enabled — would error anyway at Stripe's
  // layer ("sign up for Connect first"), but returning 503 + our known code lets the portal show
  // a friendly "coming soon" state instead of leaking a raw Stripe error to the creator.
  if (!isPayoutsStripeEnabled()) {
    return res.status(503).json({ error: PAYOUTS_DISABLED_MESSAGE, code: PAYOUTS_DISABLED_ERROR_CODE });
  }

  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'token is required' });

    const shareRef = db.collection('creatorShareLinks').doc(token);
    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) return res.status(404).json({ error: 'Invalid share link' });

    const share = shareDoc.data()!;
    if (share.revoked) return res.status(410).json({ error: 'This share link has been revoked' });
    const { orgId, projectId, creatorId, creatorEmail, creatorName } = share;
    if (!orgId || !projectId || !creatorId) {
      return res.status(500).json({ error: 'Share link is missing required fields' });
    }

    const stripe = getStripe();

    // Reuse an existing account if the creator has already started onboarding — Stripe treats
    // Connect accounts as durable (one per creator, across campaigns) so we never want duplicates.
    let accountId: string | undefined = share.stripeConnectAccountId;

    if (!accountId) {
      // Creating a Connect Express account.
      //   type: 'express'                      → Stripe-hosted onboarding UI
      //   country: 'US'                        → default for test mode; Phase 2 will let admin override
      //   capabilities.transfers               → required so we can Transfer money to the account
      //   metadata                              → reverse-lookup in Stripe dashboard back to our creator
      //
      // We deliberately don't set `email` here — Stripe will prompt the creator for it during
      // onboarding. Pre-filling can cause friction if the creator uses a different email for banking.
      const created = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        metadata: {
          creatorId,
          orgId,
          projectId,
          shareToken: token.slice(0, 8), // Breadcrumb only — full token stays server-side.
          viewTrackCreatorName: creatorName || '',
          viewTrackCreatorEmail: creatorEmail || '',
        },
      });
      accountId = created.id;

      // Persist BEFORE generating the account link — if the link call fails we still have the
      // account id saved, avoiding orphaned Stripe accounts on retry.
      await shareRef.update({
        stripeConnectAccountId: accountId,
        stripeAccountStatus: 'pending',
        stripeAccountCreatedAt: Timestamp.now(),
      });
    }

    // Generate the hosted onboarding URL. These links are short-lived (minutes), so we
    // regenerate on every click rather than caching.
    const frontendUrl = getFrontendUrl();
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      return_url: `${frontendUrl}/c/${token}?stripe=complete`,
      refresh_url: `${frontendUrl}/c/${token}?stripe=refresh`,
      type: 'account_onboarding',
    });

    return res.status(200).json({
      success: true,
      onboardingUrl: accountLink.url,
      accountId,
    });
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) {
      return res.status(503).json({ error: 'Payments are not available on this server yet.' });
    }
    console.error('creator-onboard failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
