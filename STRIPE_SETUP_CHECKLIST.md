# Stripe Integration Setup Checklist

## 🚨 Critical Issues Fixed

### Issue 1: Stripe Customer Portal Not Configured
**Error:** "No configuration provided and your test mode default configuration has not been created"

**Fix:**
1. Go to: https://dashboard.stripe.com/test/settings/billing/portal
2. Click **"Save changes"** at the bottom (even without changes)
3. This creates the default portal configuration

### Issue 2: Webhook Not Updating Firebase
**Problem:** Subscriptions purchased but plan not updating in Firebase

**Root Cause:** Webhook was only looking for `VITE_*` env vars (frontend vars) which don't exist in backend

**Fix:** Updated webhook to check both `STRIPE_*` and `VITE_STRIPE_*` environment variables

---

## ✅ Complete Setup Checklist

### 1. Stripe Dashboard Setup

#### A. Get Your API Keys
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy **Secret key** (starts with `sk_test_`)
3. Copy **Publishable key** (starts with `pk_test_`)

#### B. Create Products & Prices
1. Go to: https://dashboard.stripe.com/test/products
2. Create products for: Basic, Pro, Ultra
3. For each product, create **two prices**:
   - Monthly price
   - Yearly price (typically 75% of 12x monthly = 25% discount)
4. Copy each **Price ID** (starts with `price_`)

#### C. Set Up Webhooks
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://your-domain.vercel.app/api/stripe-webhook`
4. Events to send:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)

#### D. Configure Customer Portal
1. Go to: https://dashboard.stripe.com/test/settings/billing/portal
2. Click **"Save changes"** (creates default config)

---

### 2. Vercel Environment Variables

Go to: https://vercel.com/[your-username]/[your-project]/settings/environment-variables

Add the following variables (for all environments: Production, Preview, Development):

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Price IDs (use your actual Price IDs from Stripe Dashboard)
STRIPE_BASIC_MONTHLY=price_xxxxx
STRIPE_BASIC_YEARLY=price_xxxxx
STRIPE_PRO_MONTHLY=price_xxxxx
STRIPE_PRO_YEARLY=price_xxxxx
STRIPE_ULTRA_MONTHLY=price_xxxxx
STRIPE_ULTRA_YEARLY=price_xxxxx

# Firebase Admin (for webhook to update Firestore)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----"
```

**Important:** After adding env vars, you MUST redeploy: `vercel --prod`

---

### 3. Frontend Environment Variables

In your `.env` file (or Vercel env vars for frontend):

```bash
# Stripe Publishable Key (frontend only)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Price IDs (same as backend)
VITE_STRIPE_BASIC_MONTHLY=price_xxxxx
VITE_STRIPE_BASIC_YEARLY=price_xxxxx
VITE_STRIPE_PRO_MONTHLY=price_xxxxx
VITE_STRIPE_PRO_YEARLY=price_xxxxx
VITE_STRIPE_ULTRA_MONTHLY=price_xxxxx
VITE_STRIPE_ULTRA_YEARLY=price_xxxxx
```

---

### 4. Test the Integration

#### A. Test Checkout Flow
1. Click "Select Plan" on a paid plan
2. Use Stripe test card: `4242 4242 4242 4242`
3. Any future expiry date, any CVC
4. Complete checkout

#### B. Verify Webhook
1. Check Vercel logs: `vercel logs --follow`
2. Should see: `✅ SUCCESS: Updated subscription for org [id] to [plan] (active)`

#### C. Verify Firebase Update
1. Check Firestore console
2. Go to: `organizations/{orgId}/subscription`
3. Verify `planTier` updated to correct plan
4. Verify `status` = "active"

#### D. Test Customer Portal
1. Go to Settings → Billing
2. Click "Manage Billing"
3. Should open Stripe portal
4. Test: Update payment method, cancel subscription, etc.

---

## 🐛 Troubleshooting

### Problem: "Webhook Error: No signatures found"
**Solution:** Add webhook signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel

### Problem: "Unknown price ID"
**Solution:** 
1. Check Vercel logs for the actual price ID being sent
2. Add correct price ID to environment variables
3. Redeploy

### Problem: Plan not updating after payment
**Solution:**
1. Check webhook is receiving events (Stripe Dashboard → Webhooks → Your endpoint)
2. Check Vercel function logs for errors
3. Ensure Firebase admin credentials are correct

### Problem: Customer Portal error
**Solution:** Save default configuration in Stripe Dashboard (step 1.D above)

---

## 📚 Documentation Links

- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

---

## 🎉 Success Criteria

- ✅ Users can upgrade/downgrade plans
- ✅ Stripe webhooks update Firebase automatically
- ✅ Users can manage billing through Customer Portal
- ✅ Subscription status reflects accurately in app
- ✅ All features locked/unlocked based on plan tier

