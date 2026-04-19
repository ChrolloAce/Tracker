/**
 * Stripe platform balance
 * POST /api/stripe/platform-balance
 *
 * Super-admin–only. Returns Maktub's current Stripe balance — broken out into `available`
 * (ready to transfer) and `pending` (funds that haven't cleared yet, e.g. card charges
 * within the 2-day hold window). Admin UI uses this so you can see at a glance whether
 * you have enough to mark creators paid.
 *
 * Returns: { success, available: [{amount, currency}], pending: [{amount, currency}] } | { error }
 *
 * Note: Stripe returns balances as arrays because a platform can hold multiple currencies
 * simultaneously (e.g. USD + EUR after cross-border transfers). We pass the arrays through
 * as-is rather than flattening so the UI can render each currency separately.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStripe, StripeNotConfiguredError } from '../_utils/stripe-client.js';
import { requireSuperAdmin } from '../_utils/require-super-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  // POST so we can use authenticatedApiService.post without adding a GET path
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve();

    // Stripe amounts are in the smallest currency unit (cents for USD). Convert to decimal
    // dollars here so the UI can render without worrying about currency unit conventions.
    const toDecimal = (entry: { amount: number; currency: string }) => ({
      amount: entry.amount / 100,
      currency: entry.currency,
    });

    return res.status(200).json({
      success: true,
      available: balance.available.map(toDecimal),
      pending: balance.pending.map(toDecimal),
      // livemode tells the UI whether we're looking at real or test dollars — show a test-mode
      // banner on the admin side so nobody confuses $100 test with $100 real.
      livemode: balance.livemode,
    });
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) {
      return res.status(503).json({ error: 'Stripe is not configured on this server.' });
    }
    console.error('platform-balance failed:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
