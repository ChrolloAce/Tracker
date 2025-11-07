# Automatic Cleanup System 🧹

## Problem Solved
Videos and accounts were appearing in the dashboard with no data:
- ❌ No username (showing as `@unknown`)
- ❌ No stats (0 views, 0 likes, 0 comments)
- ❌ No caption/title (showing as `(No caption)`)
- ❌ No profile picture
- ❌ No follower count

These "ghost" entries clutter the UI and provide no value.

---

## Solution
**Automatic cleanup system** that identifies and deletes invalid videos/accounts after every sync.

---

## How It Works

### 1. **CleanupService** (`api/services/CleanupService.ts`)

#### Invalid Video Criteria:
A video is considered invalid if **ALL** of the following are true:
- ✅ Older than 1 hour (grace period for initial sync)
- ✅ No username OR username = `'unknown'` OR username = `'@unknown'`
- ✅ No stats (views = 0 AND likes = 0 AND comments = 0)
- ✅ No caption/title OR caption = `'(No caption)'`

#### Invalid Account Criteria:
An account is considered invalid if **ALL** of the following are true:
- ✅ Older than 1 hour (grace period for initial sync)
- ✅ No username OR username = `'unknown'` OR username = `'@unknown'`
- ✅ No profile picture (empty string)
- ✅ No follower count (0 followers)

#### What Gets Deleted:
```
Video:
  └── Video document
  └── Snapshots subcollection
      ├── Snapshot 1
      ├── Snapshot 2
      └── ...

Account:
  └── Account document
  └── Videos subcollection
      ├── Video 1
      ├── Video 2
      └── ...
```

---

## Automatic Triggers

### 1. **After Each Account Sync** (`api/sync-single-account.ts`)
```typescript
// At the end of sync
const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
console.log(`✅ Cleanup complete: ${cleanupStats.videosDeleted} videos, ${cleanupStats.accountsDeleted} accounts deleted`);
```

### 2. **After Each Video Processing** (`api/process-single-video.ts`)
```typescript
// At the end of processing
const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
console.log(`✅ Cleanup complete: ${cleanupStats.videosDeleted} videos, ${cleanupStats.accountsDeleted} accounts deleted`);
```

### 3. **Scheduled Cron Job** (Every 6 hours)
```json
{
  "path": "/api/cron-cleanup-invalid",
  "schedule": "0 */6 * * *"
}
```

Runs every 6 hours and cleans ALL organizations/projects.

### 4. **Manual API Endpoint**
```bash
POST /api/cleanup-invalid-data
{
  "orgId": "abc123",
  "projectId": "xyz789",
  "type": "all"  // or "videos" or "accounts"
}
```

---

## CleanupService API

### Methods

#### `isInvalidVideo(video: any): boolean`
Checks if a video should be deleted.

#### `isInvalidAccount(account: any): boolean`
Checks if an account should be deleted.

#### `cleanupInvalidVideos(orgId, projectId): Promise<CleanupStats>`
Deletes all invalid videos for a project.

#### `cleanupInvalidAccounts(orgId, projectId): Promise<CleanupStats>`
Deletes all invalid accounts for a project.

#### `runFullCleanup(orgId, projectId): Promise<CleanupStats>`
Deletes both invalid videos AND accounts.

### Return Value (`CleanupStats`)
```typescript
{
  videosDeleted: number;
  accountsDeleted: number;
  snapshotsDeleted: number;
  errors: string[];
}
```

---

## Batched Deletions

**Why?** Firestore has a limit of 500 operations per batch.

**How?**
```typescript
const batch = db.batch();
let batchCount = 0;

for (const doc of docs) {
  batch.delete(doc.ref);
  batchCount++;
  
  // Commit every 450 operations (buffer for safety)
  if (batchCount >= 450) {
    await batch.commit();
    batchCount = 0;
  }
}

// Commit remaining
if (batchCount > 0) {
  await batch.commit();
}
```

---

## Grace Period (1 Hour)

**Why?** 
- Videos/accounts need time to complete initial sync
- APIs may be slow
- Don't delete during active processing

**How?**
```typescript
const isOldEnough = video.dateAdded && 
  (Date.now() - video.dateAdded.toMillis()) > (60 * 60 * 1000); // 1 hour
```

Only delete if created **more than 1 hour ago**.

---

## Logging

### During Cleanup:
```
🧹 [CLEANUP] Starting video cleanup for org: abc123, project: xyz789
🔍 [CLEANUP] Found 150 videos to check
❌ [CLEANUP] Deleting invalid video: vid123 (username: none, views: 0)
❌ [CLEANUP] Deleting invalid video: vid456 (username: @unknown, views: 0)
✅ [CLEANUP] Committed batch of 50 deletions
✅ [CLEANUP] Video cleanup complete: 12 videos deleted, 36 snapshots deleted
```

### After Sync:
```
🧹 Running auto-cleanup for invalid videos/accounts...
✅ Cleanup complete: 12 videos, 3 accounts deleted
```

### Cron Job:
```
🧹 [CRON CLEANUP] Starting automated cleanup job...
🔍 [CRON CLEANUP] Processing organization: org123
🧹 [CRON CLEANUP] Cleaning project: proj456
✅ [CRON CLEANUP] Project proj456 cleaned: 5 videos, 2 accounts
✅ [CRON CLEANUP] Cleanup job complete:
   - Projects processed: 3
   - Videos deleted: 15
   - Accounts deleted: 5
   - Snapshots deleted: 45
   - Errors: 0
```

---

## Error Handling

### Non-Fatal Errors
Cleanup failures **DO NOT** stop the sync or video processing:

```typescript
try {
  const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
  console.log(`✅ Cleanup complete`);
} catch (cleanupError) {
  console.error('❌ Cleanup failed (non-fatal):', cleanupError);
  // Don't fail the request if cleanup fails
}
```

### Error Tracking
All errors are collected in `CleanupStats.errors[]` and logged:

```typescript
stats.errors.push(`Failed to delete snapshots for video ${videoDoc.id}`);
```

---

## Configuration Files

### `vercel.json`
```json
{
  "functions": {
    "api/cleanup-invalid-data.ts": {
      "maxDuration": 180
    },
    "api/cron-cleanup-invalid.ts": {
      "maxDuration": 180
    }
  },
  "crons": [
    {
      "path": "/api/cron-cleanup-invalid",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Schedule Explained:**
- `0 */6 * * *` = Every 6 hours at minute 0
- Runs at: 12am, 6am, 12pm, 6pm

---

## Testing

### 1. Manual API Test
```bash
curl -X POST https://your-domain.com/api/cleanup-invalid-data \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "your-org-id",
    "projectId": "your-project-id",
    "type": "all"
  }'
```

### 2. Sync Test
1. Add a TikTok/Instagram account
2. Wait for sync to complete
3. Check logs for cleanup output:
   ```
   🧹 Running auto-cleanup...
   ✅ Cleanup complete: X videos, Y accounts deleted
   ```

### 3. Cron Test
```bash
curl https://your-domain.com/api/cron-cleanup-invalid?secret=YOUR_CRON_SECRET
```

### 4. Check Dashboard
- Refresh videos page
- Invalid entries should be gone
- Only videos with data should remain

---

## Files Created/Modified

### Created:
1. ✅ `api/services/CleanupService.ts` - Core cleanup logic
2. ✅ `api/cleanup-invalid-data.ts` - Manual API endpoint
3. ✅ `api/cron-cleanup-invalid.ts` - Scheduled cron job

### Modified:
1. ✅ `api/sync-single-account.ts` - Added cleanup after sync
2. ✅ `api/process-single-video.ts` - Added cleanup after processing
3. ✅ `vercel.json` - Added cron schedule

---

## Benefits

✅ **Cleaner Dashboard** - No more ghost entries  
✅ **Better UX** - Only valid data displayed  
✅ **Automatic** - No manual intervention needed  
✅ **Safe** - 1 hour grace period prevents premature deletion  
✅ **Robust** - Batched deletions handle large datasets  
✅ **Non-Fatal** - Cleanup errors don't break syncs  
✅ **Comprehensive** - Deletes videos, accounts, and subcollections  
✅ **Scheduled** - Runs every 6 hours automatically  

---

## Result

**Before:**
```
Video	Preview	Trend	Views	Likes	Comments
U	TikTok	(No caption)	@unknown	0	0	0
U	Instagram	(No caption)	@unknown	0	0	0
U	Instagram	(No caption)	@unknown	0	0	0
```

**After:**
```
Video	Preview	Trend	Views	Likes	Comments
✓	TikTok	AI automation tips	@afro.coder	748K	48.9K	383
✓	Instagram	Product launch	@ernestosoftware	147	93	3
```

**Clean dashboard with only valid data!** 🎉
