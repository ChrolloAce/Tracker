/**
 * RevenueCat Webhook Handler
 * Receives real-time transaction events from RevenueCat
 * Documentation: https://www.revenuecat.com/docs/integrations/webhooks
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  };
  api_version: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body as RevenueCatWebhookEvent;
    
    if (!webhookData || !webhookData.event) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const { event } = webhookData;
    
    console.log('Received RevenueCat webhook:', {
      type: event.type,
      app_user_id: event.app_user_id,
      product_id: event.product_id,
    });

    // Process different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'NON_RENEWING_PURCHASE':
        await handlePurchaseEvent(event);
        break;
      
      case 'CANCELLATION':
        await handleCancellationEvent(event);
        break;
      
      case 'EXPIRATION':
        await handleExpirationEvent(event);
        break;
      
      case 'BILLING_ISSUE':
        await handleBillingIssueEvent(event);
        break;
      
      case 'PRODUCT_CHANGE':
        await handleProductChangeEvent(event);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });

  } catch (error: any) {
    console.error('RevenueCat webhook error:', error);
    // Still return 200 to prevent RevenueCat from retrying
    return res.status(200).json({ 
      received: true, 
      error: error.message 
    });
  }
}

async function handlePurchaseEvent(event: RevenueCatWebhookEvent['event']) {
  // Find which organization/project this user belongs to
  // You'll need to link the RevenueCat app_user_id to your organization/project
  // This is a simplified example - you'll need to customize based on your user model
  
  const transaction = {
    id: `rc_${event.app_user_id}_${event.purchased_at_ms}`,
    provider: 'revenuecat',
    platform: mapStoreToPlatform(event.store),
    transactionId: `${event.purchased_at_ms}`,
    customerId: event.app_user_id,
    amount: Math.round((event.price || 0) * 100), // Convert to cents
    currency: event.currency || 'USD',
    productId: event.product_id || 'unknown',
    purchaseDate: new Date(event.purchased_at_ms || Date.now()),
    expirationDate: event.expiration_at_ms ? new Date(event.expiration_at_ms) : undefined,
    type: event.period_type === 'TRIAL' ? 'trial' : 'purchase',
    status: 'active',
    isRenewal: event.type === 'RENEWAL',
    isTrial: event.period_type === 'TRIAL',
    isTrialConversion: event.is_trial_conversion || false,
    environment: event.environment,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store transaction in Firestore
  // Note: You'll need to determine the orgId and projectId from the app_user_id
  // For now, we'll store it in a global collection that can be claimed later
  await db.collection('revenuecat_transactions').doc(transaction.id).set(transaction);
  
  console.log('Stored transaction:', transaction.id);
}

async function handleCancellationEvent(event: RevenueCatWebhookEvent['event']) {
  // Update subscription status
  console.log('Processing cancellation for user:', event.app_user_id);
  
  // Find and update the transaction
  const query = db.collection('revenuecat_transactions')
    .where('customerId', '==', event.app_user_id)
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .limit(1);
  
  const snapshot = await query.get();
  
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      status: 'cancelled',
      cancelReason: event.cancel_reason || event.cancellation_reason,
      updatedAt: new Date(),
    });
  }
}

async function handleExpirationEvent(event: RevenueCatWebhookEvent['event']) {
  console.log('Processing expiration for user:', event.app_user_id);
  
  // Find and update the transaction
  const query = db.collection('revenuecat_transactions')
    .where('customerId', '==', event.app_user_id)
    .where('status', 'in', ['active', 'cancelled'])
    .orderBy('purchaseDate', 'desc')
    .limit(1);
  
  const snapshot = await query.get();
  
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      status: 'expired',
      updatedAt: new Date(),
    });
  }
}

async function handleBillingIssueEvent(event: RevenueCatWebhookEvent['event']) {
  console.log('Processing billing issue for user:', event.app_user_id);
  
  // Update subscription with billing issue flag
  const query = db.collection('revenuecat_transactions')
    .where('customerId', '==', event.app_user_id)
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .limit(1);
  
  const snapshot = await query.get();
  
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await doc.ref.update({
      hasBillingIssue: true,
      updatedAt: new Date(),
    });
  }
}

async function handleProductChangeEvent(event: RevenueCatWebhookEvent['event']) {
  console.log('Processing product change for user:', event.app_user_id);
  
  // This would involve creating a new transaction for the new product
  // and updating the old one
  await handlePurchaseEvent(event);
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

