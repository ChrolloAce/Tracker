# 🏗️ Projects Implementation Guide

## ✅ What's Been Built

### 1. **Firebase Structure** (`PROJECTS_STRUCTURE.md`)
Complete hierarchical structure with:
- Organizations → Projects → Data (accounts, links, videos)
- Project stats for fast loading
- Backward compatibility strategy

### 2. **TypeScript Types** (`src/types/projects.ts`)
- `Project` interface
- `ProjectStats` interface
- `CreateProjectData` interface
- `PROJECT_COLORS` and `PROJECT_ICONS` constants

### 3. **ProjectService** (`src/services/ProjectService.ts`)
Complete CRUD operations:
- ✅ `createProject()` - Create new projects
- ✅ `getProjects()` - Get all projects for an org
- ✅ `getProjectWithStats()` - Get single project with stats
- ✅ `getProjectsWithStats()` - Get all projects with stats
- ✅ `updateProject()` - Update project details
- ✅ `archiveProject()` - Soft delete projects
- ✅ `unarchiveProject()` - Restore archived projects
- ✅ `deleteProject()` - Permanent deletion (currently archives)
- ✅ `updateProjectStats()` - Update aggregated stats
- ✅ `recalculateProjectStats()` - Recompute all stats
- ✅ `setActiveProject()` - Set user's active project
- ✅ `getActiveProjectId()` - Get user's last active project
- ✅ `createDefaultProject()` - Create default project for migration

### 4. **AuthContext Updates** (`src/contexts/AuthContext.tsx`)
Added project tracking:
- ✅ `currentProjectId` state
- ✅ `switchProject()` function
- ✅ Auto-creates default project on login
- ✅ Remembers last active project

### 5. **UI Components**

#### **ProjectSwitcher** (`src/components/ProjectSwitcher.tsx`)
Beautiful dropdown to switch between projects:
- Shows all active projects
- Displays project stats (accounts, links)
- Color-coded project indicators
- Quick project creation button

#### **CreateProjectModal** (`src/components/CreateProjectModal.tsx`)
Full-featured project creation modal:
- Project name & description
- Icon selector (24 emojis)
- Color picker (12 colors)
- Live preview
- Form validation

## 🚀 How to Implement

### Phase 1: Add ProjectSwitcher to Top Navigation (5 min)

**File:** `src/components/layout/TopNavigation.tsx`

```typescript
import ProjectSwitcher from '../ProjectSwitcher';
import CreateProjectModal from '../CreateProjectModal';
import { useState } from 'react';

// Inside your TopNavigation component:
const [showCreateProject, setShowCreateProject] = useState(false);

// Add this to your top navigation bar (next to org name or search bar):
<ProjectSwitcher onCreateProject={() => setShowCreateProject(true)} />

// Add modal at the end of your component:
<CreateProjectModal
  isOpen={showCreateProject}
  onClose={() => setShowCreateProject(false)}
/>
```

### Phase 2: Update Firestore Security Rules (10 min)

**File:** `firestore.rules`

Add these rules:

```javascript
// Projects and their data
match /organizations/{orgId}/projects/{projectId} {
  // Members can read their org's projects
  allow read: if canReadOrg(orgId);
  
  // Admins can create/manage projects
  allow create, update: if canManageOrg(orgId);
  
  // Only owners can delete projects
  allow delete: if isOrgOwner(orgId);
  
  // Project stats
  match /stats/{statId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
  }
  
  // Tracked accounts within projects
  match /trackedAccounts/{accountId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
    
    match /videos/{videoId} {
      allow read: if canReadOrg(orgId);
      allow write: if canManageOrg(orgId);
    }
  }
  
  // Links within projects
  match /links/{linkId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
    
    match /clicks/{clickId} {
      allow read: if canReadOrg(orgId);
      allow create: if true; // Analytics can write
    }
  }
  
  // Videos within projects
  match /videos/{videoId} {
    allow read: if canReadOrg(orgId);
    allow write: if canManageOrg(orgId);
  }
}
```

Then deploy:
```bash
firebase deploy --only firestore:rules
```

### Phase 3: Update Data Services to Use Projects (30-60 min)

You need to update these services to accept `projectId`:

#### **AccountTrackingServiceFirebase.ts**
```typescript
// Change:
static async createAccount(orgId: string, accountData: ...) {
  const accountRef = doc(collection(db, 'organizations', orgId, 'trackedAccounts'));
  // ...
}

// To:
static async createAccount(orgId: string, projectId: string, accountData: ...) {
  const accountRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'));
  // ...
}
```

#### **FirestoreDataService.ts**
```typescript
// Update all link methods:
static async createLink(orgId: string, projectId: string, userId: string, linkData: ...) {
  const linkRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'links'));
  // ...
  
  // Update publicLinks to include projectId:
  const publicLinkRef = doc(db, 'publicLinks', linkData.shortCode);
  batch.set(publicLinkRef, { 
    orgId, 
    projectId,  // ADD THIS
    linkId: linkRef.id, 
    url: cleanLinkData.originalUrl 
  });
}
```

#### **VideoApiService.ts** (if you have manual video submissions)
```typescript
static async submitVideo(orgId: string, projectId: string, videoData: ...) {
  const videoRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'videos'));
  // ...
}
```

### Phase 4: Update All Components to Use currentProjectId (30-60 min)

Update these components to use `currentProjectId` from `useAuth()`:

1. **AccountsPage.tsx**
```typescript
const { currentOrgId, currentProjectId } = useAuth();

// Update all service calls:
await AccountTrackingServiceFirebase.createAccount(currentOrgId, currentProjectId, ...);
const accounts = await AccountTrackingServiceFirebase.getAccounts(currentOrgId, currentProjectId);
```

2. **TrackedLinksPage.tsx**
```typescript
const { currentOrgId, currentProjectId } = useAuth();

// Update all service calls:
await FirestoreDataService.createLink(currentOrgId, currentProjectId, user.uid, ...);
const links = await FirestoreDataService.getLinks(currentOrgId, currentProjectId);
```

3. **VideoSubmissionsTable.tsx**
```typescript
const { currentOrgId, currentProjectId } = useAuth();

// Update all service calls:
await FirestoreDataService.submitVideo(currentOrgId, currentProjectId, ...);
```

4. **KPICards.tsx**
```typescript
const { currentOrgId, currentProjectId } = useAuth();

// Update data fetching to be project-scoped
```

### Phase 5: Data Migration (IMPORTANT!)

Create a migration script to move existing data into default projects:

**File:** `src/services/DataMigrationService.ts` (already exists, extend it)

```typescript
static async migrateToProjects(orgId: string, userId: string): Promise<void> {
  console.log(`🔄 Migrating org ${orgId} to projects structure...`);
  
  // 1. Create default project
  const projectId = await ProjectService.createDefaultProject(orgId, userId);
  console.log(`✅ Created default project: ${projectId}`);
  
  // 2. Get existing data
  const oldAccountsRef = collection(db, 'organizations', orgId, 'trackedAccounts');
  const oldLinksRef = collection(db, 'organizations', orgId, 'links');
  const oldVideosRef = collection(db, 'organizations', orgId, 'videos');
  
  const [accountsSnap, linksSnap, videosSnap] = await Promise.all([
    getDocs(oldAccountsRef),
    getDocs(oldLinksRef),
    getDocs(oldVideosRef)
  ]);
  
  const batch = writeBatch(db);
  
  // 3. Move tracked accounts
  accountsSnap.docs.forEach(doc => {
    const newRef = doc(
      db,
      'organizations', orgId,
      'projects', projectId,
      'trackedAccounts', doc.id
    );
    batch.set(newRef, doc.data());
  });
  
  // 4. Move links
  linksSnap.docs.forEach(doc => {
    const newRef = doc(
      db,
      'organizations', orgId,
      'projects', projectId,
      'links', doc.id
    );
    batch.set(newRef, doc.data());
    
    // Update publicLinks to include projectId
    const linkData = doc.data();
    if (linkData.shortCode) {
      const publicLinkRef = doc(db, 'publicLinks', linkData.shortCode);
      batch.update(publicLinkRef, { projectId });
    }
  });
  
  // 5. Move videos
  videosSnap.docs.forEach(doc => {
    const newRef = doc(
      db,
      'organizations', orgId,
      'projects', projectId,
      'videos', doc.id
    );
    batch.set(newRef, doc.data());
  });
  
  await batch.commit();
  
  // 6. Recalculate project stats
  await ProjectService.recalculateProjectStats(orgId, projectId);
  
  console.log(`✅ Migration complete!`);
  console.log(`   - Migrated ${accountsSnap.size} accounts`);
  console.log(`   - Migrated ${linksSnap.size} links`);
  console.log(`   - Migrated ${videosSnap.size} videos`);
}
```

Run migration for your existing org:
```typescript
// In browser console after logging in:
const { currentOrgId, user } = useAuth();
await DataMigrationService.migrateToProjects(currentOrgId, user.uid);
```

### Phase 6: Update Subscription Limits (Optional)

**File:** `src/types/subscription.ts`

```typescript
export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic',
    price: { monthly: 2499, yearly: 1999 * 12 },
    features: {
      projects: 1,  // ADD THIS
      accountsPerProject: 3,  // CHANGE FROM global accounts
      videosPerProject: 100,
      linksPerProject: 10,
      // ...
    },
  },
  pro: {
    name: 'Pro',
    price: { monthly: 9999, yearly: 7999 * 12 },
    features: {
      projects: 5,  // ADD THIS
      accountsPerProject: 50,
      videosPerProject: 5000,
      linksPerProject: 100,
      // ...
    },
  },
  // ... ultra, enterprise
};
```

## 🎨 UI Preview

### ProjectSwitcher in Top Nav:
```
┌─────────────────────────────────────┐
│ 🏢 Your Org    📁 Q4 Campaign ▾    │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Switch Project               │  │
│  │ 3 projects                   │  │
│  ├──────────────────────────────┤  │
│  │ 🎯 Q4 Campaign           ✓   │  │
│  │ 3 accounts • 12 links        │  │
│  ├──────────────────────────────┤  │
│  │ 🚀 Brand Launch              │  │
│  │ 1 account • 5 links          │  │
│  ├──────────────────────────────┤  │
│  │ + Create New Project         │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 🧪 Testing Checklist

- [ ] ProjectSwitcher appears in top navigation
- [ ] Can create new project via modal
- [ ] Can switch between projects
- [ ] Data is scoped to current project
- [ ] Creating account/link goes to current project
- [ ] Project stats update correctly
- [ ] Archive/unarchive projects works
- [ ] Migration script runs successfully
- [ ] Firestore rules enforce proper permissions

## 📊 Benefits

1. **Better Organization** - Separate campaigns, clients, or brands
2. **Cleaner UI** - Only see relevant data for current project
3. **Scalability** - Add unlimited projects (within plan limits)
4. **Flexibility** - Archive old projects without deleting data
5. **Multi-tenant Ready** - Easy to add project-level team permissions

## 🆘 Troubleshooting

### "No projects found"
- Check if default project was created on login
- Run: `ProjectService.createDefaultProject(orgId, userId)`

### "Cannot read project data"
- Ensure Firestore rules are deployed
- Check that `currentProjectId` exists in AuthContext

### "Migration failed"
- Check console for errors
- Verify you have write permissions
- Try running migration in smaller batches

## 🚀 Next Steps

1. Add ProjectSwitcher to top nav
2. Deploy Firestore rules
3. Update services to use projectId
4. Run migration script
5. Test thoroughly
6. Deploy to production

Need help? Check `PROJECTS_STRUCTURE.md` for the complete architecture!

