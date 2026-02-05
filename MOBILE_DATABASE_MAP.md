# ViewTrack Database Structure & Query Guide

Complete reference for accessing ViewTrack's Firestore database from your mobile app.

---

## Database Overview

```
📦 Firestore Database: trackview-6a3a5
│
├── 👤 users/{userId}                          ← User profiles
│
├── 🏢 organizations/{orgId}                   ← Workspaces
│   ├── 👥 members/{userId}                    ← Team members
│   ├── 📧 invitations/{invitationId}          ← Pending invites
│   ├── 💳 billing/{document}                  ← Subscription info
│   ├── 🔑 apiKeys/{keyId}                     ← API keys
│   │
│   └── 📁 projects/{projectId}                ← Projects container
│       ├── 📊 stats/{statId}                  ← Project statistics
│       ├── 🎯 trackedAccounts/{accountId}     ← Tracked creators
│       │   └── 🎬 videos/{videoId}            ← Account's videos
│       ├── 🎬 videos/{videoId}                ← Individual videos
│       │   └── 📸 snapshots/{snapshotId}      ← Historical metrics
│       ├── 🔗 links/{linkId}                  ← Tracked links
│       │   └── 👆 clicks/{clickId}            ← Click events
│       ├── 👨‍🎨 creators/{creatorId}            ← Creator profiles
│       │   └── 💰 payouts/{payoutId}          ← Payout records
│       └── 🔗 creatorLinks/{linkId}           ← Creator-Account mapping
│
└── 📋 syncQueue/{jobId}                       ← Background jobs
```

---

## 1. Users Collection

**Path:** `users/{userId}`

```swift
struct User: Codable {
    let uid: String
    let email: String
    let displayName: String?
    let photoURL: String?
    let createdAt: Timestamp
    let lastLoginAt: Timestamp
    let plan: String  // "free", "pro", "enterprise"
    let defaultOrgId: String?
    let isAdmin: Bool?
}
```

### Query: Get Current User Profile
```swift
// iOS
let userDoc = try await db.collection("users")
    .document(Auth.auth().currentUser!.uid)
    .getDocument()
```

```kotlin
// Android
val userDoc = db.collection("users")
    .document(Firebase.auth.currentUser!!.uid)
    .get()
    .await()
```

---

## 2. Organizations Collection

**Path:** `organizations/{orgId}`

```swift
struct Organization: Codable {
    let id: String
    let name: String
    let slug: String?
    let logoUrl: String?
    let createdAt: Timestamp
    let createdBy: String
    let ownerUserId: String
    let memberCount: Int
    let trackedAccountCount: Int
    let videoCount: Int
    let linkCount: Int
    let projectCount: Int?
}
```

### Query: Get User's Organizations
```swift
// iOS - Find all orgs where user is a member
let memberships = try await db.collectionGroup("members")
    .whereField("userId", isEqualTo: userId)
    .whereField("status", isEqualTo: "active")
    .getDocuments()

for doc in memberships.documents {
    let orgId = doc.reference.parent.parent!.documentID
    let orgDoc = try await db.collection("organizations").document(orgId).getDocument()
    // Process org...
}
```

```kotlin
// Android
val memberships = db.collectionGroup("members")
    .whereEqualTo("userId", userId)
    .whereEqualTo("status", "active")
    .get()
    .await()
```

---

## 3. Members Subcollection

**Path:** `organizations/{orgId}/members/{userId}`

```swift
struct OrgMember: Codable {
    let userId: String
    let email: String?
    let displayName: String?
    let photoURL: String?
    let role: String      // "owner", "admin", "member", "creator"
    let status: String    // "active", "invited", "removed"
    let joinedAt: Timestamp
    let invitedBy: String?
}
```

### Query: Get Team Members
```swift
let members = try await db.collection("organizations")
    .document(orgId)
    .collection("members")
    .whereField("status", isEqualTo: "active")
    .getDocuments()
```

---

## 4. Projects Collection

**Path:** `organizations/{orgId}/projects/{projectId}`

```swift
struct Project: Codable {
    let id: String
    let orgId: String
    let name: String
    let description: String?
    let color: String?
    let icon: String?
    let imageUrl: String?
    let createdAt: Timestamp
    let createdBy: String
    let isArchived: Bool
}
```

### Query: Get All Projects
```swift
let projects = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .whereField("isArchived", isEqualTo: false)
    .order(by: "createdAt", descending: true)
    .getDocuments()
```

---

## 5. Tracked Accounts Collection

**Path:** `organizations/{orgId}/projects/{projectId}/trackedAccounts/{accountId}`

```swift
struct TrackedAccount: Codable {
    let id: String
    let orgId: String
    
    // Account info
    let platform: String      // "tiktok", "instagram", "youtube", "twitter"
    let username: String
    let displayName: String?
    let profilePicture: String?
    let accountType: String   // "my", "competitor"
    let youtubeChannelId: String?
    
    // Stats
    let followerCount: Int?
    let followingCount: Int?
    let postCount: Int?
    let bio: String?
    let isVerified: Bool?
    
    // Aggregated metrics
    let totalVideos: Int
    let totalViews: Int
    let totalLikes: Int
    let totalComments: Int
    let totalShares: Int?
    
    // Sync status
    let syncStatus: String?   // "idle", "pending", "syncing", "completed", "error"
    let lastSynced: Timestamp?
    let lastRefreshed: Timestamp?
    let lastSyncError: String?
    
    // Metadata
    let dateAdded: Timestamp
    let addedBy: String
    let isActive: Bool
    let isRead: Bool?
    
    // Outlier analysis
    let outlierAnalysis: OutlierAnalysis?
}

struct OutlierAnalysis: Codable {
    let topPerformersCount: Int
    let underperformersCount: Int
    let lastCalculated: Timestamp
}
```

### Query: Get All Tracked Accounts
```swift
let accounts = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("trackedAccounts")
    .whereField("isActive", isEqualTo: true)
    .order(by: "totalViews", descending: true)
    .getDocuments()
```

### Query: Get Accounts by Platform
```swift
let tiktokAccounts = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("trackedAccounts")
    .whereField("platform", isEqualTo: "tiktok")
    .whereField("isActive", isEqualTo: true)
    .getDocuments()
```

---

## 6. Videos Collection ⭐ (Main Data for KPIs)

**Path:** `organizations/{orgId}/projects/{projectId}/videos/{videoId}`

```swift
struct Video: Codable {
    let id: String
    let orgId: String
    
    // Source
    let platform: String      // "tiktok", "instagram", "youtube", "twitter"
    let url: String?
    let videoId: String       // Platform-specific ID
    let trackedAccountId: String?
    
    // Content
    let title: String?
    let caption: String?
    let thumbnail: String?
    let duration: Int?
    let hashtags: [String]?
    
    // Creator info
    let uploader: String?
    let uploaderHandle: String
    let uploaderProfilePicture: String?
    let followerCount: Int?
    
    // 📊 CURRENT METRICS (Latest values)
    let views: Int
    let likes: Int
    let comments: Int
    let shares: Int?
    let saves: Int?
    
    // 📈 GROWTH DELTAS (For KPI cards)
    let viewsDelta24h: Int?
    let likesDelta24h: Int?
    let commentsDelta24h: Int?
    let viewsDelta7d: Int?
    let likesDelta7d: Int?
    let commentsDelta7d: Int?
    let viewsDelta30d: Int?
    let likesDelta30d: Int?
    let commentsDelta30d: Int?
    
    // Status
    let status: String        // "pending", "approved", "rejected"
    let syncStatus: String?   // "idle", "pending", "syncing", "completed", "failed"
    let syncError: String?
    
    // Timestamps
    let uploadDate: Timestamp     // When posted on platform
    let dateSubmitted: Timestamp  // When added to ViewTrack
    let lastRefreshed: Timestamp?
    
    // Metadata
    let addedBy: String
    let isRead: Bool?
    
    // 📸 EMBEDDED SNAPSHOTS (Quick access - may be limited)
    let snapshots: [VideoSnapshot]?
}
```

### Query: Get All Videos (For Dashboard)
```swift
let videos = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("videos")
    .order(by: "uploadDate", descending: true)
    .getDocuments()
```

### Query: Get Videos by Platform
```swift
let tiktokVideos = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("videos")
    .whereField("platform", isEqualTo: "tiktok")
    .order(by: "views", descending: true)
    .limit(to: 50)
    .getDocuments()
```

### Query: Get Videos by Date Range (For KPI Graphs)
```swift
let startDate = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
let endDate = Date()

let recentVideos = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("videos")
    .whereField("uploadDate", isGreaterThanOrEqualTo: Timestamp(date: startDate))
    .whereField("uploadDate", isLessThanOrEqualTo: Timestamp(date: endDate))
    .order(by: "uploadDate", descending: true)
    .getDocuments()
```

### Query: Get Top Performing Videos
```swift
let topVideos = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("videos")
    .order(by: "views", descending: true)
    .limit(to: 10)
    .getDocuments()
```

---

## 7. Video Snapshots Collection ⭐ (Historical Data for Graphs)

**Path:** `organizations/{orgId}/projects/{projectId}/videos/{videoId}/snapshots/{snapshotId}`

```swift
struct VideoSnapshot: Codable {
    let id: String
    let videoId: String
    
    // 📊 Metrics at this point in time
    let views: Int
    let likes: Int
    let comments: Int
    let shares: Int?
    let saves: Int?
    
    // Timing
    let capturedAt: Timestamp
    let capturedBy: String    // "initial_upload", "manual_refresh", "scheduled_refresh"
    let isInitialSnapshot: Bool?  // True = first snapshot when video added
}
```

### Query: Get Video Snapshots (For Growth Chart)
```swift
let snapshots = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("videos")
    .document(videoId)
    .collection("snapshots")
    .order(by: "capturedAt", descending: false)  // Oldest first for charts
    .getDocuments()
```

### How Snapshots Work for KPI Graphs

```
Timeline:
─────────────────────────────────────────────────────────→

Day 1: Video uploaded
       └─ Snapshot #1 (isInitialSnapshot: true)
          views: 1,000 | likes: 50

Day 3: Scheduled refresh
       └─ Snapshot #2
          views: 15,000 | likes: 800
          
Day 5: Manual refresh
       └─ Snapshot #3
          views: 45,000 | likes: 2,100

Day 7: Scheduled refresh
       └─ Snapshot #4
          views: 120,000 | likes: 5,500

📈 Growth calculation:
   - Day 1→3: +14,000 views
   - Day 3→5: +30,000 views
   - Day 5→7: +75,000 views
```

---

## 8. Tracked Links Collection

**Path:** `organizations/{orgId}/projects/{projectId}/links/{linkId}`

```swift
struct TrackedLink: Codable {
    let id: String
    let shortCode: String         // "abc123" for viewtrack.app/l/abc123
    let originalUrl: String       // Destination URL
    let title: String
    let description: String?
    let tags: [String]?
    
    // Analytics
    let totalClicks: Int
    let uniqueClicks: Int
    let lastClickedAt: Timestamp?
    
    // Associations
    let linkedVideoId: String?
    let linkedAccountId: String?
    
    // Metadata
    let createdAt: Timestamp
    let createdBy: String
    let isActive: Bool
}
```

### Query: Get All Links
```swift
let links = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("links")
    .whereField("isActive", isEqualTo: true)
    .order(by: "totalClicks", descending: true)
    .getDocuments()
```

---

## 9. Link Clicks Collection (Click Analytics)

**Path:** `organizations/{orgId}/projects/{projectId}/links/{linkId}/clicks/{clickId}`

```swift
struct LinkClick: Codable {
    let id: String
    let linkId: String
    let clickedAt: Timestamp
    
    // Location
    let country: String?
    let countryCode: String?
    let city: String?
    
    // Device
    let deviceType: String?   // "mobile", "tablet", "desktop"
    let browser: String?
    let os: String?
    
    // Source
    let referrer: String?
    let referrerDomain: String?
    let platform: String?     // "Instagram", "TikTok", etc.
    
    // UTM Parameters
    let utmSource: String?
    let utmMedium: String?
    let utmCampaign: String?
    
    // Bot detection
    let isBot: Bool?
}
```

### Query: Get Click Analytics
```swift
let clicks = try await db.collection("organizations")
    .document(orgId)
    .collection("projects")
    .document(projectId)
    .collection("links")
    .document(linkId)
    .collection("clicks")
    .order(by: "clickedAt", descending: true)
    .limit(to: 100)
    .getDocuments()
```

---

## 10. KPI Dashboard Queries

### Calculate Total Metrics Across All Videos

```swift
func calculateDashboardKPIs(orgId: String, projectId: String) async throws -> DashboardKPIs {
    let videos = try await db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("videos")
        .getDocuments()
    
    var totalViews = 0
    var totalLikes = 0
    var totalComments = 0
    var totalShares = 0
    var viewsDelta24h = 0
    var viewsDelta7d = 0
    var viewsDelta30d = 0
    
    for doc in videos.documents {
        let data = doc.data()
        totalViews += data["views"] as? Int ?? 0
        totalLikes += data["likes"] as? Int ?? 0
        totalComments += data["comments"] as? Int ?? 0
        totalShares += data["shares"] as? Int ?? 0
        viewsDelta24h += data["viewsDelta24h"] as? Int ?? 0
        viewsDelta7d += data["viewsDelta7d"] as? Int ?? 0
        viewsDelta30d += data["viewsDelta30d"] as? Int ?? 0
    }
    
    return DashboardKPIs(
        totalVideos: videos.count,
        totalViews: totalViews,
        totalLikes: totalLikes,
        totalComments: totalComments,
        totalShares: totalShares,
        viewsDelta24h: viewsDelta24h,
        viewsDelta7d: viewsDelta7d,
        viewsDelta30d: viewsDelta30d,
        engagementRate: totalViews > 0 ? Double(totalLikes + totalComments) / Double(totalViews) * 100 : 0
    )
}
```

### Build Time-Series Data for Charts

```swift
func buildTimeSeriesData(
    videos: [Video],
    metric: String,  // "views", "likes", "comments"
    startDate: Date,
    endDate: Date,
    intervalType: String  // "day", "week", "month"
) -> [ChartDataPoint] {
    
    var dataPoints: [ChartDataPoint] = []
    
    // Generate date intervals
    let intervals = generateIntervals(start: startDate, end: endDate, type: intervalType)
    
    for interval in intervals {
        var intervalValue = 0
        
        for video in videos {
            // Check if video was uploaded in this interval
            if video.uploadDate >= interval.start && video.uploadDate <= interval.end {
                // New video - add its initial metrics
                intervalValue += video.snapshots?.first(where: { $0.isInitialSnapshot == true })?[metric] ?? video[metric]
            } else if video.uploadDate < interval.start {
                // Existing video - calculate growth during this interval
                let sortedSnapshots = video.snapshots?.sorted { $0.capturedAt < $1.capturedAt } ?? []
                
                // Find snapshot at interval start
                let startSnapshot = sortedSnapshots.last { $0.capturedAt <= interval.start }
                // Find snapshot at interval end
                let endSnapshot = sortedSnapshots.last { $0.capturedAt <= interval.end }
                
                if let start = startSnapshot, let end = endSnapshot {
                    let growth = max(0, end[metric] - start[metric])
                    intervalValue += growth
                }
            }
        }
        
        dataPoints.append(ChartDataPoint(
            date: interval.start,
            value: intervalValue
        ))
    }
    
    return dataPoints
}
```

---

## 11. Real-Time Listeners

### Listen for Video Updates (Live Dashboard)

```swift
// iOS
var listener: ListenerRegistration?

func startListeningToVideos(orgId: String, projectId: String, onChange: @escaping ([Video]) -> Void) {
    listener = db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("videos")
        .order(by: "dateSubmitted", descending: true)
        .addSnapshotListener { snapshot, error in
            guard let documents = snapshot?.documents else { return }
            
            let videos = documents.compactMap { doc -> Video? in
                try? doc.data(as: Video.self)
            }
            onChange(videos)
        }
}

func stopListening() {
    listener?.remove()
}
```

```kotlin
// Android
private var listener: ListenerRegistration? = null

fun startListeningToVideos(orgId: String, projectId: String, onChange: (List<Video>) -> Unit) {
    listener = db.collection("organizations")
        .document(orgId)
        .collection("projects")
        .document(projectId)
        .collection("videos")
        .orderBy("dateSubmitted", Query.Direction.DESCENDING)
        .addSnapshotListener { snapshot, error ->
            if (error != null) return@addSnapshotListener
            
            val videos = snapshot?.documents?.mapNotNull { doc ->
                doc.toObject(Video::class.java)
            } ?: emptyList()
            
            onChange(videos)
        }
}

fun stopListening() {
    listener?.remove()
}
```

---

## 12. Platform Breakdown Query

```swift
func getPlatformBreakdown(videos: [Video]) -> PlatformBreakdown {
    var breakdown: [String: PlatformStats] = [:]
    
    for video in videos {
        let platform = video.platform
        
        if breakdown[platform] == nil {
            breakdown[platform] = PlatformStats(
                videoCount: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0
            )
        }
        
        breakdown[platform]!.videoCount += 1
        breakdown[platform]!.totalViews += video.views
        breakdown[platform]!.totalLikes += video.likes
        breakdown[platform]!.totalComments += video.comments
    }
    
    return PlatformBreakdown(
        tiktok: breakdown["tiktok"] ?? PlatformStats.empty,
        instagram: breakdown["instagram"] ?? PlatformStats.empty,
        youtube: breakdown["youtube"] ?? PlatformStats.empty,
        twitter: breakdown["twitter"] ?? PlatformStats.empty
    )
}
```

---

## 13. Date Filter Periods

ViewTrack supports these date filters for KPIs:

| Filter | Current Period | Previous Period (for comparison) |
|--------|---------------|----------------------------------|
| Today | Today | Yesterday |
| Yesterday | Yesterday | Day before |
| Last 7 Days | Past 7 days | Previous 7 days |
| Last 14 Days | Past 14 days | Previous 14 days |
| Last 30 Days | Past 30 days | Previous 30 days |
| Last 90 Days | Past 90 days | Previous 90 days |
| MTD | Month to date | Same period last month |
| YTD | Year to date | Same period last year |
| Custom | Custom range | Same length before range |
| All Time | All data | No comparison |

---

## Quick Reference: Collection Paths

| Data | Firestore Path |
|------|----------------|
| User profile | `users/{userId}` |
| Organization | `organizations/{orgId}` |
| Team members | `organizations/{orgId}/members/{userId}` |
| Projects | `organizations/{orgId}/projects/{projectId}` |
| Tracked accounts | `organizations/{orgId}/projects/{projectId}/trackedAccounts/{accountId}` |
| Videos | `organizations/{orgId}/projects/{projectId}/videos/{videoId}` |
| Video snapshots | `organizations/{orgId}/projects/{projectId}/videos/{videoId}/snapshots/{snapshotId}` |
| Links | `organizations/{orgId}/projects/{projectId}/links/{linkId}` |
| Link clicks | `organizations/{orgId}/projects/{projectId}/links/{linkId}/clicks/{clickId}` |
| Creators | `organizations/{orgId}/projects/{projectId}/creators/{creatorId}` |
| Payouts | `organizations/{orgId}/projects/{projectId}/creators/{creatorId}/payouts/{payoutId}` |

---

## Summary: What You Need for Each Screen

### Dashboard Screen
```
GET: /organizations/{orgId}/projects/{projectId}/videos
     → Calculate totals, deltas, platform breakdown
```

### Accounts List
```
GET: /organizations/{orgId}/projects/{projectId}/trackedAccounts
     → Show creator cards with stats
```

### Account Detail
```
GET: /organizations/{orgId}/projects/{projectId}/trackedAccounts/{accountId}
GET: /organizations/{orgId}/projects/{projectId}/videos WHERE uploaderHandle == username
     → Show account stats + their videos
```

### Video Detail + Growth Chart
```
GET: /organizations/{orgId}/projects/{projectId}/videos/{videoId}
GET: /organizations/{orgId}/projects/{projectId}/videos/{videoId}/snapshots
     → Show current metrics + historical chart
```

### Links Analytics
```
GET: /organizations/{orgId}/projects/{projectId}/links
GET: /organizations/{orgId}/projects/{projectId}/links/{linkId}/clicks
     → Show click stats + breakdown
```

---

*Last updated: February 2026*
