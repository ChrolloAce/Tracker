# 🔴 Stripe Webhook 500 Error - Debugging Guide

## Common Causes When Switching to Live Mode:

### **1. Wrong Webhook Secret (MOST COMMON) ⚠️**

**The Problem:**
- You created a live webhook endpoint in Stripe
- But Vercel still has the **test** webhook secret

**The Fix:**
```bash
# Check current webhook secret
vercel env ls | grep STRIPE_WEBHOOK_SECRET

# Remove old test secret
vercel env rm STRIPE_WEBHOOK_SECRET production

# Add NEW live webhook secret (from your live endpoint)
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste: whsec_... (from your LIVE webhook endpoint)

# Redeploy
vercel --prod
```

---

### **2. Missing Environment Variables**

**Check these are ALL set in production:**
```bash
vercel env ls
```

**Required:**
- ✅ `STRIPE_SECRET_KEY` (sk_live_...)
- ✅ `STRIPE_WEBHOOK_SECRET` (whsec_... from LIVE endpoint)
- ✅ `FIREBASE_PROJECT_ID`
- ✅ `FIREBASE_CLIENT_EMAIL`
- ✅ `FIREBASE_PRIVATE_KEY`

---

### **3. Firebase Credentials Issue**

Your webhook tries to initialize Firebase Admin. If credentials are wrong, it throws 500.

**Check:**
```bash
vercel env ls | grep FIREBASE
```

**Should see:**
```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL  
FIREBASE_PRIVATE_KEY
```

---

## 🔍 How to Debug:

### **Step 1: Check Vercel Logs**

```bash
vercel logs --follow
```

Or in Vercel Dashboard:
1. Go to your project
2. Click **Deployments**
3. Click latest deployment
4. Click **Functions** tab
5. Find `/api/stripe-webhook`
6. Check error logs

---

### **Step 2: Test Webhook Locally**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to http://localhost:3000/api/stripe-webhook

# In another terminal, trigger a test event
stripe trigger customer.subscription.created
```

---

### **Step 3: Check Stripe Dashboard**

1. Go to **Developers → Webhooks**
2. Click your live endpoint
3. Check **Recent deliveries**
4. Click the failed event
5. See the **Response** tab - it will show the exact error

---

## 🎯 Most Likely Fix:

You probably need to update the webhook secret for live mode:

1. In Stripe Dashboard (**LIVE mode**):
   - Go to **Developers → Webhooks**
   - Click your endpoint
   - Click **Reveal** next to "Signing secret"
   - Copy it (starts with `whsec_`)

2. Update Vercel:
   ```bash
   vercel env add STRIPE_WEBHOOK_SECRET production
   # Paste the secret when prompted
   ```

3. Redeploy:
   ```bash
   vercel --prod
   ```

4. Test again by sending a test webhook from Stripe Dashboard

---

## 📝 Correct Stripe Webhook Setup:

### **Events to Add:**
```
✓ customer.subscription.created
✓ customer.subscription.updated
✓ customer.subscription.deleted
✓ invoice.payment_succeeded
✓ invoice.payment_failed
```

### **Endpoint URL:**
```
https://your-domain.vercel.app/api/stripe-webhook
```

### **API Version:**
- Should match your code: `2024-11-20.acacia`
- Or use latest

---

## 🧪 Quick Test:

**In Stripe Dashboard:**
1. Go to your webhook endpoint
2. Click **"Send test webhook"**
3. Select `customer.subscription.created`
4. Click **Send test webhook**
5. Should return **200 OK** (not 500)

---

## 🆘 If Still Failing:

**Check these in order:**

1. ✅ **Webhook secret matches** (test vs live)
2. ✅ **All env vars set** in production
3. ✅ **Redeployed** after adding env vars
4. ✅ **Endpoint URL** is correct
5. ✅ **Firebase credentials** are valid

**Run this diagnostic:**
```bash
curl -X POST https://your-domain.vercel.app/api/stripe-test
```

This will tell you if your Stripe keys are working.

---

## 🔑 Environment Variables Checklist:

**Backend (Server-side):**
- [ ] `STRIPE_SECRET_KEY` = `sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from LIVE endpoint)

**Frontend (Client-side):**
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_live_...`

**Firebase:**
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] `FIREBASE_PRIVATE_KEY`

**After updating, MUST redeploy:**
```bash
vercel --prod
```

---

**90% of the time, it's the webhook secret! Make sure it's from the LIVE endpoint, not test.** 🔑

