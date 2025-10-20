# 🚀 Complete Stripe Integration Guide
**Full Setup & Advanced Subscription Management**

---

## 📊 **Current Status Audit**

### ✅ **What's Already Implemented**

#### **1. Core Functionality**
- ✅ Checkout session creation (`/api/create-checkout-session`)
- ✅ Customer portal for self-service management (`/api/create-portal-session`)
- ✅ Webhook handler for subscription events (`/api/stripe-webhook`)
- ✅ Subscription status checking (`/api/check-subscription`)
- ✅ Frontend subscription page with plan selection
- ✅ Usage tracking and limits
- ✅ Automatic plan tier enforcement

#### **2. Webhook Events Handled**
- ✅ `customer.subscription.created` - New subscription
- ✅ `customer.subscription.updated` - Subscription changes
- ✅ `customer.subscription.deleted` - Cancellations
- ✅ `invoice.payment_succeeded` - Successful payments
- ✅ `invoice.payment_failed` - Failed payments

#### **3. Database Integration**
- ✅ Firestore subscription storage
- ✅ Usage tracking per organization
- ✅ Plan limits enforcement
- ✅ Customer ID mapping

---

## ⚙️ **Required Environment Variables**

### **1. Stripe Keys (Required)**
```bash
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Get from: https://dashboard.stripe.com/test/apikeys (for public key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... or pk_test_...
```

### **2. Stripe Price IDs (Required for each plan)**
```bash
# Create products in Stripe Dashboard, then get price IDs
# Format: VITE_STRIPE_{PLAN}_{CYCLE}

# Basic Plan
VITE_STRIPE_BASIC_MONTHLY=price_1ABC...
VITE_STRIPE_BASIC_YEARLY=price_1DEF...

# Pro Plan
VITE_STRIPE_PRO_MONTHLY=price_1GHI...
VITE_STRIPE_PRO_YEARLY=price_1JKL...

# Ultra Plan
VITE_STRIPE_ULTRA_MONTHLY=price_1MNO...
VITE_STRIPE_ULTRA_YEARLY=price_1PQR...
```

### **3. App URLs (Required)**
```bash
# Your production URL
NEXT_PUBLIC_BASE_URL=https://viewtrack.app

# Auto-detected from Vercel
VERCEL_URL=your-app.vercel.app
```

### **4. Firebase Admin (Already Set)**
```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

---

## 🔧 **Setup Checklist**

### **Step 1: Create Stripe Account & Products**

1. **Sign up for Stripe**
   - Go to https://dashboard.stripe.com
   - Complete business verification
   - Enable production mode

2. **Create Products**
   ```
   Product 1: ViewTrack Basic
   ├── Price: $9.99/month (price_basic_monthly)
   └── Price: $99/year (price_basic_yearly)
   
   Product 2: ViewTrack Pro
   ├── Price: $29.99/month (price_pro_monthly)
   └── Price: $299/year (price_pro_yearly)
   
   Product 3: ViewTrack Ultra
   ├── Price: $79.99/month (price_ultra_monthly)
   └── Price: $799/year (price_ultra_yearly)
   ```

3. **Copy Price IDs**
   - Navigate to each product → Pricing
   - Copy the `price_xxx` ID
   - Add to environment variables

---

### **Step 2: Configure Webhooks**

1. **Create Webhook Endpoint**
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://your-domain.vercel.app/api/stripe-webhook`
   - Select events:
     ```
     ☑️ customer.subscription.created
     ☑️ customer.subscription.updated
     ☑️ customer.subscription.deleted
     ☑️ invoice.payment_succeeded
     ☑️ invoice.payment_failed
     ```

2. **Copy Webhook Secret**
   - After creating, reveal the signing secret
   - Starts with `whsec_...`
   - Add to `STRIPE_WEBHOOK_SECRET` env var

3. **Test Webhook**
   ```bash
   # Use Stripe CLI for local testing
   stripe listen --forward-to localhost:5173/api/stripe-webhook
   ```

---

### **Step 3: Set Environment Variables**

#### **Vercel Dashboard**
1. Go to your Vercel project
2. Settings → Environment Variables
3. Add all variables from above
4. Redeploy to apply

#### **Local Development (.env)**
```bash
# Create .env.local file
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_BASIC_MONTHLY=price_...
# ... add all price IDs
```

---

### **Step 4: Test the Integration**

1. **Test Checkout Flow**
   ```javascript
   // In browser console on /settings page
   console.log('Testing checkout...');
   // Click on a plan to test
   ```

2. **Verify Webhook Receipt**
   - Make a test purchase
   - Check Stripe Dashboard → Developers → Webhooks
   - Should show "succeeded" status

3. **Check Database**
   ```javascript
   // Firestore query to verify
   organizations/{orgId}/billing/subscription
   ```

4. **Test Status Endpoint**
   ```bash
   curl https://your-app.vercel.app/api/check-subscription?orgId=YOUR_ORG_ID
   ```

---

## 🎯 **What's Missing & How to Add It**

### **1. Advanced Analytics Dashboard** 📊
**Show subscription metrics and revenue insights**

#### Create: `src/components/SubscriptionAnalytics.tsx`
```typescript
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  CreditCard 
} from 'lucide-react';

interface MetricsData {
  totalRevenue: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  avgRevenuePerUser: number;
  planDistribution: Record<string, number>;
}

export const SubscriptionAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      // Query all subscription documents
      const subsQuery = query(
        collection(db, 'organizations'),
      );
      
      // Calculate metrics from your data
      // ... implementation
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* MRR Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">MRR</span>
          <DollarSign className="w-5 h-5 text-green-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          ${metrics?.monthlyRecurringRevenue.toLocaleString() || 0}
        </div>
        <p className="text-xs text-green-600 mt-1">
          +12% from last month
        </p>
      </div>

      {/* Active Subs Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
          <Users className="w-5 h-5 text-blue-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {metrics?.activeSubscriptions || 0}
        </div>
        <p className="text-xs text-blue-600 mt-1">
          Subscriptions
        </p>
      </div>

      {/* ARPU Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">ARPU</span>
          <TrendingUp className="w-5 h-5 text-purple-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          ${metrics?.avgRevenuePerUser.toFixed(2) || 0}
        </div>
        <p className="text-xs text-purple-600 mt-1">
          Per user
        </p>
      </div>

      {/* Churn Rate Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Churn</span>
          <CreditCard className="w-5 h-5 text-red-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {metrics?.churnRate.toFixed(1) || 0}%
        </div>
        <p className="text-xs text-red-600 mt-1">
          Monthly rate
        </p>
      </div>
    </div>
  );
};
```

---

### **2. Subscription Management Panel** ⚙️
**Admin panel to view and manage all customer subscriptions**

#### Create: `src/pages/SubscriptionManagementPage.tsx`
```typescript
import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';

interface SubscriptionRecord {
  orgId: string;
  orgName: string;
  planTier: string;
  status: string;
  mrr: number;
  currentPeriodEnd: Date;
  stripeCustomerId: string;
}

export const SubscriptionManagementPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'canceled'>('active');

  const loadSubscriptions = async () => {
    // Fetch all subscription documents from Firestore
    // collectionGroup query for 'subscription' across all orgs
  };

  const handleCancelSubscription = async (orgId: string) => {
    // Call Stripe API to cancel subscription
    // POST /api/cancel-subscription
  };

  const handleRefundPayment = async (orgId: string) => {
    // Call Stripe API to issue refund
    // POST /api/refund-payment
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Subscription Management</h1>
      
      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('canceled')}>Canceled</button>
      </div>

      {/* Subscriptions table */}
      <table className="w-full">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Plan</th>
            <th>Status</th>
            <th>MRR</th>
            <th>Next Billing</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map(sub => (
            <tr key={sub.orgId}>
              <td>{sub.orgName}</td>
              <td>{sub.planTier}</td>
              <td>{sub.status}</td>
              <td>${sub.mrr}</td>
              <td>{sub.currentPeriodEnd.toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleCancelSubscription(sub.orgId)}>
                  Cancel
                </button>
                <button onClick={() => handleRefundPayment(sub.orgId)}>
                  Refund
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

### **3. Dunning Management** 💳
**Automatically handle failed payments and retry logic**

#### Create: `api/dunning-retry.ts`
```typescript
import Stripe from 'stripe';

// Retry failed payments automatically
export async function retryFailedPayments() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  // Get subscriptions with past_due status
  const pastDueSubscriptions = await db
    .collectionGroup('subscription')
    .where('status', '==', 'past_due')
    .get();
    
  for (const doc of pastDueSubscriptions.docs) {
    const data = doc.data();
    
    try {
      // Retry invoice payment
      const invoices = await stripe.invoices.list({
        customer: data.stripeCustomerId,
        status: 'open',
        limit: 1
      });
      
      if (invoices.data.length > 0) {
        await stripe.invoices.pay(invoices.data[0].id);
        console.log(`✅ Retried payment for ${data.stripeCustomerId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to retry payment:`, error);
      
      // Send notification email after 3 failed attempts
      // await sendPaymentFailedEmail(data.orgId);
    }
  }
}
```

---

### **4. Upgrade/Downgrade Flows** 📈📉
**Allow users to change plans mid-cycle with prorated billing**

#### Add to `StripeService.ts`:
```typescript
static async upgradeSubscription(
  orgId: string,
  newPlanTier: PlanTier,
  newBillingCycle: 'monthly' | 'yearly'
): Promise<void> {
  const response = await fetch('/api/upgrade-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orgId,
      newPlanTier,
      newBillingCycle
    })
  });

  if (!response.ok) {
    throw new Error('Failed to upgrade subscription');
  }

  const data = await response.json();
  return data;
}
```

#### Create: `api/upgrade-subscription.ts`
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { orgId, newPlanTier, newBillingCycle } = req.body;

  // Get current subscription
  const subDoc = await db
    .collection('organizations')
    .doc(orgId)
    .collection('billing')
    .doc('subscription')
    .get();
    
  const data = subDoc.data();
  const subscriptionId = data.stripeSubscriptionId;

  // Get new price ID
  const newPriceId = getPriceId(newPlanTier, newBillingCycle);

  // Update subscription with proration
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: data.stripeSubscriptionItemId,
      price: newPriceId,
    }],
    proration_behavior: 'create_prorations', // Credit/charge difference
  });

  res.json({ success: true, subscription });
}
```

---

### **5. Trial Management** 🎁
**Add free trial functionality**

#### Update checkout session creation:
```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  payment_method_types: ['card'],
  line_items: [{
    price: priceId,
    quantity: 1,
  }],
  subscription_data: {
    trial_period_days: 14, // 14-day free trial
    trial_settings: {
      end_behavior: {
        missing_payment_method: 'cancel' // Cancel if no payment method
      }
    }
  },
  success_url: `${baseUrl}/settings?success=true`,
  cancel_url: `${baseUrl}/settings?canceled=true`,
});
```

---

### **6. Usage-Based Billing** 📊
**Charge based on actual usage (videos tracked, API calls, etc.)**

#### Create: `api/report-usage.ts`
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { orgId, usageQuantity, metricType } = req.body;

  // Get subscription
  const subDoc = await getSubscription(orgId);
  const subscriptionItemId = subDoc.stripeSubscriptionItemId;

  // Report usage to Stripe
  await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity: usageQuantity,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment', // or 'set'
  });

  res.json({ success: true });
}
```

---

### **7. Customer Portal Customization** 🎨
**Customize the Stripe Customer Portal with your branding**

1. Go to: https://dashboard.stripe.com/settings/billing/portal
2. Configure:
   - ✅ Logo & colors matching ViewTrack
   - ✅ Allow plan changes
   - ✅ Allow cancellations
   - ✅ Invoice history
   - ✅ Payment method updates

---

### **8. Email Notifications** 📧
**Send custom emails for subscription events**

#### Add to webhook handler:
```typescript
case 'customer.subscription.updated':
  await handleSubscriptionUpdate(db, event.data.object);
  
  // Send custom email
  await sendEmail({
    to: customerEmail,
    subject: 'Your ViewTrack subscription was updated',
    template: 'subscription-updated',
    data: {
      planTier: newPlanTier,
      nextBillingDate: subscription.current_period_end
    }
  });
  break;
```

---

### **9. Revenue Recognition** 💰
**Track and recognize revenue over subscription periods**

#### Create: `src/services/RevenueRecognitionService.ts`
```typescript
export class RevenueRecognitionService {
  static async calculateRecognizedRevenue(orgId: string, date: Date) {
    // Get all subscriptions
    // Calculate daily recognized revenue based on subscription periods
    // Store in Firestore for reporting
  }
  
  static async getMonthlyRecognizedRevenue(year: number, month: number) {
    // Aggregate recognized revenue for the month
    // Return breakdown by plan tier
  }
}
```

---

### **10. Subscription Pausing** ⏸️
**Allow users to pause subscriptions temporarily**

#### Add to Stripe webhook:
```typescript
case 'customer.subscription.paused':
  await subDoc.ref.update({
    status: 'paused',
    pausedAt: new Date(),
  });
  break;

case 'customer.subscription.resumed':
  await subDoc.ref.update({
    status: 'active',
    resumedAt: new Date(),
  });
  break;
```

---

## 🚀 **Quick Implementation Plan**

### **Phase 1: Foundation (Week 1)**
1. ✅ Set up Stripe account
2. ✅ Create products & prices
3. ✅ Add environment variables
4. ✅ Configure webhooks
5. ✅ Test checkout flow

### **Phase 2: Core Features (Week 2)**
6. ✅ Add subscription analytics dashboard
7. ✅ Implement upgrade/downgrade flows
8. ✅ Add trial management
9. ✅ Customize customer portal

### **Phase 3: Advanced Features (Week 3-4)**
10. ✅ Add dunning management
11. ✅ Implement usage-based billing
12. ✅ Set up email notifications
13. ✅ Add admin subscription management panel
14. ✅ Implement revenue recognition

---

## 📞 **Support & Resources**

### **Stripe Documentation**
- Subscriptions: https://stripe.com/docs/billing/subscriptions/overview
- Webhooks: https://stripe.com/docs/webhooks
- Testing: https://stripe.com/docs/testing

### **Testing Cards**
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

### **Useful Stripe CLI Commands**
```bash
# Listen to webhooks locally
stripe listen --forward-to localhost:5173/api/stripe-webhook

# Trigger test events
stripe trigger payment_intent.succeeded

# View logs
stripe logs tail
```

---

## ✅ **Ready to Go Live Checklist**

- [ ] All environment variables set
- [ ] Webhooks configured and tested
- [ ] Products created in Stripe
- [ ] Price IDs added to env vars
- [ ] Customer portal customized
- [ ] Test transactions completed successfully
- [ ] Email notifications working
- [ ] Error handling tested
- [ ] Usage limits enforced
- [ ] Analytics dashboard live
- [ ] Support documentation prepared
- [ ] Terms of service updated
- [ ] Privacy policy updated
- [ ] Refund policy defined
- [ ] Customer support email ready

---

## 🎯 **Next Steps**

Want me to implement any of these features? I can:

1. **Set up the missing environment variables** (guide you through Stripe Dashboard)
2. **Build the subscription analytics dashboard** (show MRR, churn, etc.)
3. **Add upgrade/downgrade functionality** (with prorated billing)
4. **Implement trial management** (14-day free trials)
5. **Create admin subscription management panel** (view all customers)
6. **Add usage-based billing** (charge per video tracked)
7. **Build dunning management** (retry failed payments)

**Which would you like me to start with?** 🚀

