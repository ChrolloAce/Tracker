# 💳 Stripe Integration Setup Guide

## Overview

Your app now has full subscription billing with Stripe! This guide will help you configure everything.

## 🚀 Quick Start

### 1. Create Stripe Account
1. Go to https://dashboard.stripe.com/register
2. Complete your account setup
3. Activate your account

### 2. Get Your Stripe Keys

#### Test Mode Keys (for development)
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

#### Live Mode Keys (for production)
1. Switch to Live mode in Stripe Dashboard
2. Go to https://dashboard.stripe.com/apikeys
3. Copy your **Publishable key** (starts with `pk_live_`)
4. Copy your **Secret key** (starts with `sk_live_`)

### 3. Create Products & Prices in Stripe

Go to https://dashboard.stripe.com/test/products and create these products:

#### Product 1: Basic Plan
- Name: `ViewTrack Basic`
- Description: `For Indie Hackers - Track up to 3 accounts and 100 videos`
- Pricing:
  - **Monthly**: $24.99 USD (recurring)
  - **Yearly**: $239.88 USD (recurring) or $19.99/month

Copy the Price IDs after creation.

#### Product 2: Pro Plan  
- Name: `ViewTrack Pro`
- Description: `For Small Projects - Unlimited accounts, track 1000 videos`
- Pricing:
  - **Monthly**: $79.99 USD (recurring)
  - **Yearly**: $767.88 USD (recurring) or $63.99/month

#### Product 3: Ultra Plan
- Name: `ViewTrack Ultra`
- Description: `For Growing Businesses - 20 team seats, 5000 videos, 12hr refresh`
- Pricing:
  - **Monthly**: $199.99 USD (recurring)
  - **Yearly**: $1,919.88 USD (recurring) or $159.99/month

### 4. Set Up Webhooks

#### For Local Development:
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe login`
3. Run: `stripe listen --forward-to localhost:5173/api/stripe-webhook`
4. Copy the webhook signing secret (starts with `whsec_`)

#### For Production (Vercel):
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.vercel.app/api/stripe-webhook`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret

### 5. Add Environment Variables

#### For Local Development (.env.local):
```env
# Stripe Keys (Test Mode)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs - Basic Plan
VITE_STRIPE_BASIC_MONTHLY=price_...
VITE_STRIPE_BASIC_YEARLY=price_...

# Stripe Price IDs - Pro Plan
VITE_STRIPE_PRO_MONTHLY=price_...
VITE_STRIPE_PRO_YEARLY=price_...

# Stripe Price IDs - Ultra Plan
VITE_STRIPE_ULTRA_MONTHLY=price_...
VITE_STRIPE_ULTRA_YEARLY=price_...

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:5173

# Firebase Admin (from previous setup)
FIREBASE_PROJECT_ID=trackview-6a3a5
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

#### For Vercel (Production):
Go to: https://vercel.com/your-project/settings/environment-variables

Add all the variables above, but use **Live Mode** Stripe keys!

### 6. Update Firestore Security Rules

The subscription data is stored at:
```
/organizations/{orgId}/billing/subscription
```

Already configured in your firestore.rules ✅

### 7. Test the Integration

#### Local Testing:
1. Start your dev server: `npm run dev`
2. Start Stripe webhook listener: `stripe listen --forward-to localhost:5173/api/stripe-webhook`
3. Go to Settings page in your app
4. Try subscribing to a plan
5. Use test card: `4242 4242 4242 4242` (any future date, any CVC)

#### Check Stripe Dashboard:
- Customers: https://dashboard.stripe.com/test/customers
- Subscriptions: https://dashboard.stripe.com/test/subscriptions
- Webhooks: https://dashboard.stripe.com/test/webhooks

## 🎯 How It Works

### User Flow:
1. User clicks "Select Plan" button
2. Redirects to Stripe Checkout (secure payment page)
3. User enters payment details
4. On success, redirected back to app
5. Webhook updates subscription in Firestore
6. App shows new plan features

### Plan Limits Enforcement:
- **Before adding account**: Check if within account limit
- **Before adding video**: Check if within video limit
- **Before adding team member**: Check if within team seats limit
- **Before API call**: Check if within MCP calls limit
- **Before refresh**: Check if on-demand refresh is available

### Subscription Management:
- Users can upgrade/downgrade plans
- Users can cancel subscriptions
- Users can update payment methods
- All managed through Stripe Customer Portal

## 📊 Available Plans

| Feature | Basic | Pro | Ultra |
|---------|-------|-----|-------|
| **Price** | $24.99/mo | $79.99/mo | $199.99/mo |
| **Team Seats** | 1 | 1 (flexible) | 20 (flexible) |
| **Accounts** | 3 | Unlimited | Unlimited |
| **Videos** | 100 | 1,000 | 5,000 |
| **Data Refresh** | 24 hours | 24 hours | 12 hours |
| **On-Demand Refresh** | ❌ | ❌ | ✅ |
| **MCP Calls/month** | 100 | 1,000 | 1,000 |
| **App Store Integration** | ❌ | ✅ | ✅ |
| **Manage Creators** | ❌ | ❌ | ✅ |
| **Custom Branding** | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |
| **Tracked Links** | 10 | 100 | Unlimited |

## 🔧 Troubleshooting

### Webhook not working?
- Check webhook secret is correct
- Verify endpoint URL in Stripe Dashboard
- Check Vercel function logs

### Payment not updating in app?
- Check webhook is receiving events
- Check Firestore for subscription document
- Verify price IDs match in code and Stripe

### Test payments not working?
- Make sure you're in TEST mode in Stripe
- Use test card: 4242 4242 4242 4242
- Check browser console for errors

## 📚 Next Steps

1. **Set up your Stripe account** (above)
2. **Add environment variables** to Vercel
3. **Test with test cards** in development
4. **Switch to Live mode** when ready
5. **Update your terms of service** with billing info

## 🎉 You're Ready!

Your app now has:
- ✅ Subscription billing
- ✅ Automatic plan limits
- ✅ Webhook handling
- ✅ Customer portal
- ✅ Usage tracking

Users will get a **7-day free trial** when they create an organization!

