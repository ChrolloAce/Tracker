# Firebase Setup Guide for ViewTrack

## 🚀 Overview

ViewTrack uses Firebase for:
- **Authentication**: Google Sign-In and Email/Password
- **Firestore Database**: Multi-tenant data storage with Organizations
- **Security**: Role-based access control
- **Analytics**: Track user behavior

## 📁 Data Structure

```
users/{userId}
  - uid, email, displayName, photoURL
  - createdAt, lastLoginAt, plan
  - defaultOrgId

organizations/{orgId}
  - name, createdBy, ownerUserId
  - memberCount, trackedAccountCount, videoCount, linkCount
  
  /members/{userId}
    - role: 'owner' | 'admin' | 'member'
    - status: 'active' | 'invited' | 'removed'
  
  /trackedAccounts/{accountId}
    - platform, username, displayName, accountType
    - totalVideos, totalViews, totalLikes, totalComments
  
  /videos/{videoId}
    - platform, url, title, thumbnail
    - uploadDate, dateAdded, lastRefreshed
    - views, likes, comments, shares
    - trackedAccountId (optional), isSingular
    
    /snapshots/{snapshotId}
      - capturedAt, views, likes, comments, shares
  
  /links/{linkId}
    - shortCode, originalUrl, title
    - totalClicks, uniqueClicks, last7DaysClicks
    
    /clicks/{clickId}
      - timestamp, userAgent, deviceType, referrer

publicLinks/{shortCode}
  - orgId, linkId (for public redirects)
```

## 🔒 Security Rules

The Firestore security rules enforce:

1. **Authentication Required**: All reads/writes require authentication
2. **Organization Membership**: Users can only access orgs they're members of
3. **Role-Based Permissions**:
   - **Owner**: Full control (delete org, manage all members)
   - **Admin**: Manage members & data
   - **Member**: Read/write data (videos, accounts, links)
4. **Immutable Snapshots**: Video snapshots can't be modified after creation
5. **Public Link Redirects**: Anyone can read `publicLinks` for redirects

## 📊 Firestore Indexes

Required composite indexes (auto-created when you deploy):

```json
{
  "indexes": [
    { "collectionGroup": "videos", "fields": ["orgId", "lastRefreshed"] },
    { "collectionGroup": "videos", "fields": ["orgId", "uploadDate"] },
    { "collectionGroup": "videos", "fields": ["orgId", "trackedAccountId", "uploadDate"] },
    { "collectionGroup": "trackedAccounts", "fields": ["orgId", "platform", "isActive"] },
    { "collectionGroup": "links", "fields": ["orgId", "totalClicks"] }
  ]
}
```

## 🛠️ Setup Instructions

### 1. Deploy Firestore Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

### 2. Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `trackview-6a3a5`
3. Navigate to **Authentication** → **Sign-in method**
4. Enable:
   - ✅ **Google** (add your OAuth client)
   - ✅ **Email/Password**

### 3. Configure Firestore Database

1. Go to **Firestore Database**
2. Click **Create Database**
3. Choose **Production mode** (rules will protect data)
4. Select region: **us-east1** (or your preferred region)

## 🔄 Data Migration

On first sign-in, ViewTrack will automatically migrate data from localStorage to Firestore.

To manually trigger migration:

```typescript
import DataMigrationService from './services/DataMigrationService';
import { useAuth } from './contexts/AuthContext';

const { user, currentOrgId } = useAuth();

if (user && currentOrgId) {
  await DataMigrationService.migrateAllData(currentOrgId, user.uid);
}
```

**Migration includes**:
- ✅ All tracked videos
- ✅ All tracked accounts
- ✅ All tracked links
- ✅ Video snapshots (refresh history)

## 📝 Usage Examples

### Create Organization

```typescript
import OrganizationService from './services/OrganizationService';

const orgId = await OrganizationService.createOrganization(
  userId, 
  "My Workspace"
);
```

### Add Tracked Account

```typescript
import FirestoreDataService from './services/FirestoreDataService';

const accountId = await FirestoreDataService.addTrackedAccount(
  orgId,
  userId,
  {
    platform: 'tiktok',
    username: 'creator123',
    accountType: 'my',
    isActive: true
  }
);
```

### Add Video

```typescript
const videoId = await FirestoreDataService.addVideo(
  orgId,
  userId,
  {
    platform: 'tiktok',
    url: 'https://www.tiktok.com/@user/video/123',
    videoId: '123',
    uploadDate: Timestamp.now(),
    views: 1000,
    likes: 50,
    comments: 10,
    status: 'active',
    isSingular: false,
    trackedAccountId: accountId
  }
);
```

### Record Video Refresh

```typescript
await FirestoreDataService.addVideoSnapshot(
  orgId,
  videoId,
  userId,
  {
    views: 5000,
    likes: 250,
    comments: 50,
    shares: 10
  }
);
```

## 🎯 Multi-Tenancy

ViewTrack is fully multi-tenant:

1. **Each user** can create/join multiple organizations
2. **Each organization** has its own isolated data
3. **Security rules** prevent cross-org data access
4. **Organization switching** is handled via `AuthContext`

```typescript
const { currentOrgId, switchOrganization } = useAuth();

// Switch to different org
switchOrganization('org-id-here');
```

## 🧪 Testing

To test locally with Firebase Emulators:

```bash
# Install emulators
firebase init emulators

# Start emulators (Auth + Firestore)
firebase emulators:start

# Update firebase.ts to use emulators
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';

connectFirestoreEmulator(db, 'localhost', 8080);
connectAuthEmulator(auth, 'http://localhost:9099');
```

## 📈 Monitoring

### Check Firestore Usage

1. Go to **Firestore Database** → **Usage**
2. Monitor:
   - Document reads/writes
   - Storage size
   - Number of collections

### Check Auth Usage

1. Go to **Authentication** → **Users**
2. Monitor:
   - Total users
   - Sign-in methods
   - Recent sign-ins

## 🚨 Important Notes

- **Read/Write Costs**: Firestore charges per read/write operation
- **Security Rules**: Always test rules before deploying to production
- **Indexes**: Create indexes before querying or you'll get errors
- **Backup**: Set up daily backups in Firebase Console
- **Quotas**: Free tier has limits (50K reads, 20K writes per day)

## 📚 Additional Resources

- [Firebase Docs](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Best Practices](https://firebase.google.com/docs/firestore/best-practices)

## 🎉 You're All Set!

Your Firebase integration is ready! Users can now:
- ✅ Sign in with Google or Email/Password
- ✅ Create organizations (workspaces)
- ✅ Track videos, accounts, and links
- ✅ Share data with team members
- ✅ Access data from any device

