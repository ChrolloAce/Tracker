/**
 * Stripe runtime config for the Payouts admin UI
 * POST /api/stripe/config
 *
 * Super-admin–only. Tells the client which Stripe features are currently operational so the
 * UI can render accurate buttons / banners rather than letting admins click through to errors.
 *
 * Returns:
 *   - `payoutsEnabled`: true if top-ups, Connect onboarding, and transfers are allowed to run.
 *     False when we have a live-mode key but Stripe Connect platform approval hasn't landed yet.
 *   - `testMode`: true if the server is using a `sk_test_*` key. UI uses this for a badge.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireSuperAdmin } from '../_utils/require-super-admin.js';
import { isStripeTestMode, isPayoutsStripeEnabled } from '../_utils/stripe-client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  return res.status(200).json({
    success: true,
    payoutsEnabled: isPayoutsStripeEnabled(),
    testMode: isStripeTestMode(),
  });
}
