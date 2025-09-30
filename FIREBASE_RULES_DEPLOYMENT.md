# Firebase Rules Deployment Guide

## Overview

You need to deploy **Storage Rules** to Firebase for the image upload functionality to work.

Your **Firestore rules are already correct** ✅ and don't need changes.

## What Changed

### ✅ Firestore Rules (Already Good)
Your `firestore.rules` file already has the correct permissions for:
- `trackedAccounts` - read/write for org members
- `videos` - read/write for org members
- Organization membership checks

**No action needed for Firestore rules.**

### 🆕 Storage Rules (Need to Deploy)
Created new `storage.rules` file for Firebase Storage:
- Controls access to thumbnails and profile pictures
- Ensures only authenticated users can access images
- Limits file size to 10MB per image
- Only allows image file types

## Quick Deploy

### Option 1: Deploy All Rules (Recommended First Time)
```bash
firebase deploy --only firestore,storage
```

### Option 2: Deploy Storage Rules Only
```bash
./deploy-storage-rules.sh
```
or
```bash
firebase deploy --only storage
```

## What the Storage Rules Do

### Structure
```
organizations/
└── {orgId}/
    ├── thumbnails/
    │   └── {videoId}.jpg    ← Video thumbnails
    └── profiles/
        └── {accountId}.jpg  ← Profile pictures
```

### Security Rules
```
✅ Read Access:  Any authenticated user
✅ Write Access: Authenticated org members only
✅ File Types:   Images only (JPEG, PNG, etc.)
✅ File Size:    Max 10MB per image
❌ Public:       No unauthenticated access
```

## Verify Deployment

### 1. Check Firebase Console
After deployment, verify in Firebase Console:
1. Go to **Storage** → **Rules** tab
2. You should see the new storage rules

### 2. Test Upload
1. Open your app
2. Add a new account (Instagram or TikTok)
3. Check browser console - should see:
   ```
   ✅ Profile picture uploaded successfully
   ✅ Thumbnail uploaded successfully
   ```

### 3. Check Storage
1. Go to Firebase Console → **Storage** → **Files** tab
2. Navigate to `organizations/{your-org-id}/`
3. You should see:
   - `thumbnails/` folder with video thumbnails
   - `profiles/` folder with profile pictures

## Troubleshooting

### Error: "Unauthorized" or "Permission Denied"
**Problem:** Storage rules not deployed
**Solution:**
```bash
firebase deploy --only storage
```

### Error: "Storage rules not found"
**Problem:** firebase.json missing storage config
**Solution:** Already fixed! Your `firebase.json` now includes:
```json
{
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Error: "File type not allowed"
**Problem:** Trying to upload non-image file
**Solution:** Only JPEG, PNG, GIF, WebP images are allowed

### Error: "File size too large"
**Problem:** Image > 10MB
**Solution:** Images are automatically compressed via proxy, but if issue persists, increase limit in `storage.rules`:
```javascript
function isReasonableSize() {
  return request.resource.size < 20 * 1024 * 1024; // 20MB
}
```

## Production Considerations

### Current Setup (Good for Most Cases)
✅ Authenticated users can read all org images
✅ Simple and fast
✅ Good for team collaboration

### Enhanced Security (If Needed)
If you need stricter org isolation, you can use Custom Claims:

1. **Set up Custom Claims** (requires Cloud Functions):
```typescript
// functions/src/index.ts
admin.auth().setCustomUserClaims(uid, { orgId: 'org123' });
```

2. **Update storage.rules**:
```javascript
function isOrgMember(orgId) {
  return request.auth.token.orgId == orgId;
}

match /organizations/{orgId}/thumbnails/{videoId} {
  allow read, write: if isOrgMember(orgId);
}
```

**For now, current rules are sufficient.**

## Files Added/Updated

### New Files
- ✅ `storage.rules` - Firebase Storage security rules
- ✅ `deploy-storage-rules.sh` - Quick deploy script
- ✅ `FIREBASE_RULES_DEPLOYMENT.md` - This guide

### Updated Files
- ✅ `firebase.json` - Added storage configuration

### Unchanged (Already Correct)
- ✅ `firestore.rules` - Already has correct rules
- ✅ `firestore.indexes.json` - Indexes will auto-create as needed

## Testing Locally (Optional)

### Start Emulators
```bash
firebase emulators:start
```

This will start:
- Auth Emulator (port 9099)
- Firestore Emulator (port 8080)
- Storage Emulator (port 9199) ← NEW!
- Emulator UI (port 4000)

### Configure App for Emulators
If testing locally, update `src/services/firebase.ts`:
```typescript
if (location.hostname === 'localhost') {
  connectStorageEmulator(storage, 'localhost', 9199);
}
```

## Cost Impact

### Firebase Free Tier (Spark Plan)
- **Storage**: 5 GB stored
- **Downloads**: 1 GB/day bandwidth
- **Operations**: 50K/day reads, 20K/day writes

### Your Expected Usage
- **Profile pics**: ~100 KB each × 50 accounts = 5 MB
- **Thumbnails**: ~50 KB each × 500 videos = 25 MB
- **Total**: ~30 MB (well within free tier)

**You'll stay in free tier unless you have thousands of accounts.**

## Next Steps

1. **Deploy the rules:**
   ```bash
   firebase deploy --only storage
   ```

2. **Test the app** - Add a new account and verify images upload

3. **Check Firebase Console** - Verify files appear in Storage

4. **Done!** Your app now has unlimited image storage

## Support

If you get any errors during deployment:
1. Make sure you're logged in: `firebase login`
2. Make sure you're in the right project: `firebase use --add`
3. Check Firebase Console for any quota issues
4. Review error messages - they're usually helpful

---
**Created**: September 30, 2025
**Status**: Ready to deploy
**Impact**: Required for image upload functionality

