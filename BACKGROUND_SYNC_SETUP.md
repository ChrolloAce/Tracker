# 🚀 Background Sync Setup Guide

## ✅ What's Been Implemented

I've implemented a complete background job processing system for account syncing:

- ✅ Updated `TrackedAccount` type with sync status fields
- ✅ Created `/api/cron-sync-accounts` endpoint (runs every 5 minutes)
- ✅ Created `/api/trigger-sync` endpoint (immediate sync trigger)
- ✅ Updated `vercel.json` with new cron schedule
- ✅ Modified account creation to queue for background sync
- ✅ Added email notifications for sync completion/failure
- ✅ Automatic retry logic (up to 3 attempts)

**Commit:** `fe65198`
**Branch:** `main`

---

## 🎯 What You Need To Do Manually

### Step 1: Add CRON_SECRET Environment Variable

1. Go to your **Vercel Dashboard**
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add the following variable:

```
Name:  CRON_SECRET
Value: [Generate a random secure string - use this: https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new]
```

6. Select **All Environments** (Production, Preview, Development)
7. Click **Save**

**⚠️ IMPORTANT:** Copy your CRON_SECRET value - you'll need it for testing!

---

### Step 2: Redeploy Your Application

After adding the environment variable:

1. Go to **Deployments** tab in Vercel
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. Select **Use existing Build Cache**
5. Click **Redeploy**

**OR** just push a new commit (already done) and Vercel will auto-deploy.

---

### Step 3: Verify Cron Job is Working

After deployment, check that the cron is scheduled:

1. Go to **Settings** → **Crons** in Vercel
2. You should see:
   - ✅ `/api/cron-sync-accounts` - runs every 5 minutes
   - ✅ `/api/cron-refresh-videos` - runs every 12 hours

---

### Step 4: Test the System

#### Test 1: Add a New Account

1. Go to your **Accounts** page
2. Click **Add Account**
3. Enter a TikTok/YouTube username
4. Click **Add Account**
5. **Close the page immediately** (this is the test!)
6. Wait 5 minutes
7. Come back and refresh - the account should be synced!

#### Test 2: Check Email Notifications

- You should receive an email when the sync completes
- Check your inbox (and spam folder)

#### Test 3: View Cron Logs

To see if the cron is running:

1. Go to **Deployments** in Vercel
2. Click on your latest deployment
3. Go to **Functions** tab
4. Find `/api/cron-sync-accounts`
5. Click to view logs
6. You should see logs every 5 minutes like:

```
🚀 Cron job started: sync-accounts
📋 Found 1 accounts to sync
🔄 Processing account: username (tiktok)
✅ Completed: username - 25 videos saved
```

---

## 🎨 How It Works Now

### Old System (Blocking):
```
User clicks "Add Account"
  ↓
UI freezes while fetching videos (30-60 seconds)
  ↓
Videos appear
  ↓
If user closes page, process stops ❌
```

### New System (Background):
```
User clicks "Add Account"
  ↓
Account added with status="pending" (instant!)
  ↓
User can close page ✅
  ↓
Cron job processes account every 5 minutes
  ↓
Videos sync in background
  ↓
User gets email notification
  ↓
Next time user opens page, videos are there!
```

---

## 📊 Sync Statuses

Accounts will show one of these statuses:

| Status | Icon | Meaning |
|--------|------|---------|
| `pending` | ⏳ Queued | Waiting for cron to process |
| `syncing` | 🔄 Syncing... | Currently fetching videos |
| `completed` | ✅ Synced | Successfully synced |
| `error` | ❌ Failed | Failed after 3 retries |

---

## 🔧 Troubleshooting

### Problem: Cron not running

**Solution:**
- Check that `CRON_SECRET` is set in Vercel environment variables
- Make sure you're on Vercel Pro plan (Hobby has limits)
- Check cron logs in Vercel dashboard

### Problem: Accounts stuck in "pending"

**Solution:**
- Check the cron job logs for errors
- Manually trigger the cron: `POST /api/cron-sync-accounts` with header `Authorization: Bearer YOUR_CRON_SECRET`
- Check that Firebase credentials are set correctly

### Problem: No email notifications

**Solution:**
- Verify `RESEND_API_KEY` is set in environment variables
- Check the email address in your user account is valid
- Look for email errors in function logs

---

## 💰 Vercel Pricing Notes

**Cron Execution Limits:**

- **Hobby Plan**: 100 cron executions per day (FREE)
  - Running every 5 minutes = 288 executions/day
  - **You'll exceed the limit!** 

- **Pro Plan**: Unlimited cron executions ($20/month)
  - Recommended for production use

**Recommendations:**

1. **For Testing (Hobby):** Change cron to `*/15 * * * *` (every 15 minutes = 96/day)
2. **For Production:** Upgrade to Pro plan
3. **Alternative:** Change to `*/10 * * * *` (every 10 minutes = 144/day) but you'll still exceed

---

## 🎯 Optional Enhancements (Future)

These are NOT required but nice to have:

- [ ] Add a "Retry" button for failed syncs in the UI
- [ ] Show sync progress bar in real-time
- [ ] Add dashboard page to view all background jobs
- [ ] Add ability to pause/resume syncing for specific accounts
- [ ] Add webhook notifications instead of polling

---

## 📝 Files Changed

1. **`/api/cron-sync-accounts.ts`** - Main cron job handler
2. **`/api/trigger-sync.ts`** - Immediate sync trigger
3. **`vercel.json`** - Added cron schedule
4. **`src/types/firestore.ts`** - Added sync status fields
5. **`src/services/FirestoreDataService.ts`** - Queue accounts for sync

---

## 🚀 You're Done!

Once you complete Steps 1-3 above, your system will:

- ✅ Process accounts in the background
- ✅ Continue syncing even if user closes the page
- ✅ Send email notifications
- ✅ Automatically retry failures
- ✅ Scale to handle multiple accounts simultaneously

**Need help?** Check the Vercel logs or ping me! 🎉

