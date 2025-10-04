# Team Collaboration Feature Guide

## 🎉 Overview

Your ViewTrack application now has a complete team collaboration system! Team members can be invited to organizations, accept invitations, and collaborate with controlled access levels.

## ✨ What's New

### 1. **Team Management Page**
- View all team members in your organization
- See member roles (Owner, Admin, Member)
- Manage member permissions
- Remove team members
- View pending invitations

### 2. **Team Invitations System**
- Send email invitations to team members
- Assign roles (Admin or Member) when inviting
- Track pending, accepted, and declined invitations
- 7-day expiration on invitations
- Cancel pending invitations

### 3. **Pending Invitations Page**
- Users can view all organizations they've been invited to
- Accept or decline invitations
- See who invited them and their assigned role
- Expiration warnings for time-sensitive invites

### 4. **Organization Switcher**
- View all organizations you're a member of
- See your role in each organization
- Quickly switch between organizations
- Visual indicators for current organization

### 5. **Access Control System**
- **Owner**: Full control, can manage everything including team
- **Admin**: Can manage content and team members
- **Member**: Can view and manage content

## 🚀 How to Use

### Inviting Team Members

1. **Navigate to Team Management**
   - Click "Team" in the sidebar navigation
   - Click "Invite Member" button

2. **Send an Invitation**
   - Enter the team member's email address
   - Choose their role:
     - **Member**: Can view and manage content
     - **Admin**: Can manage content and team members
   - Click "Send Invitation"

3. **Manage Pending Invitations**
   - View all pending invitations in the Team Management page
   - Cancel invitations if needed
   - Resend expired invitations by creating a new one

### Accepting Invitations

1. **View Your Invitations**
   - Click "Invitations" in the sidebar navigation
   - See all pending organization invitations

2. **Review Invitation Details**
   - Organization name and inviter information
   - Your assigned role
   - Role permissions description
   - Expiration date

3. **Accept or Decline**
   - Click "Accept Invitation" to join
   - Click "Decline" if you don't want to join
   - Page will reload after accepting to load the new organization

### Managing Team Members

1. **View Team Members**
   - Go to Team Management page
   - See all active members with their roles and join dates

2. **Update Member Roles** (Admin/Owner only)
   - Use the dropdown to change a member's role
   - Cannot change the owner's role
   - Cannot change your own role

3. **Remove Team Members** (Owner only)
   - Click the remove button next to a member
   - Confirm the removal
   - Member will lose access to the organization

### Switching Organizations

1. **Access Organization Switcher**
   - Find it in the sidebar under "Organization" label
   - Click to see all your organizations

2. **Switch Organization**
   - Select an organization from the dropdown
   - See your role badge for each organization
   - Page will reload with the new organization's data

## 🔐 Security & Permissions

### Firestore Security Rules
All team operations are protected by Firestore security rules:

- ✅ Members can only view organizations they belong to
- ✅ Only admins can invite new members
- ✅ Only owners can remove members
- ✅ Invited users can accept/decline their own invitations
- ✅ All operations are validated server-side

### Role Hierarchy

```
Owner > Admin > Member
```

**Owner Capabilities:**
- All admin capabilities
- Remove any team member
- Delete organization
- Transfer ownership (future feature)

**Admin Capabilities:**
- Invite new members
- Manage member roles
- Cancel invitations
- Full content management

**Member Capabilities:**
- View organization data
- Manage content (videos, links, accounts)
- View team members

## 📁 Technical Architecture

### New Components

1. **`TeamManagementPage.tsx`** (351 lines)
   - Main team management interface
   - Member list with role management
   - Pending invitations display
   - Integrated with OrganizationService

2. **`InviteTeamMemberModal.tsx`** (159 lines)
   - Modal for inviting new members
   - Email validation
   - Role selection
   - Error handling

3. **`PendingInvitationsPage.tsx`** (222 lines)
   - Displays user's pending invitations
   - Accept/decline functionality
   - Expiration warnings
   - Organization details

4. **`OrganizationSwitcher.tsx`** (217 lines)
   - Dropdown to switch organizations
   - Shows user role per organization
   - Member count display
   - Current organization indicator

### New Services

1. **`TeamInvitationService.ts`** (216 lines)
   - `createInvitation()` - Send team invitations
   - `getOrgInvitations()` - Get org's pending invites
   - `getUserInvitations()` - Get user's pending invites
   - `acceptInvitation()` - Accept an invitation
   - `declineInvitation()` - Decline an invitation
   - `cancelInvitation()` - Cancel a pending invite

2. **Enhanced `OrganizationService.ts`**
   - `updateMemberRole()` - Change member roles
   - `isOrgAdmin()` - Check admin status
   - `isOrgOwner()` - Check owner status

### Database Schema

#### Organizations Collection
```
/organizations/{orgId}
  - members/{userId}
    - userId: string
    - role: 'owner' | 'admin' | 'member'
    - joinedAt: Timestamp
    - status: 'active' | 'invited' | 'removed'
    - invitedBy?: string
  
  - invitations/{invitationId}
    - id: string
    - orgId: string
    - email: string (lowercase)
    - role: 'admin' | 'member'
    - status: 'pending' | 'accepted' | 'declined' | 'expired'
    - invitedBy: string (userId)
    - invitedByName: string
    - organizationName: string
    - createdAt: Timestamp
    - expiresAt: Timestamp (7 days)
    - acceptedAt?: Timestamp
```

## 🎨 UI/UX Features

- **Modern Design**: Consistent with your existing dark theme
- **Role Badges**: Visual indicators for user roles (Owner, Admin, Member)
- **Real-time Updates**: Changes reflect immediately
- **Loading States**: Smooth loading experiences
- **Error Handling**: User-friendly error messages
- **Responsive Design**: Works on all screen sizes

## 🔧 Configuration

### Environment Variables
No additional environment variables needed! The system uses your existing Firebase configuration.

### Firebase Console Setup
✅ Already deployed! Your Firestore security rules include:
- Team invitation permissions
- Member management rules
- Access control validation

## 📊 Data Flow

### Invitation Flow
```
1. Admin sends invitation
   ↓
2. TeamInvitationService creates invitation document
   ↓
3. Invitee sees invitation in "Invitations" page
   ↓
4. Invitee accepts invitation
   ↓
5. Member document created in organization
   ↓
6. User gains access to organization
```

### Organization Switching Flow
```
1. User clicks Organization Switcher
   ↓
2. OrganizationService loads all user's organizations
   ↓
3. User selects organization
   ↓
4. AuthContext updates currentOrgId
   ↓
5. Page reloads with new organization data
```

## 🚦 Getting Started Checklist

- [x] Team invitation system implemented
- [x] Firestore security rules deployed
- [x] UI components integrated
- [x] Navigation updated with Team and Invitations tabs
- [x] Organization switcher added
- [ ] Test inviting your first team member!
- [ ] Try switching between organizations
- [ ] Explore role-based permissions

## 💡 Tips & Best Practices

1. **Start Small**: Invite 1-2 team members first to test the flow
2. **Use Admin Role**: Give admin role to trusted team members
3. **Regular Reviews**: Periodically review your team members
4. **Clear Communication**: Let invitees know to check their "Invitations" page
5. **Role Planning**: Plan your team structure before mass inviting

## 🐛 Troubleshooting

### Invitation Not Showing Up
- Check if email matches the invited user's account email
- Invitations expire after 7 days
- Check "Pending Invitations" section in Team Management

### Can't Accept Invitation
- Ensure you're logged in with the invited email address
- Check if invitation hasn't expired
- Try refreshing the page

### Permission Denied Errors
- Verify your role in the organization
- Only admins can invite members
- Only owners can remove members

## 🎯 Next Steps

Consider these enhancements:
- [ ] Email notifications for invitations (requires email service)
- [ ] Resend invitation functionality
- [ ] Bulk member management
- [ ] Custom role permissions
- [ ] Activity logs for team actions
- [ ] Member profile pages

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review Firestore security rules in `firestore.rules`
3. Check browser console for detailed error messages
4. Verify Firebase permissions are correctly set

---

**Built with ❤️ for seamless team collaboration!**

