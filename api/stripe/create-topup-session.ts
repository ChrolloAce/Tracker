/**
 * Stripe platform balance top-up (card-based via Checkout)
 * POST /api/stripe/create-topup-session
 *
 * Super-admin–only. Creates a Stripe Checkout Session in `payment` mode that an admin can
 * complete to fund Maktub's platform balance. No destination / on_behalf_of / transfer_data,
 * so the entire charge lands in the platform's own balance — exactly what we need to fund
 * Connect transfers to creators.
 *
 * Body:    { amount: number, currency?: string }  — amount in major units (dollars, not cents)
 * Returns: { success, url, sessionId } | { error }
 *
 * Fee note: card top-ups incur Stripe's standard processing fee (~2.9% + 30¢). For cheaper
 * funding in production, consider ACH-based top-ups via `stripe.topups.create()` — needs a
 * verified platform bank account. Not implemented here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, StripeNotConfiguredError, isPayoutsStripeEnabled, PAYOUTS_DISABLED_ERROR_CODE, PAYOUTS_DISABLED_MESSAGE } from '../_utils/stripe-client.js';
import { requireSuperAdmin } from '../_utils/require-super-admin.js';
import { getFrontendUrl } from '../_utils/base-url.js';

// Hard cap on single top-up amounts to make accidental extra zeros less catastrophic in prod.
// Stripe's own card transaction ceilings vary but $50K is a reasonable safety rail.
const MAX_TOPUP_AMOUNT = 50_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  // Hard block in live mode without Connect enabled — prevents accidental real-card charges.
  // Admin still sees the balance (read-only), just can't top up. When Stripe approves Connect,
  // flip STRIPE_CONNECT_ENABLED=true in prod env and this guard lets calls through.
  if (!isPayoutsStripeEnabled()) {
    return res.status(503).json({ error: PAYOUTS_DISABLED_MESSAGE, code: PAYOUTS_DISABLED_ERROR_CODE });
  }

  try {
    const { amount, currency = 'usd' } = req.body || {};
    // Basic sanity — number, finite, positive, below safety cap. Stripe also rejects amounts
    // below its minimum (50¢ for USD) so we echo that error back.
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number (in dollars)' });
    }
    if (amount < 0.5) {
      return res.status(400).json({ error: `Minimum top-up is $0.50 (Stripe requirement).` });
    }
    if (amount > MAX_TOPUP_AMOUNT) {
      return res.status(400).json({ error: `Maximum single top-up is $${MAX_TOPUP_AMOUNT}. Split into multiple charges for larger amounts.` });
    }

    const stripe = getStripe();
    const frontendUrl = getFrontendUrl();

    // Checkout Session funds the platform directly — no Connect destination. Stripe treats
    // this as a standard charge whose proceeds sit in our balance after clearing.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          // The smallest Stripe unit — cents for USD, pence for GBP, etc. Math.round guards
          // against floating-point dust (e.g. 100.1 * 100 = 10009.999…).
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: 'Maktub platform balance top-up',
            description: `Funds to pay creators via Stripe Connect transfers.`,
          },
        },
        quantity: 1,
      }],
      // Return the admin to the Payouts page with a query param we can detect to refresh balance.
      success_url: `${frontendUrl}/payouts?topup=success&amount=${amount}`,
      cancel_url: `${frontendUrl}/payouts?topup=cancel`,
      metadata: {
        kind: 'platform_balance_topup',
        initiatedBy: user.email || user.userId,
      },
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) {
      return res.status(503).json({ error: 'Stripe is not configured on this server.' });
    }
    console.error('create-topup-session failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
