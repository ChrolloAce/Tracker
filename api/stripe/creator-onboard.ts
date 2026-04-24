/**
 * Stripe Connect — creator onboarding entry point
 * POST /api/stripe/creator-onboard
 *
 * Called from the creator's public portal (`/c/:token`) when they click "Set up payments".
 * Auth is the share token itself, same pattern as the other public endpoints in this repo.
 *
 * Flow:
 *   1. Validate the share token → resolves creator identity
 *   2. If the creator already has a Stripe Express account, reuse it. Otherwise create one
 *      using the creator-selected country (falls back to US for safety).
 *   3. Generate an Account Link (hosted Stripe onboarding URL) and return it.
 *   4. Persist `stripeConnectAccountId` + chosen country on the share doc.
 *
 * Body:    { token, country? }   // country = ISO 3166-1 alpha-2, required for first-time creation
 * Returns: { success, onboardingUrl, accountId } | { error }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeFirebase } from '../_utils/firebase-admin.js';
import { getStripe, StripeNotConfiguredError, isPayoutsStripeEnabled, PAYOUTS_DISABLED_ERROR_CODE, PAYOUTS_DISABLED_MESSAGE } from '../_utils/stripe-client.js';
import { getFrontendUrl } from '../_utils/base-url.js';

/**
 * Server-side allow-list of Stripe Connect Express country codes. MUST stay in sync with
 * `src/data/stripe-countries.ts` (client-side UI). Duplicated here because Vercel serverless
 * functions can't import from the `src/` tree without extra build config, and we need the
 * validation on the server so a malicious client can't pass an unsupported country.
 */
const ALLOWED_COUNTRIES = new Set([
  'US', 'GB', 'CA',
  'AU', 'AT', 'BE', 'BR', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
  'GI', 'GR', 'HK', 'HU', 'IN', 'ID', 'IE', 'IT', 'JP', 'LV', 'LI', 'LT', 'LU',
  'MY', 'MT', 'MX', 'NL', 'NZ', 'NO', 'PH', 'PL', 'PT', 'RO', 'SG', 'SK', 'SI',
  'ES', 'SE', 'CH', 'TH', 'AE',
]);

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
    const { token, country: countryRaw } = req.body || {};
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

    // Per-creator admin gate: same flag the public portal UI reads. Creators whose admin hasn't
    // explicitly turned payouts on (default state) cannot create a Stripe account here — even
    // if they curl the endpoint directly with their token. Strict `=== true` check so missing
    // field = denied. Returns 403 so it's distinguishable from invalid/revoked tokens.
    const creatorDoc = await db
      .collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('creators').doc(creatorId)
      .get();
    if (!creatorDoc.exists || creatorDoc.data()?.payoutPortalEnabled !== true) {
      return res.status(403).json({
        error: 'Payouts are not enabled for this creator yet. Contact your admin.',
        code: 'PAYOUTS_NOT_ENABLED_FOR_CREATOR',
      });
    }

    const stripe = getStripe();

    // Reuse an existing account if the creator has already started onboarding — Stripe treats
    // Connect accounts as durable (one per creator, across campaigns) so we never want duplicates.
    // Country is immutable once the account exists; we ignore any incoming `country` arg in that case.
    let accountId: string | undefined = share.stripeConnectAccountId;

    if (!accountId) {
      // First-time account creation — require an explicit, validated country from the creator.
      // Stripe's Express `accounts.create({country})` is locked at creation time and determines
      // allowed currencies, onboarding questions, and tax forms, so we don't guess.
      const country = typeof countryRaw === 'string' ? countryRaw.toUpperCase().trim() : '';
      if (!country) {
        return res.status(400).json({ error: 'country is required for first-time account creation' });
      }
      if (!ALLOWED_COUNTRIES.has(country)) {
        return res.status(400).json({ error: `Country ${country} isn't supported for Stripe Connect payouts.` });
      }

      // Creating a Connect Express account.
      //   type: 'express'                      → Stripe-hosted onboarding UI
      //   country: <creator-selected>          → immutable after creation; determines currencies/tax forms
      //   capabilities.transfers               → required so we can Transfer money to the account
      //   metadata                              → reverse-lookup in Stripe dashboard back to our creator
      //
      // For NON-US creators, we must explicitly set the `recipient` service agreement. Our platform
      // is US-based, so creating accounts in other countries is a cross-border Connect relationship.
      // Stripe requires either:
      //   (a) request `transfers` + `card_payments` capabilities together (extra verification), or
      //   (b) declare `recipient` service agreement (transfers-only, lighter onboarding).
      // Our creators only RECEIVE money from us — they never accept payments — so (b) is correct.
      // For US creators, the default (full) agreement already allows transfers — don't change it
      // or you'll break existing US accounts' tax-reporting behavior.
      //
      // We deliberately don't set `email` here — Stripe will prompt the creator for it during
      // onboarding. Pre-filling can cause friction if the creator uses a different email for banking.
      const created = await stripe.accounts.create({
        type: 'express',
        country,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
        ...(country !== 'US' ? {
          tos_acceptance: { service_agreement: 'recipient' },
        } : {}),
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
        stripeConnectAccountCountry: country,
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
