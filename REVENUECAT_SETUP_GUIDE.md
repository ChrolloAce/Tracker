# RevenueCat Integration Setup Guide

## Important: RevenueCat Requires Webhooks

RevenueCat's public REST API **does not support** fetching historical transaction data. To integrate RevenueCat with your application, you must use **webhooks** to receive transaction events in real-time.

## Why Webhooks?

RevenueCat is designed to push transaction data to your server via webhooks rather than allowing you to pull it via API. This ensures:
- Real-time transaction updates
- No missed transactions
- Better security
- Lower API usage

## Setup Instructions

### Step 1: Get Your Webhook URL

Your webhook endpoint is:
```
https://your-domain.vercel.app/api/revenuecat-webhook
```

Replace `your-domain.vercel.app` with your actual Vercel deployment URL.

### Step 2: Configure RevenueCat Webhook

1. Log in to your [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project
3. Go to **Integrations** → **Webhooks**
4. Click **+ New**
5. Enter your webhook URL: `https://your-domain.vercel.app/api/revenuecat-webhook`
6. Select the events you want to receive:
   - ✅ **INITIAL_PURCHASE** (First purchase)
   - ✅ **RENEWAL** (Subscription renewal)
   - ✅ **NON_RENEWING_PURCHASE** (One-time purchase)
   - ✅ **CANCELLATION** (Subscription cancelled)
   - ✅ **EXPIRATION** (Subscription expired)
   - ✅ **BILLING_ISSUE** (Payment failed)
   - ✅ **PRODUCT_CHANGE** (User changed subscription tier)
7. Save the webhook configuration

### Step 3: Test the Webhook

1. In RevenueCat dashboard, use the "Send Test" button to send a test webhook
2. Check your Vercel function logs to confirm receipt
3. Verify the transaction appears in your Firestore database under `revenuecat_transactions`

### Step 4: Link Users to Projects (Optional)

By default, webhook transactions are stored in a global `revenuecat_transactions` collection. To link them to specific organizations/projects:

1. When creating a user in RevenueCat, use your internal user ID as the `app_user_id`
2. Store a mapping in Firestore:
   ```
   /revenuecat_user_mappings/{app_user_id}
     - organizationId
     - projectId
   ```
3. Update the webhook handler to use this mapping

## What Data Gets Synced?

The webhook receives and stores:
- Transaction ID
- Customer ID (app_user_id)
- Product ID
- Amount and Currency
- Purchase Date
- Expiration Date (for subscriptions)
- Platform (iOS, Android, Web)
- Status (active, cancelled, expired)
- Trial information
- Environment (sandbox vs production)

## Viewing Your Data

Once webhooks are configured:
1. New transactions will automatically appear in Firestore
2. The dashboard will show revenue metrics
3. You can manually sync existing data from RevenueCat's export feature

## API Key Usage

Your RevenueCat API key is used for:
- ✅ **Test Connection** - Verify credentials
- ✅ **Subscriber Lookup** - Get individual subscriber details
- ❌ **NOT for pulling transaction history** - Use webhooks instead

## Troubleshooting

### Webhook Not Receiving Events
- Verify your webhook URL is publicly accessible
- Check Vercel function logs for errors
- Ensure Firebase credentials are configured in Vercel environment variables
- Test with RevenueCat's "Send Test" feature

### Transactions Not Appearing in Dashboard
- Check Firestore rules allow writes to `revenuecat_transactions`
- Verify the webhook handler is running (check Vercel logs)
- Ensure transactions are being linked to the correct organization/project

### Sandbox vs Production
- Webhooks work in both sandbox and production
- Use the `environment` field to filter sandbox transactions if needed
- Test in sandbox before going to production

## Advanced Configuration

### Custom User Mapping

Edit `/api/revenuecat-webhook.ts` to customize how users are mapped to organizations:

```typescript
async function handlePurchaseEvent(event) {
  // Get organization/project from user mapping
  const mappingDoc = await db
    .collection('revenuecat_user_mappings')
    .doc(event.app_user_id)
    .get();
  
  const mapping = mappingDoc.data();
  
  if (mapping) {
    // Store in organization's project collection
    await db
      .collection('organizations')
      .doc(mapping.organizationId)
      .collection('projects')
      .doc(mapping.projectId)
      .collection('revenueTransactions')
      .doc(transactionId)
      .set(transaction);
  }
}
```

### Webhook Security

For production, add webhook signature verification:

```typescript
// Get your webhook authorization header from RevenueCat dashboard
const authHeader = req.headers['authorization'];
if (authHeader !== process.env.REVENUECAT_WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

## Need Help?

- [RevenueCat Webhooks Documentation](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat Support](https://community.revenuecat.com/)
- [Your App's Vercel Logs](https://vercel.com/dashboard)

## Summary

1. ✅ RevenueCat API key configured (for test connection)
2. ⚠️ **Action Required**: Set up webhooks in RevenueCat dashboard
3. 📝 Configure webhook URL: `https://your-domain.vercel.app/api/revenuecat-webhook`
4. ✨ Transactions will automatically sync in real-time

Once webhooks are configured, you'll see transaction data flowing into your dashboard automatically!

