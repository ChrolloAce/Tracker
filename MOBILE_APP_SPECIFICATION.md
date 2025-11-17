# ViewTrack Mobile App Specification

## 📱 App Overview

**ViewTrack** is a comprehensive social media analytics and creator management platform that helps businesses and agencies track content performance, manage creator relationships, monitor revenue, and analyze engagement metrics across multiple social media platforms.

### Core Platforms Supported
- ✅ TikTok
- ✅ Instagram (Reels & Posts)
- ✅ YouTube (Shorts & Videos)
- ✅ Twitter/X

### Key Value Propositions
1. **Unified Dashboard**: Track all social media content in one place
2. **Automated Data Collection**: Background syncing every 12-48 hours based on plan
3. **Creator Management**: Manage creator payouts, contracts, and performance
4. **Revenue Tracking**: Integrate with Apple App Store for revenue analytics
5. **Team Collaboration**: Multi-user workspaces with role-based permissions
6. **Custom Tracking Links**: Generate and track custom short links
7. **Campaign Management**: Organize content and creators into campaigns

---

## 🏗️ App Architecture

### Multi-Tenancy Structure
```
User Account (Firebase Auth)
  └── Organizations (Workspaces)
      └── Projects (Sub-workspaces)
          ├── Tracked Accounts (Social media profiles)
          ├── Tracked Videos (Individual posts)
          ├── Tracked Links (Short URLs)
          ├── Creators (Team members with creator role)
          ├── Campaigns (Content groupings)
          └── Team Members (Users with various roles)
```

### User Roles & Permissions
1. **Owner**: Full access, billing management, can delete organization
2. **Admin**: Full access except billing and org deletion
3. **Member**: Can view and edit content, limited access
4. **Creator**: Self-service portal, view own content and earnings only
5. **Guest**: View-only access

---

## 📊 Data Structure (Firestore)

### Root Collections

#### 1. `/users/{userId}`
User account information (one per Firebase Auth user)
```typescript
{
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  plan: 'free' | 'pro' | 'enterprise';
  defaultOrgId?: string; // Most recently used organization
  isAdmin?: boolean; // ViewTrack admin, bypasses all limits
}
```

#### 2. `/organizations/{orgId}`
Main workspace level
```typescript
{
  id: string;
  name: string;
  slug?: string;
  website?: string;
  logoUrl?: string;
  createdAt: Timestamp;
  createdBy: string; // userId
  ownerUserId: string;
  
  // Aggregated counts
  memberCount: number;
  trackedAccountCount: number;
  videoCount: number;
  linkCount: number;
  projectCount: number;
  
  // Settings
  settings?: {
    timezone?: string;
    currency?: string;
  }
}
```

**Sub-collections:**
- `/organizations/{orgId}/members/{userId}` - Team members
- `/organizations/{orgId}/billing/subscription` - Subscription info
- `/organizations/{orgId}/billing/usage` - Usage tracking
- `/organizations/{orgId}/revenueMetrics/*` - Revenue data
- `/organizations/{orgId}/refreshSessions/*` - Sync session tracking

#### 3. `/organizations/{orgId}/projects/{projectId}`
Project level (sub-workspace)
```typescript
{
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
  
  // Aggregated counts
  trackedAccountCount: number;
  videoCount: number;
  linkCount: number;
  creatorCount: number;
  campaignCount: number;
}
```

**Sub-collections:**
- `/projects/{projectId}/trackedAccounts/{accountId}` - Social media accounts
- `/projects/{projectId}/videos/{videoId}` - Videos/posts
- `/projects/{projectId}/trackedLinks/{linkId}` - Short links
- `/projects/{projectId}/creators/{creatorId}` - Creators
- `/projects/{projectId}/campaigns/{campaignId}` - Campaigns
- `/projects/{projectId}/paymentTermPresets/*` - Payment templates

#### 4. Tracked Account Structure
Path: `/organizations/{orgId}/projects/{projectId}/trackedAccounts/{accountId}`
```typescript
{
  id: string;
  orgId: string;
  projectId: string;
  
  // Account Info
  username: string;
  displayName?: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter';
  profileUrl: string;
  profilePicture?: string;
  coverPicture?: string; // Banner/header image
  bio?: string;
  
  // Metrics
  followerCount?: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves?: number;
  
  // Settings
  maxVideos: number; // How many videos to scrape (default 100)
  isActive: boolean;
  creatorType: 'automatic' | 'manual'; // Automatic = auto-fetch videos
  
  // Sync Status
  syncStatus: 'pending' | 'syncing' | 'completed' | 'error';
  lastRefreshed?: Timestamp;
  
  // Metadata
  dateAdded: Timestamp;
  addedBy: string; // userId
  linkedCreatorId?: string; // If linked to a creator
  campaignIds?: string[]; // Associated campaigns
}
```

#### 5. Video Structure
Path: `/organizations/{orgId}/projects/{projectId}/videos/{videoId}`
```typescript
{
  id: string;
  orgId: string;
  projectId: string;
  
  // Source
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter';
  trackedAccountId?: string;
  videoId: string; // Platform-specific ID
  videoUrl: string;
  
  // Content
  caption: string;
  thumbnail: string;
  duration?: number;
  hashtags?: string[];
  
  // Metrics
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  saveCount?: number;
  
  // Deltas (change in last 7/30 days)
  viewsDelta7d?: number;
  viewsDelta30d?: number;
  likesDelta7d?: number;
  likesDelta30d?: number;
  
  // Timestamps
  uploadDate: Timestamp;
  dateAdded: Timestamp;
  lastRefreshed?: Timestamp;
  
  // Metadata
  addedBy: string;
  status: 'active' | 'archived' | 'processing';
  isSingular: boolean; // Not from tracked account
  campaignIds?: string[];
  
  // Engagement (computed)
  engagementRate?: number; // (likes + comments) / views
}
```

**Sub-collection:**
- `/videos/{videoId}/snapshots/{snapshotId}` - Historical data points

#### 6. Tracked Link Structure
Path: `/organizations/{orgId}/projects/{projectId}/trackedLinks/{linkId}`
```typescript
{
  id: string;
  shortCode: string; // e.g., "abc123"
  destination: string; // Full URL
  
  // Metadata
  title: string;
  description?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Timestamp;
  
  // Tracking
  totalClicks: number;
  uniqueClicks: number;
  lastClickedAt?: Timestamp;
  
  // Settings
  isActive: boolean;
  expiresAt?: Timestamp;
  
  // Campaign
  campaignId?: string;
}
```

**Sub-collection:**
- `/trackedLinks/{linkId}/clicks/{clickId}` - Individual click events

#### 7. Creator Structure
Path: `/organizations/{orgId}/projects/{projectId}/creators/{creatorId}`
```typescript
{
  id: string; // Firebase userId
  orgId: string;
  projectId: string;
  
  // Profile
  displayName: string;
  email?: string;
  photoURL?: string;
  
  // Stats
  linkedAccountsCount: number;
  totalEarnings: number;
  
  // Payment Settings
  payoutsEnabled: boolean;
  paymentInfo?: {
    isPaid: boolean;
    structure?: string; // Description
    schedule?: 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
    notes?: string;
    tieredStructure?: TieredPaymentStructure;
  };
  
  // Contract
  paymentTermPresetId?: string;
  contractNotes?: string;
  contractStartDate?: Timestamp;
  contractEndDate?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  lastPayoutAt?: Timestamp;
  status?: string;
}
```

**Sub-collections:**
- `/creators/{creatorId}/payouts/{payoutId}` - Payout records
- `/creators/{creatorId}/invitations/*` - Pending invitations

#### 8. Campaign Structure
Path: `/organizations/{orgId}/projects/{projectId}/campaigns/{campaignId}`
```typescript
{
  id: string;
  orgId: string;
  projectId: string;
  
  // Campaign Info
  name: string;
  description?: string;
  coverImage?: string;
  
  // Dates
  startDate?: Timestamp;
  endDate?: Timestamp;
  
  // Status
  status: 'draft' | 'active' | 'completed' | 'archived';
  
  // Associations
  linkedAccountIds: string[];
  videoIds: string[];
  creatorIds: string[];
  linkIds: string[];
  
  // Metrics (aggregated)
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalClicks: number;
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  lastUpdated?: Timestamp;
}
```

#### 9. Subscription & Billing
Path: `/organizations/{orgId}/billing/subscription`
```typescript
{
  planTier: 'free' | 'basic' | 'pro' | 'ultra' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  
  // Provider (Stripe or RevenueCat)
  provider: 'stripe' | 'revenuecat';
  subscriptionId?: string;
  customerId?: string;
  
  // Dates
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  
  // Limits (copied from SUBSCRIPTION_PLANS)
  trackedVideos: number;
  trackedAccounts: number;
  teamSeats: number;
  projectsAllowed: number;
  dataRefreshHours: number;
  
  // Features
  features: {
    advancedAnalytics: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    prioritySupport: boolean;
  };
}
```

Path: `/organizations/{orgId}/billing/usage`
```typescript
{
  // Current usage
  trackedVideos: number;
  trackedAccounts: number;
  trackedLinks: number;
  teamMembers: number;
  projects: number;
  
  // Limits
  limits: {
    trackedVideos: number;
    trackedAccounts: number;
    trackedLinks: number;
    teamMembers: number;
    projects: number;
  };
  
  // Last updated
  lastUpdated: Timestamp;
}
```

#### 10. Revenue Integration
Path: `/organizations/{orgId}/projects/{projectId}/revenueIntegrations/{integrationId}`
```typescript
{
  id: string;
  type: 'apple_app_store';
  status: 'active' | 'error' | 'disconnected';
  
  // Apple App Store specific
  issuerId: string;
  keyId: string;
  vendorNumber: string;
  privateKey: string; // Encrypted
  
  // Metadata
  createdAt: Timestamp;
  lastSyncedAt?: Timestamp;
  syncError?: string;
}
```

Path: `/organizations/{orgId}/projects/{projectId}/revenueMetrics/apple_summary`
```typescript
{
  totalRevenue: number;
  totalUnits: number;
  lastUpdated: Timestamp;
  
  // Daily breakdown
  dailyData: Array<{
    date: string; // YYYY-MM-DD
    revenue: number;
    units: number;
  }>;
  
  // By product
  productData: Array<{
    sku: string;
    name: string;
    revenue: number;
    units: number;
  }>;
}
```

#### 11. Job Queue (for background processing)
Path: `/syncQueue/{jobId}`
```typescript
{
  type: 'account_sync';
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // Job details
  orgId: string;
  projectId: string;
  accountId: string;
  sessionId?: string;
  
  // Account info (denormalized for logging)
  accountUsername: string;
  accountPlatform: string;
  
  // Retry logic
  attempts: number;
  maxAttempts: number;
  error?: string;
  
  // Timestamps
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  
  // Priority (higher = process first)
  priority: number; // 10 for manual, 5 for scheduled
}
```

---

## 🔐 Authentication & Authorization

### Firebase Authentication
- Email/Password
- Google OAuth
- Apple Sign In (optional)

### Authorization Levels
```typescript
// Permission types
type Permission = 
  | 'videos.view'
  | 'videos.create'
  | 'videos.edit'
  | 'videos.delete'
  | 'accounts.view'
  | 'accounts.create'
  | 'accounts.edit'
  | 'accounts.delete'
  | 'analytics.view'
  | 'team.view'
  | 'team.invite'
  | 'team.edit'
  | 'team.remove'
  | 'billing.view'
  | 'billing.edit'
  | 'org.edit'
  | 'org.delete'
  | 'creators.view'
  | 'creators.create'
  | 'creators.edit'
  | 'creators.delete'
  | 'payouts.view'
  | 'payouts.create'
  | 'campaigns.view'
  | 'campaigns.create'
  | 'campaigns.edit';

// Role permissions mapping
const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS_EXCEPT_BILLING,
  member: VIEW_AND_EDIT_CONTENT,
  creator: CREATOR_PORTAL_ONLY,
  guest: VIEW_ONLY
};
```

### Admin Bypass
- Users with `isAdmin: true` in `/users/{userId}` bypass all usage limits
- Can toggle "admin mode" off to view app as normal user (useful for testing)
- Stored in localStorage: `admin_bypass_disabled_{userId}`

---

## 🌐 API Endpoints

### Base URL
- Production: `https://www.viewtrack.app/api`
- All endpoints require authentication (Firebase ID token in `Authorization` header)

### Core Endpoints

#### Account Management
- `POST /api/sync-single-account` - Trigger sync for a single account
  - Body: `{ orgId, projectId, accountId, sessionId?, jobId? }`
  - Returns: Sync status and video count

- `DELETE /api/delete-account` - Delete a tracked account
  - Body: `{ orgId, projectId, accountId }`

#### Video Management
- `POST /api/process-single-video` - Add and process a single video
  - Body: `{ url, orgId, projectId, userId }`
  - Automatically detects platform and fetches metrics

- `DELETE /api/delete-video` - Delete a video
  - Body: `{ orgId, projectId, videoId }`

#### Project Management
- `DELETE /api/delete-project` - Delete a project and all data
  - Body: `{ orgId, projectId }`

#### Organization Management
- `DELETE /api/delete-organization` - Delete organization
  - Body: `{ orgId }`

#### Refresh & Sync
- `POST /api/trigger-orchestrator` - Manually trigger refresh for all organizations
  - Requires CRON_SECRET or Firebase admin auth

- `POST /api/process-organization` - Process single organization
  - Body: `{ orgId, manual? }`
  - Dispatches project jobs

- `POST /api/process-project` - Process single project
  - Body: `{ orgId, projectId, sessionId, manual? }`
  - Queues account sync jobs

- `POST /api/queue-worker` - Job queue processor (runs every 1 min)
  - Processes max 6 concurrent jobs
  - Auto-cleanup when queue empty

#### Revenue Integration
- `POST /api/sync-apple-revenue` - Sync Apple App Store revenue
  - Body: `{ organizationId, projectId, integrationId, wipeData? }`
  
- `POST /api/apple-test-connection` - Test Apple API credentials
  - Body: `{ issuerId, keyId, privateKey, vendorNumber }`

- `GET /api/apple-fetch-transactions` - Fetch transactions
  - Query: `organizationId, projectId, integrationId, startDate, endDate`

#### Tracking Links
- `GET /l/{shortCode}` - Redirect and track click
  - Records click data (IP, user agent, referrer, etc.)
  - Redirects to destination URL

#### Subscription & Billing
- `POST /api/create-checkout-session` - Create Stripe checkout
  - Body: `{ priceId, organizationId, successUrl, cancelUrl }`

- `POST /api/create-portal-session` - Create Stripe portal session
  - Body: `{ organizationId }`

- `POST /api/stripe-webhook` - Handle Stripe webhooks
  - Signature verification required

- `POST /api/revenuecat-webhook` - Handle RevenueCat webhooks
  - For mobile in-app purchases

- `POST /api/sync-usage-counts` - Update usage counts
  - Body: `{ organizationId }`

#### Diagnostics & Maintenance
- `GET /api/cron-status` - View cron job status
- `POST /api/cleanup-invalid-data` - Remove invalid data
- `POST /api/diagnose-tiktok-thumbnails` - Fix thumbnail issues

### Cron Jobs (Automatic)
- `/api/cron-orchestrator` - Runs at 00:00 and 12:00 UTC
  - Dispatches organization refresh jobs based on plan tier
  
- `/api/queue-worker` - Runs every 1 minute
  - Processes job queue, max 6 concurrent jobs
  - Auto-cleanup completed jobs when queue empty

### Platform-Specific Scrapers
All scrapers use Apify actors:
- **TikTok**: `clockworks~free-tiktok-scraper`
- **Instagram**: `scraper-engine~instagram-reels-scraper` (residential proxies)
- **YouTube**: `grow_media~youtube-shorts-scraper`
- **Twitter/X**: `apidojo~tweet-scraper`

---

## 📱 Mobile App Screens & User Flows

### 1. Authentication Flow
```
Launch
  └─> Login/Signup Screen
      ├─> Email/Password
      ├─> Google Sign In
      └─> Apple Sign In
  └─> Organization Selector (if multiple orgs)
  └─> Project Selector (if multiple projects)
  └─> Dashboard
```

### 2. Main Navigation (Bottom Tab Bar)
- **Dashboard** (Home icon)
- **Accounts** (Users icon)
- **Videos** (Film icon)
- **Links** (Link icon)
- **More** (Menu icon)

### 3. Dashboard Screen
**Top Section:**
- Organization/Project switcher
- Refresh countdown timer (shows next auto-refresh)

**Stats Cards:**
- Total Accounts
- Total Videos
- Total Views
- Total Engagement

**Charts:**
- Views over time (7/30/90 days)
- Engagement breakdown (likes, comments, shares)
- Top performing content

**Quick Actions:**
- Add Account
- Add Video
- Create Link
- Manual Refresh

**Recent Activity Feed:**
- New videos discovered
- Milestone achievements
- Sync completions

### 4. Accounts Screen
**List View:**
```
┌─────────────────────────────────────┐
│ [Profile Pic] @username             │
│ TikTok • 125K followers             │
│ 45 videos • 2.3M views              │
│ Last synced: 2h ago                 │
│ [Syncing indicator or checkmark]    │
└─────────────────────────────────────┘
```

**Account Detail Screen:**
- Header with profile info
- Platform badge
- Follower count
- Sync status and manual sync button
- Tabs:
  - **Overview**: Key metrics, engagement rate
  - **Videos**: List of all videos from this account
  - **Performance**: Charts and trends
  - **Settings**: Max videos, active/inactive toggle, delete

**Add Account Flow:**
1. Select platform (TikTok, Instagram, YouTube, Twitter)
2. Enter username
3. Choose sync type (automatic or manual)
4. Set max videos to scrape
5. Add to campaign (optional)
6. Confirm → Background sync starts

### 5. Videos Screen
**Filter/Sort Options:**
- Platform filter
- Sort by: Date added, Views, Engagement, Upload date
- Search by caption/hashtag

**Grid/List Toggle:**
- Grid: Thumbnail preview with view count overlay
- List: Full details with metrics

**Video Detail Screen:**
- Large thumbnail/video player
- Caption with hashtags
- Platform-specific metrics:
  - Views, Likes, Comments, Shares, Saves
- Historical chart (view trend)
- Account link (if from tracked account)
- Campaign tags
- Actions:
  - Archive
  - Add to campaign
  - Delete
  - Share link

**Add Video Flow:**
1. Paste URL
2. Auto-detect platform
3. Fetch metadata (loading state)
4. Review and confirm
5. Add to campaign (optional)
6. Save

### 6. Links Screen
**List View:**
```
┌─────────────────────────────────────┐
│ Campaign Name                       │
│ viewtrack.app/l/abc123              │
│ → https://destination.com/...       │
│ 1,234 clicks • 890 unique           │
│ Created 5 days ago                  │
└─────────────────────────────────────┘
```

**Link Detail Screen:**
- Short URL with copy button
- Destination URL
- QR code
- Click statistics:
  - Total clicks
  - Unique clicks
  - Click timeline chart
  - Geographic breakdown
  - Device breakdown
  - Referrer sources
- Campaign association
- Active/inactive toggle
- Delete option

**Create Link Flow:**
1. Enter destination URL
2. Customize short code (optional)
3. Add title and description
4. Add to campaign (optional)
5. Set expiration date (optional)
6. Generate → Get shareable short link

### 7. More/Settings Screen
**Organization Section:**
- Organization name/logo
- Switch organization
- Organization settings

**Project Section:**
- Current project name
- Switch project
- Create new project

**Menu Items:**
- **Team Members**: Invite and manage users
- **Creators**: Manage creator portal (if enabled)
- **Campaigns**: View and manage campaigns
- **Revenue**: Revenue integration settings
- **Billing**: Subscription and usage
- **Notifications**: Push notification preferences
- **Profile**: Edit profile, change password
- **Support**: Help docs, contact support
- **Logout**

### 8. Team Members Screen
**List of Members:**
```
┌─────────────────────────────────────┐
│ [Avatar] John Doe                   │
│ john@example.com                    │
│ Owner • Joined 3 months ago         │
└─────────────────────────────────────┘
```

**Actions:**
- Invite new member (email + role)
- Edit member role
- Remove member

### 9. Creators Screen (Owner/Admin Only)
**List of Creators:**
```
┌─────────────────────────────────────┐
│ [Avatar] Jane Creator               │
│ jane@creator.com                    │
│ 3 accounts • $2,450 earnings        │
│ Payment: Monthly • Active           │
└─────────────────────────────────────┘
```

**Creator Detail:**
- Linked accounts
- Performance metrics
- Earnings breakdown
- Payment structure
- Contract details
- Payout history

**Invite Creator Flow:**
1. Enter email
2. Set payment terms
3. Add contract notes
4. Send invitation → Creator receives email

### 10. Creator Portal (Creator Role Only)
Simple view showing:
- Linked accounts and their performance
- Total earnings
- Payment schedule
- Campaign participation

### 11. Campaigns Screen
**List of Campaigns:**
```
┌─────────────────────────────────────┐
│ [Cover] Summer Campaign 2024        │
│ Active • 15 videos • 2.3M views     │
│ 3 creators • 5 accounts             │
│ Jun 1 - Aug 31                      │
└─────────────────────────────────────┘
```

**Campaign Detail:**
- Overview stats
- Associated videos
- Participating creators
- Tracked links
- Performance timeline

**Create Campaign Flow:**
1. Name and description
2. Start/end dates
3. Add accounts, videos, creators, links
4. Set goals (optional)
5. Create

### 12. Revenue Screen
**Apple App Store Integration:**
- Connection status
- Total revenue
- Revenue timeline chart
- Product breakdown
- Manual sync button

**Setup Flow:**
1. Select "Apple App Store"
2. Enter API credentials (Issuer ID, Key ID, Private Key, Vendor Number)
3. Test connection
4. Save and sync

### 13. Billing & Usage Screen
**Current Plan:**
- Plan name and price
- Billing period
- Next billing date

**Usage:**
- Progress bars for each limit:
  - Videos: 450/1000
  - Accounts: 15/50
  - Team Members: 3/10
  - Projects: 2/5

**Actions:**
- Upgrade plan
- Manage subscription (Stripe portal)
- View invoice history

### 14. Settings Screen
**Profile:**
- Avatar
- Display name
- Email
- Password change

**Notifications:**
- Push notifications toggle
- Email notifications toggle
- Notification types:
  - New videos discovered
  - Sync completed
  - Milestones reached
  - Team invitations

**App Settings:**
- Dark/Light mode
- Default project
- Data refresh frequency display

**Admin Settings (if admin user):**
- Admin mode toggle
- View app as normal user

---

## 🔄 Background Sync System

### How It Works
1. **Scheduled Sync** (Automatic):
   - Runs at 00:00 and 12:00 UTC
   - Premium users (Ultra/Enterprise): Both times
   - Regular users (Free/Basic/Pro): 12:00 UTC only
   
2. **Manual Sync** (User-triggered):
   - Can trigger refresh anytime
   - Bypasses time-based restrictions
   - Processes all active accounts immediately

3. **Job Queue System**:
   - All accounts queued in Firestore `/syncQueue`
   - Worker runs every 1 minute
   - Processes max 6 concurrent jobs (Apify RAM limit: 6 × 4GB = 24GB)
   - Jobs have retry logic (max 3 attempts)
   - Auto-cleanup completed jobs when queue empty

4. **Session Tracking**:
   - Each refresh creates a session in `/organizations/{orgId}/refreshSessions`
   - Tracks progress: completed accounts, total videos, views, etc.
   - "Last one out" pattern: Final completing account sends summary email

5. **Email Notifications**:
   - Summary email sent when all accounts in org complete
   - Shows top performers, new videos, total metrics
   - Hourly fallback cron checks for orphaned sessions

### Mobile Implementation Considerations
- Show real-time sync progress via Firestore listeners
- Display countdown timer to next auto-refresh
- Allow manual refresh with pull-to-refresh gesture
- Show sync status per account (pending, syncing, completed, error)
- Push notification when sync completes

---

## 📊 Analytics & Charts

### Dashboard Charts
1. **Views Over Time** (Line chart)
   - Time periods: 7d, 30d, 90d, All time
   - Shows cumulative views

2. **Engagement Breakdown** (Pie chart)
   - Likes, Comments, Shares, Saves
   - Percentage distribution

3. **Top Performing Content** (Horizontal bar chart)
   - Top 5 videos by views
   - With thumbnail preview

4. **Platform Distribution** (Donut chart)
   - Video count by platform
   - Color-coded (TikTok pink, Instagram gradient, YouTube red, Twitter blue)

### Account/Video Detail Charts
1. **Growth Timeline** (Line chart)
   - View count over time
   - Shows refresh snapshots

2. **Engagement Rate Trend** (Area chart)
   - Engagement rate over time
   - (likes + comments) / views

### Campaign Analytics
1. **Campaign Performance** (Multi-line chart)
   - Compare multiple campaigns
   - Views, engagement over time

2. **Creator Performance** (Stacked bar chart)
   - Views per creator
   - Color-coded by creator

---

## 🎨 Design Guidelines

### Color Scheme
```css
/* Primary */
--primary: #667eea; /* Purple gradient start */
--primary-dark: #764ba2; /* Purple gradient end */

/* Accents */
--accent-pink: #f093fb;
--accent-red: #f5576c;
--accent-blue: #4facfe;
--accent-cyan: #00f2fe;
--accent-emerald: #10b981;
--accent-amber: #f59e0b;

/* Platform Colors */
--tiktok: #ff0050;
--instagram: linear-gradient(#833ab4, #fd1d1d, #fcb045);
--youtube: #ff0000;
--twitter: #1da1f2;

/* Neutrals */
--background: #0a0a0a;
--surface: #1a1a1a;
--border: rgba(255, 255, 255, 0.1);
--text: #ffffff;
--text-secondary: #a0a0a0;
```

### Typography
- **Headings**: Inter, SF Pro Display (iOS), Roboto (Android)
- **Body**: Inter, SF Pro Text (iOS), Roboto (Android)
- **Monospace**: SF Mono (iOS), Roboto Mono (Android)

### Icons
- Use Lucide Icons library (consistent with web app)
- Platform-specific icons for social media logos

### Spacing
- Base unit: 4px
- Common spacings: 8px, 12px, 16px, 24px, 32px

---

## 🔔 Push Notifications

### Notification Types
1. **Sync Complete**
   - "Your content has been refreshed! 25 videos updated, 250K new views"
   - Deep link to dashboard

2. **Milestone Reached**
   - "@username just hit 1M views!"
   - Deep link to account detail

3. **New Video Discovered**
   - "3 new videos from @username"
   - Deep link to videos screen

4. **Team Invitation**
   - "You've been invited to join [Org Name]"
   - Deep link to team screen

5. **Creator Invitation**
   - "You've been added as a creator"
   - Deep link to creator portal

6. **Sync Error**
   - "Failed to sync @username - tap to retry"
   - Deep link to account detail

### Implementation
- Use Firebase Cloud Messaging (FCM)
- Store FCM token in `/users/{userId}/devices/{deviceId}`
- Send from backend using Firebase Admin SDK

---

## 💾 Offline Support

### Data to Cache
1. **Dashboard stats** (last synced values)
2. **Account list** with basic info
3. **Video list** with thumbnails
4. **Link list**
5. **User profile**

### Sync Strategy
- Queue offline actions (add video, create link, etc.)
- Process queue when connection restored
- Show "Offline" badge in UI
- Use optimistic updates where possible

---

## 🔐 Security Considerations

### Data Security
- All API calls require Firebase authentication
- Row-level security via Firestore rules
- Sensitive data (API keys) encrypted at rest
- HTTPS only

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOrgMember(orgId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
    }
    
    function getMemberRole(orgId) {
      return get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role;
    }
    
    function isOwnerOrAdmin(orgId) {
      let role = getMemberRole(orgId);
      return role == 'owner' || role == 'admin';
    }
    
    // Organizations
    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow update: if isOwnerOrAdmin(orgId);
      allow delete: if getMemberRole(orgId) == 'owner';
      
      // Members
      match /members/{userId} {
        allow read: if isOrgMember(orgId);
        allow create: if isOwnerOrAdmin(orgId);
        allow update, delete: if isOwnerOrAdmin(orgId) || request.auth.uid == userId;
      }
      
      // Projects
      match /projects/{projectId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOwnerOrAdmin(orgId);
        
        // Project sub-collections (accounts, videos, etc.)
        match /{collection}/{docId} {
          allow read: if isOrgMember(orgId);
          allow write: if isOrgMember(orgId) && getMemberRole(orgId) != 'guest';
        }
      }
      
      // Billing (owner only)
      match /billing/{document=**} {
        allow read: if isOrgMember(orgId);
        allow write: if getMemberRole(orgId) == 'owner';
      }
    }
    
    // Users
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

---

## 📦 Dependencies & Tech Stack

### Frontend (React Native)
- **Framework**: React Native (Expo recommended)
- **Navigation**: React Navigation
- **State Management**: React Context + Hooks (or Redux Toolkit)
- **Firebase**: `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/firestore`
- **Charts**: `react-native-chart-kit` or `victory-native`
- **UI Components**: React Native Elements or NativeBase
- **Image Caching**: `react-native-fast-image`
- **Deep Linking**: Expo Linking or React Navigation Deep Linking

### Backend (Already Exists)
- **Runtime**: Node.js (Vercel Serverless Functions)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Functions**: Vercel Edge Functions
- **Scraping**: Apify API
- **Payments**: Stripe + RevenueCat

### APIs to Use
- Firebase REST API
- Custom endpoints at `https://www.viewtrack.app/api/*`

---

## 🚀 Mobile App Development Roadmap

### Phase 1: MVP (4-6 weeks)
- [ ] Authentication (email/password, Google)
- [ ] Organization/Project switcher
- [ ] Dashboard with basic stats
- [ ] Accounts list and detail view
- [ ] Videos list and detail view
- [ ] Manual refresh
- [ ] Push notifications for sync complete

### Phase 2: Core Features (4-6 weeks)
- [ ] Add account flow
- [ ] Add video flow
- [ ] Links management
- [ ] Team members screen
- [ ] Settings and profile
- [ ] Offline support
- [ ] Real-time sync status

### Phase 3: Advanced Features (6-8 weeks)
- [ ] Creators management
- [ ] Campaigns
- [ ] Revenue integration
- [ ] Advanced analytics and charts
- [ ] In-app purchases (via RevenueCat)
- [ ] Dark/Light mode
- [ ] Localization

### Phase 4: Polish & Launch (2-4 weeks)
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Beta testing
- [ ] App Store submission
- [ ] Marketing materials

---

## 📝 API Integration Examples

### Authentication
```typescript
import auth from '@react-native-firebase/auth';

// Sign in
const signIn = async (email: string, password: string) => {
  const userCredential = await auth().signInWithEmailAndPassword(email, password);
  const idToken = await userCredential.user.getIdToken();
  return idToken;
};

// Use token for API calls
const fetchData = async () => {
  const idToken = await auth().currentUser?.getIdToken();
  const response = await fetch('https://www.viewtrack.app/api/some-endpoint', {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

### Listening to Firestore
```typescript
import firestore from '@react-native-firebase/firestore';

// Listen to accounts
const unsubscribe = firestore()
  .collection('organizations')
  .doc(orgId)
  .collection('projects')
  .doc(projectId)
  .collection('trackedAccounts')
  .where('isActive', '==', true)
  .onSnapshot((snapshot) => {
    const accounts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setAccounts(accounts);
  });

// Cleanup
return () => unsubscribe();
```

### Manual Refresh
```typescript
const triggerRefresh = async () => {
  const idToken = await auth().currentUser?.getIdToken();
  const response = await fetch('https://www.viewtrack.app/api/trigger-orchestrator', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ manual: true })
  });
  return response.json();
};
```

### Add Account
```typescript
const addAccount = async (username: string, platform: string) => {
  const idToken = await auth().currentUser?.getIdToken();
  
  // Add account document to Firestore
  const accountRef = firestore()
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('trackedAccounts')
    .doc();
  
  await accountRef.set({
    username,
    platform,
    isActive: true,
    creatorType: 'automatic',
    maxVideos: 100,
    syncStatus: 'pending',
    dateAdded: firestore.Timestamp.now(),
    addedBy: auth().currentUser?.uid,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0
  });
  
  // Trigger immediate sync
  await fetch('https://www.viewtrack.app/api/sync-single-account', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orgId,
      projectId,
      accountId: accountRef.id
    })
  });
};
```

---

## 🎯 Key Differences from Web App

### What to Keep
- All core functionality
- Data structure
- Authentication
- API endpoints
- Business logic

### What to Adapt
- **Navigation**: Bottom tabs instead of sidebar
- **Charts**: Use mobile-optimized chart library
- **Forms**: Mobile-friendly inputs with proper keyboards
- **Images**: Implement image caching for performance
- **Notifications**: Push notifications instead of email-only
- **Offline**: Queue actions for later sync
- **Performance**: Implement pagination and lazy loading

### What to Add
- **Biometric Auth**: Face ID / Touch ID
- **Share Sheet**: Native share functionality
- **Camera**: Scan QR codes for links
- **Widgets**: iOS/Android home screen widgets
- **Shortcuts**: Siri Shortcuts / Android App Actions

---

## 📚 Additional Resources

### Documentation
- Firebase: https://firebase.google.com/docs
- React Native: https://reactnative.dev/docs
- Expo: https://docs.expo.dev
- Firestore: https://firebase.google.com/docs/firestore
- Apify: https://docs.apify.com

### Design Assets
- Logo: `/public/vtlogo.png`
- White Logo: `/public/whitelogo.png`
- Icons: Lucide Icons (https://lucide.dev)
- Platform Icons: Official brand guidelines

### Support
- Web App: https://www.viewtrack.app
- Email: team@viewtrack.app
- GitHub: (your repo)

---

## ✅ Conclusion

This specification provides everything needed to build a fully-featured mobile app for ViewTrack. The mobile app will connect to the same Firebase backend and APIs as the web app, ensuring data consistency across platforms.

**Key Principles:**
1. **User-Centric**: Optimize for mobile-first interactions
2. **Performance**: Cache data, lazy load, optimize images
3. **Reliable**: Handle offline scenarios gracefully
4. **Secure**: Use Firebase Auth and Firestore rules
5. **Consistent**: Match web app functionality and branding

**Next Steps:**
1. Choose React Native or Flutter
2. Set up project with Firebase
3. Implement authentication
4. Build core screens (Dashboard, Accounts, Videos)
5. Connect to existing APIs
6. Test thoroughly
7. Submit to App Stores

Good luck with your mobile app development! 🚀

