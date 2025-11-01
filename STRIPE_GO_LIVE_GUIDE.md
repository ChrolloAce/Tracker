# 🚀 Stripe: Test → Live Mode Migration Guide

## Current Status: TEST MODE ⚠️

Your app is currently using Stripe **test keys** (sk_test_... and pk_test_...).

---

## 📋 Step-by-Step Migration to LIVE Mode

### **Step 1: Get Your Live Stripe Keys**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Switch to LIVE mode** (toggle in top-right corner)
3. Navigate to **Developers → API Keys**
4. Copy your **live keys**:
   - **Secret key** (starts with `sk_live_...`) ⚠️ KEEP SECRET!
   - **Publishable key** (starts with `pk_live_...`)

---

### **Step 2: Create Live Products & Prices**

In **LIVE mode** on Stripe Dashboard:

1. Go to **Products**
2. Create these products (or copy from test mode):

#### **Basic Plan**
- Name: `ViewTrack Basic`
- Monthly Price: `$X/month` → Copy the `price_xxxxx` ID
- Yearly Price: `$X/year` → Copy the `price_xxxxx` ID

#### **Pro Plan**
- Name: `ViewTrack Pro`
- Monthly Price: `$X/month` → Copy the `price_xxxxx` ID
- Yearly Price: `$X/year` → Copy the `price_xxxxx` ID

#### **Ultra Plan**
- Name: `ViewTrack Ultra`
- Monthly Price: `$X/month` → Copy the `price_xxxxx` ID
- Yearly Price: `$X/year` → Copy the `price_xxxxx` ID

---

### **Step 3: Update Vercel Environment Variables**

You'll need to update these environment variables on Vercel:

#### **Backend (Server-side)**
```bash
vercel env rm STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY production
# Enter your sk_live_... key when prompted
```

#### **Frontend (Client-side)**
```bash
vercel env rm VITE_STRIPE_PUBLISHABLE_KEY production
vercel env add VITE_STRIPE_PUBLISHABLE_KEY production
# Enter your pk_live_... key when prompted
```

#### **Price IDs (All environments)**
```bash
# Basic Plan
vercel env add VITE_STRIPE_BASIC_MONTHLY production
# Enter: price_xxxxx (your live basic monthly price ID)

vercel env add VITE_STRIPE_BASIC_YEARLY production
# Enter: price_xxxxx (your live basic yearly price ID)

# Pro Plan
vercel env add VITE_STRIPE_PRO_MONTHLY production
# Enter: price_xxxxx (your live pro monthly price ID)

vercel env add VITE_STRIPE_PRO_YEARLY production
# Enter: price_xxxxx (your live pro yearly price ID)

# Ultra Plan
vercel env add VITE_STRIPE_ULTRA_MONTHLY production
# Enter: price_xxxxx (your live ultra monthly price ID)

vercel env add VITE_STRIPE_ULTRA_YEARLY production
# Enter: price_xxxxx (your live ultra yearly price ID)
```

---

### **Step 4: Update Stripe Webhook Endpoint**

1. In Stripe Dashboard (**LIVE mode**), go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL:
   ```
   https://your-domain.vercel.app/api/stripe-webhook
   ```
4. Select these events to listen to:
   ```
   ✓ customer.subscription.created
   ✓ customer.subscription.updated
   ✓ customer.subscription.deleted
   ✓ invoice.payment_succeeded
   ✓ invoice.payment_failed
   ✓ checkout.session.completed
   ```
5. Copy the **Webhook Signing Secret** (starts with `whsec_...`)
6. Add it to Vercel:
   ```bash
   vercel env add STRIPE_WEBHOOK_SECRET production
   # Enter: whsec_xxxxx
   ```

---

### **Step 5: Deploy to Production**

```bash
vercel --prod
```

Or push to git (auto-deploys):
```bash
git push origin main
```

---

### **Step 6: Test Live Subscriptions**

1. Use a **real credit card** (NOT test cards like 4242 4242 4242 4242)
2. Subscribe to a plan
3. Check Stripe Dashboard → Payments (should see real transaction)
4. Verify subscription appears in your app

---

## 🧪 Verifying You're in Live Mode

### **Check Environment Variables:**
```bash
vercel env ls
```

Look for:
- ✅ `STRIPE_SECRET_KEY` starts with `sk_live_`
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
- ✅ All `VITE_STRIPE_*` price IDs are from LIVE mode products

### **Check in Browser Console:**
When creating a checkout, the Stripe Checkout page URL should use **live keys**:
```
https://checkout.stripe.com/c/pay/cs_live_... ← LIVE MODE ✅
https://checkout.stripe.com/c/pay/cs_test_... ← TEST MODE ⚠️
```

---

## ⚠️ IMPORTANT WARNINGS

### **Before Going Live:**

1. **Test Everything** in test mode first:
   - Successful payments
   - Failed payments
   - Subscription upgrades/downgrades
   - Cancellations
   - Webhooks firing correctly

2. **Backup Your Data:**
   ```bash
   firebase firestore:backup
   ```

3. **Monitor Initially:**
   - Watch Stripe Dashboard for first few transactions
   - Check webhook delivery logs
   - Verify subscriptions sync correctly

4. **Have Rollback Plan:**
   - Keep test keys handy
   - Can switch back if issues arise

---

## 🔄 Quick Reference: Test vs Live Keys

| Environment Variable | Test Key Format | Live Key Format |
|---------------------|-----------------|-----------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| Price IDs | `price_...` (from test products) | `price_...` (from live products) |
| Webhook Secret | `whsec_...` (from test endpoint) | `whsec_...` (from live endpoint) |

---

## 🆘 Troubleshooting

### **"Invalid API Key" Error**
- Check you're using `sk_live_` not `sk_test_`
- Verify key is set in production environment

### **"Price not found" Error**
- Make sure price IDs are from LIVE mode products
- Check `VITE_STRIPE_*` env vars are updated

### **Webhooks Not Firing**
- Verify webhook URL is correct
- Check signing secret is from LIVE webhook endpoint
- Test webhook with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

### **Subscriptions Not Showing in App**
- Check webhook events are being received
- Verify `orgId` is being saved correctly in Stripe metadata
- Check Firebase for subscription documents

---

## 📞 Need Help?

- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Docs: https://stripe.com/docs/keys
- Webhook Testing: https://stripe.com/docs/webhooks/test

---

**Once you've completed all steps, your app will be processing REAL payments! 💰**

