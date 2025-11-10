# Debug Invitation Issue

## Problem
Invitation page shows "Permission denied" error when accessing invitation ID: `XL2pbvpCNjD99XhwbWQF`

## Steps to Debug

### 1. Check Firestore Console
Go to: https://console.firebase.google.com/project/trackview-6a3a5/firestore/databases/-default-/data/~2FinvitationsLookup~2FXL2pbvpCNjD99XhwbWQF

Check if the document exists with these fields:
- `email`: erntechdesign@gmail.com
- `organizationName`: Maktub (or your org name)
- `role`: creator
- `status`: pending
- `orgId`: (should have a value)
- `invitationId`: XL2pbvpCNjD99XhwbWQF

### 2. If Document Doesn't Exist
The invitation wasn't created properly. Check:
- Was there an error when creating the invitation?
- Check the main invitation collection: `/organizations/{orgId}/invitations/XL2pbvpCNjD99XhwbWQF`

### 3. Hard Refresh Browser
- Mac: Cmd + Shift + R
- Windows: Ctrl + Shift + R
- Or use Incognito mode

After refresh, you should see detailed console logs like:
```
═══════════════════════════════════════════════
🚀 [INVITATION PAGE] Component mounted
📋 Invitation ID: XL2pbvpCNjD99XhwbWQF
...
```

### 4. Try Creating a New Invitation
If the old one is broken:
1. Go to Team tab
2. Click "Invite Team Member"
3. Enter email: erntechdesign@gmail.com
4. Select role: Creator
5. Send invitation
6. Copy the NEW invitation link from the success message
7. Try that link instead

## Expected Flow
1. User clicks invitation link
2. Page loads invitation data from `invitationsLookup/{invitationId}` (PUBLIC ACCESS)
3. User clicks "Sign in with Google"
4. After Google auth, invitation is auto-accepted
5. User is redirected to dashboard

## Current Error
Getting "Permission denied" which means either:
- The lookup document doesn't exist
- There's a network/Firestore connection issue
- The invitation ID is wrong/malformed

