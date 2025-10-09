# FIX REFRESH TO UPDATE EXISTING VIDEOS ONLY

## 🔍 Problem Identified

After the manual video refresh was successfully working, it was adding 100+ new videos to the database for each account. This was not the intended behavior. The goal of the "refresh" operation is to:
- ✅ **UPDATE** metrics for videos that are already being tracked
- ❌ **NOT ADD** new videos from the API

The previous implementation was treating the refresh like a sync operation, adding all videos returned from Apify to the database.

## ✅ What Was Fixed

### 1. Changed Logic to Skip Non-Existing Videos

Modified `saveVideosToFirestore` function to check if a video exists **before** processing it:

**Before:**
```typescript
if (existingDoc.exists) {
  // Update existing video
  batch.update(videoRef, videoData);
  // Create snapshot...
} else {
  // Create new video (THIS WAS THE PROBLEM)
  batch.set(videoRef, { ...allVideoData });
}
```

**After:**
```typescript
// ONLY update existing videos - don't add new ones
if (!existingDoc.exists) {
  // Skip videos that don't already exist in the database
  skippedCount++;
  continue;
}

// Update existing video metrics
batch.update(videoRef, videoData);
// Create snapshot...
updatedCount++;
```

### 2. Added Tracking for Updated vs Skipped Videos

**Function Signature Updated:**
```typescript
async function saveVideosToFirestore(
  orgId: string,
  projectId: string,
  accountId: string,
  videos: any[],
  platform: string
): Promise<{ updated: number; skipped: number }>
```

**Returns:**
- `updated`: Number of videos that were updated (already existed)
- `skipped`: Number of videos that were skipped (not yet tracked)

### 3. Updated Return Type for `refreshAccountVideos`

Changed from returning the raw video array to returning detailed counts:

**Before:**
```typescript
async function refreshAccountVideos(...): Promise<any[]>
```

**After:**
```typescript
async function refreshAccountVideos(...): Promise<{
  fetched: number;   // Total videos returned from API
  updated: number;   // Videos that were updated in DB
  skipped: number;   // New videos that were skipped
}>
```

### 4. Improved Logging

**New Log Output:**
```
📊 Apify returned 100 items for tiktok
📊 Updated: 5 videos, Skipped: 95 new videos
✅ @username: Updated 5 videos, Skipped 95 new videos
```

This makes it clear:
- How many videos the API returned
- How many were actually updated (already tracked)
- How many were skipped (new videos not yet tracked)

## 🎯 Behavior Changes

### Before This Fix:
1. Manual refresh triggers
2. Apify returns 100 videos for each account
3. **All 100 videos are added to database** ❌
4. Database grows uncontrollably with duplicate/unwanted videos

### After This Fix:
1. Manual refresh triggers
2. Apify returns 100 videos for each account
3. **Only videos already in database are updated** ✅
4. New videos are skipped (logged but not added)
5. Database only contains manually tracked videos

## 📋 Files Modified

- ✅ `api/cron-refresh-videos.ts` - Complete refresh logic overhaul
- ✅ `FIX_REFRESH_EXISTING_ONLY.md` - Documentation

## 🔧 How It Works Now

1. **Account Sync** (adding account):
   - Uses `/api/sync-single-account` endpoint
   - Fetches videos from Apify
   - Adds ALL videos to database (initial sync)

2. **Video Refresh** (updating metrics):
   - Uses `/api/cron-refresh-videos` endpoint
   - Fetches latest data from Apify
   - ONLY updates videos that already exist
   - Skips any new videos
   - Creates new snapshots for updated videos

## 🚀 Deployment

**Commit:** `Fix: Refresh should only update existing videos, not add new ones`

The fix has been committed and will be pushed to trigger Vercel deployment.

## 📊 Expected Results

After this deployment:
- ✅ Manual refresh will only update existing videos
- ✅ New videos won't be automatically added during refresh
- ✅ Better logging shows updated vs skipped counts
- ✅ Database stays clean with only manually tracked videos
- ✅ Snapshots are created only for videos being tracked

## 💡 Future Enhancements

If you want to add new videos from an account:
1. Use the "Sync Account" button (not "Refresh")
2. Or create a separate "Add New Videos" feature
3. The refresh operation is now purely for updating metrics

