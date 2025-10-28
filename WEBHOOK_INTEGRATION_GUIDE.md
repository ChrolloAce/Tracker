# Webhook Integration Guide

ViewTrack now supports **real-time webhook receivers** for revenue integrations! Instead of manual syncing, your revenue data updates automatically when transactions occur.

## 🎯 Supported Providers

- ✅ **Superwall** - Fully supported
- ✅ **RevenueCat** - Coming soon
- ⏳ **Apple App Store** - Direct API only (no webhooks)

## 🚀 How It Works

1. **Unique URLs**: Each integration gets a unique, secure webhook URL
2. **Real-time**: Transactions are recorded instantly when they occur
3. **Automatic**: No manual syncing required
4. **Organized**: All data is automatically categorized by organization and project

## 📋 Setup Instructions

### Step 1: Add Integration

1. Go to **Settings** → **Revenue Integrations**
2. Click **"Add Integration"**
3. Select your provider (e.g., Superwall)
4. Enter your API credentials
5. Click **"Save Integration"**

### Step 2: Copy Webhook URL

After saving, you'll see a **"Webhook URL"** section with:
- 🔗 Your unique webhook endpoint
- 📋 A "Copy URL" button
- ⚡ Real-time event badge

Click **"Copy URL"** to copy your webhook endpoint.

### Step 3: Configure in Provider Dashboard

#### For Superwall:

1. Go to [Superwall Dashboard](https://superwall.com/dashboard)
2. Navigate to **Settings** → **Webhooks**
3. Click **"Create Webhook"**
4. **Webhook URL**: Paste your copied URL
5. **Events**: Select all transaction events:
   - ✅ `transaction`
   - ✅ `purchase`
   - ✅ `subscription_started`
   - ✅ `subscription_renewed`
   - ✅ `subscription_cancelled`
   - ✅ `subscription_expired`
   - ✅ `trial_started`
6. Click **"Create"**

#### For RevenueCat:

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Navigate to **Settings** → **Webhooks**
3. Click **"+ Add Webhook"**
4. **URL**: Paste your copied URL
5. **Events**: Select all events
6. Click **"Add Webhook"**

### Step 4: Test the Webhook

1. Make a test purchase in your app (use sandbox/test mode)
2. Check ViewTrack dashboard - the transaction should appear instantly!
3. No manual syncing needed ✨

## 🔒 Security

### How Webhook URLs Are Secured:

1. **Organization-Specific**: Each webhook is tied to your organization ID
2. **Project-Specific**: Transactions go to the correct project
3. **Validation**: Only enabled integrations can receive webhooks
4. **Logging**: All webhook events are logged for auditing

### Webhook URL Format:

```
https://your-domain.com/api/superwall-webhook?orgId=xxx&projectId=yyy
```

- `orgId`: Your organization ID
- `projectId`: Your project ID

## 📊 What Gets Tracked

### Transaction Events:
- 💰 Purchase amount and currency
- 👤 Customer/User ID
- 📦 Product ID
- 📅 Transaction timestamp
- 📱 Platform (iOS/Android/Web)
- 🔄 Transaction type (purchase/subscription/renewal/refund)

### Subscription Events:
- 🆕 New subscriptions
- 🔄 Renewals
- ❌ Cancellations
- ⏰ Expirations
- 🎁 Trial starts

### Metadata:
- Original transaction ID
- Subscription ID
- Environment (sandbox/production)
- All raw event data for reference

## 📈 Benefits

### Versus Manual Syncing:

| Feature | Manual Sync | Webhooks |
|---------|------------|----------|
| **Update Speed** | Every 60 mins | Instant |
| **Data Freshness** | Delayed | Real-time |
| **User Action** | Required | Automatic |
| **API Calls** | Frequent | None |
| **Accuracy** | Good | Excellent |

### Why Use Webhooks?

✅ **Instant Updates**: See transactions as they happen
✅ **No Rate Limits**: Provider sends data to you
✅ **Reduced Costs**: Fewer API calls
✅ **Better UX**: Always up-to-date dashboards
✅ **Event History**: Complete audit trail

## 🛠️ Troubleshooting

### Webhook Not Receiving Events

1. **Check Integration Status**: Make sure it's "Active" (green toggle)
2. **Verify URL**: Copy the URL again and update in provider dashboard
3. **Check Provider Settings**: Ensure all event types are selected
4. **Test with Sandbox**: Try a test transaction first

### Transactions Not Appearing

1. **Check Webhook Logs**: View logs in ViewTrack (coming soon)
2. **Verify Provider**: Make sure events are being sent from provider
3. **Check Time**: Allow 2-3 seconds for processing
4. **Review Filters**: Ensure you're viewing the correct date range

### Multiple Organizations/Projects

Each organization and project gets its own unique webhook URL. Make sure you're using the correct URL for the right project!

## 📝 Webhook Log Viewer (Coming Soon!)

In a future update, you'll be able to:
- View all received webhook events
- See processing status
- Inspect raw event data
- Debug failed events
- Retry failed webhooks

## 💡 Pro Tips

1. **Use Webhooks + Manual Sync**: Keep manual sync as a backup
2. **Test in Sandbox First**: Always test with test transactions
3. **Monitor Regularly**: Check dashboard to ensure events are coming through
4. **Document Your Setup**: Keep track of which webhooks are configured where
5. **Update URLs Carefully**: Changing URLs requires updating provider dashboard

## 🎉 You're All Set!

Once configured, your revenue data will flow automatically into ViewTrack. Sit back and watch your metrics update in real-time! 🚀

---

**Need Help?** Check the provider-specific guides:
- [Superwall Webhook Documentation](https://docs.superwall.com/webhooks)
- [RevenueCat Webhook Documentation](https://docs.revenuecat.com/docs/webhooks)


