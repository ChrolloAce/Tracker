# 🧹 Clean Start Guide - Projects-First Architecture

## What We're Changing

Moving from this (old, broken):
```
organizations/{orgId}/
  ├── trackedAccounts/  ❌ Data here
  ├── links/            ❌ Data here
  └── videos/           ❌ Data here
```

To this (new, correct):
```
organizations/{orgId}/
  ├── members/          ✅ Only org-level
  ├── billing/          ✅ Only org-level
  └── projects/
      └── {projectId}/
          ├── trackedAccounts/  ✅ All data here!
          ├── links/            ✅ All data here!
          └── videos/           ✅ All data here!
```

## Step 1: Delete Old Data (Firebase Console)

1. Go to: https://console.firebase.google.com/project/trackview-6a3a5/firestore
2. Navigate to `organizations/{your-org-id}`
3. **Delete these collections:**
   - `trackedAccounts`
   - `links`
   - `videos`
4. **Keep these:**
   - `members`
   - `billing`
   - `projects`

## Step 2: Services Updated

All services now write directly to project paths:

### FirestoreDataService
- `createLink(orgId, projectId, ...)` → `projects/{projectId}/links`
- `getLinks(orgId, projectId)` → reads from project
- `getVideos(orgId, projectId)` → reads from project

### AccountTrackingServiceFirebase  
- `createAccount(orgId, projectId, ...)` → `projects/{projectId}/trackedAccounts`
- `getAccounts(orgId, projectId)` → reads from project

### All Components
- Now pass `currentProjectId` from `useAuth()`
- Data is automatically scoped to current project

## Step 3: What Happens Now

1. **Login** → Auto-creates default project
2. **Add Account/Link/Video** → Goes into current project
3. **Switch Project** → See different data
4. **Create New Project** → Clean slate

## No Migration Needed!

Everything writes to the correct place from day 1. No more migration errors!

