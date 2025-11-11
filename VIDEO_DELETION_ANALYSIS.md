# Video Deletion Analysis

## Current State: Partial Deletion ⚠️

When you delete a video, here's what **IS** deleted:

✅ **Video document** - Main video data  
✅ **All snapshots** - Historical metrics (subcollection)  
✅ **Firebase Storage thumbnail** - Image file  
✅ **Project video count** - Decremented  
✅ **Organization usage counter** - Decremented  

## What's **NOT** Being Deleted ❌

### 1. Revenue Attributions
**Location**: `organizations/{orgId}/projects/{projectId}/revenueAttributions`

Revenue attributions can reference deleted videos via `videoId` field:
```typescript
interface RevenueAttribution {
  videoId?: string;  // ← References video that might be deleted!
  totalRevenue: number;
  transactionCount: number;
  // ... other fields
}
```

**Impact**: 
- Orphaned revenue data pointing to non-existent videos
- Could cause errors when loading revenue reports
- Inflated revenue metrics for deleted content

### 2. Campaign Video Submissions
**Location**: `organizations/{orgId}/projects/{projectId}/campaigns/{campaignId}/videoSubmissions`

Campaign submissions reference videos via `videoUrl`:
```typescript
interface CampaignVideoSubmission {
  videoUrl: string;  // ← URL might match deleted video!
  campaignId: string;
  status: 'pending' | 'approved' | 'rejected';
  views: number;
  likes: number;
  totalEarnings: number;
  // ... other fields
}
```

**Impact**:
- Campaign submissions remain even after video is deleted
- Dead links in campaign management UI
- Earnings/stats calculations include deleted videos

## Current Deletion Logic

**File**: `src/services/FirestoreDataService.ts`

```typescript
static async deleteVideo(orgId: string, projectId: string, videoId: string) {
  // ✅ Step 1: Delete snapshots
  const snapshotsRef = collection(db, '...', 'videos', videoId, 'snapshots');
  // Delete all snapshot docs
  
  // ✅ Step 2: Delete thumbnail from Storage
  await FirebaseStorageService.deleteVideoThumbnail(orgId, videoId);
  
  // ✅ Step 3: Delete video document
  batch.delete(videoRef);
  
  // ✅ Step 4: Update counters
  batch.update(projectRef, { videoCount: increment(-1) });
  
  // ❌ Missing: Delete revenue attributions
  // ❌ Missing: Delete/update campaign submissions
}
```

## Recommended Fixes

### Option 1: Complete Deletion (Recommended)

Delete **everything** associated with a video:

```typescript
static async deleteVideo(orgId: string, projectId: string, videoId: string) {
  // Existing deletions...
  await this.deleteSnapshots(orgId, projectId, videoId);
  await this.deleteThumbnail(orgId, videoId);
  await this.deleteVideoDoc(orgId, projectId, videoId);
  
  // NEW: Delete revenue attributions
  await this.deleteVideoRevenueAttributions(orgId, projectId, videoId);
  
  // NEW: Update/delete campaign submissions
  await this.cleanupCampaignSubmissions(orgId, projectId, videoId);
}

// New helper method
private static async deleteVideoRevenueAttributions(
  orgId: string, 
  projectId: string, 
  videoId: string
): Promise<void> {
  const attributionsRef = collection(
    db, 
    'organizations', orgId, 
    'projects', projectId, 
    'revenueAttributions'
  );
  
  const q = query(attributionsRef, where('videoId', '==', videoId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  console.log(`✅ Deleted ${snapshot.size} revenue attributions for video ${videoId}`);
}

// New helper method
private static async cleanupCampaignSubmissions(
  orgId: string,
  projectId: string,
  videoId: string
): Promise<void> {
  // Get video URL to match against submissions
  const videoRef = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', videoId);
  const videoSnap = await getDoc(videoRef);
  
  if (!videoSnap.exists()) return;
  
  const videoUrl = videoSnap.data()?.videoUrl || videoSnap.data()?.url;
  if (!videoUrl) return;
  
  // Find all campaigns
  const campaignsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'campaigns');
  const campaignsSnapshot = await getDocs(campaignsRef);
  
  let deletedCount = 0;
  
  for (const campaignDoc of campaignsSnapshot.docs) {
    const submissionsRef = collection(campaignDoc.ref, 'videoSubmissions');
    const q = query(submissionsRef, where('videoUrl', '==', videoUrl));
    const submissions = await getDocs(q);
    
    if (!submissions.empty) {
      const batch = writeBatch(db);
      submissions.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deletedCount += submissions.size;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`✅ Deleted ${deletedCount} campaign submissions for video ${videoId}`);
  }
}
```

### Option 2: Soft Delete (Alternative)

Instead of hard deleting, mark as deleted:

```typescript
// Update video status instead of deleting
batch.update(videoRef, {
  status: 'deleted',
  deletedAt: Timestamp.now(),
  deletedBy: userId
});

// Keep data but hide it from queries
// Can be restored if needed
```

**Pros**: 
- Can restore videos if deleted by mistake
- Maintains referential integrity
- Historical data preserved for audits

**Cons**:
- Data still counts toward storage
- More complex queries (filter out deleted items)
- Could confuse users if not clearly marked

## Impact Analysis

### Scenario 1: Delete video with revenue data
```
Before deletion:
- Video: 1M views, $500 revenue
- Revenue attribution exists: $500 linked to this video
- Organization total revenue: $5000

After deletion (current):
- Video: DELETED ✓
- Revenue attribution: STILL EXISTS ❌
- Organization total revenue: STILL $5000 (includes deleted video's $500)

After deletion (with fix):
- Video: DELETED ✓
- Revenue attribution: DELETED ✓
- Organization total revenue: $4500 (corrected)
```

### Scenario 2: Delete video in active campaign
```
Before deletion:
- Video submitted to "Summer Campaign"
- Submission status: "approved"
- Total campaign earnings: $1000 (includes this video)

After deletion (current):
- Video: DELETED ✓
- Campaign submission: STILL EXISTS ❌
- Campaign shows dead video link
- Campaign earnings: STILL $1000 (inflated)

After deletion (with fix):
- Video: DELETED ✓
- Campaign submission: DELETED ✓
- Campaign earnings: Recalculated (accurate)
```

## Testing Checklist

After implementing the fix:

- [ ] Delete a video without revenue/campaigns → Should work as before
- [ ] Delete a video with revenue attribution → Attribution should be deleted
- [ ] Delete a video in a campaign → Submission should be deleted
- [ ] Check revenue reports → Deleted video revenue shouldn't appear
- [ ] Check campaign stats → Deleted video shouldn't count
- [ ] Check Firestore console → No orphaned documents
- [ ] Check Storage → No orphaned thumbnails
- [ ] Verify counters → Video counts accurate

## Priority: HIGH ⚠️

**Why this matters**:
1. **Data integrity**: Orphaned references cause errors
2. **Accurate reporting**: Revenue/campaign stats become incorrect
3. **User experience**: Dead links and broken UI
4. **Storage costs**: Keeping unnecessary data
5. **Compliance**: GDPR/data retention policies

## Recommendation

**Implement Option 1: Complete Deletion**

Reasons:
- Clean data architecture
- Prevents orphaned references
- Accurate metrics and reports
- Better user experience
- Simpler to maintain

**When to use soft delete**:
- Legal requirement to keep audit trails
- User specifically requests "restore" feature
- Compliance needs historical records

## Related Issues

The same problem might exist for:
- Account deletion (check for orphaned videos)
- Project deletion (check for orphaned everything)
- Campaign deletion (check for orphaned submissions)

---

**Action Required**: Update `FirestoreDataService.deleteVideo()` to include:
1. Revenue attribution deletion
2. Campaign submission cleanup
3. Any other video references

This ensures **complete deletion** with no lingering data.

