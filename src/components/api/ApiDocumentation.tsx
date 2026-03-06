import React, { useState } from 'react';
import { Copy, Check, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Full API Docs (plain text) ─────────────────────────
// This is the full documentation blob that can be copied and sent to an AI.

const FULL_API_DOCS = `
# ViewTrack API Documentation
Base URL: https://viewtrack.app/api/v1

## Authentication
Every request requires an \`x-api-key\` header containing a valid API key.

\`\`\`
x-api-key: vt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

API keys are scoped with permissions. Each key can have any combination of:
- videos:read — Read video data
- videos:write — Add/delete videos
- accounts:read — Read account data
- accounts:write — Add/delete accounts
- analytics:read — Read analytics & refresh history
- projects:read — List projects
- projects:write — Create projects
- organizations:read — Read org-level data

Rate Limit: 100 requests per minute per API key.
Rate limit headers are included in every response:
- X-RateLimit-Limit
- X-RateLimit-Remaining
- X-RateLimit-Reset (ISO timestamp)

## Response Format
All responses follow this shape:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": { ... }  // optional
}
\`\`\`

Error responses:
\`\`\`json
{
  "success": false,
  "error": {
    "message": "Human readable error",
    "code": "ERROR_CODE"
  }
}
\`\`\`

Error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, ALREADY_EXISTS, RATE_LIMITED, METHOD_NOT_ALLOWED, INTERNAL_ERROR

---

## Endpoints

### 1. Videos

#### GET /api/v1/videos
List all tracked videos across the organization or a specific project.

Required scope: \`videos:read\`

Query parameters:
| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| projectId | string | no       | —       | Filter to a specific project |
| platform  | string | no       | —       | Filter by platform: tiktok, instagram, youtube, twitter |
| status    | string | no       | —       | Filter by status: active, processing, error |
| sortBy    | string | no       | uploadDate | Sort field: uploadDate, views, likes, comments |
| sortOrder | string | no       | desc    | Sort order: asc, desc |
| limit     | number | no       | 50      | Max results (capped at 100) |
| offset    | number | no       | 0       | Pagination offset |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "abc123",
        "projectId": "proj_1",
        "url": "https://tiktok.com/@user/video/123",
        "platform": "tiktok",
        "thumbnail": "https://storage.googleapis.com/...",
        "title": "Video title",
        "caption": "Full caption text",
        "uploaderHandle": "username",
        "views": 150000,
        "likes": 5000,
        "comments": 200,
        "shares": 300,
        "status": "active",
        "uploadDate": "2025-06-15T12:00:00.000Z",
        "lastRefreshed": "2025-06-20T17:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 128,
      "hasMore": true
    }
  }
}
\`\`\`

---

#### POST /api/v1/videos
Add a video to track. Supports both async and sync modes.

Required scope: \`videos:write\`

Request body:
| Field     | Type    | Required | Description |
|-----------|---------|----------|-------------|
| url       | string  | yes      | Full video URL (TikTok, Instagram, YouTube, or Twitter) |
| projectId | string  | yes*     | Target project ID (* not needed if API key is scoped to a project) |
| sync      | boolean | no       | Set true to wait up to 90 seconds for full data |

**Async mode (default):**
Returns immediately with status "processing" or "queued". Poll GET /api/v1/videos/:id for the final result.

\`\`\`json
// Request
POST /api/v1/videos
{
  "url": "https://www.tiktok.com/@user/video/7612046529016106247",
  "projectId": "wQyFcJ5xrAnMbKYQKMw8"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "id": "0McBqCRBqV3jfIIQSh53",
    "url": "https://www.tiktok.com/@user/video/7612046529016106247",
    "platform": "tiktok",
    "status": "processing",
    "jobId": "HddMhNz62IZJGeV20gtp",
    "message": "Video dispatched for immediate processing. Metrics typically available within 30-60 seconds.",
    "endpoints": {
      "poll": "/api/v1/videos/0McBqCRBqV3jfIIQSh53?projectId=wQyFcJ5xrAnMbKYQKMw8"
    }
  }
}
\`\`\`

**Sync mode (sync: true):**
Waits up to 90 seconds for Apify to scrape the video. Returns full data when ready.

\`\`\`json
// Request
POST /api/v1/videos
{
  "url": "https://www.tiktok.com/@user/video/7612046529016106247",
  "projectId": "wQyFcJ5xrAnMbKYQKMw8",
  "sync": true
}

// Response (201 Created) — if ready within 90s
{
  "success": true,
  "data": {
    "id": "0McBqCRBqV3jfIIQSh53",
    "projectId": "wQyFcJ5xrAnMbKYQKMw8",
    "url": "https://www.tiktok.com/@user/video/7612046529016106247",
    "platform": "tiktok",
    "thumbnail": "https://storage.googleapis.com/...",
    "title": "My viral video",
    "caption": "Full caption here",
    "uploaderHandle": "user",
    "metrics": {
      "views": 715800,
      "likes": 10100,
      "comments": 184,
      "shares": 162,
      "saves": 421
    },
    "status": "active",
    "uploadDate": "2025-02-04T00:00:00.000Z",
    "lastRefreshed": "2025-06-20T17:00:00.000Z"
  },
  "meta": {
    "sync": true,
    "processingTimeMs": 32000
  }
}

// Response (202 Accepted) — if still processing after 90s
{
  "success": true,
  "data": {
    "id": "0McBqCRBqV3jfIIQSh53",
    "url": "...",
    "platform": "tiktok",
    "status": "processing",
    "jobId": "HddMhNz62IZJGeV20gtp",
    "message": "Video is still processing. Poll GET /api/v1/videos/:id for the final result.",
    "retryAfter": 30,
    "endpoints": { "poll": "/api/v1/videos/0McBqCRBqV3jfIIQSh53?projectId=..." }
  },
  "meta": { "sync": true, "processingTimeMs": 90000, "timedOut": true }
}
\`\`\`

Duplicate detection: If the URL is already tracked, returns 409 (async) or 200 with existing data (sync).

---

#### GET /api/v1/videos/:id
Get full details for a single video including optional snapshot history.

Required scope: \`videos:read\`

Query parameters:
| Parameter         | Type    | Required | Description |
|-------------------|---------|----------|-------------|
| projectId         | string  | no       | Speeds up lookup if provided |
| includeSnapshots  | boolean | no       | Set "true" to include metric snapshots history |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "id": "abc123",
    "projectId": "proj_1",
    "url": "https://tiktok.com/@user/video/123",
    "platform": "tiktok",
    "thumbnail": "https://storage.googleapis.com/...",
    "title": "Video title",
    "caption": "Full caption",
    "uploaderHandle": "username",
    "uploaderProfilePicture": "https://storage.googleapis.com/...",
    "metrics": {
      "views": 150000,
      "likes": 5000,
      "comments": 200,
      "shares": 300,
      "saves": 100
    },
    "growth": {
      "views": 5000,
      "likes": 200,
      "comments": 10,
      "period": {
        "from": "2025-06-19T17:00:00.000Z",
        "to": "2025-06-20T17:00:00.000Z"
      }
    },
    "status": "active",
    "syncStatus": "completed",
    "uploadDate": "2025-06-15T12:00:00.000Z",
    "lastRefreshed": "2025-06-20T17:00:00.000Z",
    "createdAt": "2025-06-15T14:30:00.000Z",
    "snapshots": [
      {
        "id": "snap_1",
        "views": 150000,
        "likes": 5000,
        "comments": 200,
        "shares": 300,
        "capturedAt": "2025-06-20T17:00:00.000Z"
      }
    ]
  }
}
\`\`\`

---

#### DELETE /api/v1/videos/:id
Remove a video from tracking.

Required scope: \`videos:write\`

Response:
\`\`\`json
{ "success": true, "message": "Video removed from tracking" }
\`\`\`

---

### 2. Accounts

#### GET /api/v1/accounts
List all tracked creator accounts.

Required scope: \`accounts:read\`

Query parameters:
| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| projectId | string | no       | —       | Filter to a specific project |
| platform  | string | no       | —       | Filter: tiktok, instagram, youtube, twitter |
| limit     | number | no       | 50      | Max results (capped at 100) |
| offset    | number | no       | 0       | Pagination offset |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "GGSW1i24XH9ejTCk1OnJ",
        "username": "username",
        "platform": "tiktok",
        "profilePicture": "https://storage.googleapis.com/...",
        "followerCount": 20780,
        "totalVideos": 10,
        "totalViews": 948915,
        "totalLikes": 5399,
        "maxVideos": 10,
        "status": "active",
        "lastSyncedAt": "2025-06-20T17:00:00.000Z",
        "createdAt": "2025-06-15T14:30:00.000Z"
      }
    ],
    "pagination": { "limit": 50, "offset": 0, "total": 12, "hasMore": false }
  }
}
\`\`\`

---

#### POST /api/v1/accounts
Add a creator account to track, or trigger re-discovery on an existing account. Automatically syncs the latest videos.

If the account already exists, a **re-discovery** is launched instead (HTTP 200). This fetches the latest videos without creating a duplicate. Project stats and usage counters are updated atomically.

Required scope: \`accounts:write\`

Request body:
| Field     | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| username  | string | yes      | —       | Creator username (with or without @) |
| platform  | string | yes      | —       | Platform: tiktok, instagram, youtube, twitter |
| projectId | string | yes*     | —       | Target project (* not needed if key is project-scoped) |
| maxVideos | number | no       | 10      | Number of recent videos to fetch (1-50) |

\`\`\`json
// Request
POST /api/v1/accounts
{
  "username": "@simonecanciello",
  "platform": "twitter",
  "projectId": "wQyFcJ5xrAnMbKYQKMw8",
  "maxVideos": 10
}

// Response — NEW account (201 Created)
{
  "success": true,
  "data": {
    "id": "twitter_simonecanciello",
    "username": "simonecanciello",
    "platform": "twitter",
    "maxVideos": 10,
    "status": "processing",
    "jobId": "xUGS0oBqHzdG2jBTTXGg",
    "isExisting": false,
    "message": "Account @simonecanciello created & dispatched. Up to 10 videos will be fetched.",
    "endpoints": {
      "poll": "/api/v1/accounts/twitter_simonecanciello?projectId=wQyFcJ5xrAnMbKYQKMw8"
    }
  }
}

// Response — EXISTING account re-discovery (200 OK)
{
  "success": true,
  "data": {
    "id": "twitter_simonecanciello",
    "username": "simonecanciello",
    "platform": "twitter",
    "maxVideos": 10,
    "status": "processing",
    "jobId": "abc123",
    "isExisting": true,
    "message": "Re-discovery launched for @simonecanciello. Up to 10 newest videos will be checked.",
    "endpoints": {
      "poll": "/api/v1/accounts/twitter_simonecanciello?projectId=wQyFcJ5xrAnMbKYQKMw8"
    }
  }
}
\`\`\`

Processing: The account sync runs in the background. Poll GET /api/v1/accounts/:id to check when it's complete. Typically takes 15-60 seconds depending on the platform and number of videos.

---

#### GET /api/v1/accounts/:id
Get full details for a single account.

Required scope: \`accounts:read\`

Query parameters:
| Parameter     | Type    | Required | Description |
|---------------|---------|----------|-------------|
| includeVideos | boolean | no       | Set "true" to include the account's tracked videos |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "id": "GGSW1i24XH9ejTCk1OnJ",
    "username": "simonecanciello",
    "platform": "twitter",
    "profilePicture": "https://storage.googleapis.com/...",
    "followerCount": 20780,
    "totalVideos": 10,
    "totalViews": 948915,
    "totalLikes": 5399,
    "totalComments": 120,
    "syncStatus": "completed",
    "lastSyncedAt": "2025-06-20T17:00:00.000Z",
    "createdAt": "2025-06-15T14:30:00.000Z",
    "videos": [
      {
        "id": "vid_1",
        "url": "https://twitter.com/user/status/123",
        "thumbnail": "...",
        "title": "Tweet text",
        "views": 50000,
        "likes": 200,
        "comments": 10,
        "uploadDate": "2025-06-10T12:00:00.000Z"
      }
    ]
  }
}
\`\`\`

---

#### DELETE /api/v1/accounts/:id
Remove a tracked account.

Required scope: \`accounts:write\`

Response:
\`\`\`json
{ "success": true, "message": "Account removed from tracking" }
\`\`\`

---

### 3. Projects

#### GET /api/v1/projects
List all projects in the organization. Includes account and video counts.

Required scope: \`projects:read\`

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "wQyFcJ5xrAnMbKYQKMw8",
        "name": "My Project",
        "description": "Campaign tracking",
        "color": "#3B82F6",
        "isArchived": false,
        "accountCount": 12,
        "videoCount": 128,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-06-20T17:00:00.000Z"
      }
    ],
    "total": 3
  }
}
\`\`\`

---

#### POST /api/v1/projects
Create a new project. Initializes all subcollections and updates org project count atomically.

Required scope: \`projects:write\`
Note: Cannot be used with project-scoped API keys.

Request body:
| Field       | Type   | Required | Description |
|-------------|--------|----------|-------------|
| name        | string | yes      | Project name (must be unique within org) |
| description | string | no       | Project description |
| color       | string | no       | Hex color code (e.g. "#3B82F6") |

\`\`\`json
// Request
POST /api/v1/projects
{
  "name": "Q3 Campaign",
  "description": "Summer 2025 influencer campaign",
  "color": "#10B981"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "id": "newProjectId123",
    "name": "Q3 Campaign",
    "description": "Summer 2025 influencer campaign",
    "color": "#10B981",
    "isArchived": false,
    "createdAt": "2025-06-20T17:00:00.000Z",
    "message": "Project created successfully. Use this project ID when adding accounts or videos."
  }
}
\`\`\`

---

### 4. Analytics

#### GET /api/v1/analytics/overview
Get aggregated analytics across all tracked content.

Required scope: \`analytics:read\`

Query parameters:
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| projectId | string | no       | Scope to a specific project |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "totalAccounts": 12,
    "totalVideos": 128,
    "totalViews": 5400000,
    "totalLikes": 180000,
    "totalComments": 12000,
    "totalShares": 8000,
    "platformBreakdown": {
      "tiktok": { "accounts": 5, "videos": 60, "views": 3000000 },
      "instagram": { "accounts": 4, "videos": 40, "views": 1500000 },
      "youtube": { "accounts": 2, "videos": 20, "views": 800000 },
      "twitter": { "accounts": 1, "videos": 8, "views": 100000 }
    },
    "topPerformingVideos": [...],
    "topCreators": [...],
    "recentActivity": [...]
  }
}
\`\`\`

---

### 5. Refresh History

#### GET /api/v1/refreshes
Get historical refresh session data (when ViewTrack last refreshed your metrics).

Required scope: \`analytics:read\`

Query parameters:
| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| startDate | string | no       | —       | ISO date filter start (e.g. "2025-01-01") |
| endDate   | string | no       | —       | ISO date filter end |
| limit     | number | no       | 20      | Max results (capped at 100) |
| offset    | number | no       | 0       | Pagination offset |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_1",
        "status": "completed",
        "startedAt": "2025-06-20T17:00:00.000Z",
        "completedAt": "2025-06-20T17:15:00.000Z",
        "durationMs": 900000,
        "totalAccounts": 12,
        "processedAccounts": 12,
        "failedAccounts": 0,
        "totalVideosRefreshed": 128,
        "totalNewVideosFound": 3,
        "errors": [],
        "accountResults": [...]
      }
    ],
    "summary": {
      "totalRefreshes": 30,
      "totalVideosRefreshed": 3840,
      "totalNewVideos": 45,
      "totalFailures": 2
    },
    "pagination": { "limit": 20, "offset": 0, "total": 30, "hasMore": true }
  }
}
\`\`\`

---

## Common Workflows

### Workflow 1: Track a new video and get its data
\`\`\`
1. POST /api/v1/videos  { url, projectId, sync: true }
   → Waits up to 90s, returns full metrics when ready

2. If 202 (still processing):
   → Wait retryAfter seconds
   → GET /api/v1/videos/:id?includeSnapshots=true
   → Repeat until status is "active"
\`\`\`

### Workflow 2: Track a creator account
\`\`\`
1. POST /api/v1/accounts  { username, platform, projectId, maxVideos: 10 }
   → Returns account ID and job ID

2. Poll: GET /api/v1/accounts/:id?includeVideos=true
   → When syncStatus is "completed", all videos are available

3. List videos: GET /api/v1/videos?projectId=xxx
   → All synced videos appear here
\`\`\`

### Workflow 3: Set up a new project
\`\`\`
1. POST /api/v1/projects  { name: "My Campaign" }
   → Returns project ID

2. POST /api/v1/accounts  { username: "@creator", platform: "tiktok", projectId: "<id>" }
   → Add creators to the project

3. POST /api/v1/videos  { url: "...", projectId: "<id>", sync: true }
   → Add individual videos
\`\`\`

### Workflow 4: Get analytics dashboard data
\`\`\`
1. GET /api/v1/analytics/overview?projectId=xxx
   → Full stats with platform breakdown, top performers, recent activity

2. GET /api/v1/refreshes?startDate=2025-06-01&endDate=2025-06-30
   → See when data was last refreshed and any failures
\`\`\`

---

## HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200  | Success |
| 201  | Created (new resource) |
| 202  | Accepted (processing, not yet complete) |
| 400  | Bad request (validation error) |
| 401  | Unauthorized (invalid or missing API key) |
| 403  | Forbidden (missing required scope) |
| 404  | Not found |
| 405  | Method not allowed |
| 409  | Conflict (duplicate resource) |
| 429  | Rate limited (wait and retry) |
| 500  | Server error |

## Supported Platforms
- TikTok: tiktok.com, vt.tiktok.com
- Instagram: instagram.com (Reels, Posts)
- YouTube: youtube.com, youtu.be (Shorts, Videos)
- Twitter/X: twitter.com, x.com

## Notes
- Metrics are automatically refreshed once per day at 12:00 PM EST (17:00 UTC).
- Snapshots (historical metrics) are created on each refresh, enabling growth tracking.
- Thumbnails and profile pictures are stored on Firebase Storage for permanent URLs.
- The API processes videos using Apify scrapers. Processing time varies: TikTok ~30s, Instagram ~30-60s, YouTube ~15s, Twitter ~10s.
- All timestamps are returned in ISO 8601 format (UTC).
`.trim();

// ─── Component ──────────────────────────────────────────

const ApiDocumentation: React.FC = () => {
  const [showDocs, setShowDocs] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyDocs = () => {
    navigator.clipboard.writeText(FULL_API_DOCS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="mb-8">
      <button
        onClick={() => setShowDocs(!showDocs)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-all"
      >
        <BookOpen className="w-4 h-4" />
        {showDocs ? (
          <><ChevronDown className="w-3 h-3" /> Hide Full API Documentation</>
        ) : (
          <><ChevronRight className="w-3 h-3" /> Show Full API Documentation</>
        )}
      </button>

      {showDocs && (
        <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center border border-blue-500/20">
                <BookOpen className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">API Documentation</h3>
                <p className="text-[11px] text-gray-500">
                  Copy & send to your AI or integration partner
                </p>
              </div>
            </div>
            <button
              onClick={copyDocs}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5" /> Copied!</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy All</>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap leading-relaxed">
              {FULL_API_DOCS}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiDocumentation;
