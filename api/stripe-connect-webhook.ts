/**
 * Stripe Connect webhook handler
 * POST /api/stripe-connect-webhook
 *
 * Separate from /api/stripe-webhook (which handles platform subscription events) so the two
 * webhook secrets and event types stay cleanly isolated. Configure this endpoint in Stripe
 * Dashboard → Developers → Webhooks → Add endpoint, select event types below, and check
 * "Listen to events on Connect accounts" so connected-account events (payout.paid, etc.)
 * are forwarded.
 *
 * Events we act on:
 *   - account.updated                 → sync creator onboarding status on the share-link doc
 *   - account.application.deauthorized → clear the account id so a fresh onboarding can start
 *   - capability.updated              → indirect trigger: re-fetch account and recompute status
 *   - transfer.reversed / .updated    → if reversed, revert the creator's payoutStatus + mark the
 *                                       paidSnapshot as failed, so the admin sees there's money back
 *   - payout.paid / payout.failed     → creator's Stripe balance → bank leg; logged only for now
 *                                       (upgrade path: notify creator via email)
 *
 * Env:
 *   STRIPE_SECRET_KEY               — platform secret key
 *   STRIPE_CONNECT_WEBHOOK_SECRET   — signing secret from the Connect webhook endpoint in Dashboard
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeFirebase } from './_utils/firebase-admin.js';

// Disable body parsing — Stripe needs the raw bytes for signature verification.
export const config = { api: { bodyParser: false } };

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const connectWebhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

// Lazy init — avoids crashing the Vercel bundler if env vars aren't present.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(stripeSecret, { apiVersion: '2024-11-20.acacia' as any });
  }
  return _stripe;
}

// Short-lived in-memory dedupe so rapid duplicate deliveries within one lambda instance are no-ops.
// Doesn't survive cold starts (fine — Stripe's built-in idempotency protects us at the API layer too).
const processedEvents = new Map<string, number>();
const EVENT_CACHE_TTL = 5 * 60 * 1000;

function isEventProcessed(id: string): boolean {
  const now = Date.now();
  for (const [k, t] of processedEvents) if (now - t > EVENT_CACHE_TTL) processedEvents.delete(k);
  if (processedEvents.has(id)) return true;
  processedEvents.set(id, now);
  return false;
}

initializeFirebase();
const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!connectWebhookSecret) {
    console.error('[Connect webhook] STRIPE_CONNECT_WEBHOOK_SECRET is not set — rejecting events.');
    return res.status(503).json({ error: 'Connect webhook not configured' });
  }

  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) return res.status(400).json({ error: 'Missing Stripe signature' });

  let event: Stripe.Event;
  try {
    const rawBody = await buffer(req);
    event = getStripe().webhooks.constructEvent(rawBody, sig, connectWebhookSecret);
  } catch (err: any) {
    console.error('[Connect webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (isEventProcessed(event.id)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    console.log(`[Connect webhook] ${event.type} · event=${event.id} · account=${event.account || 'platform'}`);

    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'account.application.deauthorized':
        await handleAccountDeauthorized(event.data.object as Stripe.Account);
        break;

      case 'capability.updated':
        await handleCapabilityUpdated(event.data.object as Stripe.Capability);
        break;

      case 'transfer.reversed':
      case 'transfer.updated':
        await handleTransferEvent(event.data.object as Stripe.Transfer, event.type);
        break;

      case 'payout.paid':
      case 'payout.failed':
        await handleConnectedAccountPayout(event.data.object as Stripe.Payout, event);
        break;

      default:
        console.log(`[Connect webhook] Unhandled event: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('[Connect webhook] Processing error:', error);
    return res.status(500).json({ error: 'Processing failed' });
  }
}

// ==================== account.updated ====================

/**
 * Sync a creator's onboarding state to their creatorShareLinks doc. Fires whenever Stripe updates
 * the account (requirements change, verification succeeds, payouts enabled, etc.).
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const accountId = account.id;
  if (!accountId) return;

  const detailsSubmitted = account.details_submitted ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const currentlyDue = account.requirements?.currently_due || [];
  const disabledReason = account.requirements?.disabled_reason || null;

  // Derive the simplified status the portal UI uses. Mirrors the logic in fetchStripeStatus
  // on the client so the UI converges on the same state whether it got here via poll or webhook.
  let status: 'pending' | 'restricted' | 'complete';
  if (payoutsEnabled && detailsSubmitted) status = 'complete';
  else if (disabledReason || currentlyDue.length > 0) status = 'restricted';
  else status = 'pending';

  const snap = await db
    .collection('creatorShareLinks')
    .where('stripeConnectAccountId', '==', accountId)
    .limit(1)
    .get();

  if (snap.empty) {
    console.warn(`[Connect webhook] account.updated for ${accountId} but no share link matched`);
    return;
  }

  await snap.docs[0].ref.update({
    stripeAccountStatus: status,
    stripePayoutsEnabled: payoutsEnabled,
    stripeDetailsSubmitted: detailsSubmitted,
    stripeAccountUpdatedAt: Timestamp.now(),
    ...(disabledReason ? { stripeAccountDisabledReason: disabledReason } : { stripeAccountDisabledReason: FieldValue.delete() }),
  });

  console.log(`[Connect webhook] ${accountId} → ${status} (payouts=${payoutsEnabled}, details=${detailsSubmitted})`);
}

// ==================== account.application.deauthorized ====================

/**
 * Creator (or our platform) broke the Connect link. Clear the account id on the share link so a
 * future onboarding starts a fresh account — the old one is no longer usable for transfers.
 */
async function handleAccountDeauthorized(account: Stripe.Account) {
  const accountId = account.id;
  if (!accountId) return;

  const snap = await db
    .collection('creatorShareLinks')
    .where('stripeConnectAccountId', '==', accountId)
    .limit(1)
    .get();

  if (snap.empty) return;

  await snap.docs[0].ref.update({
    stripeAccountStatus: 'none',
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: false,
    stripeConnectAccountId: FieldValue.delete(),
    stripeAccountDeauthorizedAt: Timestamp.now(),
  });

  console.log(`[Connect webhook] ${accountId} deauthorized — cleared from share link`);
}

// ==================== capability.updated ====================

/**
 * Capability-level changes (e.g., `transfers` becomes active after Stripe finishes verification)
 * don't include the full account state in the event. Re-fetch the account so handleAccountUpdated
 * recomputes the derived status with fresh data.
 */
async function handleCapabilityUpdated(capability: Stripe.Capability) {
  const accountId = typeof capability.account === 'string' ? capability.account : capability.account?.id;
  if (!accountId) return;

  try {
    const account = await getStripe().accounts.retrieve(accountId);
    await handleAccountUpdated(account);
  } catch (err) {
    console.error(`[Connect webhook] Failed to fetch account ${accountId} for capability update:`, err);
  }
}

// ==================== transfer.reversed / transfer.updated ====================

/**
 * If a transfer gets reversed after we marked the creator as paid, revert their status and flag
 * the paidSnapshot as failed so the admin sees the money came back. We use the metadata we stamped
 * in api/stripe/transfer.ts (orgId, projectId, campaignId, creatorId) to find the right doc —
 * no scanning required.
 */
async function handleTransferEvent(transfer: Stripe.Transfer, eventType: string) {
  const meta = transfer.metadata || {};
  const orgId = meta.orgId;
  const projectId = meta.projectId;
  const campaignId = meta.campaignId;
  const creatorId = meta.creatorId;

  if (!orgId || !projectId || !campaignId || !creatorId) {
    console.warn(`[Connect webhook] Transfer ${transfer.id} missing metadata; can't reconcile`);
    return;
  }

  // Only act on actual reversals. `transfer.updated` is fired for many reasons; if reversed=false
  // we just log and move on. Reading the `reversed` flag is the canonical way to detect reversal.
  if (!transfer.reversed && eventType === 'transfer.updated') {
    console.log(`[Connect webhook] Transfer ${transfer.id} updated (not reversed) — no action`);
    return;
  }

  const campaignRef = db
    .collection('organizations').doc(orgId)
    .collection('projects').doc(projectId)
    .collection('payoutCampaigns').doc(campaignId);

  const doc = await campaignRef.get();
  if (!doc.exists) {
    console.warn(`[Connect webhook] Campaign ${campaignId} not found for reversed transfer`);
    return;
  }

  const data = doc.data()!;
  const creators = Array.isArray(data.creators) ? [...data.creators] : [];
  const idx = creators.findIndex((c: any) => c.id === creatorId);
  if (idx < 0) {
    console.warn(`[Connect webhook] Creator ${creatorId} not in campaign ${campaignId}`);
    return;
  }

  const creator = creators[idx];
  const reversalAmount = transfer.reversals?.data?.reduce((s, r) => s + (r.amount || 0), 0) || transfer.amount;
  const reversalId = transfer.reversals?.data?.[0]?.id;

  creators[idx] = {
    ...creator,
    // Roll back from 'paid' → 'approved'. Admin can retry via the Pay button, and the
    // idempotency key on paidSnapshot means Stripe will treat the retry as a fresh transfer
    // (the old one is fully reversed, so no dedup conflict).
    payoutStatus: 'approved',
    paidSnapshot: creator.paidSnapshot ? {
      ...creator.paidSnapshot,
      stripeTransferStatus: 'failed',
      stripeTransferError: `Transfer reversed by Stripe${reversalId ? ` (reversal ${reversalId})` : ''}`,
    } : creator.paidSnapshot,
    history: [
      ...(Array.isArray(creator.history) ? creator.history : []),
      {
        action: 'Stripe transfer reversed',
        at: Timestamp.now(),
        by: 'stripe-webhook',
        details: `Transfer ${transfer.id} reversed · ${(reversalAmount / 100).toFixed(2)} ${(transfer.currency || 'usd').toUpperCase()}`,
      },
    ],
  };

  await campaignRef.update({
    creators,
    updatedAt: Timestamp.now(),
  });

  console.log(`[Connect webhook] Transfer ${transfer.id} reversed → reverted creator ${creatorId} to 'approved'`);
}

// ==================== payout.paid / payout.failed (connected-account events) ====================

/**
 * Fires on CONNECTED ACCOUNTS when their Stripe balance → bank payout settles (or fails).
 * For a Connect webhook to receive these, check "Listen to events on Connect accounts" in Dashboard.
 *
 * For now we just log. Next-step upgrades:
 *   - Email creator via Resend when payout.paid ("Your $X payout landed in your bank")
 *   - Alert admin when payout.failed so they can help troubleshoot
 *   - Persist a payouts activity log on the creator doc for full audit trail
 */
async function handleConnectedAccountPayout(payout: Stripe.Payout, event: Stripe.Event) {
  const connectedAccountId = event.account as string | undefined;
  if (!connectedAccountId) return;

  const snap = await db
    .collection('creatorShareLinks')
    .where('stripeConnectAccountId', '==', connectedAccountId)
    .limit(1)
    .get();

  if (snap.empty) {
    console.log(`[Connect webhook] Payout ${payout.id} for unknown connected account ${connectedAccountId}`);
    return;
  }

  const share = snap.docs[0].data();
  const amountDisplay = (payout.amount / 100).toFixed(2);
  const currency = (payout.currency || 'usd').toUpperCase();

  if (event.type === 'payout.paid') {
    console.log(`[Connect webhook] Payout ${payout.id} landed: $${amountDisplay} ${currency} for creator ${share.creatorId}`);
    // TODO: email creator when we wire Resend notifications for payout settlement.
  } else {
    console.error(`[Connect webhook] Payout ${payout.id} FAILED: $${amountDisplay} ${currency} for creator ${share.creatorId} · ${payout.failure_message || 'no reason given'}`);
    // TODO: alert admin so they can reach out to the creator and help resolve.
  }
}
