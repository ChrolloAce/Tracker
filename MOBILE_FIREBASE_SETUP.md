# ViewTrack Mobile App - Firebase Direct Connection Guide

This guide explains how to connect your mobile app directly to ViewTrack's Firebase database so you can share the same data between web and mobile.

---

## Overview

There are **two ways** to build your mobile app:

| Approach | Pros | Cons |
|----------|------|------|
| **1. Use ViewTrack API** | Simple, secure, no Firebase setup | Requires internet, rate limited |
| **2. Direct Firebase Connection** | Real-time sync, offline support, faster | More setup, shared security rules |

**This guide covers Approach #2** - connecting directly to Firebase.

---

## Step 1: Firebase Project Configuration

### Your Firebase Project Details

```
Project ID:       trackview-6a3a5
Auth Domain:      trackview-6a3a5.firebaseapp.com
Storage Bucket:   trackview-6a3a5.firebasestorage.app
```

### iOS Setup (Swift)

1. **Add Firebase SDK** via Swift Package Manager or CocoaPods:

```ruby
# Podfile
pod 'FirebaseAuth'
pod 'FirebaseFirestore'
pod 'FirebaseStorage'
```

2. **Download `GoogleService-Info.plist`** from Firebase Console:
   - Go to: https://console.firebase.google.com/project/trackview-6a3a5/settings/general
   - Click "Add app" → iOS
   - Enter your bundle ID
   - Download the plist file
   - Add to your Xcode project

3. **Initialize Firebase** in `AppDelegate.swift`:

```swift
import Firebase

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        return true
    }
}
```

### Android Setup (Kotlin)

1. **Add Firebase SDK** in `build.gradle`:

```groovy
// Project-level build.gradle
plugins {
    id 'com.google.gms.google-services' version '4.4.0' apply false
}

// App-level build.gradle
plugins {
    id 'com.google.gms.google-services'
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-auth-ktx'
    implementation 'com.google.firebase:firebase-firestore-ktx'
    implementation 'com.google.firebase:firebase-storage-ktx'
}
```

2. **Download `google-services.json`** from Firebase Console:
   - Go to: https://console.firebase.google.com/project/trackview-6a3a5/settings/general
   - Click "Add app" → Android
   - Enter your package name
   - Download the JSON file
   - Place in `app/` directory

3. **Initialize Firebase** (automatic with google-services plugin)

### Flutter Setup

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_auth: ^4.16.0
  cloud_firestore: ^4.14.0
  firebase_storage: ^11.6.0
```

```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(MyApp());
}
```

### React Native Setup

```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

---

## Step 2: Authentication

Users must authenticate with the **same Firebase Auth** to access their data.

### Sign In Methods Available

ViewTrack supports:
- ✅ Email/Password
- ✅ Google Sign-In
- ✅ Apple Sign-In

### iOS - Google Sign-In Example

```swift
import FirebaseAuth
import GoogleSignIn

class AuthManager {
    static let shared = AuthManager()
    
    func signInWithGoogle(presenting: UIViewController) async throws -> User {
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            throw AuthError.missingClientID
        }
        
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config
        
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenting)
        
        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.missingToken
        }
        
        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: result.user.accessToken.tokenString
        )
        
        let authResult = try await Auth.auth().signIn(with: credential)
        return authResult.user
    }
    
    func signOut() throws {
        try Auth.auth().signOut()
        GIDSignIn.sharedInstance.signOut()
    }
    
    var currentUser: User? {
        Auth.auth().currentUser
    }
}
```

### Android - Google Sign-In Example

```kotlin
class AuthManager(private val context: Context) {
    private val auth = Firebase.auth
    
    suspend fun signInWithGoogle(activityResultLauncher: ActivityResultLauncher<Intent>) {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(context.getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
            
        val googleSignInClient = GoogleSignIn.getClient(context, gso)
        activityResultLauncher.launch(googleSignInClient.signInIntent)
    }
    
    suspend fun firebaseAuthWithGoogle(idToken: String): FirebaseUser? {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        val result = auth.signInWithCredential(credential).await()
        return result.user
    }
    
    fun signOut() {
        auth.signOut()
    }
    
    val currentUser: FirebaseUser?
        get() = auth.currentUser
}
```

### Email/Password Sign-In

```swift
// iOS
func signIn(email: String, password: String) async throws -> User {
    let result = try await Auth.auth().signIn(withEmail: email, password: password)
    return result.user
}

func signUp(email: String, password: String) async throws -> User {
    let result = try await Auth.auth().createUser(withEmail: email, password: password)
    return result.user
}
```

```kotlin
// Android
suspend fun signIn(email: String, password: String): FirebaseUser? {
    val result = auth.signInWithEmailAndPassword(email, password).await()
    return result.user
}

suspend fun signUp(email: String, password: String): FirebaseUser? {
    val result = auth.createUserWithEmailAndPassword(email, password).await()
    return result.user
}
```

---

## Step 3: Firestore Data Structure

### Database Hierarchy

```
📁 users/{userId}
   └── User profile data

📁 organizations/{orgId}
   ├── 📄 Organization data (name, owner, plan)
   │
   ├── 📁 members/{userId}
   │   └── Member role & status
   │
   ├── 📁 projects/{projectId}
   │   ├── 📄 Project data (name, description)
   │   │
   │   ├── 📁 trackedAccounts/{accountId}
   │   │   ├── 📄 Account data (username, platform, stats)
   │   │   └── 📁 videos/{videoId}
   │   │       └── Video metrics from this account
   │   │
   │   ├── 📁 videos/{videoId}
   │   │   ├── 📄 Video data (url, metrics, status)
   │   │   └── 📁 snapshots/{snapshotId}
   │   │       └── Historical metric snapshot
   │   │
   │   └── 📁 links/{linkId}
   │       └── Tracked link data
   │
   ├── 📁 billing/{document}
   │   └── Subscription data
   │
   └── 📁 apiKeys/{keyId}
       └── API key data
```

### Key Collections & Fields

#### Organization Document
```typescript
// Path: organizations/{orgId}
{
  name: string;
  ownerUserId: string;
  createdBy: string;
  plan: 'free' | 'starter' | 'pro' | 'agency';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Member Document
```typescript
// Path: organizations/{orgId}/members/{userId}
{
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'creator';
  status: 'active' | 'pending' | 'removed';
  joinedAt: Timestamp;
}
```

#### Project Document
```typescript
// Path: organizations/{orgId}/projects/{projectId}
{
  name: string;
  description?: string;
  orgId: string;
  createdBy: string;
  videoCount: number;
  trackedAccountCount: number;
  linkCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Tracked Account Document
```typescript
// Path: organizations/{orgId}/projects/{projectId}/trackedAccounts/{accountId}
{
  username: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter';
  profilePicture?: string;
  followerCount?: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  syncStatus: 'idle' | 'pending' | 'syncing' | 'completed' | 'failed';
  lastSyncedAt?: Timestamp;
  addedBy: string;
  createdAt: Timestamp;
}
```

#### Video Document
```typescript
// Path: organizations/{orgId}/projects/{projectId}/videos/{videoId}
{
  url: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter';
  thumbnail?: string;
  title?: string;
  caption?: string;
  uploaderHandle: string;
  uploaderProfilePicture?: string;
  
  // Metrics
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
  
  // Status
  status: 'pending' | 'approved' | 'rejected';
  syncStatus: 'idle' | 'pending' | 'syncing' | 'completed' | 'failed';
  
  // Dates
  uploadDate?: Timestamp;
  lastRefreshed?: Timestamp;
  dateSubmitted: Timestamp;
  
  // Embedded snapshots (for quick access)
  snapshots?: VideoSnapshot[];
}
```

#### Video Snapshot Document
```typescript
// Path: organizations/{orgId}/projects/{projectId}/videos/{videoId}/snapshots/{snapshotId}
{
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
  capturedAt: Timestamp;
  capturedBy: 'initial_upload' | 'manual_refresh' | 'scheduled_refresh';
}
```

---

## Step 4: Reading Data (Firestore Queries)

### iOS - Swift Examples

```swift
import FirebaseFirestore

class ViewTrackService {
    private let db = Firestore.firestore()
    
    // MARK: - Get User's Organizations
    func getUserOrganizations(userId: String) async throws -> [Organization] {
        let snapshot = try await db.collectionGroup("members")
            .whereField("userId", isEqualTo: userId)
            .whereField("status", isEqualTo: "active")
            .getDocuments()
        
        var organizations: [Organization] = []
        
        for doc in snapshot.documents {
            let orgId = doc.reference.parent.parent!.documentID
            let orgDoc = try await db.collection("organizations").document(orgId).getDocument()
            
            if let org = try? orgDoc.data(as: Organization.self) {
                organizations.append(org)
            }
        }
        
        return organizations
    }
    
    // MARK: - Get Projects for Organization
    func getProjects(orgId: String) async throws -> [Project] {
        let snapshot = try await db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .order(by: "createdAt", descending: true)
            .getDocuments()
        
        return snapshot.documents.compactMap { doc in
            try? doc.data(as: Project.self)
        }
    }
    
    // MARK: - Get Tracked Accounts
    func getTrackedAccounts(orgId: String, projectId: String) async throws -> [TrackedAccount] {
        let snapshot = try await db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .document(projectId)
            .collection("trackedAccounts")
            .order(by: "createdAt", descending: true)
            .getDocuments()
        
        return snapshot.documents.compactMap { doc in
            try? doc.data(as: TrackedAccount.self)
        }
    }
    
    // MARK: - Get Videos with Real-Time Updates
    func observeVideos(orgId: String, projectId: String, 
                       onChange: @escaping ([Video]) -> Void) -> ListenerRegistration {
        return db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .document(projectId)
            .collection("videos")
            .order(by: "dateSubmitted", descending: true)
            .addSnapshotListener { snapshot, error in
                guard let documents = snapshot?.documents else { return }
                
                let videos = documents.compactMap { doc in
                    try? doc.data(as: Video.self)
                }
                onChange(videos)
            }
    }
    
    // MARK: - Get Video with Snapshots
    func getVideoWithSnapshots(orgId: String, projectId: String, videoId: String) async throws -> (Video, [VideoSnapshot]) {
        let videoDoc = try await db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .document(projectId)
            .collection("videos")
            .document(videoId)
            .getDocument()
        
        guard let video = try? videoDoc.data(as: Video.self) else {
            throw ViewTrackError.notFound
        }
        
        let snapshotsSnapshot = try await videoDoc.reference
            .collection("snapshots")
            .order(by: "capturedAt", descending: true)
            .limit(to: 30)
            .getDocuments()
        
        let snapshots = snapshotsSnapshot.documents.compactMap { doc in
            try? doc.data(as: VideoSnapshot.self)
        }
        
        return (video, snapshots)
    }
    
    // MARK: - Get Analytics Summary
    func getAnalyticsSummary(orgId: String, projectId: String) async throws -> AnalyticsSummary {
        let videosSnapshot = try await db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .document(projectId)
            .collection("videos")
            .getDocuments()
        
        var totalViews = 0
        var totalLikes = 0
        var totalComments = 0
        
        for doc in videosSnapshot.documents {
            let data = doc.data()
            totalViews += data["views"] as? Int ?? 0
            totalLikes += data["likes"] as? Int ?? 0
            totalComments += data["comments"] as? Int ?? 0
        }
        
        return AnalyticsSummary(
            videoCount: videosSnapshot.count,
            totalViews: totalViews,
            totalLikes: totalLikes,
            totalComments: totalComments
        )
    }
}
```

### Android - Kotlin Examples

```kotlin
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.tasks.await

class ViewTrackService {
    private val db = FirebaseFirestore.getInstance()
    
    // Get user's organizations
    suspend fun getUserOrganizations(userId: String): List<Organization> {
        val memberships = db.collectionGroup("members")
            .whereEqualTo("userId", userId)
            .whereEqualTo("status", "active")
            .get()
            .await()
        
        return memberships.documents.mapNotNull { doc ->
            val orgId = doc.reference.parent.parent?.id ?: return@mapNotNull null
            val orgDoc = db.collection("organizations").document(orgId).get().await()
            orgDoc.toObject(Organization::class.java)?.copy(id = orgId)
        }
    }
    
    // Get projects
    suspend fun getProjects(orgId: String): List<Project> {
        val snapshot = db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .get()
            .await()
        
        return snapshot.documents.mapNotNull { doc ->
            doc.toObject(Project::class.java)?.copy(id = doc.id)
        }
    }
    
    // Get tracked accounts
    suspend fun getTrackedAccounts(orgId: String, projectId: String): List<TrackedAccount> {
        val snapshot = db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .document(projectId)
            .collection("trackedAccounts")
            .get()
            .await()
        
        return snapshot.documents.mapNotNull { doc ->
            doc.toObject(TrackedAccount::class.java)?.copy(id = doc.id)
        }
    }
    
    // Real-time video updates
    fun observeVideos(
        orgId: String, 
        projectId: String,
        onChange: (List<Video>) -> Unit
    ): ListenerRegistration {
        return db.collection("organizations")
            .document(orgId)
            .collection("projects")
            .document(projectId)
            .collection("videos")
            .orderBy("dateSubmitted", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                
                val videos = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(Video::class.java)?.copy(id = doc.id)
                } ?: emptyList()
                
                onChange(videos)
            }
    }
}
```

---

## Step 5: Writing Data

### Adding a Video (iOS)

```swift
func addVideo(orgId: String, projectId: String, url: String) async throws -> String {
    let platform = detectPlatform(from: url)
    
    let videoData: [String: Any] = [
        "url": url,
        "platform": platform,
        "status": "pending",
        "syncStatus": "pending",
        "views": 0,
        "likes": 0,
        "comments": 0,
        "dateSubmitted": Timestamp(),
        "createdAt": Timestamp()
    ]
    
    let docRef = try await db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("videos")
        .addDocument(data: videoData)
    
    return docRef.documentID
}

private func detectPlatform(from url: String) -> String {
    if url.contains("tiktok.com") { return "tiktok" }
    if url.contains("instagram.com") { return "instagram" }
    if url.contains("youtube.com") || url.contains("youtu.be") { return "youtube" }
    if url.contains("twitter.com") || url.contains("x.com") { return "twitter" }
    return "unknown"
}
```

### Adding a Tracked Account (Android)

```kotlin
suspend fun addTrackedAccount(
    orgId: String, 
    projectId: String, 
    username: String, 
    platform: String
): String {
    val userId = Firebase.auth.currentUser?.uid 
        ?: throw IllegalStateException("User not signed in")
    
    val accountData = hashMapOf(
        "username" to username.lowercase(),
        "platform" to platform,
        "status" to "pending",
        "syncStatus" to "pending",
        "totalVideos" to 0,
        "totalViews" to 0,
        "totalLikes" to 0,
        "addedBy" to userId,
        "createdAt" to FieldValue.serverTimestamp()
    )
    
    val docRef = db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("trackedAccounts")
        .add(accountData)
        .await()
    
    return docRef.id
}
```

---

## Step 6: Security Rules Summary

Your mobile app users can only access data they're authorized for:

| Action | Who Can Do It |
|--------|---------------|
| Read organization | Organization members |
| Read projects | Organization members |
| Read videos | Organization members |
| Create videos | Members (not creators) |
| Update/delete videos | Admins only |
| Create tracked accounts | Members (not creators) |
| Manage members | Admins/Owners |
| Manage billing | Admins only |

⚠️ **Important:** The security rules are enforced by Firebase. Your app doesn't need to implement permission checks - Firebase will reject unauthorized requests automatically.

---

## Step 7: Offline Support

Firebase Firestore has built-in offline support.

### Enable Offline Persistence (iOS)

```swift
let settings = FirestoreSettings()
settings.cacheSettings = PersistentCacheSettings(sizeBytes: 100_000_000) // 100 MB
Firestore.firestore().settings = settings
```

### Enable Offline Persistence (Android)

```kotlin
val settings = firestoreSettings {
    setLocalCacheSettings(persistentCacheSettings {
        setSizeBytes(100_000_000) // 100 MB
    })
}
Firebase.firestore.firestoreSettings = settings
```

---

## Complete Data Models (Swift)

```swift
import FirebaseFirestore

struct Organization: Codable, Identifiable {
    @DocumentID var id: String?
    let name: String
    let ownerUserId: String
    let plan: String
    @ServerTimestamp var createdAt: Timestamp?
}

struct Project: Codable, Identifiable {
    @DocumentID var id: String?
    let name: String
    let description: String?
    let orgId: String
    let videoCount: Int
    let trackedAccountCount: Int
    @ServerTimestamp var createdAt: Timestamp?
}

struct TrackedAccount: Codable, Identifiable {
    @DocumentID var id: String?
    let username: String
    let platform: String
    let profilePicture: String?
    let followerCount: Int?
    let totalVideos: Int
    let totalViews: Int
    let totalLikes: Int
    let syncStatus: String
    @ServerTimestamp var lastSyncedAt: Timestamp?
    @ServerTimestamp var createdAt: Timestamp?
}

struct Video: Codable, Identifiable {
    @DocumentID var id: String?
    let url: String
    let platform: String
    let thumbnail: String?
    let title: String?
    let caption: String?
    let uploaderHandle: String
    let views: Int
    let likes: Int
    let comments: Int
    let shares: Int?
    let status: String
    let syncStatus: String
    @ServerTimestamp var uploadDate: Timestamp?
    @ServerTimestamp var lastRefreshed: Timestamp?
    @ServerTimestamp var dateSubmitted: Timestamp?
}

struct VideoSnapshot: Codable, Identifiable {
    @DocumentID var id: String?
    let views: Int
    let likes: Int
    let comments: Int
    let shares: Int?
    @ServerTimestamp var capturedAt: Timestamp?
}

struct AnalyticsSummary {
    let videoCount: Int
    let totalViews: Int
    let totalLikes: Int
    let totalComments: Int
    
    var engagementRate: Double {
        guard totalViews > 0 else { return 0 }
        return Double(totalLikes + totalComments) / Double(totalViews) * 100
    }
}
```

---

## Quick Start Checklist

- [ ] Add Firebase to your mobile project (iOS/Android)
- [ ] Download config file from Firebase Console (`GoogleService-Info.plist` / `google-services.json`)
- [ ] Implement authentication (Google Sign-In recommended)
- [ ] Create data models matching Firestore structure
- [ ] Implement ViewTrackService with Firestore queries
- [ ] Enable offline persistence
- [ ] Test with your existing ViewTrack account

---

## Need Help?

- **Firebase Console:** https://console.firebase.google.com/project/trackview-6a3a5
- **Firestore Data Viewer:** Check real data structure in Firebase Console → Firestore Database
- **Auth Users:** Firebase Console → Authentication → Users

---

*Last updated: February 2026*
