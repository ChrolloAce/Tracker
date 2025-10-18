# Revenue Integration Guide 💰

## What We've Built

You now have a complete revenue tracking system that integrates **RevenueCat** and **Superwall** with your dashboard!

### ✅ Completed Components

#### 1. **Type Definitions** (`src/types/revenue.ts`)
- `RevenueIntegration` - Store API credentials
- `RevenueTransaction` - Individual purchases/subscriptions
- `RevenueMetrics` - Aggregated revenue data
- `RevenueSnapshot` - Time-series data
- `RevenueAttribution` - Link revenue to videos/creators
- RevenueCat & Superwall specific types

#### 2. **Services**
- **`RevenueCatService.ts`** - Fetch data from RevenueCat API
  - Fetch overview metrics
  - Fetch transactions
  - Fetch subscriber details
  - Calculate metrics
  - Test API connection

- **`SuperwallService.ts`** - Fetch data from Superwall API
  - Fetch paywall analytics
  - Fetch experiments
  - Fetch conversion events
  - Calculate conversion funnels
  - Test API connection

- **`RevenueDataService.ts`** - Manage revenue data in Firestore
  - Save/load integrations
  - Store transactions
  - Calculate metrics
  - Sync data from both providers
  - Attribution tracking

#### 3. **UI Components**
- **`RevenueIntegrationsSettings.tsx`** - Settings page for managing integrations
  - Add/remove integrations
  - Test API connections
  - Enable/disable syncing
  - View sync status

---

## 🚀 Next Steps to Complete Integration

### Step 1: Add Revenue Settings to Settings Page

```typescript
// src/components/SettingsPage.tsx

import { RevenueIntegrationsSettings } from './RevenueIntegrationsSettings';

// Add a new section in your settings tabs:
const tabs = [
  // ... existing tabs
  { id: 'revenue', label: 'Revenue Integrations', icon: DollarSign }
];

// Add to your tab content rendering:
{activeTab === 'revenue' && (
  <RevenueIntegrationsSettings 
    organizationId={currentOrgId}
    projectId={currentProjectId}
  />
)}
```

### Step 2: Create Revenue KPI Cards

Add these new metrics to your `KPICards.tsx`:

```typescript
const revenueKPIs = [
  {
    id: 'revenue',
    label: 'Total Revenue',
    metric: 'revenue',
    icon: DollarSign,
    format: 'currency'
  },
  {
    id: 'mrr',
    label: 'MRR',
    metric: 'mrr',
    icon: TrendingUp,
    format: 'currency'
  },
  {
    id: 'revenue-per-video',
    label: 'Revenue per Video',
    metric: 'revenuePerVideo',
    icon: VideoIcon,
    format: 'currency'
  }
];
```

### Step 3: Fetch Revenue Data in Dashboard

```typescript
// src/pages/DashboardPage.tsx

import RevenueDataService from '../services/RevenueDataService';

// Add state for revenue data
const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);

// Load revenue data
useEffect(() => {
  const loadRevenueData = async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    const metrics = await RevenueDataService.getLatestMetrics(
      currentOrgId,
      currentProjectId
    );
    setRevenueMetrics(metrics);
  };
  
  loadRevenueData();
}, [currentOrgId, currentProjectId, dateFilter]);
```

### Step 4: Create Revenue Analytics Page (Optional)

Create a dedicated page for revenue analytics:

```typescript
// src/pages/RevenueAnalyticsPage.tsx

export const RevenueAnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Revenue KPI Cards */}
      <RevenueKPICards metrics={revenueMetrics} />
      
      {/* Revenue Chart */}
      <RevenueChart data={revenueSnapshots} />
      
      {/* Product Performance */}
      <ProductPerformanceTable products={products} />
      
      {/* Revenue Attribution */}
      <RevenueAttributionTable 
        videos={videos}
        attribution={attributionData}
      />
    </div>
  );
};
```

### Step 5: Link Revenue to Video Performance

Add revenue attribution to video details:

```typescript
// In VideoAnalyticsModal or CreatorDetailsPage

const videoAttribution = await RevenueDataService.getVideoAttribution(
  orgId,
  projectId,
  videoId
);

// Display:
// - Revenue generated from this video
// - Revenue per view
// - Conversion rate
// - ROI
```

---

## 📊 Firestore Data Structure

Your data will be organized as:

```
organizations/{orgId}/
  projects/{projectId}/
    revenueIntegrations/
      {integrationId}
        - provider: 'revenuecat' | 'superwall'
        - credentials: { apiKey, appId }
        - enabled: true/false
        - lastSynced: timestamp
    
    revenueTransactions/
      {transactionId}
        - amount: number (cents)
        - currency: 'USD'
        - productId: string
        - purchaseDate: timestamp
        - customerId: string
        - attributedVideoId: string (optional)
    
    revenueMetrics/
      {metricsId}
        - totalRevenue: number
        - mrr: number
        - activeSubscriptions: number
        - revenueByPlatform: {...}
        - calculatedAt: timestamp
    
    revenueSnapshots/
      {snapshotId}
        - snapshotDate: timestamp
        - totalRevenue: number
        - mrr: number
    
    revenueAttributions/
      {attributionId}
        - videoId: string
        - totalRevenue: number
        - conversionRate: number
```

---

## 🔑 Getting API Keys

### RevenueCat
1. Go to https://app.revenuecat.com
2. Navigate to **Settings → API Keys**
3. Create a new **Public API Key** (read-only)
4. Copy the key

### Superwall
1. Go to https://superwall.com/dashboard
2. Navigate to **Settings → API**
3. Copy your **API Key** and **App ID**

---

## 💡 Usage Examples

### 1. Add Integration

```typescript
// User goes to Settings → Revenue Integrations
// Clicks "Add Integration"
// Selects "RevenueCat"
// Enters API key
// Tests connection
// Saves

// Behind the scenes:
await RevenueDataService.saveIntegration(
  orgId,
  projectId,
  'revenuecat',
  { apiKey: 'sk_...' }
);
```

### 2. Sync Revenue Data

```typescript
// Manual sync button or automatic cron job
const result = await RevenueDataService.syncRevenueCat(
  orgId,
  projectId,
  startDate,
  endDate
);

console.log(`Synced ${result.transactionCount} transactions`);
console.log(`Total revenue: $${result.revenue / 100}`);
```

### 3. Display Revenue KPIs

```typescript
const metrics = await RevenueDataService.getLatestMetrics(orgId, projectId);

// Show in KPI cards:
// - Total Revenue: $24,500
// - MRR: $8,200
// - Active Subscriptions: 145
// - Revenue Growth: +15.2%
```

### 4. Revenue Attribution

```typescript
// Link revenue to specific video
await RevenueDataService.saveAttribution(orgId, projectId, {
  id: 'attr_123',
  videoId: 'video_456',
  totalRevenue: 1250000, // $12,500 in cents
  transactionCount: 250,
  conversionRate: 5.2,
  revenuePerView: 0.25,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
});
```

---

## 🎨 UI Enhancements

### Revenue KPI Card Example

```typescript
<KPICard
  label="Total Revenue"
  value="$24.5K"
  delta={{ value: 15.2, isPositive: true }}
  period="vs last month"
  icon={DollarSign}
  color="emerald"
  sparklineData={revenueSparkline}
  onClick={() => openRevenueModal()}
/>
```

### Revenue + Video Combined View

```typescript
<VideoCard
  video={video}
  views={45000}
  engagement={12.5}
  revenue={2500} // Add revenue field
  revenuePerView={0.055} // $0.055 per view
  roi={3.2} // 3.2x return
/>
```

---

## 🔄 Automatic Syncing (Optional)

Set up a cron job to automatically sync revenue:

```typescript
// api/cron-sync-revenue.ts

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get all organizations with revenue integrations
  // Sync each one
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - 1); // Last hour

  await RevenueDataService.syncAllIntegrations(
    orgId,
    projectId,
    startDate,
    endDate
  );

  res.json({ success: true });
}
```

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron-sync-revenue",
    "schedule": "0 * * * *"
  }]
}
```

---

## 🧪 Testing

1. **Test API Connection**
   - Go to Settings → Revenue Integrations
   - Click "Test Connection" button
   - Should show ✅ success or ❌ error

2. **Manual Sync**
   - Click "Sync All" button
   - Check console for sync results
   - Verify transactions in Firestore

3. **View Revenue Data**
   - Check KPI cards update with revenue metrics
   - View revenue trends in charts
   - See attribution on video pages

---

## 📈 Metrics You Can Now Track

1. **Revenue Metrics**
   - Total Revenue
   - Net Revenue (after refunds)
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)
   - ARPU (Average Revenue Per User)

2. **Conversion Metrics**
   - Trial Conversions
   - Conversion Rate
   - Revenue per Impression (Superwall)
   - Revenue per Conversion

3. **Attribution Metrics**
   - Revenue per Video
   - Revenue per View
   - Revenue per Creator
   - Revenue per Campaign
   - ROI by Content Type

4. **Product Metrics**
   - Revenue by Product
   - Active Subscriptions by Product
   - Churn Rate
   - Upgrade/Downgrade Rates

5. **Platform Metrics**
   - Revenue by Platform (iOS/Android/Web)
   - Subscription Distribution
   - Platform Conversion Rates

---

## 🎯 Advanced Features (Future)

1. **Revenue Forecasting**
   - Predict future MRR
   - Identify growth trends
   - Seasonality analysis

2. **Cohort Analysis**
   - Revenue by acquisition cohort
   - Retention curves
   - LTV projections

3. **A/B Testing Integration**
   - Link Superwall experiments to video content
   - Test different creator strategies
   - Optimize paywall placement

4. **Smart Alerts**
   - Revenue drops
   - Churn spikes
   - High-value customers
   - Refund anomalies

5. **CSV Export**
   - Export revenue data
   - Custom date ranges
   - Filtered by product/platform

---

## 🆘 Troubleshooting

### API Connection Fails
- Verify API key is correct
- Check key permissions (must be public/read-only)
- Ensure account is active

### No Data Syncing
- Check integration is enabled
- Verify date range has data
- Check Firestore permissions
- Look for errors in console

### Incorrect Revenue Amounts
- Verify currency settings
- Check for duplicate transactions
- Review refund handling
- Validate transaction filters

---

## 🎉 You're Ready!

You now have a complete revenue tracking system that:
- ✅ Connects to RevenueCat & Superwall
- ✅ Stores data in Firestore
- ✅ Calculates comprehensive metrics
- ✅ Links revenue to video performance
- ✅ Provides beautiful UI for management

Next step: Add the settings component to your Settings Page and start tracking revenue! 🚀

