# Environment Variables Checklist

## ✅ What You Have

| Variable | Status |
|----------|--------|
| `STRIPE_SECRET_KEY` | ✅ |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ |
| `VITE_STRIPE_PRO_MONTHLY` | ✅ |
| `VITE_STRIPE_PRO_YEARLY` | ✅ |
| `VITE_STRIPE_ULTRA_MONTHLY` | ✅ |
| `VITE_STRIPE_ULTRA_YEARLY` | ✅ |
| `FIREBASE_PROJECT_ID` | ✅ |

---

## ❌ What You're Missing

### **Critical - Required for Stripe to Work:**

| Variable | Why You Need It |
|----------|----------------|
| `STRIPE_WEBHOOK_SECRET` | **Required** for webhook signature verification. Without this, Stripe webhooks will fail. |
| `VITE_STRIPE_BASIC_MONTHLY` | **Required** for users to subscribe to Basic Monthly plan |
| `VITE_STRIPE_BASIC_YEARLY` | **Required** for users to subscribe to Basic Yearly plan |

### **Critical - Required for Firebase Admin (Backend):**

| Variable | Why You Need It |
|----------|----------------|
| `FIREBASE_CLIENT_EMAIL` | **Required** for Firebase Admin SDK authentication |
| `FIREBASE_PRIVATE_KEY` | **Required** for Firebase Admin SDK authentication |

---

## 🔧 How to Get Missing Variables

### 1. Stripe Webhook Secret

**Steps:**
1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click your webhook endpoint (or create one if missing)
3. **Webhook URL**: `https://yourdomain.vercel.app/api/stripe-webhook`
4. **Events to send**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Reveal" next to "Signing secret"
6. Copy the value (starts with `whsec_`)

**Add to Vercel:**
```
Name: STRIPE_WEBHOOK_SECRET
Value: whsec_xxxxxxxxxxxxxxxxxx
```

---

### 2. Stripe Price IDs for Basic Plan

**Steps:**
1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Find or create your "Basic" product
3. Click on the product
4. You'll see 2 prices (Monthly and Yearly)
5. Click each price → Copy the Price ID

**It looks like:** `price_1Abc2DefGhi3Jkl`

**Add to Vercel:**
```
Name: VITE_STRIPE_BASIC_MONTHLY
Value: price_xxxxxxxxxxxxx

Name: VITE_STRIPE_BASIC_YEARLY
Value: price_xxxxxxxxxxxxx
```

---

### 3. Firebase Service Account Credentials

**Steps:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click ⚙️ (Settings) → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file
7. Open the JSON file

**Extract these values:**

```json
{
  "project_id": "your-project-id",           ← FIREBASE_PROJECT_ID (you have this)
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  ← FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk@...iam.gserviceaccount.com"  ← FIREBASE_CLIENT_EMAIL
}
```

**Add to Vercel:**
```
Name: FIREBASE_CLIENT_EMAIL
Value: firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

Name: FIREBASE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n
```

**⚠️ IMPORTANT for `FIREBASE_PRIVATE_KEY`:**
- Copy the ENTIRE key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters - they're important!
- Wrap the whole thing in quotes if pasting in Vercel

---

## 📋 Complete Environment Variables List

Here's the **complete list** of what you should have in Vercel:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

# Stripe Price IDs - Basic
VITE_STRIPE_BASIC_MONTHLY=price_xxxxx
VITE_STRIPE_BASIC_YEARLY=price_xxxxx

# Stripe Price IDs - Pro
VITE_STRIPE_PRO_MONTHLY=price_xxxxx
VITE_STRIPE_PRO_YEARLY=price_xxxxx

# Stripe Price IDs - Ultra
VITE_STRIPE_ULTRA_MONTHLY=price_xxxxx
VITE_STRIPE_ULTRA_YEARLY=price_xxxxx

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## ✅ After Adding Variables

1. **Redeploy on Vercel** (or wait for auto-deploy)
2. **Test the checkout flow:**
   - Click "Upgrade Plan"
   - Should redirect to Stripe (not 404)
3. **Test webhook:**
   - Complete a test payment
   - Check Stripe Dashboard → Webhooks → Should show 200 response
4. **Verify Firebase update:**
   - Check Firestore → organizations → {orgId} → billing → subscription
   - `planTier` should be updated

---

## 🚨 Common Issues

### "Webhook signature verification failed"
- **Cause**: Wrong `STRIPE_WEBHOOK_SECRET` or missing
- **Fix**: Copy the correct secret from Stripe Dashboard → Webhooks

### "Missing Stripe Price ID for basic monthly"
- **Cause**: `VITE_STRIPE_BASIC_MONTHLY` not set
- **Fix**: Add the price ID from Stripe Dashboard

### "Firebase Admin initialization failed"
- **Cause**: Missing `FIREBASE_CLIENT_EMAIL` or `FIREBASE_PRIVATE_KEY`
- **Fix**: Add both variables from your service account JSON

---

## 🎯 Quick Setup Command (for terminal)

If you have the Vercel CLI installed:

```bash
# Set Stripe variables
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add VITE_STRIPE_BASIC_MONTHLY
vercel env add VITE_STRIPE_BASIC_YEARLY

# Set Firebase variables
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY

# Redeploy
vercel --prod
```

---

## Summary

**You have:** 7/12 required variables ✅  
**You need:** 5 more variables ❌

Once you add these 5 missing variables, your entire Stripe integration will work perfectly! 🚀

