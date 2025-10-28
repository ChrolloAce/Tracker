# Apple App Store Integration Guide

## Overview

You can now integrate directly with Apple's App Store to track revenue, subscriptions, and in-app purchases alongside your video performance metrics. This provides an alternative to RevenueCat for iOS revenue tracking.

## What You'll Get

- **Real-time subscription data** from App Store Server API
- **Transaction history** including purchases, renewals, refunds
- **Active subscription tracking**
- **Revenue metrics** (MRR, ARPU, etc.)
- **Unified dashboard** with video and revenue data

## Prerequisites

### 1. App Store Connect API Key

You need to create an API key in App Store Connect:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to **Users and Access** → **Keys** → **In-App Purchase**
3. Click **Generate API Key** or **+** button
4. Give it a name (e.g., "ViewTrack Integration")
5. **Download the .p8 private key file** (you can only download it once!)
6. Note down the **Key ID** (e.g., `2X9R4HXF34`)

### 2. Get Your Issuer ID

Still in App Store Connect → Users and Access → Keys:
- At the top of the page, you'll see your **Issuer ID**
- It looks like: `57246542-96fe-1a63-e053-0824d011072a`
- Copy this value

### 3. Get Your Bundle ID

- Go to App Store Connect → **Apps** → Select your app
- Under **App Information**, find your **Bundle ID**
- It looks like: `com.yourcompany.appname`

## Setting Up the Integration

### Step 1: Add Integration in ViewTrack

1. Go to **Settings** → **Revenue Integrations**
2. Click **Add Integration**
3. Select **Apple App Store** from the dropdown
4. Fill in the fields:
   - **Private Key (.p8 file)**: Click "Upload .p8 Key File" and select your `AuthKey_XXXXXXXXXX.p8` file
   - **Key ID**: This will auto-fill from your filename (e.g., `ZDN6JH8DST` from `AuthKey_ZDN6JH8DST.p8`)
   - **Issuer ID**: From App Store Connect (UUID format) - you need to enter this manually
   - **Bundle ID**: Your app's bundle ID (e.g., `com.yourcompany.appname`)
5. Click **Test Connection** to verify
6. Click **Save** if the test succeeds

**Note:** The system automatically converts your .p8 file to the required format when you upload it. No manual conversion needed!

### Step 2: Sync Your Data

After saving:
1. Click the **Sync All** button
2. ViewTrack will fetch the last 30 days of transaction data
3. Revenue metrics will appear in your dashboard

## Important Notes

### Server-Side JWT Generation Required

⚠️ **Security Note**: The Apple App Store integration requires server-side JWT token generation for production use.

For full production deployment, you'll need to create a serverless function:

**Example:** `/api/apple-auth-token.ts` (Vercel function)

```typescript
import { SignJWT } from 'jose';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { privateKey, keyId, issuerId } = req.body;
  
  // Decode the base64 private key
  const key = Buffer.from(privateKey, 'base64');
  
  // Generate JWT
  const jwt = await new SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: keyId,
      typ: 'JWT'
    })
    .setIssuedAt()
    .setIssuer(issuerId)
    .setAudience('appstoreconnect-v1')
    .setExpirationTime('20m')
    .sign(key);
    
  res.json({ token: jwt });
}
```

Install required package:
```bash
npm install jose
```

### Sandbox vs Production

- **Test Connection** uses Apple's Sandbox environment
- **Sync Data** uses Production by default
- You can configure this in the code (`useSandbox` parameter)

### Data Refresh

- Manual: Click **Sync All** button
- Automatic: Configure `autoSync` interval in integration settings
- Recommended: Sync once per hour to stay within API limits

## API Endpoints Used

The integration uses Apple's App Store Server API:

1. **Transaction History** - Get all transactions for a period
   - Endpoint: `/inApps/v1/history/{bundleId}`
   
2. **Subscription Status** - Check current subscription status
   - Endpoint: `/inApps/v1/subscriptions/{transactionId}`

3. **Server Notifications** - Webhook for real-time updates
   - You can set this up to receive instant subscription changes

## Webhook Setup (Optional)

For real-time subscription updates:

1. Create an endpoint in your app: `/api/apple-webhook.ts`
2. In App Store Connect → App Information → App Store Server Notifications
3. Add your webhook URL: `https://yourdomain.com/api/apple-webhook`
4. Select notification types (SUBSCRIBED, DID_RENEW, EXPIRED, etc.)

**Example webhook handler:**

```typescript
import AppleAppStoreService from '../src/services/AppleAppStoreService';
import RevenueDataService from '../src/services/RevenueDataService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { signedPayload } = req.body;
  
  // Verify the notification
  const isValid = await AppleAppStoreService.verifyNotification(signedPayload);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Parse the notification
  const notification = AppleAppStoreService.parseNotification(signedPayload);
  
  // Process based on notification type
  switch (notification.notificationType) {
    case 'SUBSCRIBED':
      // New subscription
      break;
    case 'DID_RENEW':
      // Subscription renewed
      break;
    case 'EXPIRED':
      // Subscription expired
      break;
    // ... handle other types
  }
  
  res.json({ success: true });
}
```

## Metrics Tracked

Once integrated, you'll see:

- **MRR** (Monthly Recurring Revenue)
- **ARR** (Annual Recurring Revenue)
- **Active Subscriptions** count
- **New Subscriptions** per period
- **Churn Rate**
- **Trial Conversions**
- **Revenue per User** (ARPU)
- **Revenue by Product**
- **Platform breakdown** (iOS, Android, Web)

## Troubleshooting

### "Failed to generate JWT" Error

- Make sure you've base64 encoded your .p8 file correctly
- Implement the server-side JWT generation endpoint

### "Invalid credentials" Error

- Verify your Key ID matches the one in App Store Connect
- Verify your Issuer ID is correct (UUID format)
- Make sure you're using the correct Bundle ID

### "No data returned"

- Check if you have transactions in the selected date range
- Verify your app has active subscriptions or purchases
- Try using Sandbox mode for testing with test purchases

### API Rate Limits

Apple's App Store Server API has rate limits:
- Recommended: 1 sync per hour
- Maximum: Don't exceed 100 requests/minute

## Support

For more information:
- [App Store Server API Documentation](https://developer.apple.com/documentation/appstoreserverapi)
- [App Store Server Notifications](https://developer.apple.com/documentation/appstoreservernotifications)
- [JWT Authentication Guide](https://developer.apple.com/documentation/appstoreserverapi/generating_tokens_for_api_requests)

## Benefits vs RevenueCat

**Apple Direct Integration:**
- ✅ No third-party service fees
- ✅ Direct connection to Apple
- ✅ Full control over data
- ❌ More complex setup
- ❌ Requires server-side JWT generation

**RevenueCat:**
- ✅ Easier setup
- ✅ Handles authentication for you
- ✅ Cross-platform support out of the box
- ❌ Additional service fees
- ❌ Data goes through third party

Choose based on your needs!

