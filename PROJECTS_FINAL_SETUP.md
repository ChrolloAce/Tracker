# 🎯 Projects Final Setup - Clean Start Instructions

## Current Situation
- You have data at org level (old location)
- Projects exist but aren't being used
- Migration keeps failing
- Same data showing across organizations

## Solution: Clean Start with Projects-First Architecture

### ✅ What I've Built For You:

1. **ProjectService** - Manages projects ✓
2. **ProjectSwitcher** - UI to switch/create projects ✓  
3. **AuthContext** - Tracks currentProjectId ✓
4. **Firestore Rules** - Proper permissions ✓
5. **Firestore Indexes** - For queries ✓

### 🧹 Steps to Clean Start:

#### Step 1: Clean Your Firebase Data (5 min)

**Option A: Delete in Firebase Console (Recommended)**
1. Go to: https://console.firebase.google.com/project/trackview-6a3a5/firestore
2. Find your organization: `organizations/NKq43lra1CHhPMvbZWU0`
3. **Delete these subcollections:**
   - Click `trackedAccounts` → Delete collection
   - Click `links` → Delete collection  
   - Click `videos` → Delete collection
4. **Keep these** (don't touch):
   - `members/`
   - `billing/`
   - `projects/`

**Option B: Use Firebase CLI**
```bash
# This will be safer - we can script it
firebase firestore:delete organizations/NKq43lra1CHhPMvbZWU0/trackedAccounts --recursive
firebase firestore:delete organizations/NKq43lra1CHhPMvbZWU0/links --recursive
firebase firestore:delete organizations/NKq43lra1CHhPMvbZWU0/videos --recursive
```

#### Step 2: Remove Migration Code

I'll update `App.tsx` to remove the migration logic since you're starting fresh.

#### Step 3: Update All Services

I need to update these files to use `projectId`:
- ✅ `FirestoreDataService.ts` - Already uses projectId in methods
- ⚠️  `AccountTrackingServiceFirebase.ts` - Needs projectId parameter
- ⚠️  Components need to pass `currentProjectId`

### 🏗️ New Data Flow:

```
User Login
  ↓
Create/Load Organization
  ↓
Create/Load Default Project  
  ↓
Set currentProjectId in AuthContext
  ↓
All operations use: organizations/{orgId}/projects/{projectId}/{collection}
```

### 📊 After Clean Start:

**When you add an account:**
```
organizations/NKq43lra1CHhPMvbZWU0/
  └── projects/g21AqJ4HopDAqoGFuvO7/    ← Your project
      └── trackedAccounts/
          └── [new-account-id]/         ← Goes here!
```

**When you add a link:**
```
organizations/NKq43lra1CHhPMvbZWU0/
  └── projects/g21AqJ4HopDAqoGFuvO7/
      └── links/
          └── [new-link-id]/            ← Goes here!
```

### 🎯 What This Fixes:

1. ✅ **No more shared data** - Each project is isolated
2. ✅ **No more migration errors** - Writes to correct place from start
3. ✅ **Switch projects** - See different data instantly
4. ✅ **Multiple projects** - Organize by client/campaign/brand

### 🚀 Implementation Plan:

I'll now:
1. Remove migration code from App.tsx
2. Update AccountTrackingServiceFirebase to require projectId
3. Update AccountsPage to pass currentProjectId
4. Deploy everything

Then you:
1. Delete old data from Firebase Console
2. Refresh app
3. Start adding data - it goes to correct place!

### 📝 Important Notes:

- Your project switcher is already in the sidebar ✓
- Projects are automatically created on login ✓
- All Firestore rules are set up ✓
- All indexes are deployed ✓

**Ready to implement? I'll update the services now!**

