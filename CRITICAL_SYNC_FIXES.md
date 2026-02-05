# Critical Sync Fixes Required

## Issue 1: Multiple Refresh Snapshots 📊

**Problem**: Creating a snapshot for EVERY progressive fetch attempt, not just once at the end.

**Current Flow**:
```
Fetch 5 videos → Check each → Create snapshot for each
Continue to 10 → Check each → Create ANOTHER snapshot for same videos
Continue to 15 → Check each → Create ANOTHER snapshot for same videos
```

**Result**: One video gets 3-4 snapshots from the same sync! This inflates metrics and wastes storage.

**Solution**: 
- Track which videos were ACTUALLY updated
- Create snapshot ONLY for videos that were refreshed
- Do this ONCE at the end, not during progressive fetch

## Issue 2: Progressive Fetch Not Stopping Immediately

**Problem**: When a duplicate is found in a batch, the code should:
1. Stop fetching MORE batches ✅ (this works)
2. But it should NOT process the duplicate or anything after it ❌ (this is broken)

**Current Logic**:
```typescript
for (const batchSize of [5, 10, 15, 20]) {
  fetch batch
  for each video in batch {
    if (exists) {
      foundDuplicate = true
      break  // Only breaks inner loop
    }
    newVideos.push(video)  // Adds videos BEFORE checking
  }
  if (foundDuplicate) break  // Breaks outer loop
}
```

**Problem**: All videos in the batch are added BEFORE checking. If video #3 is a duplicate, videos #1 and #2 are already added (correct), but video #3 and #4-5 are also added (WRONG).

**Solution**:
- Check if video exists BEFORE adding to newVideos
- If exists, break IMMEDIATELY without adding it
- Don't process anything after the duplicate

## Issue 3: TikTok Not Refreshing Existing Videos

**Problem**: Instagram does TWO API calls:
1. Progressive fetch for NEW videos
2. Bulk refresh ALL existing videos with post_urls

TikTok only does #1, missing the bulk refresh.

**Instagram Code** (lines 981-1045):
```typescript
// SECOND API CALL: Refresh metrics for ALL existing reels
const postUrls = existingVideos.map(v => `https://instagram.com/p/${v.videoId}/`);
const refreshData = await runApifyActor({
  actorId: 'hpix~ig-reels-scraper',
  input: { post_urls: postUrls }
});
// Adds refreshed data to processing
```

**TikTok**: Missing this entirely!

**Solution**: Add same bulk refresh logic to TikTok (and YouTube, Twitter if they support it)

---

## Fixes Required

### Fix 1: Remove Snapshot Creation from Progressive Fetch Loop

Move snapshot creation to AFTER all videos are processed, create ONE snapshot per video.

### Fix 2: Fix Progressive Fetch to Stop Immediately

```typescript
for (const video of batch) {
  const videoId = video.id;
  
  // CHECK FIRST
  if (existingVideoIds.has(videoId)) {
    console.log(`Found duplicate ${videoId} - STOPPING`);
    foundDuplicate = true;
    break;  // Don't add this or any more videos
  }
  
  // ONLY add if not duplicate
  newVideos.push(video);
}
```

### Fix 3: Add Bulk Refresh to TikTok

```typescript
// After progressive fetch for new videos
if (existingVideoIds.size > 0) {
  console.log(`🔄 Refreshing ${existingVideoIds.size} existing TikTok videos...`);
  
  // Build video URLs
  const videoUrls = Array.from(existingVideoIds).map(id => 
    `https://www.tiktok.com/@${username}/video/${id}`
  );
  
  // Bulk refresh using video URLs
  const refreshData = await runApifyActor({
    actorId: 'apidojo/tiktok-scraper-api',
    input: {
      startUrls: videoUrls,
      maxItems: videoUrls.length
    }
  });
  
  // Add to processing
  newTikTokVideos.push(...refreshData.items);
}
```

---

**Priority**: CRITICAL - Affects billing metrics and API costs
**Impact**: High - Creating 3-4x more snapshots than needed
**Status**: Ready to implement

