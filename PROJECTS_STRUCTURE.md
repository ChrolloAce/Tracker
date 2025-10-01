# 🏗️ Projects-Based Firebase Structure

## Overview
Multi-project architecture allowing organizations to segment their tracking data into separate projects (e.g., "Brand A Campaign", "Q4 Marketing", "Client X").

## Firebase Structure

```
firestore/
├── users/{userId}
│   ├── email: string
│   ├── displayName: string
│   ├── createdAt: Timestamp
│   └── lastActiveOrgId: string
│
├── organizations/{orgId}
│   ├── id: string
│   ├── name: string
│   ├── createdAt: Timestamp
│   ├── createdBy: string (userId)
│   ├── ownerUserId: string
│   ├── ownerEmail: string
│   ├── memberCount: number
│   ├── projectCount: number
│   ├── planTier: string
│   ├── subscriptionStatus: string
│   ├── stripeCustomerId?: string
│   │
│   ├── members/{userId}
│   │   ├── userId: string
│   │   ├── email: string
│   │   ├── role: 'owner' | 'admin' | 'member' | 'viewer'
│   │   ├── joinedAt: Timestamp
│   │   └── lastActiveProjectId?: string
│   │
│   ├── billing/
│   │   └── subscription/
│   │       ├── planTier: string
│   │       ├── status: string
│   │       ├── usage: { projects, accounts, videos, links, teamMembers }
│   │       └── ...
│   │
│   └── projects/{projectId}
│       ├── id: string
│       ├── name: string
│       ├── description?: string
│       ├── color: string (for UI)
│       ├── icon?: string (emoji or icon name)
│       ├── createdAt: Timestamp
│       ├── createdBy: string (userId)
│       ├── isArchived: boolean
│       ├── archivedAt?: Timestamp
│       │
│       ├── stats/
│       │   ├── trackedAccountCount: number
│       │   ├── videoCount: number
│       │   ├── linkCount: number
│       │   ├── totalViews: number
│       │   ├── totalClicks: number
│       │   └── lastUpdated: Timestamp
│       │
│       ├── trackedAccounts/{accountId}
│       │   ├── id: string
│       │   ├── platform: 'instagram' | 'tiktok' | 'youtube'
│       │   ├── username: string
│       │   ├── displayName: string
│       │   ├── profileUrl: string
│       │   ├── avatarUrl?: string
│       │   ├── isActive: boolean
│       │   ├── createdAt: Timestamp
│       │   ├── lastScraped?: Timestamp
│       │   │
│       │   ├── metrics/
│       │   │   ├── followers: number
│       │   │   ├── totalVideos: number
│       │   │   ├── totalViews: number
│       │   │   └── ...
│       │   │
│       │   └── videos/{videoId}
│       │       ├── id: string
│       │       ├── accountId: string
│       │       ├── platform: string
│       │       ├── videoUrl: string
│       │       ├── title?: string
│       │       ├── thumbnail?: string
│       │       ├── views: number
│       │       ├── likes: number
│       │       ├── comments: number
│       │       ├── shares: number
│       │       ├── createdAt: Timestamp
│       │       └── lastUpdated: Timestamp
│       │
│       ├── links/{linkId}
│       │   ├── id: string
│       │   ├── shortCode: string
│       │   ├── originalUrl: string
│       │   ├── title: string
│       │   ├── description?: string
│       │   ├── tags?: string[]
│       │   ├── linkedAccountId?: string
│       │   ├── linkedVideoId?: string
│       │   ├── totalClicks: number
│       │   ├── uniqueClicks: number
│       │   ├── last7DaysClicks: number
│       │   ├── isActive: boolean
│       │   ├── createdAt: Timestamp
│       │   ├── createdBy: string
│       │   ├── lastClickedAt?: Timestamp
│       │   │
│       │   └── clicks/{clickId}
│       │       ├── id: string
│       │       ├── linkId: string
│       │       ├── timestamp: Timestamp
│       │       ├── userAgent: string
│       │       ├── deviceType: string
│       │       ├── browser: string
│       │       ├── os: string
│       │       ├── referrer: string
│       │       └── ipHash?: string
│       │
│       └── videos/{videoId}  (manual submissions)
│           ├── id: string
│           ├── platform: 'instagram' | 'tiktok' | 'youtube'
│           ├── url: string
│           ├── title?: string
│           ├── thumbnail?: string
│           ├── views: number
│           ├── likes: number
│           ├── comments: number
│           ├── shares: number
│           ├── submittedBy: string (userId)
│           ├── submittedAt: Timestamp
│           └── lastUpdated: Timestamp
│
└── publicLinks/{shortCode}
    ├── orgId: string
    ├── projectId: string
    ├── linkId: string
    └── url: string
```

## Key Design Decisions

### 1. **Projects as Subcollection**
- Projects live under `organizations/{orgId}/projects/{projectId}`
- Easy to query all projects for an org
- Clean security rules (inherit org permissions)

### 2. **All Data Scoped to Projects**
- `trackedAccounts`, `links`, `videos` all live under projects
- Complete data isolation between projects
- Easy to archive/delete entire projects

### 3. **Project Stats Aggregation**
- Each project has a `stats` document for quick dashboard loading
- Updated atomically when data changes
- Avoids expensive queries across collections

### 4. **Backward Compatibility Path**
- Create a "Default Project" for existing orgs
- Migrate existing data to default project
- User sees no disruption

### 5. **Public Links Updated**
- `publicLinks` now includes `projectId` for proper scoping
- Redirect function uses projectId to find the right link

## Usage Patterns

### Create New Project
```typescript
const projectId = await ProjectService.createProject(orgId, {
  name: "Q4 Campaign",
  description: "Holiday marketing campaign",
  color: "#3B82F6",
  icon: "🎄"
});
```

### Switch Projects
```typescript
// Store in user's org membership
await ProjectService.setActiveProject(orgId, userId, projectId);
```

### Query Project Data
```typescript
// All data automatically scoped to current project
const accounts = await getAccounts(orgId, projectId);
const links = await getLinks(orgId, projectId);
```

## Migration Strategy

### Phase 1: Add Projects Layer (Non-Breaking)
1. Add `projects` collection to Firestore structure
2. Create `ProjectService` for project management
3. Add project context to AuthContext
4. Create default project for all existing orgs

### Phase 2: Migrate Data
1. For each organization:
   - Create "Default Project"
   - Move `trackedAccounts` → `projects/default/trackedAccounts`
   - Move `links` → `projects/default/links`
   - Move `videos` → `projects/default/videos`
2. Update `publicLinks` with `projectId`

### Phase 3: Update Services
1. Update all service methods to accept `projectId`
2. Update all queries to use project scope
3. Update UI to show project selector

### Phase 4: Add Project Features
1. Project switcher in top navigation
2. Project management page (create, edit, archive)
3. Cross-project analytics (future)

## Subscription Limits

Update subscription plans to include project limits:

```typescript
basic: {
  projects: 1,
  accountsPerProject: 3,
  videosPerProject: 100,
  linksPerProject: 10,
}

pro: {
  projects: 5,
  accountsPerProject: 50,
  videosPerProject: 5000,
  linksPerProject: 100,
}

ultra: {
  projects: 25,
  accountsPerProject: 500,
  videosPerProject: 50000,
  linksPerProject: 1000,
}

enterprise: {
  projects: 'unlimited',
  // ...
}
```

## Security Rules

```javascript
match /organizations/{orgId}/projects/{projectId} {
  // Members can read their org's projects
  allow read: if canReadOrg(orgId);
  
  // Admins can create/manage projects
  allow create, update: if canManageOrg(orgId);
  
  // Only owners can delete projects
  allow delete: if isOrgOwner(orgId);
  
  // Project data inherits project permissions
  match /trackedAccounts/{accountId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
  }
  
  match /links/{linkId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
    
    match /clicks/{clickId} {
      allow read: if canReadOrg(orgId);
      allow create: if true; // Analytics can write
    }
  }
  
  match /videos/{videoId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
  }
}
```

## UI Components Needed

1. **ProjectSwitcher** - Dropdown in top nav to switch projects
2. **ProjectManagementPage** - Create, edit, archive projects
3. **ProjectCard** - Visual project cards with stats
4. **ProjectSettingsModal** - Edit project details
5. **CreateProjectModal** - Quick project creation

## Next Steps

1. ✅ Review this structure
2. Create TypeScript types for projects
3. Create ProjectService
4. Update AuthContext with project tracking
5. Create migration script
6. Update UI components
7. Update Firestore rules
8. Deploy migration

Would you like me to proceed with implementation?

