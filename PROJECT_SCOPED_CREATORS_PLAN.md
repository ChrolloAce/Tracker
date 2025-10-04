# Project-Scoped Creators Implementation Plan

## Overview
Change creators from organization-scoped to **project-scoped**. Creators are added to specific projects and can only see data from those projects.

## Architecture Changes

### Data Model (NEW Paths)
```
OLD (Org-scoped):
/organizations/{orgId}/creators/{creatorId}
/organizations/{orgId}/creatorLinks/{linkId}
/organizations/{orgId}/creators/{creatorId}/payouts/{payoutId}

NEW (Project-scoped):
/organizations/{orgId}/projects/{projectId}/creators/{creatorId}
/organizations/{orgId}/projects/{projectId}/creatorLinks/{linkId}
/organizations/{orgId}/projects/{projectId}/creators/{creatorId}/payouts/{payoutId}
```

### Key Features

1. **Multi-Project Creators**
   - Same user can be creator in multiple projects within an org
   - Each project has independent creator assignments
   - `OrgMember.creatorProjectIds` tracks which projects user is creator in

2. **Project Switcher for Creators**
   - Creators see dropdown of only projects where they're assigned
   - Can't see projects they're not part of
   - Project switching changes their dashboard/payouts view

3. **Creator UI Changes**
   - Tab name: "Creators" → "Payouts" (for creator role)
   - Views:
     - **Payouts**: List of all payouts for current project
     - **Dashboard**: Videos from linked accounts in current project
     - Shows project-specific stats only

4. **Admin Functionality**
   - Add creators per-project (not org-wide)
   - Link accounts to creators within project scope
   - Manage payouts per-project
   - Same user can have different linked accounts in different projects

## Implementation Steps

### Phase 1: Types & Services ✅
- [x] Add `projectId` to Creator, CreatorLink, Payout interfaces
- [x] Add `creatorProjectIds` to OrgMember
- [ ] Update CreatorLinksService (all methods need projectId)
- [ ] Update PayoutsService (all methods need projectId)

### Phase 2: UI Components
- [ ] Update CreatorsManagementPage (per-project view)
- [ ] Update CreatorPortalPage (Payouts + Dashboard tabs)
- [ ] Update LinkCreatorAccountsModal (project-scoped)
- [ ] Add project filtering for creators

### Phase 3: Navigation & Access
- [ ] Update sidebar: "Creators" → "Payouts" for creator role
- [ ] Filter ProjectSwitcher to show only creator's assigned projects
- [ ] Update dashboard routing for project-scoped creators

### Phase 4: Security Rules
- [ ] Update Firestore rules for project-scoped creator access
- [ ] Ensure creators can only read their project's data
- [ ] Update creatorLinks rules for project scope

## User Flows

### Admin Flow: Adding a Creator
1. Admin goes to project
2. Clicks "Creators" tab
3. Clicks "Add Creator"
4. Selects user (or invites new)
5. Creator is added to THIS PROJECT only
6. Admin links accounts to creator (project-specific)

### Creator Flow: Viewing Data
1. Creator logs in
2. Sees project dropdown (only assigned projects)
3. Selects project
4. Views "Payouts" tab: payouts for this project
5. Views "Dashboard": videos from linked accounts in this project

### Admin Flow: Adding Creator to Another Project
1. Admin switches to different project
2. Goes to "Creators" tab
3. Adds same user as creator
4. Links different (or same) accounts
5. User now sees both projects in dropdown

## Benefits

1. **Multi-Tenant**: Agencies can use same creator across client projects
2. **Clear Scope**: Creators only see their project data
3. **Flexible**: Different account assignments per project
4. **Secure**: Project-level access control
5. **Scalable**: Independent project management

## Migration Notes

**For Existing Installations:**
- Old org-level creator data would need migration to project level
- Default: migrate to user's `lastActiveProjectId` or first project
- Run migration script to move data to new paths

## Files to Update

### Types
- [x] `src/types/firestore.ts` - Add projectId fields

### Services
- [ ] `src/services/CreatorLinksService.ts` - Project-scoped operations
- [ ] `src/services/PayoutsService.ts` - Project-scoped operations

### Components
- [ ] `src/components/CreatorsManagementPage.tsx` - Per-project management
- [ ] `src/components/CreatorPortalPage.tsx` - Rename tabs, project filter
- [ ] `src/components/LinkCreatorAccountsModal.tsx` - Project-scoped
- [ ] `src/components/layout/Sidebar.tsx` - Rename "Creators" → "Payouts"
- [ ] `src/components/ProjectSwitcher.tsx` - Filter for creators

### Pages
- [ ] `src/pages/DashboardPage.tsx` - Project-aware creator routing

### Rules
- [ ] `firestore.rules` - Project-scoped access rules

---

**Status**: In Progress
**Priority**: High - Core feature request
**Estimated**: Large refactor (3-4 hours)

