/**
 * RevenueCat Webhook Handler
 * Receives real-time transaction events from RevenueCat
 * Documentation: https://www.revenuecat.com/docs/integrations/webhooks
 *
 * URL format: /api/revenuecat-webhook?orgId=xxx&projectId=yyy
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

interface RevenueCatWebhookEvent {
  event: {
    type: string;
    id?: string;
    app_user_id: string;
    aliases?: string[];
    original_app_user_id: string;
    product_id?: string;
    entitlement_id?: string;
    entitlement_ids?: string[];
    period_type?: 'NORMAL' | 'TRIAL' | 'INTRO';
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    environment?: 'SANDBOX' | 'PRODUCTION';
    price?: number;
    currency?: string;
    price_in_purchased_currency?: number;
    takehome_percentage?: number;
    is_trial_conversion?: boolean;
    cancel_reason?: string;
    cancellation_reason?: string;
    new_product_id?: string;
    presented_offering_id?: string;
  };
  api_version: string;
}

/**
 * Helper to get the Firestore collection path for revenue transactions
 */
function transactionsCollection(orgId: string, projectId: string) {
  return db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('revenueTransactions');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract org/project from query params
    const { orgId, projectId } = req.query;

    if (!orgId || !projectId || typeof orgId !== 'string' || typeof projectId !== 'string') {
      console.error('RevenueCat webhook: missing orgId or projectId in URL');
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'orgId and projectId must be provided in URL query parameters',
      });
    }

    // Verify webhook authorization
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers['authorization'];
      if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
        console.warn('RevenueCat webhook received with invalid authorization');
        return res.status(401).json({ error: 'Unauthorized - invalid webhook secret' });
      }
    } else {
      console.warn('REVENUECAT_WEBHOOK_SECRET not configured - webhook verification disabled');
    }

    // Validate payload structure
    if (!req.body || typeof req.body !== 'object' || !req.body.event) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Verify the RevenueCat integration exists and is enabled for this project
    const integrationsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('revenueIntegrations')
      .where('provider', '==', 'revenuecat')
      .where('enabled', '==', true)
      .limit(1)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('RevenueCat webhook: no active integration found - ignoring');
      return res.status(200).json({
        success: false,
        message: 'No active RevenueCat integration configured',
      });
    }

    const webhookData = req.body as RevenueCatWebhookEvent;
    const { event } = webhookData;

    console.log('RevenueCat webhook received:', {
      orgId,
      projectId,
      type: event.type,
      app_user_id: event.app_user_id,
      product_id: event.product_id,
    });

    // Process event by type
    try {
      switch (event.type) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
        case 'NON_RENEWING_PURCHASE':
          await handlePurchaseEvent(orgId, projectId, event);
          break;

        case 'CANCELLATION':
          await handleCancellationEvent(orgId, projectId, event);
          break;

        case 'UNCANCELLATION':
          await handleUncancellationEvent(orgId, projectId, event);
          break;

        case 'EXPIRATION':
          await handleExpirationEvent(orgId, projectId, event);
          break;

        case 'BILLING_ISSUE':
          await handleBillingIssueEvent(orgId, projectId, event);
          break;

        case 'PRODUCT_CHANGE':
          await handleProductChangeEvent(orgId, projectId, event);
          break;

        case 'SUBSCRIPTION_PAUSED':
          await handleStatusUpdateEvent(orgId, projectId, event, 'paused');
          break;

        case 'SUBSCRIPTION_EXTENDED':
          await handlePurchaseEvent(orgId, projectId, event);
          break;

        default:
          console.log(`RevenueCat webhook: unhandled event type: ${event.type}`);
      }
    } catch (processError) {
      console.error(`Error processing event type ${event.type}:`, processError);
    }

    // Log webhook receipt for audit trail
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('webhookLogs')
      .add({
        provider: 'revenuecat',
        eventType: event.type,
        appUserId: event.app_user_id,
        receivedAt: FieldValue.serverTimestamp(),
        data: webhookData,
        processed: true,
      });

    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error: any) {
    console.error('RevenueCat webhook error:', error);
    // Return 200 to prevent RevenueCat from retrying on our errors
    return res.status(200).json({ received: true, error: error.message });
  }
}

async function handlePurchaseEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event']
) {
  const takehome = event.takehome_percentage ?? 0.7;
  const priceInCurrency = event.price_in_purchased_currency ?? event.price ?? 0;
  const amountInCents = Math.round(priceInCurrency * 100);
  const netAmountInCents = Math.round(priceInCurrency * takehome * 100);

  const transactionId = `rc_${event.app_user_id}_${event.purchased_at_ms || Date.now()}`;

  const transaction = {
    id: transactionId,
    transactionId,
    organizationId: orgId,
    projectId,
    provider: 'revenuecat' as const,
    platform: mapStoreToPlatform(event.store),
    customerId: event.app_user_id,
    amount: amountInCents,
    netAmount: netAmountInCents,
    currency: event.currency || 'USD',
    productId: event.product_id || 'unknown',
    purchaseDate: new Date(event.purchased_at_ms || Date.now()),
    expirationDate: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
    type: event.period_type === 'TRIAL' ? 'trial' : event.type === 'RENEWAL' ? 'renewal' : 'purchase',
    status: 'active' as const,
    isRenewal: event.type === 'RENEWAL',
    isTrial: event.period_type === 'TRIAL',
    isTrialConversion: event.is_trial_conversion || false,
    metadata: {
      eventType: event.type,
      environment: event.environment || 'PRODUCTION',
      periodType: event.period_type,
      store: event.store,
      entitlementIds: event.entitlement_ids || [],
      originalAppUserId: event.original_app_user_id,
      presentedOfferingId: event.presented_offering_id,
      rawEvent: event,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await transactionsCollection(orgId, projectId)
    .doc(transactionId)
    .set(transaction, { merge: true });

  console.log(`RevenueCat: stored transaction ${transactionId} - $${(amountInCents / 100).toFixed(2)}`);
}

async function handleCancellationEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event']
) {
  const query = transactionsCollection(orgId, projectId)
    .where('customerId', '==', event.app_user_id)
    .where('provider', '==', 'revenuecat')
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: 'cancelled',
      cancelReason: event.cancel_reason || event.cancellation_reason || null,
      updatedAt: new Date(),
    });
    console.log(`RevenueCat: cancelled subscription for ${event.app_user_id}`);
  } else {
    console.log(`RevenueCat: no active transaction found for cancellation - ${event.app_user_id}`);
  }
}

async function handleUncancellationEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event']
) {
  const query = transactionsCollection(orgId, projectId)
    .where('customerId', '==', event.app_user_id)
    .where('provider', '==', 'revenuecat')
    .where('status', '==', 'cancelled')
    .orderBy('purchaseDate', 'desc')
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: 'active',
      cancelReason: null,
      updatedAt: new Date(),
    });
    console.log(`RevenueCat: reactivated subscription for ${event.app_user_id}`);
  }
}

async function handleExpirationEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event']
) {
  const query = transactionsCollection(orgId, projectId)
    .where('customerId', '==', event.app_user_id)
    .where('provider', '==', 'revenuecat')
    .where('status', 'in', ['active', 'cancelled'])
    .orderBy('purchaseDate', 'desc')
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: 'expired',
      updatedAt: new Date(),
    });
    console.log(`RevenueCat: expired subscription for ${event.app_user_id}`);
  }
}

async function handleBillingIssueEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event']
) {
  const query = transactionsCollection(orgId, projectId)
    .where('customerId', '==', event.app_user_id)
    .where('provider', '==', 'revenuecat')
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      hasBillingIssue: true,
      updatedAt: new Date(),
    });
    console.log(`RevenueCat: billing issue flagged for ${event.app_user_id}`);
  }
}

async function handleProductChangeEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event']
) {
  // Mark the old subscription as upgraded/downgraded
  const query = transactionsCollection(orgId, projectId)
    .where('customerId', '==', event.app_user_id)
    .where('provider', '==', 'revenuecat')
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: 'expired',
      'metadata.replacedByProduct': event.new_product_id || event.product_id,
      updatedAt: new Date(),
    });
  }

  // Create a new transaction for the new product
  await handlePurchaseEvent(orgId, projectId, event);
  console.log(`RevenueCat: product change for ${event.app_user_id}`);
}

async function handleStatusUpdateEvent(
  orgId: string,
  projectId: string,
  event: RevenueCatWebhookEvent['event'],
  newStatus: string
) {
  const query = transactionsCollection(orgId, projectId)
    .where('customerId', '==', event.app_user_id)
    .where('provider', '==', 'revenuecat')
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    await snapshot.docs[0].ref.update({
      status: newStatus,
      updatedAt: new Date(),
    });
    console.log(`RevenueCat: subscription ${newStatus} for ${event.app_user_id}`);
  }
}

function mapStoreToPlatform(store?: string): 'ios' | 'android' | 'web' | 'other' {
  switch (store) {
    case 'APP_STORE':
      return 'ios';
    case 'PLAY_STORE':
      return 'android';
    case 'STRIPE':
      return 'web';
    default:
      return 'other';
  }
}

