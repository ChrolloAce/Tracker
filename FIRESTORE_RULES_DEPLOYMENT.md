# Firestore Rules Deployment Guide

## Problem Identified ✅

Your project deletion was failing with this error:
```
❌ Failed to delete project: FirebaseError: Missing or insufficient permissions
```

**Root Cause**: The `payoutStructures` subcollection didn't have any security rules defined in `firestore.rules`. When Firestore doesn't find a rule for a path, it denies access by default.

## What Was Fixed ✅

Added security rules for the `payoutStructures` subcollection:

```javascript
// ==================== PROJECT PAYOUT STRUCTURES ====================

match /payoutStructures/{structureId} {
  // All org members can read payout structures
  allow read: if canReadOrg(orgId);
  
  // Only admins can create/update/delete payout structures
  allow write: if canManageOrg(orgId);
}
```

This allows:
- ✅ **Read access**: All organization members
- ✅ **Write/Delete access**: Organization admins and owners only

## Deploy the Updated Rules

### Option 1: Quick Deploy (Recommended)

I've created a deployment script for you. Just run:

```bash
cd /Users/ernestolopez/Desktop/Scrpa
./deploy-firestore-rules.sh
```

The script will:
1. Check if Firebase CLI is installed
2. Login to Firebase (if needed)
3. Show your projects
4. Ask for confirmation
5. Deploy the rules
6. Show success message

### Option 2: Manual Deploy

If you prefer to deploy manually:

```bash
# 1. Login to Firebase (opens browser)
firebase login

# 2. Check which project you're deploying to
firebase projects:list

# 3. Deploy only Firestore rules
firebase deploy --only firestore:rules

# 4. Confirm deployment
# Rules will be live immediately
```

### Option 3: Firebase Console

You can also deploy via the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Rules**
4. Copy the contents of `firestore.rules` from your repo
5. Paste into the console editor
6. Click **Publish**

## After Deployment

Once the rules are deployed:

1. **Test Project Deletion**:
   ```
   - Go to your dashboard
   - Click the pencil icon next to a test project
   - Scroll to "Danger Zone"
   - Try deleting the project
   ```

2. **Verify Success**:
   - You should see: `✅ Successfully deleted project {id} and all its data`
   - No more "Missing or insufficient permissions" errors

3. **Check Console Logs**:
   ```
   🗑️ Starting deletion of project abc123
   🗑️ Deleting 9 subcollections...
   ✓ trackedAccounts: empty, skipping
   ✓ videos: empty, skipping
   ✓ links: empty, skipping
   ✓ campaigns: empty, skipping
   ✓ trackingRules: empty, skipping
   ✓ payoutStructures: empty, skipping  ← Should work now!
   ✓ creators: empty, skipping
   ✓ payouts: empty, skipping
   ✓ stats: empty, skipping
   ✅ Successfully deleted project
   ```

## Troubleshooting

### "Firebase CLI not found"

Install it globally:
```bash
npm install -g firebase-tools
```

### "Authentication Error"

Your Firebase session expired. Re-login:
```bash
firebase login --reauth
```

Then try deploying again:
```bash
firebase deploy --only firestore:rules
```

### "Wrong project selected"

Check current project:
```bash
firebase use
```

Switch to correct project:
```bash
firebase use <project-id>
```

Then deploy:
```bash
firebase deploy --only firestore:rules
```

### "Rules still failing after deployment"

1. **Wait 30 seconds**: Rule updates can take a moment to propagate
2. **Hard refresh**: Clear browser cache (Cmd/Ctrl + Shift + R)
3. **Check console**: Verify which project ID is being used
4. **Verify deployment**: Check Firebase Console to confirm rules are live

## Security Notes

### What the Rules Protect

The `payoutStructures` rules ensure:

✅ **Read Access**: 
- All organization members can view payout structures
- Helpful for transparency

✅ **Write Access**:
- Only admins/owners can create, edit, or delete
- Prevents unauthorized modifications

✅ **Demo Mode**:
- Demo org is read-only (defined in `isDemoOrg()`)
- Public can view but not modify

### Permission Levels

```
Owner   → Full access (read, write, delete everything)
Admin   → Full access (read, write, delete everything)
Member  → Read payout structures, but cannot modify
Creator → Read access only (via canReadOrg)
Public  → Read access to demo org only
```

## Files Modified

1. **`firestore.rules`**: 
   - Added `payoutStructures` security rules
   - Lines 469-477

2. **`deploy-firestore-rules.sh`**: 
   - New deployment helper script
   - Makes deploying rules easier

## Related Collections

All project subcollections now have proper delete rules:

| Subcollection | Delete Permission | Status |
|---------------|-------------------|--------|
| trackedAccounts | `canManageOrg(orgId)` | ✅ Working |
| videos | `canManageOrg(orgId)` | ✅ Working |
| links | `canManageOrg(orgId)` | ✅ Working |
| campaigns | `canManageOrg(orgId)` | ✅ Working |
| trackingRules | `canManageOrg(orgId)` | ✅ Working |
| **payoutStructures** | `canManageOrg(orgId)` | ✅ **Fixed!** |
| creators | `canManageOrg(orgId)` | ✅ Working |
| payouts | `canManageOrg(orgId)` | ✅ Working |
| stats | `canManageOrg(orgId)` | ✅ Working |

## Quick Reference

### Check Firebase Status
```bash
firebase login:list         # Show logged in accounts
firebase projects:list      # Show all projects
firebase use                # Show current project
```

### Deploy Rules Only
```bash
firebase deploy --only firestore:rules
```

### Deploy Everything
```bash
firebase deploy
```

### Test Rules Locally (Optional)
```bash
firebase emulators:start --only firestore
```

## Next Steps

1. **Deploy the rules** using one of the methods above
2. **Test project deletion** to confirm it works
3. **Monitor logs** for any other permission errors

If you encounter any other permission errors, check that all subcollections have appropriate rules defined in `firestore.rules`.

## Support

If you need help deploying:
- Firebase CLI docs: https://firebase.google.com/docs/cli
- Firestore rules docs: https://firebase.google.com/docs/firestore/security/get-started
- Security rules reference: https://firebase.google.com/docs/rules

---

**Summary**: The `payoutStructures` subcollection was missing security rules. I've added them to `firestore.rules`. Deploy these rules to Firebase using the script or manual commands above, and your project deletion will work! 🚀

