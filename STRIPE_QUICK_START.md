# 🚀 Stripe Quick Start Checklist

## Current Status: ⚠️ Payments Not Configured

Your subscription page is live, but payments won't work until you complete these steps:

---

## ✅ Quick Setup (5 Steps)

### Step 1: Create Stripe Account (2 min)
- Go to: https://dashboard.stripe.com/register
- Sign up (it's free for testing)
- Activate your account

### Step 2: Get Your API Keys (1 min)
- Go to: https://dashboard.stripe.com/test/apikeys
- Copy **Publishable key** (starts with `pk_test_`)
- Copy **Secret key** (starts with `sk_test_`)

### Step 3: Add Keys to Vercel (2 min)
Go to: https://vercel.com/your-project/settings/environment-variables

Add these two:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
```

### Step 4: Create Products in Stripe (5 min)
Go to: https://dashboard.stripe.com/test/products

**Create 3 products:**

#### Product 1: Basic Plan
- Name: `ViewTrack Basic`
- **Monthly Price**: $24.99 USD (recurring monthly)
- **Yearly Price**: $239.88 USD (recurring yearly)
- Copy both Price IDs

#### Product 2: Pro Plan
- Name: `ViewTrack Pro` 
- **Monthly Price**: $79.99 USD (recurring monthly)
- **Yearly Price**: $767.88 USD (recurring yearly)
- Copy both Price IDs

#### Product 3: Ultra Plan
- Name: `ViewTrack Ultra`
- **Monthly Price**: $199.99 USD (recurring monthly)
- **Yearly Price**: $1,919.88 USD (recurring yearly)
- Copy both Price IDs

### Step 5: Add Price IDs to Vercel (2 min)
Go back to Vercel environment variables and add:

```
VITE_STRIPE_BASIC_MONTHLY=price_... (from Basic monthly)
VITE_STRIPE_BASIC_YEARLY=price_... (from Basic yearly)
VITE_STRIPE_PRO_MONTHLY=price_... (from Pro monthly)
VITE_STRIPE_PRO_YEARLY=price_... (from Pro yearly)
VITE_STRIPE_ULTRA_MONTHLY=price_... (from Ultra monthly)
VITE_STRIPE_ULTRA_YEARLY=price_... (from Ultra yearly)
```

---

## 🎯 After Setup

1. **Redeploy** your app (or wait for auto-deploy)
2. **Test** with test card: `4242 4242 4242 4242`
3. **Go Live** by switching to Live mode keys when ready!

---

## 🧪 Testing Payments

Use these **test cards** in Stripe checkout:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Require 3D Secure**: `4000 0025 0000 3155`

Any future expiry date and any 3-digit CVC works!

---

## 📊 What You'll Get

After setup, users can:
- ✅ View pricing page
- ✅ Click "Select Plan"
- ✅ Get redirected to Stripe Checkout
- ✅ Enter payment details securely
- ✅ Automatically get upgraded
- ✅ Manage subscription in customer portal

---

## ⏭️ Optional: Webhooks (Advanced)

For automatic subscription updates:

1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/stripe-webhook`
3. Select events: `customer.subscription.*`, `invoice.payment_*`
4. Copy webhook secret (`whsec_...`)
5. Add to Vercel: `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## 🆘 Need Help?

- **Full Guide**: See `STRIPE_SETUP_GUIDE.md`
- **Stripe Docs**: https://stripe.com/docs
- **Test Dashboard**: https://dashboard.stripe.com/test/payments

---

## 🎉 Current Error

The "500 error" you're seeing is **expected** because Stripe isn't configured yet. Once you complete Steps 1-5 above, it will work perfectly!

**Total Setup Time**: ~15 minutes

