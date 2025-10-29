# 🎯 Usage Limits & Subscription Enforcement Guide

Complete guide for integrating usage tracking and subscription limits throughout your app.

---

## 📊 What's Been Built

### **1. UsageTrackingService** (`src/services/UsageTrackingService.ts`)
- Tracks usage for all resources
- Checks limits against subscription plan
- Increments/decrements counters
- Provides usage status

### **2. UsageDisplay Component** (`src/components/UsageDisplay.tsx`)
- Shows usage bars for all resources
- Real-time updates
- Compact mode for sidebars
- Color-coded status (green/yellow/red)

### **3. UpgradeModal Component** (`src/components/UpgradeModal.tsx`)
- Beautiful upgrade prompt
- Shows current vs upgraded limits
- Recommends best plan
- Links to subscription page

### **4. useUsageLimits Hook** (`src/hooks/useUsageLimits.ts`)
- Easy limit checking before actions
- Automatic upgrade modal
- Increment/decrement helpers

---

## 🚀 Integration Examples

### **Example 1: Adding a Tracked Account**

```typescript
// In AccountsPage.tsx or wherever you add accounts

import { useUsageLimits } from '../hooks/useUsageLimits';
import UpgradeModal from './UpgradeModal';

function AccountsPage() {
  const { checkLimit, incrementUsage, limitInfo, isUpgradeModalOpen, closeUpgradeModal } = useUsageLimits();

  const handleAddAccount = async (accountData: any) => {
    // ✅ CHECK LIMIT FIRST
    if (!(await checkLimit('account'))) {
      // Upgrade modal automatically shown
      return;
    }

    try {
      // Add account to Firestore
      await FirestoreDataService.addAccount(currentOrgId, currentProjectId, accountData);
      
      // ✅ INCREMENT USAGE COUNTER
      await incrementUsage('trackedAccounts');
      
      // Success!
      alert('Account added successfully!');
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  };

  return (
    <div>
      {/* Your existing UI */}
      <button onClick={handleAddAccount}>
        Add Account
      </button>

      {/* ✅ ADD UPGRADE MODAL */}
      {limitInfo && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={closeUpgradeModal}
          resourceType={limitInfo.resourceType}
          currentLimit={limitInfo.currentLimit}
          currentUsage={limitInfo.currentUsage}
        />
      )}
    </div>
  );
}
```

### **Example 2: Deleting a Tracked Account**

```typescript
const handleDeleteAccount = async (accountId: string) => {
  try {
    await FirestoreDataService.deleteAccount(currentOrgId, currentProjectId, accountId);
    
    // ✅ DECREMENT USAGE COUNTER
    await decrementUsage('trackedAccounts');
    
    alert('Account deleted successfully!');
  } catch (error) {
    console.error('Failed to delete account:', error);
  }
};
```

### **Example 3: Adding Manual Videos**

```typescript
const handleAddManualVideo = async (videoData: any) => {
  // Check limit
  if (!(await checkLimit('video'))) {
    return;
  }

  try {
    await FirestoreDataService.addVideo(currentOrgId, currentProjectId, videoData);
    
    // Increment BOTH counters
    await incrementUsage('trackedVideos'); // Total videos
    await incrementUsage('manualVideos'); // Manual videos specifically
    
    alert('Video added!');
  } catch (error) {
    console.error('Failed to add video:', error);
  }
};
```

### **Example 4: Adding Team Members**

```typescript
const handleInviteTeamMember = async (email: string) => {
  // Check if team has space
  if (!(await checkLimit('team'))) {
    return; // Shows upgrade modal automatically
  }

  try {
    await TeamInvitationService.inviteUser(currentOrgId, email);
    
    // Increment team member count
    await incrementUsage('teamMembers');
    
    alert('Invitation sent!');
  } catch (error) {
    console.error('Failed to invite team member:', error);
  }
};
```

### **Example 5: Creating Tracked Links**

```typescript
const handleCreateLink = async (linkData: any) => {
  if (!(await checkLimit('link'))) {
    return;
  }

  try {
    await TrackedLinksService.createLink(currentOrgId, currentProjectId, linkData);
    await incrementUsage('trackedLinks');
    
    alert('Link created!');
  } catch (error) {
    console.error('Failed to create link:', error);
  }
};
```

### **Example 6: MCP API Calls**

```typescript
const handleMCPCall = async () => {
  if (!(await checkLimit('mcp'))) {
    return;
  }

  try {
    await fetch('/api/mcp-endpoint', { method: 'POST' });
    await incrementUsage('mcpCallsThisMonth');
  } catch (error) {
    console.error('MCP call failed:', error);
  }
};
```

---

## 🎨 Displaying Usage in UI

### **In Settings Page (Full Display)**

```typescript
import UsageDisplay from './UsageDisplay';

function SettingsPage() {
  return (
    <div>
      <h2>Your Usage</h2>
      <UsageDisplay /> {/* Full detailed view */}
    </div>
  );
}
```

### **In Sidebar (Compact Display)**

```typescript
import UsageDisplay from './UsageDisplay';

function Sidebar() {
  return (
    <div>
      {/* Other sidebar items */}
      
      <div className="mt-4 pt-4 border-t border-white/10">
        <h3 className="text-xs font-semibold text-gray-400 mb-2">Usage</h3>
        <UsageDisplay compact /> {/* Compact view */}
      </div>
    </div>
  );
}
```

---

## 📋 Complete Integration Checklist

### **Step 1: Update Firestore Structure**

Run this once to initialize usage tracking for existing organizations:

```typescript
// In a migration script or admin panel
import UsageTrackingService from './services/UsageTrackingService';

async function initializeUsageTracking(orgId: string) {
  // This will create the usage document with current counts
  const usage = await UsageTrackingService.getUsage(orgId);
  console.log('✅ Usage tracking initialized:', usage);
}
```

### **Step 2: Add to All Resource Creation Points**

**Accounts:**
- ✅ `AccountsPage.tsx` - Add account button
- ✅ `CreateAccountModal.tsx` - Submit handler

**Videos:**
- ✅ `AddVideoModal.tsx` - Manual video add
- ✅ Auto-tracking service - When videos are fetched

**Links:**
- ✅ `CreateLinkModal.tsx` - Link creation
- ✅ `TrackedLinksPage.tsx` - Bulk operations

**Team:**
- ✅ `TeamManagementPage.tsx` - Invite user
- ✅ `InviteTeamMemberModal.tsx` - Invitation form

### **Step 3: Add to All Deletion Points**

Make sure to decrement when deleting:

```typescript
// For accounts
await decrementUsage('trackedAccounts');

// For videos
await decrementUsage('trackedVideos');

// For links
await decrementUsage('trackedLinks');

// For team members (when removing)
await decrementUsage('teamMembers');
```

### **Step 4: Add Usage Display to Key Pages**

**Recommended Locations:**
- ✅ Settings Page (full view)
- ✅ Billing/Subscription Page (full view)
- ✅ Dashboard (compact view in header/sidebar)
- ✅ Accounts Page (compact, accounts only)
- ✅ Links Page (compact, links only)

### **Step 5: Monthly Reset (MCP Calls)**

Add a cloud function or cron job:

```typescript
// api/cron-reset-usage.ts
import UsageTrackingService from '../src/services/UsageTrackingService';

export default async function handler(req, res) {
  // Get all organizations
  const orgs = await getAllOrganizations();
  
  for (const org of orgs) {
    await UsageTrackingService.resetMonthlyUsage(org.id);
  }
  
  res.status(200).json({ success: true });
}
```

---

## 🎯 Subscription Limits Reference

| Feature | Free | Basic | Pro | Ultra |
|---------|------|-------|-----|-------|
| **Tracked Accounts** | 1 | 3 | ∞ | ∞ |
| **Tracked Videos** | 5 | 100 | 1,000 | 5,000 |
| **Tracked Links** | 1 | 10 | 100 | ∞ |
| **Team Seats** | 1 | 1 | 1 | 20 |
| **MCP Calls/Month** | 10 | 100 | 1,000 | 1,000 |

---

## 🐛 Testing

### **Test Limit Enforcement:**

```typescript
// 1. Create a test organization with Free plan
// 2. Try to add 6 videos (limit is 5)
// 3. Should show upgrade modal
// 4. Upgrade to Pro
// 5. Should now allow adding videos up to 1,000
```

### **Test Usage Display:**

```typescript
// 1. Add some resources
// 2. Check Settings page - should show usage bars
// 3. Get close to limit (4/5 videos)
// 4. Bar should turn yellow (warning)
// 5. Reach limit (5/5 videos)
// 6. Bar should turn red and show "Limit reached"
```

---

## 🎨 Styling Customization

The components use Tailwind classes. Key colors:

- **Over limit**: `text-red-400`, `bg-red-500`
- **Near limit** (>80%): `text-yellow-400`, `bg-yellow-500`
- **Normal**: `text-emerald-400`, `bg-emerald-500`
- **Unlimited**: `text-emerald-400` with ∞ symbol

---

## 📞 Support

If you need help integrating:
1. Check the examples above
2. Test with the hook in a simple component first
3. Add logging to track when limits are checked
4. Verify Firestore structure matches expected format

**Firestore Structure:**
```
organizations/{orgId}/
  ├── billing/
  │   ├── subscription (planTier, status, etc.)
  │   └── usage (trackedAccounts, trackedVideos, etc.)
```

---

## ✅ Summary

1. **Use `useUsageLimits()` hook** in any component that creates resources
2. **Call `checkLimit()` before** the action
3. **Call `incrementUsage()` after** successful creation
4. **Call `decrementUsage()` after** deletion
5. **Add `<UpgradeModal>`** to show upgrade prompts
6. **Add `<UsageDisplay>`** to show current usage

**You're all set!** 🚀 Your subscription limits are now fully enforced!

