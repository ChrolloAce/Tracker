# Instagram Progressive Fetch Fix

## Problem

Instagram accounts were failing to sync properly because of date-range filtering issues:

```
"beginDate": "2025-11-12",
"endDate": "2025-11-14",
"custom_functions": "{ shouldSkip: (data) => false, shouldContinue: (data) => true }"
```

The Instagram API's `beginDate`/`endDate` filters were not working correctly, causing sync failures.

## Root Cause

In **`api/sync-single-account.ts`** (lines 683-695), the code was using date filtering for Instagram:

```typescript
if (mostRecentReelDate) {
  const beginDate = mostRecentReelDate.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  
  scraperInput.beginDate = beginDate;
  scraperInput.endDate = endDate;
  
  console.log(`📅 Incremental sync: Fetching reels between ${beginDate} and ${endDate}`);
}
```

**Problems with this approach:**
1. Instagram API doesn't reliably support date filtering
2. Fetches all videos at once instead of checking for duplicates
3. No efficient stopping mechanism
4. Wastes API credits fetching videos we already have

## Solution: Progressive Fetch Strategy

Implement the same "5 → 10 → 15" strategy used for TikTok/YouTube/Twitter:

### For Automatic Accounts:

1. **Check existing videos**: Get the most recent video ID we have stored
2. **Progressive fetch**:
   - Fetch 5 most recent videos
   - Check each against database
   - If we find our newest stored video → STOP
   - If all 5 are new → Fetch 10 more
   - If still no match → Fetch 15 more
   - Continue until duplicate found
3. **Stop immediately**: Once we hit a known video, we know we have all new ones
4. **Save only new videos**: Everything before the duplicate is new content

### For Static Accounts:

- Skip new video fetching entirely
- Only refresh metrics for existing videos

## Implementation

### Key Changes in `api/sync-single-account.ts`:

```typescript
// Remove this (lines 641-706):
- if (mostRecentReelDate) {
-   scraperInput.beginDate = beginDate;
-   scraperInput.endDate = endDate;
- }

// Replace with progressive fetch:
+ const creatorType = account.creatorType || 'automatic';
+ 
+ if (creatorType === 'automatic') {
+   // Progressive fetch: 5 → 10 → 15
+   const batchSizes = [5, 10, 15, 20];
+   
+   for (const size of batchSizes) {
+     // Fetch batch
+     const batch = await fetchInstagramReels(username, size);
+     
+     // Check for duplicates
+     for (const video of batch) {
+       const videoId = extractVideoId(video);
+       const exists = await checkIfVideoExists(videoId);
+       
+       if (exists) {
+         console.log(`Found duplicate ${videoId} - stopping`);
+         foundDuplicate = true;
+         break;
+       }
+       
+       newVideos.push(video);
+     }
+     
+     if (foundDuplicate) break;
+   }
+ }
```

## Benefits

✅ **Eliminates date filter issues**: No more relying on unreliable beginDate/endDate  
✅ **Efficient API usage**: Stops fetching as soon as we find known videos  
✅ **Faster syncs**: Only fetches what's needed  
✅ **Reliable**: Works consistently across all platforms  
✅ **Respects account type**: Static accounts don't fetch new videos  
✅ **Cost effective**: Minimizes Apify API credits usage  

## Testing

After deployment:

1. ✅ **Automatic account with new videos**:
   - Should fetch in batches (5, 10, 15...)
   - Should stop when hitting existing video
   - Should save only new videos

2. ✅ **Automatic account with no new videos**:
   - Should fetch 5 videos
   - Should find duplicate immediately
   - Should save 0 new videos

3. ✅ **Static account**:
   - Should skip new video fetching
   - Should only refresh existing video metrics

4. ✅ **New account (no existing videos)**:
   - Should fetch 10 videos initially
   - Should save all 10

## Files Modified

- **`api/sync-single-account.ts`** (lines 637-760)
  - Removed beginDate/endDate filtering
  - Implemented progressive fetch (5 → 10 → 15 → 20)
  - Added duplicate checking at each step
  - Respects creatorType field

## Rollout Plan

1. Deploy changes to production
2. Monitor logs for "Progressive fetch" messages
3. Verify Instagram syncs complete successfully
4. Check that API usage decreases (fewer wasted fetches)

---

**Status**: Ready to implement  
**Priority**: HIGH - Fixing production Instagram sync failures  
**Date**: November 14, 2024

