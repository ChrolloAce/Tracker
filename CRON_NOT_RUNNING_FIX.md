# Cron Job Not Running - Diagnostic & Fix Guide

## 🔍 Quick Diagnosis

Your cron job is **configured** but may not be **enabled** in Vercel. Here's how to fix it.

## Current Configuration

**Schedule**: Every 12 hours (midnight & noon UTC)
- **Cron Expression**: `0 */12 * * *`
- **Endpoint**: `/api/cron-orchestrator`
- **File**: `api/cron-orchestrator.ts`

## ⚡ Quick Fix Steps

### Step 1: Check if Cron is Enabled in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **trackview-6a3a5**
3. Click on **"Cron Jobs"** tab in the left sidebar
4. You should see: `/api/cron-orchestrator` with schedule `0 */12 * * *`
5. **Check if it's ENABLED** (toggle should be ON/green)

**If it's disabled**:
- Click the toggle to **ENABLE** it
- Wait a few minutes for it to activate

### Step 2: Check Environment Variables

The cron needs a `CRON_SECRET` environment variable:

1. In Vercel Dashboard → Your Project
2. Go to **Settings** → **Environment Variables**
3. Check if **`CRON_SECRET`** exists
4. If missing, add it:
   - Name: `CRON_SECRET`
   - Value: (generate a random secure string, e.g., `crypto.randomUUID()`)
   - **Important**: Add to **ALL environments** (Production, Preview, Development)

**Required Environment Variables**:
```
✓ CRON_SECRET           - For cron authentication
✓ FIREBASE_PROJECT_ID   - Your Firebase project
✓ FIREBASE_CLIENT_EMAIL - Firebase service account email
✓ FIREBASE_PRIVATE_KEY  - Firebase service account private key
```

### Step 3: Test the Cron Manually

Test if the cron endpoint works:

```bash
# Option 1: Use the built-in test endpoint
curl https://www.viewtrack.app/api/cron-test

# Option 2: Call the orchestrator directly
curl -X POST https://www.viewtrack.app/api/cron-orchestrator \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Or use the dashboard**:
- Visit: https://www.viewtrack.app/api/cron-test
- This triggers a manual run

### Step 4: Check Cron Status

View your accounts and when they were last synced:

```
https://www.viewtrack.app/api/cron-status
```

This shows:
- All tracked accounts
- Last sync time for each
- Which accounts are due for refresh

## 🔍 Troubleshooting Common Issues

### Issue 1: "Cron shows as disabled in Vercel"

**Solution**: Enable it manually
1. Vercel Dashboard → Your Project → Cron Jobs
2. Find `/api/cron-orchestrator`
3. Toggle it to ENABLED
4. Redeploy if needed (Settings → Deployments → Redeploy latest)

### Issue 2: "Cron is enabled but not running"

**Check Logs**:
1. Vercel Dashboard → Your Project
2. Go to **"Logs"** or **"Functions"**
3. Filter by `/api/cron-orchestrator`
4. Look for executions and errors

**Common errors**:
- `Unauthorized`: CRON_SECRET is missing or wrong
- `Firebase not initialized`: Firebase env vars missing
- `No accounts to refresh`: All accounts were recently synced

### Issue 3: "Accounts never refresh"

**Reason**: Refresh intervals are based on plan tier:
- **Free**: 48 hours
- **Basic**: 24 hours
- **Pro**: 24 hours
- **Ultra**: 12 hours
- **Enterprise**: 12 hours

If you refreshed manually recently, the cron will **skip** those accounts until the interval passes.

**Check in logs**:
```
⏭️  Skipping @username (refreshed 2.5h ago, 9.5h remaining)
```

### Issue 4: "Cron runs but nothing happens"

**Check account status**:
1. Visit `/api/cron-status`
2. Look for accounts with `lastSynced: "Never"`
3. Check if accounts have `status: "active"`

**Verify in Firestore**:
- `organizations/{orgId}/projects/{projectId}/trackedAccounts`
- Each account should have:
  - `status: "active"`
  - `isActive: true`
  - `lastRefreshed: Timestamp` (optional on first run)

## 📊 Monitoring

### Built-in Dashboards

1. **Status Dashboard**: https://www.viewtrack.app/api/cron-status
   - Shows all accounts and sync times
   - Real-time refresh status
   
2. **Cron Management** (in app):
   - Go to Settings → Cron
   - View current schedule
   - Trigger manual refresh
   - See last execution results

3. **Vercel Logs**:
   - Vercel Dashboard → Functions → cron-orchestrator
   - Shows every execution
   - Displays success/failure
   - Shows which accounts were refreshed

### Expected Log Output

When cron runs successfully:
```
🚀 Cron Orchestrator started at 2025-01-11T12:00:00.000Z
📊 Found 1 organization(s)
📁 Processing organization: YOUR_ORG_ID
  📋 Organization plan: pro
  ⏱️  Refresh interval: 24 hours
  📂 Found 1 project(s)
  📦 Processing project: Default Project
    🚀 Checking accounts for refresh (24h interval)...
    👥 Found 3 active account(s)
      ⚡ Dispatching @username (instagram), last refresh: 2025-01-10T12:00:00.000Z
        ✅ @username: 2 updated, 1 added
      ⏭️  Skipping @another_user (refreshed 2h ago, 22h remaining)
✅ Cron completed in 15.3s
📈 Stats:
  • Total accounts: 3
  • Dispatched: 1
  • Skipped: 2
  • Failed: 0
```

## 🧪 Testing

### Test 1: Manual Trigger

```bash
# Trigger a test run
curl https://www.viewtrack.app/api/cron-test
```

Expected response:
```json
{
  "success": true,
  "message": "Cron job triggered successfully",
  "stats": {
    "totalAccounts": 5,
    "dispatchedJobs": 2,
    "skippedAccounts": 3,
    "failedDispatches": 0
  }
}
```

### Test 2: Check Individual Account

Visit your dashboard and check:
1. Go to Accounts tab
2. Find an account
3. Check "Last Refreshed" timestamp
4. It should update after cron runs

### Test 3: Force Refresh

To test if the refresh logic works:
1. In Firestore Console
2. Find an account in `trackedAccounts`
3. Delete or update `lastRefreshed` field to an old date
4. Run the cron manually
5. Check if it refreshes

## 🔧 Manual Fixes

### Re-enable Cron in vercel.json

If cron isn't showing in Vercel, check `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron-orchestrator",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

Then:
```bash
git add vercel.json
git commit -m "Ensure cron is configured"
git push origin main
```

### Reset Cron Schedule

To change the schedule:

1. Edit `vercel.json`:
```json
"crons": [
  {
    "path": "/api/cron-orchestrator",
    "schedule": "0 * * * *"  // Every hour for testing
  }
]
```

2. Deploy:
```bash
git push origin main
```

3. Check Vercel Dashboard → Cron Jobs
4. Verify new schedule is active

## 🚨 Emergency Options

### Option 1: Trigger from Dashboard

1. In your app, go to **Settings → Cron**
2. Click **"Trigger Manual Refresh"**
3. Wait for confirmation

### Option 2: Call API Directly

```bash
# Get your CRON_SECRET from Vercel env vars
curl -X POST https://www.viewtrack.app/api/cron-orchestrator \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 3: Use Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Trigger cron manually
vercel logs --follow
```

## ✅ Verification Checklist

After applying fixes, verify:

- [ ] Cron shows as **ENABLED** in Vercel Dashboard
- [ ] `CRON_SECRET` environment variable exists
- [ ] All Firebase env vars are set
- [ ] Manual test works: `/api/cron-test` returns success
- [ ] Status dashboard shows accounts: `/api/cron-status`
- [ ] Vercel logs show cron executions
- [ ] Account `lastRefreshed` timestamps update after cron runs
- [ ] New videos appear in dashboard after refresh

## 📞 Still Not Working?

### Check Vercel Function Logs

1. Vercel Dashboard → Your Project
2. **Functions** tab
3. Find `api/cron-orchestrator.ts`
4. Click to see recent invocations
5. Look for errors in execution logs

### Check Firebase Console

1. [Firebase Console](https://console.firebase.google.com/)
2. Select **trackview-6a3a5**
3. Go to **Firestore Database**
4. Navigate to: `organizations/{yourOrgId}/projects/{yourProjectId}/trackedAccounts`
5. Check if accounts have:
   - `status: "active"`
   - `isActive: true`
   - Recent `lastRefreshed` timestamp

### Contact Support

If still stuck, gather this info:
1. Screenshot of Vercel Cron Jobs tab
2. Output from `/api/cron-status`
3. Output from `/api/cron-test`
4. Recent Vercel function logs for `/api/cron-orchestrator`
5. Your organization tier (free/pro/enterprise)

## 🎯 Most Likely Cause

**99% of the time it's one of these**:
1. ❌ Cron is **disabled** in Vercel Dashboard
2. ❌ `CRON_SECRET` environment variable is **missing**
3. ⏰ Accounts were **recently refreshed** (within interval period)
4. 🔐 Vercel Cron **header check** failing (should work automatically)

---

**Quick Command to Enable Everything**:

```bash
# 1. Check vercel.json has cron configured
cat vercel.json | grep -A 3 "crons"

# 2. Deploy to ensure latest config
git push origin main

# 3. Test manually
curl https://www.viewtrack.app/api/cron-test

# 4. Check status
open https://www.viewtrack.app/api/cron-status
```

**Next Step**: Go to Vercel Dashboard → Cron Jobs and click the toggle to ENABLE it! 🚀

