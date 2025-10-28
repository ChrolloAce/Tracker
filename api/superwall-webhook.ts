import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

/**
 * Superwall Webhook Handler
 * Receives transaction events from Superwall and stores them in Firestore
 * 
 * URL format: /api/superwall-webhook?orgId=xxx&projectId=yyy
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { orgId, projectId } = req.query;

    if (!orgId || !projectId || typeof orgId !== 'string' || typeof projectId !== 'string') {
      console.error('❌ Missing orgId or projectId in webhook URL');
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'orgId and projectId must be provided in URL query parameters'
      });
    }

    const event = req.body;

    console.log('🎣 Superwall webhook received:', {
      orgId,
      projectId,
      eventType: event.event_type,
      timestamp: new Date().toISOString()
    });

    // Verify the integration exists and is enabled
    const integrationsSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('revenueIntegrations')
      .where('provider', '==', 'superwall')
      .where('enabled', '==', true)
      .limit(1)
      .get();

    if (integrationsSnapshot.empty) {
      console.error('❌ No active Superwall integration found');
      return res.status(404).json({ 
        error: 'Integration not found',
        details: 'No active Superwall integration found for this organization/project'
      });
    }

    // Process the webhook event based on type
    const eventType = event.event_type || event.type;

    switch (eventType) {
      case 'transaction':
      case 'purchase':
      case 'subscription_started':
      case 'subscription_renewed':
        await processTransactionEvent(orgId, projectId, event);
        break;

      case 'subscription_cancelled':
      case 'subscription_expired':
        await processSubscriptionEndEvent(orgId, projectId, event);
        break;

      case 'trial_started':
        await processTrialEvent(orgId, projectId, event);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${eventType}`);
    }

    // Log webhook receipt
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('webhookLogs')
      .add({
        provider: 'superwall',
        eventType,
        receivedAt: FieldValue.serverTimestamp(),
        data: event,
        processed: true
      });

    console.log('✅ Webhook processed successfully');
    res.status(200).json({ success: true, message: 'Webhook received' });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Process transaction/purchase events
 */
async function processTransactionEvent(
  orgId: string,
  projectId: string,
  event: any
) {
  const transaction = {
    id: event.transaction_id || event.id || `superwall_${Date.now()}`,
    userId: event.user_id || event.customer_id,
    productId: event.product_id,
    amount: parseFloat(event.revenue || event.amount || 0),
    currency: event.currency || 'USD',
    type: determineTransactionType(event),
    status: 'completed',
    platform: event.platform || 'unknown',
    provider: 'superwall' as const,
    timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    metadata: {
      eventType: event.event_type,
      subscriptionId: event.subscription_id,
      originalTransactionId: event.original_transaction_id,
      environment: event.environment,
      rawEvent: event
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Store transaction
  await db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('revenueTransactions')
    .doc(transaction.id)
    .set(transaction, { merge: true });

  console.log(`💰 Transaction stored: ${transaction.id} - $${transaction.amount}`);
}

/**
 * Process subscription end events
 */
async function processSubscriptionEndEvent(
  orgId: string,
  projectId: string,
  event: any
) {
  const subscriptionId = event.subscription_id || event.id;
  
  if (!subscriptionId) {
    console.warn('⚠️ No subscription ID in cancellation event');
    return;
  }

  // Update subscription status in existing transactions
  const transactionsSnapshot = await db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('revenueTransactions')
    .where('metadata.subscriptionId', '==', subscriptionId)
    .get();

  const batch = db.batch();

  transactionsSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      'metadata.subscriptionStatus': event.event_type,
      'metadata.cancelledAt': event.timestamp || new Date().toISOString(),
      updatedAt: new Date()
    });
  });

  await batch.commit();

  console.log(`🔕 Subscription ${subscriptionId} status updated: ${event.event_type}`);
}

/**
 * Process trial events
 */
async function processTrialEvent(
  orgId: string,
  projectId: string,
  event: any
) {
  const trial = {
    id: event.trial_id || event.id || `trial_${Date.now()}`,
    userId: event.user_id || event.customer_id,
    productId: event.product_id,
    startedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
    expiresAt: event.expiration_date ? new Date(event.expiration_date) : null,
    status: 'active',
    platform: event.platform || 'unknown',
    provider: 'superwall' as const,
    metadata: event,
    createdAt: new Date()
  };

  await db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('trials')
    .doc(trial.id)
    .set(trial, { merge: true });

  console.log(`🎁 Trial started: ${trial.id}`);
}

/**
 * Determine transaction type from event
 */
function determineTransactionType(event: any): 'purchase' | 'subscription' | 'refund' | 'renewal' {
  const eventType = event.event_type || event.type;
  
  if (eventType === 'refund') return 'refund';
  if (eventType === 'subscription_renewed' || eventType === 'renewal') return 'renewal';
  if (eventType === 'subscription_started' || event.is_subscription) return 'subscription';
  
  return 'purchase';
}

