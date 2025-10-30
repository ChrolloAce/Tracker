# 🧪 Stripe Test Webhook Setup Guide

## Your Test API Keys (Already Have)
```
Publishable Key: pk_test_51XXXXX...
Secret Key: sk_test_51XXXXX...
```

**Note:** You already have these test keys. Keep them in your Vercel environment variables:
- `STRIPE_PUBLISHABLE_KEY` = your pk_test_... key
- `STRIPE_SECRET_KEY` = your sk_test_... key

## Step 1: Create Test Webhook

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com
2. **Switch to TEST MODE** (toggle in top right corner - should show "Viewing test data")
3. **Navigate to Webhooks**:
   - Click "Developers" in left sidebar
   - Click "Webhooks"
4. **Click "+ Add endpoint"**

## Step 2: Configure the Endpoint

**Endpoint URL:**
```
https://your-vercel-app.vercel.app/api/stripe-webhook
```

**Description:**
```
Test Webhook for Development
```

**Events to listen for:**
Click "Select events" and choose these:

### Required Events:
- ✅ `checkout.session.completed` - When customer completes checkout
- ✅ `customer.subscription.created` - New subscription created
- ✅ `customer.subscription.updated` - Subscription changed (plan upgrade/downgrade)
- ✅ `customer.subscription.deleted` - Subscription cancelled
- ✅ `invoice.payment_succeeded` - Payment successful
- ✅ `invoice.payment_failed` - Payment failed

**Click "Add endpoint"**

## Step 3: Get Your Test Webhook Secret

1. After creating, click on the webhook endpoint you just created
2. Look for **"Signing secret"**
3. Click **"Reveal"** 
4. Copy the secret - it will look like: `whsec_test_XXXXXXXXXXXXXXXX`

## Step 4: Add to Vercel Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. **Add or Update** this variable:

```
Name: STRIPE_WEBHOOK_SECRET
Value: whsec_test_XXXXXXXXXXXXXXXX (paste your test secret here)
Environment: Preview, Development (NOT Production yet)
```

5. Click **Save**

## Step 5: Redeploy Your App

```bash
cd /Users/ernestolopez/Desktop/Scrpa
git add -A
git commit -m "Update Stripe test webhook secret"
git push
```

## Step 6: Test the Webhook

### Option A: Send Test Event from Stripe Dashboard

1. Go to: Developers → Webhooks
2. Click your test endpoint
3. Click **"Send test webhook"**
4. Select: `checkout.session.completed`
5. Click **"Send test event"**
6. You should see: ✅ **200** response

### Option B: Make a Real Test Purchase

1. Go to your app's subscription/checkout page
2. Click to upgrade to a paid plan
3. Use Stripe test card:
   ```
   Card Number: 4242 4242 4242 4242
   Expiry: 12/34 (any future date)
   CVC: 123 (any 3 digits)
   ZIP: 12345 (any 5 digits)
   ```
4. Complete the checkout
5. Check Stripe Dashboard → Webhooks → Your endpoint → Attempts
6. You should see the event delivered! ✅

## What Events Will Fire When You Subscribe?

When you complete a test subscription, these webhooks will fire in order:

1. ✅ `checkout.session.completed` - Checkout completed
2. ✅ `customer.subscription.created` - Subscription created
3. ✅ `invoice.payment_succeeded` - First payment processed

Your webhook at `/api/stripe-webhook` will receive ALL of these events!

## Verify It's Working

### Check Vercel Logs:
```bash
vercel logs --follow
```

### Check Stripe Dashboard:
1. Webhooks → Your endpoint → "Attempts" tab
2. You'll see:
   - ✅ Green checkmarks = successful
   - ❌ Red X = failed (check error message)

### What Should Happen in Your App:
After subscribing with test card:
- ✅ Subscription created in Firestore (`organizations/{orgId}/billing/subscription`)
- ✅ Plan tier updated to the selected plan
- ✅ UI updates to show new plan
- ✅ Features unlocked based on new plan

## Troubleshooting

### "Webhook failed with 401 error"
- Your `STRIPE_WEBHOOK_SECRET` doesn't match
- Make sure you copied the RIGHT secret (test vs live)
- Redeploy after updating env var

### "Webhook failed with 500 error"
- Check Vercel logs for the actual error
- Common issues:
  - Missing `FIREBASE_PRIVATE_KEY` env var
  - Firebase admin not initialized
  - Firestore rules blocking write

### "No webhook events showing"
- Make sure you're in **TEST MODE** in Stripe
- Make sure your webhook endpoint is configured
- Make sure you're using **test API keys** in your app

## When Ready for Production

1. Switch Stripe to **Live Mode**
2. Create NEW webhook endpoint (same URL)
3. Get LIVE signing secret (won't have `_test_` in it)
4. Update Vercel env vars for **Production** environment
5. Use LIVE Stripe keys (pk_live_... and sk_live_...)

## Test Card Numbers

**Successful Payment:**
```
4242 4242 4242 4242
```

**Payment Requires Authentication:**
```
4000 0027 6000 3184
```

**Payment Declined:**
```
4000 0000 0000 0002
```

**Insufficient Funds:**
```
4000 0000 0000 9995
```

All test cards: https://stripe.com/docs/testing#cards

