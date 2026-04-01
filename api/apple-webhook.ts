/**
 * Apple App Store Server Notifications V2 Webhook Handler
 * Receives real-time subscription lifecycle events from Apple
 * Documentation: https://developer.apple.com/documentation/appstoreservernotifications
 *
 * URL format: /api/apple-webhook?orgId=xxx&projectId=yyy
 *
 * Apple sends a signed JWS (JSON Web Signature) payload. The outer payload
 * contains a `signedPayload` field which is a JWS string. Inside that is the
 * notification with `notificationType`, `subtype`, and `data` containing
 * `signedTransactionInfo` and `signedRenewalInfo` (also JWS strings).
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

/**
 * Decode a JWS token by extracting and base64-decoding the payload (middle segment).
 * Note: This does NOT verify the signature. For production, you should verify
 * against Apple's root certificate chain.
 */
function decodeJWSPayload(jws: string): any {
  const parts = jws.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWS format');
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

/**
 * Recursively strip undefined values from an object so Firestore doesn't reject it
 */
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
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

/**
 * Map Apple notification types to transaction status
 */
function mapNotificationToStatus(
  notificationType: string,
  subtype?: string
): 'active' | 'cancelled' | 'expired' | 'refunded' {
  switch (notificationType) {
    case 'REFUND':
    case 'REVOKE':
      return 'refunded';
    case 'EXPIRED':
      return 'expired';
    case 'DID_CHANGE_RENEWAL_STATUS':
      return subtype === 'AUTO_RENEW_DISABLED' ? 'cancelled' : 'active';
    default:
      return 'active';
  }
}

/**
 * Map Apple notification types to transaction type
 */
function mapNotificationToType(
  notificationType: string,
  subtype?: string
): 'purchase' | 'renewal' | 'refund' | 'trial' {
  switch (notificationType) {
    case 'REFUND':
      return 'refund';
    case 'DID_RENEW':
      return 'renewal';
    case 'SUBSCRIBED':
      if (subtype === 'INITIAL_BUY') return 'purchase';
      return 'purchase';
    case 'OFFER_REDEEMED':
      return 'trial';
    default:
      return 'purchase';
  }
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
      console.error('Apple webhook: missing orgId or projectId in URL');
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'orgId and projectId must be provided in URL query parameters',
      });
    }

    // Validate payload
    if (!req.body || !req.body.signedPayload) {
      return res.status(400).json({ error: 'Invalid webhook payload - missing signedPayload' });
    }

    // Verify the Apple integration exists and is enabled for this project
    const integrationsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('revenueIntegrations')
      .where('provider', '==', 'apple')
      .where('enabled', '==', true)
      .limit(1)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('Apple webhook: no active integration found - ignoring');
      return res.status(200).json({
        success: false,
        message: 'No active Apple App Store integration configured',
      });
    }

    // Decode the outer notification payload
    const notification = decodeJWSPayload(req.body.signedPayload);
    const { notificationType, subtype, data } = notification;

    console.log('Apple webhook received:', {
      orgId,
      projectId,
      notificationType,
      subtype,
      environment: data?.environment,
      bundleId: data?.bundleId,
    });

    // Decode the signed transaction info if present
    let transactionInfo: any = null;
    if (data?.signedTransactionInfo) {
      try {
        transactionInfo = decodeJWSPayload(data.signedTransactionInfo);
      } catch (err) {
        console.error('Apple webhook: failed to decode signedTransactionInfo:', err);
      }
    }

    // Decode the signed renewal info if present
    let renewalInfo: any = null;
    if (data?.signedRenewalInfo) {
      try {
        renewalInfo = decodeJWSPayload(data.signedRenewalInfo);
      } catch (err) {
        console.error('Apple webhook: failed to decode signedRenewalInfo:', err);
      }
    }

    // Process the notification
    let processingFailed = false;
    try {
      await processAppleNotification(
        orgId,
        projectId,
        notificationType,
        subtype,
        data,
        transactionInfo,
        renewalInfo
      );
    } catch (processError) {
      console.error(`Apple webhook: error processing ${notificationType}:`, processError);
      processingFailed = true;
    }

    // Log webhook receipt for audit trail
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('webhookLogs')
      .add(stripUndefined({
        provider: 'apple',
        eventType: notificationType,
        subtype: subtype || null,
        environment: data?.environment || null,
        receivedAt: FieldValue.serverTimestamp(),
        data: {
          notificationType,
          subtype,
          bundleId: data?.bundleId,
          environment: data?.environment,
          transactionId: transactionInfo?.transactionId,
          productId: transactionInfo?.productId,
        },
        processed: !processingFailed,
        ...(processingFailed ? { error: 'Event processing failed - check server logs' } : {}),
      }));

    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error: any) {
    console.error('Apple webhook error:', error);
    // Return 200 to prevent Apple from retrying on our errors
    return res.status(200).json({ received: true, error: error.message });
  }
}

async function processAppleNotification(
  orgId: string,
  projectId: string,
  notificationType: string,
  subtype: string | undefined,
  data: any,
  transactionInfo: any,
  renewalInfo: any
) {
  if (!transactionInfo) {
    console.log(`Apple webhook: no transaction info for ${notificationType} - skipping`);
    return;
  }

  const status = mapNotificationToStatus(notificationType, subtype);
  const type = mapNotificationToType(notificationType, subtype);

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'OFFER_REDEEMED':
    case 'PRICE_INCREASE':
      await upsertTransaction(orgId, projectId, transactionInfo, renewalInfo, data, {
        notificationType,
        subtype,
        status,
        type,
      });
      break;

    case 'DID_CHANGE_RENEWAL_STATUS':
      // User toggled auto-renew on/off
      await updateTransactionStatus(orgId, projectId, transactionInfo, status, {
        autoRenewStatus: renewalInfo?.autoRenewStatus,
        notificationType,
        subtype,
      });
      break;

    case 'DID_CHANGE_RENEWAL_PREF':
      // User changed their subscription product for next renewal
      await updateTransactionMetadata(orgId, projectId, transactionInfo, {
        pendingProductChange: renewalInfo?.autoRenewProductId,
        notificationType,
        subtype,
      });
      break;

    case 'EXPIRED':
      await updateTransactionStatus(orgId, projectId, transactionInfo, 'expired', {
        expirationReason: subtype,
        notificationType,
      });
      break;

    case 'DID_FAIL_TO_RENEW':
      await updateTransactionMetadata(orgId, projectId, transactionInfo, {
        hasBillingIssue: true,
        billingRetry: subtype === 'GRACE_PERIOD',
        notificationType,
        subtype,
      });
      break;

    case 'GRACE_PERIOD_EXPIRED':
      await updateTransactionStatus(orgId, projectId, transactionInfo, 'expired', {
        expirationReason: 'GRACE_PERIOD_EXPIRED',
        notificationType,
      });
      break;

    case 'REFUND':
      await updateTransactionStatus(orgId, projectId, transactionInfo, 'refunded', {
        refundDate: transactionInfo.revocationDate
          ? new Date(transactionInfo.revocationDate)
          : new Date(),
        refundReason: transactionInfo.revocationReason,
        notificationType,
      });
      break;

    case 'REVOKE':
      await updateTransactionStatus(orgId, projectId, transactionInfo, 'refunded', {
        revokedDate: new Date(),
        notificationType,
      });
      break;

    case 'CONSUMPTION_REQUEST':
      // Apple is asking for consumption info — log only, no action
      console.log(`Apple webhook: consumption request for ${transactionInfo.transactionId}`);
      break;

    default:
      console.log(`Apple webhook: unhandled notification type ${notificationType}`);
      // Still store/update the transaction with whatever info we have
      await upsertTransaction(orgId, projectId, transactionInfo, renewalInfo, data, {
        notificationType,
        subtype,
        status,
        type,
      });
  }
}

async function upsertTransaction(
  orgId: string,
  projectId: string,
  transactionInfo: any,
  renewalInfo: any,
  notificationData: any,
  opts: { notificationType: string; subtype?: string; status: string; type: string }
) {
  const transactionId = `apple_${transactionInfo.transactionId || transactionInfo.originalTransactionId}`;
  const priceInMilliunits = transactionInfo.price || 0;
  // Apple sends price in milliunits (price * 1000) — convert to cents
  const amountInCents = Math.round(priceInMilliunits / 10);

  const isTrial =
    transactionInfo.offerType === 3 || // free trial offer type
    transactionInfo.type === 'Auto-Renewable Subscription' && priceInMilliunits === 0;

  const transaction = {
    id: transactionId,
    transactionId,
    organizationId: orgId,
    projectId,
    provider: 'apple' as const,
    platform: 'ios' as const,
    customerId: transactionInfo.appAccountToken || transactionInfo.originalTransactionId || 'unknown',
    amount: amountInCents,
    netAmount: Math.round(amountInCents * 0.7), // Apple takes 30% (15% for small business)
    currency: transactionInfo.currency || 'USD',
    productId: transactionInfo.productId || 'unknown',
    purchaseDate: transactionInfo.purchaseDate
      ? new Date(transactionInfo.purchaseDate)
      : new Date(),
    expirationDate: transactionInfo.expiresDate
      ? new Date(transactionInfo.expiresDate)
      : null,
    type: opts.type,
    status: opts.status,
    isRenewal: opts.notificationType === 'DID_RENEW',
    isTrial,
    isTrialConversion: opts.subtype === 'BILLING_RECOVERY' || false,
    metadata: {
      notificationType: opts.notificationType,
      subtype: opts.subtype,
      environment: notificationData?.environment || 'Production',
      bundleId: notificationData?.bundleId,
      originalTransactionId: transactionInfo.originalTransactionId,
      webOrderLineItemId: transactionInfo.webOrderLineItemId,
      subscriptionGroupIdentifier: transactionInfo.subscriptionGroupIdentifier,
      storefront: transactionInfo.storefront,
      autoRenewStatus: renewalInfo?.autoRenewStatus,
      autoRenewProductId: renewalInfo?.autoRenewProductId,
      offerType: transactionInfo.offerType,
      rawTransactionInfo: transactionInfo,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await transactionsCollection(orgId, projectId)
    .doc(transactionId)
    .set(stripUndefined(transaction), { merge: true });

  console.log(
    `Apple: stored transaction ${transactionId} (${opts.notificationType}) - $${(amountInCents / 100).toFixed(2)}`
  );
}

async function updateTransactionStatus(
  orgId: string,
  projectId: string,
  transactionInfo: any,
  newStatus: string,
  extraFields: Record<string, any> = {}
) {
  // Try to find by Apple transaction ID
  const transactionId = `apple_${transactionInfo.transactionId || transactionInfo.originalTransactionId}`;
  const docRef = transactionsCollection(orgId, projectId).doc(transactionId);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update(stripUndefined({
      status: newStatus,
      ...Object.fromEntries(
        Object.entries(extraFields).map(([k, v]) => [`metadata.${k}`, v])
      ),
      updatedAt: new Date(),
    }));
    console.log(`Apple: updated ${transactionId} status to ${newStatus}`);
  } else {
    // Transaction not found — create a minimal record so we don't lose the event
    await upsertTransaction(orgId, projectId, transactionInfo, null, null, {
      notificationType: extraFields.notificationType || 'UNKNOWN',
      subtype: extraFields.subtype,
      status: newStatus,
      type: newStatus === 'refunded' ? 'refund' : 'purchase',
    });
  }
}

async function updateTransactionMetadata(
  orgId: string,
  projectId: string,
  transactionInfo: any,
  metadataUpdates: Record<string, any>
) {
  const transactionId = `apple_${transactionInfo.transactionId || transactionInfo.originalTransactionId}`;
  const docRef = transactionsCollection(orgId, projectId).doc(transactionId);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update(stripUndefined({
      ...Object.fromEntries(
        Object.entries(metadataUpdates).map(([k, v]) => [`metadata.${k}`, v])
      ),
      updatedAt: new Date(),
    }));
    console.log(`Apple: updated metadata for ${transactionId}`);
  } else {
    console.log(`Apple: transaction ${transactionId} not found for metadata update`);
  }
}
