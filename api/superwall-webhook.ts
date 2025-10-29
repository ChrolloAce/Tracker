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
  // WRAP EVERYTHING IN ERROR HANDLER
  try {
    console.log('🚀 Webhook handler started', {
      method: req.method,
      url: req.url,
      headers: req.headers
    });

    // Only accept POST requests
    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method Not Allowed', method: req.method });
    }

    const { orgId, projectId } = req.query;
    console.log('🔍 Query params:', { orgId, projectId });

    if (!orgId || !projectId || typeof orgId !== 'string' || typeof projectId !== 'string') {
      console.error('❌ Missing orgId or projectId in webhook URL');
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: 'orgId and projectId must be provided in URL query parameters'
      });
    }

    const event = req.body;
    console.log('📦 Request body received:', { 
      hasBody: !!event,
      bodyType: typeof event,
      bodyKeys: event ? Object.keys(event) : []
    });

    // Log the full payload for debugging
    console.log('🎣 Superwall webhook received:', {
      orgId,
      projectId,
      timestamp: new Date().toISOString(),
      fullPayload: JSON.stringify(event, null, 2)
    });

    // Verify the integration exists and is enabled
    console.log('🔍 Checking for Superwall integration...');
    let integrationsSnapshot;
    try {
      integrationsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('revenueIntegrations')
        .where('provider', '==', 'superwall')
        .where('enabled', '==', true)
        .limit(1)
        .get();
      
      console.log('✅ Firestore query successful, found:', integrationsSnapshot.size, 'integrations');
    } catch (firestoreError) {
      console.error('❌ Firestore query failed:', firestoreError);
      throw new Error(`Firestore query failed: ${firestoreError instanceof Error ? firestoreError.message : String(firestoreError)}`);
    }

    if (integrationsSnapshot.empty) {
      console.error('❌ No active Superwall integration found');
      return res.status(404).json({ 
        error: 'Integration not found',
        details: 'No active Superwall integration found for this organization/project'
      });
    }
    
    console.log('✅ Integration verified');

    // Process the webhook event based on type
    const eventType = event.event_type || event.type || event.event?.name || 'unknown';

    console.log(`📋 Processing event type: ${eventType}`);

    try {
      const normalizedEventType = eventType.toLowerCase().replace(/_/g, '');
      
      switch (normalizedEventType) {
        case 'transaction':
        case 'purchase':
        case 'subscriptionstarted':
        case 'subscriptionrenewed':
        case 'initialpurchase': // Superwall uses this
        case 'renewal': // ✅ Superwall renewal events
        case 'newsubscription':
          await processTransactionEvent(orgId, projectId, event);
          break;

        case 'subscriptioncancelled':
        case 'subscriptionexpired':
        case 'subscriptioncanceled':
          await processSubscriptionEndEvent(orgId, projectId, event);
          break;

        case 'trialstarted':
        case 'freetrialstarted':
          await processTrialEvent(orgId, projectId, event);
          break;

        default:
          console.log(`ℹ️ Unhandled event type: ${eventType} (normalized: ${normalizedEventType})`);
          // Still save it as transaction for debugging
          await processTransactionEvent(orgId, projectId, event);
      }
    } catch (processError) {
      console.error(`❌ Error processing event type ${eventType}:`, processError);
      // Log error but don't throw - still record the webhook
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
    console.error('❌ WEBHOOK PROCESSING ERROR:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : typeof error,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
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
  try {
    // Superwall event structure variations
    const eventData = event.event?.data || event.data || event;
    
    console.log('📦 Event data structure:', {
      hasEvent: !!event.event,
      hasData: !!event.data,
      keys: Object.keys(eventData)
    });

    // Extract amount - Superwall sends 'proceeds' (net revenue after fees) in dollars
    // Use proceeds (what you actually earn), not price (what customer paid)
    const proceedsInDollars = eventData.proceeds || 
                              eventData.price || 
                              eventData.priceInPurchasedCurrency || 
                              eventData.revenue || 
                              eventData.amount || 
                              0;
    
    // Convert to cents for storage
    const amountInCents = Math.round(proceedsInDollars * 100);

    // Extract all relevant IDs and data from Superwall event
    const transactionId = eventData.transactionId || 
                          eventData.transaction_id || 
                          eventData.id || 
                          event.id || 
                          `sw_${Date.now()}`;
    
    const originalTransactionId = eventData.originalTransactionId || 
                                  eventData.original_transaction_id || 
                                  transactionId;

    const customerId = eventData.originalAppUserId || 
                       eventData.user_id || 
                       eventData.customer_id || 
                       eventData.subscriber_id || 
                       'anonymous';

    const productId = eventData.productId || 
                      eventData.product_id || 
                      eventData.name || 
                      'unknown';

    // Determine purchase date (Superwall sends timestamps in milliseconds)
    let purchaseDate = new Date();
    if (eventData.purchasedAt) {
      purchaseDate = new Date(eventData.purchasedAt);
    } else if (eventData.purchased_at) {
      purchaseDate = new Date(eventData.purchased_at);
    } else if (eventData.timestamp) {
      purchaseDate = new Date(eventData.timestamp);
    } else if (event.timestamp) {
      purchaseDate = new Date(event.timestamp);
    }

    // Determine if renewal
    const isRenewal = (event.type || event.eventType || '').toLowerCase().includes('renewal') || 
                      (event.name || '').toLowerCase().includes('renewal');

    const transaction = {
      id: transactionId,
      transactionId: transactionId,
      organizationId: orgId,
      projectId: projectId,
      customerId: customerId,
      userId: customerId,
      productId: productId,
      amount: amountInCents,
      currency: eventData.currencyCode || eventData.currency || 'USD',
      type: determineTransactionType(event, eventData),
      status: 'completed' as const,
      platform: ((eventData.store || '').toLowerCase() === 'app_store' ? 'ios' : 
                 (eventData.store || '').toLowerCase() === 'play_store' ? 'android' :
                 'other') as 'ios' | 'android' | 'web' | 'other',
      provider: 'superwall' as const,
      purchaseDate,
      isRenewal,
      isTrial: eventData.isTrialConversion || false,
      metadata: {
        eventType: event.event_type || event.type || event.event?.name,
        subscriptionId: eventData.subscription_id,
        originalTransactionId: eventData.original_transaction_id,
        environment: eventData.environment || event.environment,
        rawEvent: event
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`💰 Storing transaction: ${transaction.id} - $${(transaction.amount / 100).toFixed(2)}`);

    // Store transaction
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('revenueTransactions')
      .doc(transaction.id)
      .set(transaction, { merge: true });

    console.log(`✅ Transaction stored successfully: ${transaction.id}`);
  } catch (error) {
    console.error('❌ Error in processTransactionEvent:', error);
    console.error('Event that caused error:', JSON.stringify(event, null, 2));
    throw error; // Re-throw to be caught by outer try-catch
  }
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
function determineTransactionType(event: any, eventData: any): 'purchase' | 'subscription' | 'refund' | 'renewal' {
  const eventType = (event.event_type || event.type || event.event?.name || '').toLowerCase();
  
  if (eventType.includes('refund')) return 'refund';
  if (eventType.includes('renewed') || eventType.includes('renewal')) return 'renewal';
  if (eventType.includes('subscription') || eventData?.is_subscription) return 'subscription';
  
  return 'purchase';
}

