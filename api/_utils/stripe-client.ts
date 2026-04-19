/**
 * Shared Stripe SDK instance.
 *
 * Lazily initialised so importing this module doesn't crash at build time if the env var
 * isn't set (e.g. preview deployments that haven't had secrets wired yet). Handlers should
 * call `getStripe()` and surface a clean 500 if the env is missing rather than crashing.
 */

import Stripe from 'stripe';

let cached: Stripe | null = null;

/**
 * Returns the Stripe SDK, throwing a typed error if `STRIPE_SECRET_KEY` is missing.
 * The API version is pinned — Stripe treats unpinned versions as "use the latest" which
 * means their API updates could silently change response shapes under us.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError();
  }
  cached = new Stripe(key, {
    // Stripe docs recommend pinning to the version you tested against.
    apiVersion: '2024-12-18.acacia' as any,
    typescript: true,
    // Platform identification — helps Stripe support trace requests.
    appInfo: { name: 'ViewTrack/Tracker', version: '1.0.0' },
  });
  return cached;
}

/** Signals that the server isn't configured for Stripe yet. Handlers return 503 on this. */
export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe is not configured on this server (STRIPE_SECRET_KEY missing).');
    this.name = 'StripeNotConfiguredError';
  }
}

/** Whether we're pointed at Stripe test mode. Determined by the secret key prefix. */
export function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
}

/**
 * Whether the Payouts Stripe features (top-up, Connect onboarding, transfers) are allowed to
 * run on this server. The answer depends on what mode the Stripe key is in:
 *
 *   - Test mode key  → always enabled. Test mode can't touch real money and Connect test-mode
 *                       is available by default, so no gate is necessary.
 *   - Live mode key  → requires `STRIPE_CONNECT_ENABLED=true` in env. This is the production
 *                       safety interlock: the same live key is also powering the subscription
 *                       billing side of the product, so we can't just swap it to a test key.
 *                       Instead we refuse to touch Payouts/Connect APIs on live until the admin
 *                       has explicitly opted in — which they do after Stripe approves their
 *                       Connect platform application.
 *
 * The three endpoints that call this (`create-topup-session`, `creator-onboard`, `transfer`)
 * return 503 with a distinct code so the UI can render a "coming soon" banner rather than a
 * generic error.
 */
export function isPayoutsStripeEnabled(): boolean {
  if (isStripeTestMode()) return true;
  return process.env.STRIPE_CONNECT_ENABLED === 'true';
}

/** Used in the 503 response body when payouts are disabled, so the client can distinguish this
 *  specific state from other server errors and render a friendly "not ready yet" UI. */
export const PAYOUTS_DISABLED_ERROR_CODE = 'PAYOUTS_NOT_ENABLED';
export const PAYOUTS_DISABLED_MESSAGE = 'Stripe Payouts is not enabled on this server yet — waiting on Stripe Connect platform approval.';
