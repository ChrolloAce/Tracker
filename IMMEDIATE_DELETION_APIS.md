# Immediate Deletion APIs 🗑️

All deletion operations now happen **immediately** when triggered - no cron jobs required!

## Overview

Previously, deletions were queued in a `pendingDeletions` collection and processed by a cron job. This caused:
- Delayed deletions (had to wait for cron)
- Complex state management
- Inconsistent UI (items still visible until cron ran)

Now all deletions happen **instantly via serverless functions** with authenticated API calls.

---

## Available APIs

### 1. Delete Video
**Endpoint**: `/api/delete-video`  
**Method**: POST  
**Auth**: Firebase ID Token (Bearer)

**Request Body**:
```json
{
  "orgId": "string",
  "projectId": "string",
  "videoId": "string",
  "platformVideoId": "string",
  "platform": "string",
  "trackedAccountId": "string"
}
```

**What it deletes**:
- ✅ All snapshots for the video
- ✅ Thumbnail from Storage
- ✅ Video document
- ✅ Adds to `deletedVideos` blacklist (prevents re-sync)
- ✅ Updates account and project usage counters

**Response**:
```json
{
  "success": true,
  "message": "Video XYZ deleted successfully",
  "snapshotsDeleted": 5,
  "duration": 0.90
}
```

---

### 2. Delete Account
**Endpoint**: `/api/delete-account`  
**Method**: POST  
**Auth**: Firebase ID Token (Bearer)

**Request Body**:
```json
{
  "orgId": "string",
  "projectId": "string",
  "accountId": "string",
  "username": "string",
  "platform": "string"
}
```

**What it deletes**:
- ✅ All videos for the account
- ✅ All snapshots for those videos
- ✅ All thumbnails from Storage
- ✅ Profile picture from Storage
- ✅ Account document
- ✅ Updates project and org usage counters

**Response**:
```json
{
  "success": true,
  "message": "Account @username deleted successfully",
  "accountId": "abc123",
  "videosDeleted": 42,
  "snapshotsDeleted": 210,
  "thumbnailsDeleted": 42,
  "duration": 3.45
}
```

**Processing**:
- Videos deleted in batches of 500
- Fully async - happens in background
- UI updates instantly, actual deletion completes within seconds

---

### 3. Delete Project
**Endpoint**: `/api/delete-project`  
**Method**: POST  
**Auth**: Firebase ID Token (Bearer)

**Request Body**:
```json
{
  "orgId": "string",
  "projectId": "string"
}
```

**What it deletes**:
- ✅ All tracked accounts
- ✅ All videos and snapshots
- ✅ All links and link clicks
- ✅ All campaigns, resources, submissions
- ✅ All creator profiles and payouts
- ✅ All tracking rules
- ✅ All thumbnails and assets from Storage
- ✅ Project document
- ✅ Updates organization counters

**Response**:
```json
{
  "success": true,
  "message": "Project 'My Project' deleted successfully",
  "projectId": "xyz789",
  "deleted": {
    "accounts": 5,
    "videos": 150,
    "snapshots": 750,
    "thumbnails": 150,
    "links": 10,
    "linkClicks": 543,
    "campaigns": 2,
    "creators": 3,
    "rules": 8
  },
  "duration": 12.34
}
```

**Processing**:
- Comprehensive cascade deletion
- All data cleaned up including Storage
- Typical duration: 5-15 seconds depending on data size

---

### 4. Delete Organization
**Endpoint**: `/api/delete-organization`  
**Method**: POST  
**Auth**: Verified via Firebase (owner check)

**Request Body**:
```json
{
  "organizationId": "string",
  "userId": "string"
}
```

**What it deletes**:
- ✅ All projects (cascades to accounts, videos, etc.)
- ✅ All team members
- ✅ All invitations
- ✅ Organization document
- ✅ Removes from all user documents
- ✅ Clears defaultOrgId if applicable

**Response**:
```json
{
  "success": true,
  "message": "Organization deleted successfully",
  "organizationId": "org123",
  "organizationName": "My Org",
  "deleted": {
    "projects": 3,
    "accounts": 15,
    "videos": 500,
    "snapshots": 2500,
    "links": 30,
    "members": 5
  }
}
```

**Authorization**: Only the organization **owner** can delete it.

---

## Client-Side Usage

### Deleting a Video

```typescript
import { getAuth } from 'firebase/auth';

async function deleteVideo(orgId: string, projectId: string, videoId: string) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const token = await user.getIdToken();
  
  const response = await fetch('/api/delete-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      orgId,
      projectId,
      videoId,
      platformVideoId: video.videoId,
      platform: video.platform,
      trackedAccountId: video.trackedAccountId
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return await response.json();
}
```

### Deleting an Account

```typescript
import AccountTrackingServiceFirebase from '@/services/AccountTrackingServiceFirebase';

// Simple wrapper - handles auth internally
await AccountTrackingServiceFirebase.removeAccount(
  orgId,
  projectId,
  accountId,
  username,  // optional
  platform   // optional
);
```

---

## Error Handling

All APIs return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errorType": "FIREBASE_NOT_INITIALIZED | PROCESSING_ERROR | etc."
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad request (missing fields)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not owner)
- `404` - Resource not found
- `405` - Method not allowed
- `500` - Server error

---

## Benefits of Immediate Deletion

### Before (Cron-Based)
```
User clicks "Delete" 
    ↓
Add to pendingDeletions 
    ↓
Wait for cron (up to 12 hours) ⏰
    ↓
Cron processes deletion 
    ↓
Actually deleted
```
**Issues**: Slow, complex, items still visible

### After (Immediate API)
```
User clicks "Delete" 
    ↓
Call API immediately 
    ↓
Deleted in 1-10 seconds ⚡
    ↓
Done!
```
**Benefits**: Fast, simple, instant feedback

---

## Cascade Deletion Hierarchy

```
Organization
  ├─ Projects
  │   ├─ Tracked Accounts
  │   │   ├─ Videos
  │   │   │   └─ Snapshots
  │   │   └─ Profile Pictures (Storage)
  │   ├─ Links
  │   │   └─ Clicks
  │   ├─ Campaigns
  │   │   ├─ Resources
  │   │   └─ Submissions
  │   ├─ Creators
  │   │   └─ Payouts
  │   └─ Tracking Rules
  ├─ Team Members
  └─ Invitations
```

Deleting at any level cascades to all children automatically.

---

## Storage Cleanup

All APIs automatically clean up Firebase Storage:
- Video thumbnails: `thumbnails/{platform}_{videoId}_thumb.jpg`
- Profile pictures: `profile-pictures/{platform}_{username}.jpg`
- Campaign resources: handled by campaign deletion

**Graceful Handling**: If file doesn't exist, continues without error.

---

## Performance

| Operation | Typical Duration | Max Duration |
|-----------|------------------|--------------|
| Delete Video | 0.5-1s | 2s |
| Delete Account (50 videos) | 2-5s | 10s |
| Delete Project (5 accounts, 250 videos) | 8-15s | 30s |
| Delete Organization (3 projects) | 20-45s | 90s |

**Batching**: Large operations (500+ videos) are batched for optimal performance.

---

## Migration Notes

### Deprecated
- `api/cron-process-deletions.ts` - No longer needed
- `pendingDeletions` collection - No longer used for videos/accounts/projects
- `deleteAccountVideos` in FirestoreDataService - Replaced by API

### Updated Services
- ✅ `FirestoreDataService.deleteVideo()` - Now calls `/api/delete-video`
- ✅ `AccountTrackingServiceFirebase.removeAccount()` - Now calls `/api/delete-account`

### Still Using Direct Firestore
These still use client-side Firestore (lightweight operations):
- Creator link removal
- Campaign resource deletion (small files)
- Individual rule deletion

---

## Security

All APIs:
- ✅ Require Firebase authentication
- ✅ Verify user has access to org/project
- ✅ Validate all required fields
- ✅ Log all operations
- ✅ Handle errors gracefully

**Organization Deletion**: Extra protection - only **owner** can delete.

---

## Monitoring

All deletion operations log detailed information:

```
🗑️ [IMMEDIATE] Starting account deletion: abc123 (@username)
  📹 Found 42 videos to delete
    ✅ Batch 1 committed (42/42 videos)
  ✅ Deleted 42 videos, 210 snapshots, 42 thumbnails
  ✅ Deleted profile picture: instagram_username.jpg
  ✅ Deleted account document: abc123
  ✅ Updated project counters
  ✅ Updated organization usage counters
✅ Account deletion completed for abc123 in 3.45s
```

Check Vercel Function Logs for detailed deletion traces.

---

## Future Enhancements

Potential improvements:
- [ ] Soft delete (trash bin with 30-day retention)
- [ ] Batch delete multiple videos at once
- [ ] Progress indicators for large deletions
- [ ] Undo functionality (restore from blacklist)
- [ ] Email notifications for large deletions

---

**Summary**: All deletions now happen instantly via authenticated serverless functions. No cron jobs, no delays, just immediate, reliable deletion with full cascade cleanup! 🎉

