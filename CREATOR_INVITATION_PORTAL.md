# Creator Invitation Portal

## Overview

The Creator Invitation Portal provides a seamless onboarding experience for creators. When a creator receives an invitation email and clicks the "Join" link, they're taken directly to a custom portal that handles authentication and organization joining in one smooth flow.

## How It Works

### 1. Invitation Creation

When you invite a creator through the app:

1. An invitation document is created in `/organizations/{orgId}/invitations/{invitationId}`
2. A lookup document is created in `/invitationsLookup/{invitationId}` (for quick access)
3. An invitation email is sent with a link to: `https://viewtrack.app/invitations/{invitationId}`

### 2. Creator Experience

When a creator clicks the invitation link:

1. **Landing**: They see a beautiful invitation page with:
   - Organization name
   - Inviter's name
   - Pre-filled email address (from invitation)
   - Sign up or sign in options
   - Google authentication option

2. **Authentication**:
   - If new user: Creates account with pre-filled email
   - If existing user: Signs in with their credentials
   - Email must match the invitation email

3. **Auto-Acceptance**:
   - After successful authentication, the invitation is automatically accepted
   - Creator profile is created in the project
   - User is added as an organization member with 'creator' role
   - Organization is set as their default org

4. **Redirect**:
   - After 2 seconds, they're automatically redirected to the dashboard
   - **No onboarding screens** - they go straight to work!

### 3. Technical Details

#### Routes
- `/invitations/:invitationId` - Public route (no authentication required initially)

#### Components
- `CreatorInvitationPage.tsx` - Main invitation portal component

#### Services
- `TeamInvitationService.createInvitation()` - Creates invitation + lookup document
- `TeamInvitationService.acceptInvitation()` - Handles invitation acceptance

#### Firestore Collections
- `/organizations/{orgId}/invitations/{invitationId}` - Invitation documents
- `/invitationsLookup/{invitationId}` - Public lookup for invitations
  - Schema: `{ invitationId, orgId, email, createdAt }`

#### Security Rules
- `invitationsLookup` collection has public read access
- `invitations` collection requires authentication or email match
- Auto-creates lookup document when invitation is created

## Features

### ✅ Seamless Onboarding
- No complex onboarding steps
- Direct access to dashboard after authentication
- Pre-filled email prevents typos

### ✅ Multiple Auth Options
- Email/password sign up
- Email/password sign in
- Google authentication
- Toggle between sign up and sign in modes

### ✅ Security
- Email must match invitation email
- Invitation expiration (7 days)
- Status validation (pending/accepted/declined/expired)
- Prevents duplicate acceptances

### ✅ Beautiful UI
- Gradient background matching email design
- Clear invitation details
- Error handling with helpful messages
- Loading and success states
- Mobile responsive

### ✅ Error Handling
- Expired invitations
- Invalid invitation IDs
- Email mismatch detection
- Already accepted invitations
- Network errors

## Email Template

The invitation email includes:
- Personalized greeting
- Inviter's name
- Organization name
- Project name
- Direct "Join Now" button linking to the portal
- Alternative sign-in link

## Future Enhancements

Potential improvements:
1. Add invitation preview before authentication
2. Support for bulk creator invitations
3. Invitation analytics (opened, accepted, etc.)
4. Custom welcome message from inviter
5. Project preview/details before accepting
6. Invitation reminder emails

## Testing

### Local Testing
1. Start app: `npm run dev`
2. Create a creator invitation from the dashboard
3. Copy the invitation link from the console logs
4. Open link in incognito window
5. Sign up or sign in with the invited email
6. Verify auto-acceptance and redirect to dashboard

### Production Testing
1. Create invitation from production dashboard
2. Check email for invitation (if email delivery is working)
3. Click "Join Now" button
4. Complete authentication flow
5. Verify you're redirected to dashboard with correct org/project

## Troubleshooting

### "Invitation not found"
- Check if invitation ID is correct
- Verify invitation hasn't been deleted
- Check if invitation has expired (>7 days old)

### "Email mismatch"
- Ensure you're signing in with the exact email that received the invitation
- Email comparison is case-insensitive

### "Already accepted"
- This invitation has already been used
- User should sign in normally at `/login`

### Stuck on loading
- Check browser console for errors
- Verify Firestore rules are deployed
- Check network connectivity

## Migration Notes

### From Old System
The old invitation system used query parameters (`/login?invite={id}&org={orgId}`). The new system:
- Uses cleaner URLs: `/invitations/{invitationId}`
- Has a dedicated UI (not embedded in login page)
- Provides better UX with clear context
- Supports the invitation lookup system

### Backward Compatibility
- Old invitation links still work via LoginPage
- New invitations use the new portal automatically
- Both systems coexist without conflicts

## Database Structure

```
/invitationsLookup/{invitationId}
  - invitationId: string
  - orgId: string
  - email: string
  - createdAt: Timestamp

/organizations/{orgId}/invitations/{invitationId}
  - id: string
  - orgId: string
  - email: string
  - role: 'creator'
  - status: 'pending' | 'accepted' | 'declined' | 'expired'
  - invitedBy: string
  - invitedByName: string
  - invitedByEmail: string
  - organizationName: string
  - projectId: string (for creators)
  - createdAt: Timestamp
  - expiresAt: Timestamp
  - acceptedAt?: Timestamp
```

## Summary

The Creator Invitation Portal provides a professional, seamless onboarding experience for creators. It eliminates friction by combining invitation validation, authentication, and organization joining into a single, beautiful flow that takes creators directly to their dashboard without any additional steps.

