# Cron Refresh System - Manual vs Automatic Accounts

## Overview
Your cron system now properly handles **manual** vs **automatic** account types with consolidated email notifications per organization.

---

## ✅ What Was Fixed

### 1. **Email Notifications** 
- **Before:** Individual email sent for each account refreshed (spam)
- **After:** One summary email per organization with aggregated stats

### 2. **Manual vs Automatic Logic**
- **Manual Accounts:** Only refresh existing videos (no new video discovery)
- **Automatic Accounts:** Refresh existing + discover new videos after the most recent one

### 3. **Bug Fixes**
- Fixed undefined `plan` variable in `cron-orchestrator.ts` (line 435)
- Removed duplicate email sending from `sync-single-account.ts`

---

## 🔄 How It Works

### Automatic Accounts (Default)
```
1. Fetch 2-5 newest videos from platform
2. Check if any already exist in database
3. If found existing video → STOP fetching new
4. Save any NEW videos found
5. Refresh ALL existing videos with latest metrics
```

**Example:** If account has 100 videos, and 3 new videos were posted:
- ✅ Discovers and adds the 3 new videos
- ✅ Refreshes all 103 videos with latest views/likes/comments

### Manual Accounts
```
1. Get list of existing videos from database
2. Refresh ONLY those videos with latest metrics
3. NEVER discover or add new videos
```

**Example:** If account has 100 videos, and 3 new videos were posted:
- ❌ Does NOT add the 3 new videos
- ✅ Refreshes only the existing 100 videos

---

## 📧 Email System

### Organization Summary Email (Sent by `cron-orchestrator.ts`)
**Sent:** Once per organization after all accounts are refreshed  
**Contains:**
- Total accounts refreshed
- Total videos synced
- Overall view growth
- Top 5 performing accounts
- Link clicks from tracked links

**Example:**
```
Subject: 📊 Your ViewTrack Report for Acme Corp (25h refresh)

✅ 5 accounts refreshed (234 videos synced)
👁️ 1.2M views (+12.5%)
❤️ 45K likes
💬 8.3K comments
🔗 342 link clicks

Top Performers:
1. @johndoe (Instagram) - 450K views (+15.2%)
2. @janedoe (TikTok) - 380K views (+8.1%)
...
```

---

## 🗂️ Cron Jobs Architecture

### 1. `cron-orchestrator.ts`
**Schedule:** Every 12 hours (midnight & noon UTC)  
**Purpose:** Process all organizations  
**What it does:**
- Finds accounts that need refreshing (based on plan interval)
- Calls `sync-single-account` for each account
- Sends ONE summary email per organization
- Tracks Apple revenue if enabled

### 2. `cron-refresh-videos.ts` (Standalone)
**Schedule:** Every 12 hours (configurable)  
**Purpose:** Direct video refresh without orchestrator  
**What it does:**
- Processes all organizations directly
- Respects manual vs automatic account types
- Sends ONE summary email per organization
- Can be triggered manually with organization/project scope

### 3. `sync-single-account.ts` (Called by orchestrator)
**Purpose:** Sync a single account  
**What it does:**
- Fetches videos from platform
- Saves to Firestore
- Updates account stats
- ~~Does NOT send emails~~ (handled by orchestrator)

---

## 🔍 How to Verify It's Working

### Check Account Type in Firestore
```
1. Go to Firestore Console
2. Navigate to: organizations/{orgId}/projects/{projectId}/trackedAccounts/{accountId}
3. Check field: creatorType
   - "manual" = Only refreshes existing videos
   - "automatic" = Discovers new + refreshes existing
   - undefined/null = Defaults to "automatic"
```

### Test Manual Account
1. Set account `creatorType` to `"manual"`
2. Wait for next cron run (or trigger manually)
3. Check logs for: `[MANUAL]: Refreshing existing videos only`
4. Verify no new videos were added (check video count before/after)

### Test Automatic Account
1. Set account `creatorType` to `"automatic"` (or leave undefined)
2. Wait for next cron run
3. Check logs for: `[AUTOMATIC]: Discovering new videos + refreshing existing`
4. Verify new videos were added if any exist on platform

---

## 📝 Account Setup

### When Accounts Are Created

#### From Video URL (`process-single-video.ts`)
```javascript
creatorType: 'manual'  // ✅ Correct - only refreshes that specific video
```

#### From Account Username (`sync-single-account.ts`)
```javascript
// Should be set by the UI when adding account
// If not set, defaults to 'automatic'
```

### Recommended: Set creatorType in UI
When users add an account, give them the option:
- [ ] **Automatic** - Discover new videos + refresh existing (recommended)
- [ ] **Manual** - Only refresh existing videos (for specific content)

---

## 🛠️ API Endpoints

### Trigger Manual Refresh
```bash
POST /api/cron-refresh-videos
Authorization: Bearer {CRON_SECRET}

Body:
{
  "manual": true,
  "organizationId": "optional-scope-to-org",
  "projectId": "optional-scope-to-project"
}
```

### Trigger Orchestrator
```bash
POST /api/cron-orchestrator
Authorization: Bearer {CRON_SECRET}
# or use Firebase ID token for manual testing
```

---

## 📊 Logs to Look For

### Manual Account Success
```
🔄 @username [MANUAL]: Refreshing existing videos only
📊 [TIKTOK] Refreshing 25 existing videos...
✅ @username [MANUAL]: Updated 25 existing videos
```

### Automatic Account Success
```
🔄 @username [AUTOMATIC]: Discovering new videos + refreshing existing
📥 [TIKTOK] Fetching 2 newest videos...
✨ [TIKTOK] New video detected: 7281234567890
📊 [TIKTOK] Found 3 new videos
🔄 [TIKTOK] Refreshing existing videos...
✅ @username [AUTOMATIC]: Updated 100 videos, Added 3 new videos
```

---

## 🚨 Troubleshooting

### Issue: All accounts being treated as automatic
**Cause:** `creatorType` field not set on accounts  
**Fix:** Set `creatorType: 'manual'` or `creatorType: 'automatic'` in Firestore

### Issue: Still receiving individual emails
**Cause:** Old cron jobs still running or cache  
**Fix:** 
1. Redeploy the API (`vercel --prod`)
2. Check environment variable `RESEND_API_KEY` is set
3. Verify `sync-single-account.ts` was updated (should have comment about orchestrator)

### Issue: Manual accounts still adding new videos
**Cause:** Wrong API endpoint being called or `creatorType` not set  
**Fix:**
1. Check account has `creatorType: 'manual'` in Firestore
2. Check logs for `[MANUAL]` vs `[AUTOMATIC]` designation
3. Verify `cron-refresh-videos.ts` line 200-230 logic

---

## 📈 Next Steps

1. **Set creatorType for existing accounts** (batch update in Firestore)
2. **Add UI toggle** when adding accounts (automatic/manual choice)
3. **Monitor email consolidation** (should receive 1 email per org, not per account)
4. **Test both account types** with real accounts

---

## Files Modified

- ✅ `api/sync-single-account.ts` - Removed individual email sending
- ✅ `api/cron-orchestrator.ts` - Fixed undefined `plan` variable
- ✅ `api/cron-refresh-videos.ts` - Already correctly implements manual/automatic logic
- ✅ `api/refresh-account.ts` - Already correctly implements manual/automatic logic

---

## Summary

Your system now:
- ✅ Respects manual vs automatic account types
- ✅ Sends ONE summary email per organization (not per account)
- ✅ Manual accounts only refresh existing videos
- ✅ Automatic accounts discover new + refresh existing videos
- ✅ Handles errors gracefully
- ✅ Provides detailed logging for debugging

**The logic was already correct in `cron-refresh-videos.ts`.** The issue was likely:
1. Accounts don't have `creatorType` set (defaulting to automatic)
2. Duplicate emails from `sync-single-account.ts` (now fixed)

