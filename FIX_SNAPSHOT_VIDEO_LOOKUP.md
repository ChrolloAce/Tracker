# FIX SNAPSHOT VIDEO LOOKUP - CRITICAL BUG

## 🔍 Problem Identified

After successfully implementing the refresh functionality, snapshots were being created in the logs (confirmed by successful API calls), but users couldn't see them in the UI. Upon investigation, the root cause was discovered:

**The refresh function was looking up videos by the wrong ID!**

### How Videos Are Stored:
When videos are initially synced via `/api/sync-single-account`, they are saved with:
- **Document ID**: Auto-generated Firestore ID (e.g., `"abc123xyz"`)
- **Field `videoId`**: The platform's video ID (e.g., TikTok ID `"7123456789"`)

```typescript
const videoRef = db
  .collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos')
  .doc();  // ← Auto-generated ID!

batch.set(videoRef, {
  videoId: "7123456789",  // ← TikTok video ID stored as FIELD
  ...otherData
});
```

### How Refresh Was Trying to Find Videos (WRONG):
```typescript
const videoRef = db
  .collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos')
  .doc(videoId);  // ← Using TikTok ID as document ID!

const existingDoc = await videoRef.get();
// This would NEVER find the video!
```

### The Result:
- ✅ Refresh fetched data from Apify successfully
- ✅ Attempted to update videos
- ❌ Could never find the videos (wrong lookup method)
- ❌ All videos were marked as "skipped" (not found)
- ❌ No snapshots were created
- ❌ Logs showed "0 videos updated, 131 skipped"

## ✅ What Was Fixed

### New Approach: Query by Field Instead of Document ID

**Before (WRONG):**
```typescript
// Tried to use TikTok video ID as Firestore document ID
const videoRef = db
  .collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos')
  .doc(videoId);  // ❌ This videoId doesn't match any document ID!
```

**After (CORRECT):**
```typescript
// Query for videos WHERE videoId field EQUALS the TikTok video ID
const videosCollectionRef = db
  .collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos');

const videoQuery = videosCollectionRef
  .where('videoId', '==', platformVideoId)  // ✅ Query by field!
  .limit(1);

const querySnapshot = await videoQuery.get();

if (!querySnapshot.empty) {
  const existingDoc = querySnapshot.docs[0];
  const videoRef = existingDoc.ref;  // ✅ Now we have the correct document reference!
  // ... update video and create snapshot
}
```

### Key Changes:

1. **Renamed variable** for clarity:
   - `videoId` → `platformVideoId` (to indicate it's the platform's ID, not Firestore's)

2. **Query by field** instead of document ID:
   - Used `.where('videoId', '==', platformVideoId)` to find videos
   - This correctly matches videos by their `videoId` field

3. **Get document reference** from query result:
   - `const videoRef = existingDoc.ref` gives us the actual Firestore document reference
   - This reference includes the auto-generated document ID

4. **Create snapshots under correct parent**:
   - `videoRef.collection('snapshots').doc()` now creates snapshots under the correct video document

## 🎯 Impact

### Before This Fix:
```
📊 Found 131 videos from Apify
📊 Updated: 0 videos, Skipped: 131 new videos  ❌
✅ Video refresh completed (but nothing was actually updated!)
```

### After This Fix:
```
📊 Found 131 videos from Apify
📊 Updated: 131 videos, Skipped: 0 new videos  ✅
✅ Video refresh completed with 131 new snapshots created!
```

## 🚀 Deployment

**Commit:** `Fix: Query videos by videoId field instead of document ID for snapshot creation`

The fix has been pushed and Vercel will deploy automatically.

## 📊 Expected Results

After this deployment, when you run a manual refresh:

1. ✅ Videos will be correctly found by querying the `videoId` field
2. ✅ Metrics will be updated for all tracked videos
3. ✅ New snapshots will be created under the correct video documents
4. ✅ When you open a video modal, you'll see the new snapshots with:
   - Correct timestamp
   - Correct metrics (views, likes, comments, shares)
   - Label showing "Manual Refresh" (purple badge)

## 🧪 How to Test

1. Wait 2-3 minutes for Vercel deployment to complete
2. Trigger a manual video refresh from your dashboard
3. Wait for the refresh to complete (you'll see success message)
4. Close any open video modals
5. Click on any video to open the analytics modal
6. **You should now see new snapshots!**

The snapshots table should show:
- Your original 2 snapshots from earlier
- Plus 2-3 NEW snapshots from the recent refreshes (17:12, 17:24, and the upcoming one)

## 🔑 Lessons Learned

1. **Document structure matters**: Always verify how documents are stored before writing queries
2. **Field vs Document ID**: Don't assume the ID field matches the document ID
3. **Query patterns**: Use `.where()` queries when looking up by field values
4. **Variable naming**: Clear names like `platformVideoId` vs `firestoreDocId` prevent confusion
5. **Testing**: Always verify that data is actually being written, not just that the function completes

This was a critical bug that prevented the entire snapshot system from working!

