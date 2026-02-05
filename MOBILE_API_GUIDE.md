# ViewTrack Mobile App Development Guide

This guide explains how to build a mobile app that integrates with the ViewTrack API.

---

## What is ViewTrack?

**ViewTrack** is a short-form video analytics platform that helps users track performance metrics across multiple social media platforms:

- **TikTok**
- **Instagram Reels**
- **YouTube Shorts**
- **Twitter/X**

### Core Features

| Feature | Description |
|---------|-------------|
| **Track Accounts** | Monitor any creator's account and automatically fetch all their videos |
| **Track Videos** | Add individual video URLs to track their metrics over time |
| **Analytics** | View aggregated stats: views, likes, comments, shares, engagement rates |
| **Historical Data** | Snapshots track how metrics change over time (growth charts) |
| **Multi-Project** | Organize tracking into separate projects (e.g., by campaign, client) |
| **Team Collaboration** | Invite team members with role-based permissions |

---

## API Overview

**Base URL:** `https://viewtrack.app/api/v1`

**Authentication:** API Key via `x-api-key` header

**Response Format:** JSON

```json
{
  "success": true,
  "data": { ... }
}
```

**Error Format:**
```json
{
  "success": false,
  "error": {
    "message": "Description of error",
    "code": "ERROR_CODE"
  }
}
```

---

## Authentication

### Getting an API Key

1. Log into ViewTrack web dashboard
2. Go to **Settings → API Keys**
3. Click **Create API Key**
4. Select permissions (scopes) needed
5. Copy the key immediately (shown only once!)

### Using the API Key

Include the key in every request header:

```
x-api-key: vt_live_xxxxxxxxxxxxxxxxxxxx
```

### Available Scopes (Permissions)

| Scope | Description |
|-------|-------------|
| `accounts:read` | View tracked accounts |
| `accounts:write` | Add/remove tracked accounts |
| `videos:read` | View tracked videos |
| `videos:write` | Add/remove tracked videos |
| `analytics:read` | View analytics data |
| `projects:read` | View projects |
| `projects:write` | Create/update projects |
| `organizations:read` | View organization info |

### Rate Limiting

- Default: **100 requests per minute** per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Max requests per window
  - `X-RateLimit-Remaining`: Requests left
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## API Endpoints

### 1. Accounts

#### List All Tracked Accounts

```http
GET /api/v1/accounts
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project (optional) |
| `platform` | string | Filter by platform: `tiktok`, `instagram`, `youtube`, `twitter` |
| `limit` | number | Results per page (max 100, default 50) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "abc123",
        "username": "creator_handle",
        "platform": "tiktok",
        "profilePicture": "https://...",
        "followerCount": 150000,
        "totalVideos": 42,
        "totalViews": 5000000,
        "totalLikes": 300000,
        "lastSyncedAt": "2026-02-01T10:30:00Z",
        "createdAt": "2026-01-15T08:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 15,
      "hasMore": false
    }
  }
}
```

#### Add Tracked Account

```http
POST /api/v1/accounts
```

**Required Scope:** `accounts:write`

**Request Body:**
```json
{
  "username": "creator_handle",
  "platform": "tiktok",
  "projectId": "project_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new_account_id",
    "username": "creator_handle",
    "platform": "tiktok",
    "status": "pending",
    "syncStatus": "pending"
  },
  "message": "Account added. Data will be synced shortly."
}
```

#### Get Account Details

```http
GET /api/v1/accounts/{id}
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `includeVideos` | boolean | Include account's videos in response |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "username": "creator_handle",
    "platform": "tiktok",
    "profilePicture": "https://...",
    "followerCount": 150000,
    "totalVideos": 42,
    "totalViews": 5000000,
    "totalLikes": 300000,
    "totalComments": 50000,
    "syncStatus": "completed",
    "lastSyncedAt": "2026-02-01T10:30:00Z",
    "createdAt": "2026-01-15T08:00:00Z",
    "videos": [
      {
        "id": "vid_001",
        "url": "https://tiktok.com/...",
        "thumbnail": "https://...",
        "title": "Video title",
        "views": 100000,
        "likes": 5000,
        "comments": 200,
        "uploadDate": "2026-01-20T15:00:00Z"
      }
    ]
  }
}
```

#### Delete Account

```http
DELETE /api/v1/accounts/{id}
```

**Required Scope:** `accounts:write`

**Response:**
```json
{
  "success": true,
  "message": "Account removed from tracking"
}
```

---

### 2. Videos

#### List All Tracked Videos

```http
GET /api/v1/videos
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project |
| `platform` | string | Filter by platform |
| `status` | string | Filter by status: `pending`, `approved`, `rejected` |
| `sortBy` | string | Sort field: `uploadDate`, `views`, `likes` |
| `sortOrder` | string | `asc` or `desc` |
| `limit` | number | Results per page (max 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "vid_001",
        "projectId": "proj_123",
        "url": "https://tiktok.com/@user/video/123",
        "platform": "tiktok",
        "thumbnail": "https://...",
        "title": "Amazing video title",
        "caption": "Full video description...",
        "uploaderHandle": "creator_handle",
        "views": 500000,
        "likes": 25000,
        "comments": 1200,
        "shares": 3000,
        "status": "approved",
        "uploadDate": "2026-01-25T12:00:00Z",
        "lastRefreshed": "2026-02-01T08:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 100,
      "hasMore": true
    }
  }
}
```

#### Add Video to Track

```http
POST /api/v1/videos
```

**Required Scope:** `videos:write`

**Request Body:**
```json
{
  "url": "https://www.tiktok.com/@creator/video/1234567890",
  "projectId": "project_123"
}
```

**Supported URL Formats:**
- TikTok: `https://www.tiktok.com/@user/video/123456`
- Instagram: `https://www.instagram.com/reel/ABC123/`
- YouTube: `https://youtube.com/shorts/ABC123` or `https://youtu.be/ABC123`
- Twitter: `https://twitter.com/user/status/123456` or `https://x.com/user/status/123456`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new_video_id",
    "url": "https://www.tiktok.com/@creator/video/1234567890",
    "platform": "tiktok",
    "status": "pending",
    "message": "Video added. Metrics will be fetched shortly."
  }
}
```

#### Get Video Details

```http
GET /api/v1/videos/{id}
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `includeSnapshots` | boolean | Include historical metric snapshots |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "vid_001",
    "projectId": "proj_123",
    "url": "https://tiktok.com/@user/video/123",
    "platform": "tiktok",
    "thumbnail": "https://...",
    "title": "Video title",
    "caption": "Full description...",
    "uploaderHandle": "creator_handle",
    "uploaderProfilePicture": "https://...",
    "metrics": {
      "views": 500000,
      "likes": 25000,
      "comments": 1200,
      "shares": 3000,
      "saves": 800
    },
    "growth": {
      "views": 15000,
      "likes": 800,
      "comments": 50,
      "period": {
        "from": "2026-01-31T08:00:00Z",
        "to": "2026-02-01T08:00:00Z"
      }
    },
    "status": "approved",
    "syncStatus": "completed",
    "uploadDate": "2026-01-25T12:00:00Z",
    "lastRefreshed": "2026-02-01T08:00:00Z",
    "createdAt": "2026-01-26T10:00:00Z",
    "snapshots": [
      {
        "id": "snap_001",
        "views": 500000,
        "likes": 25000,
        "comments": 1200,
        "shares": 3000,
        "capturedAt": "2026-02-01T08:00:00Z"
      },
      {
        "id": "snap_002",
        "views": 485000,
        "likes": 24200,
        "comments": 1150,
        "shares": 2900,
        "capturedAt": "2026-01-31T08:00:00Z"
      }
    ]
  }
}
```

#### Delete Video

```http
DELETE /api/v1/videos/{id}
```

**Required Scope:** `videos:write`

**Response:**
```json
{
  "success": true,
  "message": "Video removed from tracking"
}
```

---

### 3. Analytics

#### Get Analytics Overview

```http
GET /api/v1/analytics/overview
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project (optional) |

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAccounts": 25,
      "totalVideos": 342,
      "totalViews": 15000000,
      "totalLikes": 850000,
      "totalComments": 45000,
      "totalShares": 120000
    },
    "averages": {
      "viewsPerVideo": 43859,
      "likesPerVideo": 2485,
      "engagementRate": "5.97%"
    },
    "platformBreakdown": {
      "tiktok": {
        "accounts": 10,
        "videos": 150,
        "views": 8000000
      },
      "instagram": {
        "accounts": 8,
        "videos": 120,
        "views": 5000000
      },
      "youtube": {
        "accounts": 5,
        "videos": 60,
        "views": 1500000
      },
      "twitter": {
        "accounts": 2,
        "videos": 12,
        "views": 500000
      }
    },
    "topPerformingVideos": [
      {
        "id": "vid_001",
        "title": "Viral video title",
        "platform": "tiktok",
        "thumbnail": "https://...",
        "uploaderHandle": "top_creator",
        "views": 2500000,
        "likes": 150000
      }
    ],
    "topCreators": [
      {
        "username": "top_creator",
        "platform": "tiktok",
        "profilePicture": "https://...",
        "totalViews": 5000000,
        "totalVideos": 50,
        "followerCount": 500000
      }
    ],
    "recentActivity": [
      {
        "id": "vid_newest",
        "title": "Latest video",
        "platform": "instagram",
        "uploaderHandle": "creator",
        "views": 10000,
        "uploadDate": "2026-02-01T14:00:00Z"
      }
    ],
    "generatedAt": "2026-02-01T15:30:00Z"
  }
}
```

---

### 4. Projects

#### List All Projects

```http
GET /api/v1/projects
```

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_001",
        "name": "Q1 Campaign",
        "description": "Creator campaign for Q1 2026",
        "accountCount": 15,
        "videoCount": 120,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-02-01T10:00:00Z"
      }
    ],
    "total": 3
  }
}
```

#### Create Project

```http
POST /api/v1/projects
```

**Required Scope:** `projects:write`

**Request Body:**
```json
{
  "name": "Summer Campaign 2026",
  "description": "Track all creator content for summer launch"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new_project_id",
    "name": "Summer Campaign 2026",
    "description": "Track all creator content for summer launch",
    "createdAt": "2026-02-01T16:00:00Z"
  }
}
```

---

## Data Models

### Account

```typescript
interface Account {
  id: string;
  username: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter';
  profilePicture?: string;
  followerCount?: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments?: number;
  syncStatus: 'idle' | 'pending' | 'syncing' | 'completed' | 'failed';
  lastSyncedAt?: string; // ISO date
  createdAt: string;
}
```

### Video

```typescript
interface Video {
  id: string;
  projectId: string;
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
  uploadDate?: string;
  lastRefreshed?: string;
  createdAt: string;
}
```

### VideoSnapshot

```typescript
interface VideoSnapshot {
  id: string;
  views: number;
  likes: number;
  comments: number;
  shares?: number;
  saves?: number;
  capturedAt: string; // ISO date
}
```

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  accountCount: number;
  videoCount: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## Mobile App Implementation Tips

### 1. Authentication Flow

```swift
// iOS Example (Swift)
class ViewTrackAPI {
    private let baseURL = "https://viewtrack.app/api/v1"
    private var apiKey: String
    
    init(apiKey: String) {
        self.apiKey = apiKey
    }
    
    func request<T: Decodable>(_ endpoint: String, method: String = "GET", body: Data? = nil) async throws -> T {
        var request = URLRequest(url: URL(string: "\(baseURL)\(endpoint)")!)
        request.httpMethod = method
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        if httpResponse.statusCode == 429 {
            throw APIError.rateLimited
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```

```kotlin
// Android Example (Kotlin)
class ViewTrackAPI(private val apiKey: String) {
    private val client = OkHttpClient()
    private val baseUrl = "https://viewtrack.app/api/v1"
    
    suspend fun <T> request(endpoint: String, method: String = "GET"): T {
        val request = Request.Builder()
            .url("$baseUrl$endpoint")
            .addHeader("x-api-key", apiKey)
            .addHeader("Content-Type", "application/json")
            .method(method, null)
            .build()
            
        return withContext(Dispatchers.IO) {
            client.newCall(request).execute().use { response ->
                // Parse response
            }
        }
    }
}
```

### 2. Caching Strategy

- Cache account/video lists locally for offline viewing
- Store `lastRefreshed` timestamps to show data freshness
- Implement pull-to-refresh for manual sync
- Background fetch new data periodically

### 3. Key Screens to Build

| Screen | API Calls |
|--------|-----------|
| **Dashboard** | `GET /analytics/overview` |
| **Accounts List** | `GET /accounts` |
| **Account Detail** | `GET /accounts/{id}?includeVideos=true` |
| **Videos List** | `GET /videos` |
| **Video Detail** | `GET /videos/{id}?includeSnapshots=true` |
| **Projects List** | `GET /projects` |
| **Add Account** | `POST /accounts` |
| **Add Video** | `POST /videos` |

### 4. Error Handling

```swift
enum ViewTrackError: Error {
    case unauthorized      // 401 - Invalid API key
    case forbidden         // 403 - Missing scope
    case notFound          // 404 - Resource not found
    case rateLimited       // 429 - Too many requests
    case serverError       // 500 - Internal error
}

// Handle rate limiting with exponential backoff
func handleRateLimitError(retryAfter: Int) {
    DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(retryAfter)) {
        // Retry request
    }
}
```

### 5. Secure API Key Storage

**iOS:** Store in Keychain
```swift
let keychain = Keychain(service: "com.yourapp.viewtrack")
keychain["api_key"] = "vt_live_xxx..."
```

**Android:** Store in EncryptedSharedPreferences
```kotlin
val prefs = EncryptedSharedPreferences.create(
    "viewtrack_prefs",
    masterKeyAlias,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
prefs.edit().putString("api_key", "vt_live_xxx...").apply()
```

---

## Example: Complete Mobile Flow

### 1. User Onboards → Links their ViewTrack account via API key

### 2. Dashboard loads:
```
GET /api/v1/analytics/overview
→ Display summary stats, top videos, platform breakdown
```

### 3. User taps "Accounts":
```
GET /api/v1/accounts?limit=20
→ Show list with profile pics, follower counts
```

### 4. User taps account:
```
GET /api/v1/accounts/{id}?includeVideos=true
→ Show account stats + list of their videos
```

### 5. User adds new video via share sheet:
```
POST /api/v1/videos
{ "url": "https://tiktok.com/...", "projectId": "..." }
→ Confirm added, show pending status
```

### 6. Background refresh:
```
GET /api/v1/videos?sortBy=lastRefreshed&sortOrder=desc&limit=10
→ Update local cache with latest metrics
```

---

## Support

- **API Documentation:** https://viewtrack.app/api-docs
- **Rate Limits:** 100 requests/minute (upgradeable)
- **Contact:** support@viewtrack.app

---

*Last updated: February 2026*
