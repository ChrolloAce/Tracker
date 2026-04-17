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
- videos:analyze — Run paid AI analysis (Gemini 3 Flash) on tracked videos. Kept separate from videos:write so you can gate AI spend independently.
- accounts:read — Read account data
- accounts:write — Add/delete accounts
- analytics:read — Read analytics & refresh history
- projects:read — List projects
- projects:write — Create projects
- organizations:read — Read org-level data
- creators:read — View creator profiles, stats, and leaderboards
- saved:read — Read saved/bookmarked content
- saved:write — Save/unsave videos and manage folders

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
        "transcriptStatus": "completed",
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

The \`transcriptStatus\` field on each video indicates whether a transcript is available. Possible values: \`none\`, \`processing\`, \`completed\`, \`failed\`, \`unavailable\`. To get the full transcript text, call GET /api/v1/videos/:id for that video.
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
Get full details for a single video, including its transcript and optional snapshot history.

**Automatic Transcription:** The first time you fetch a video through this endpoint, ViewTrack automatically generates a transcript. The API will wait up to 25 seconds for the transcript to complete before responding. For most videos (especially YouTube), the transcript is returned in the same response, so you get everything in a single call.

Required scope: \`videos:read\`

Query parameters:
| Parameter         | Type    | Required | Description |
|-------------------|---------|----------|-------------|
| projectId         | string  | no       | Speeds up lookup if provided |
| includeSnapshots  | boolean | no       | Set "true" to include metric snapshots history |

Response (with transcript ready):
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
    "transcription": {
      "status": "completed",
      "transcript": "Hey everyone, welcome back to my channel. Today we are going to talk about...",
      "language": "en",
      "source": "platform_captions",
      "segments": [
        { "start": 0.0, "end": 1.8, "text": "Hey everyone, welcome back to my channel." },
        { "start": 1.8, "end": 4.2, "text": "Today we are going to talk about..." }
      ],
      "wordCount": 342,
      "completedAt": "2025-06-20T17:00:05.000Z"
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

Response (transcript still processing):
If the transcript takes longer than 25 seconds (rare, only for very long videos), the response includes a clear retry instruction:
\`\`\`json
{
  "success": true,
  "data": {
    "id": "abc123",
    "...": "...all other fields...",
    "transcription": {
      "status": "processing",
      "transcript": null,
      "retryAfterSeconds": 10,
      "message": "Transcript is being generated. Retry this same request in 10 seconds."
    }
  }
}
\`\`\`

**Transcription details:**
- The \`transcription\` block is always present in the response, regardless of status.
- The \`transcription.status\` field will be one of: \`completed\`, \`processing\`, \`failed\`, \`unavailable\`, \`none\`.
- When \`status\` is \`completed\`, the \`transcript\` field contains the full text, \`language\` contains the detected language code, and \`segments\` contains timestamped text segments.
- The \`source\` field indicates how the transcript was generated: \`platform_captions\` (free, from YouTube auto-captions) or \`whisper\` (OpenAI Whisper API for TikTok, Instagram, Twitter).
- Transcripts are cached. The first request triggers transcription, and all subsequent requests return the cached transcript instantly.
- YouTube videos use free platform captions when available. All other platforms use OpenAI Whisper for audio transcription.

---

#### DELETE /api/v1/videos/:id
Remove a video from tracking.

Required scope: \`videos:write\`

Response:
\`\`\`json
{ "success": true, "message": "Video removed from tracking" }
\`\`\`

---

#### POST /api/v1-analyze-video
Run AI video analysis powered by Gemini 3 Flash. Returns a structured breakdown of the video: transcript with timestamps, plain-English summary, hook analysis, topics, tone, pacing, what's working, and actionable suggestions for the creator — all in a single call.

> **URL note:** This endpoint lives at \`/api/v1-analyze-video\` (root), not under \`/api/v1/videos/...\`. The flat path lets us bundle a 36 MB video-download binary with this one function only, instead of every \`/api/v1/*\` function. Everything else (auth header, response envelope, rate limits) is identical to the rest of the API.

Required scope: \`videos:analyze\`

This scope is deliberately separate from \`videos:write\` because each fresh call triggers a paid Gemini API request. Issue keys with this scope only to trusted integrations, and prefer \`force: false\` (the default) so repeated calls return cached results instantly.

**Latency expectations:**
| Path | Typical time |
|------|-------------|
| Cached (\`force: false\` and video was previously analyzed) | <500 ms |
| Fresh — YouTube (Gemini fetches URL directly) | 30–60 s |
| Fresh — TikTok / Instagram / Twitter (download → upload → analyze) | 60–180 s |

The endpoint is synchronous — it holds the connection open until Gemini returns. Plan for up to 3 minutes on the first call for a non-YouTube video.

Request body:
| Field     | Type    | Required | Default | Description |
|-----------|---------|----------|---------|-------------|
| videoId   | string  | yes      | —       | ViewTrack video document ID (from GET /api/v1/videos) |
| projectId | string  | no       | —       | Speeds up lookup if you know it. Otherwise we search across all projects in your org. |
| force     | boolean | no       | false   | Always re-run the Gemini analysis even if a cached one exists. Use sparingly — each run costs money. |

Example request:
\`\`\`bash
curl -X POST https://viewtrack.app/api/v1-analyze-video \\
  -H "x-api-key: vt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"videoId": "abc123"}'
\`\`\`

Response (success):
\`\`\`json
{
  "success": true,
  "data": {
    "videoId": "abc123",
    "projectId": "proj_1",
    "analysis": {
      "transcript": "Hey everyone, welcome back. Today we're breaking down the three hooks...",
      "transcriptSegments": [
        { "timestamp": "00:00", "text": "Hey everyone, welcome back." },
        { "timestamp": "00:02", "text": "Today we're breaking down the three hooks..." }
      ],
      "summary": "The creator walks through three pattern-interrupt hooks used in viral short-form video, with a live example for each.",
      "hook": "The video opens with 'most people get this wrong' over a fast-cut compilation, setting up curiosity within the first 2 seconds.",
      "topics": ["short-form video", "hook writing", "TikTok strategy"],
      "tone": "Educational, energetic, conversational",
      "pacing": "Fast — aggressive jump-cuts every 1–2 seconds, on-screen captions reinforce the audio.",
      "whatWorked": [
        "Strong pattern-interrupt hook in the first 2 seconds",
        "Each of the three examples is under 10 seconds, keeping retention high",
        "Clear CTA at the end tied to the creator's profile"
      ],
      "suggestions": [
        "Add a visual countdown to the three examples to reinforce structure",
        "Hold the final frame longer so viewers can screenshot the key insight",
        "Test a version with larger on-screen captions sized for full-screen viewing"
      ],
      "modelVersion": "gemini-3-flash-preview"
    }
  },
  "meta": {
    "cached": false,
    "durationMs": 36114
  }
}
\`\`\`

**Analysis fields:**
| Field | Description |
|-------|-------------|
| transcript | Full spoken audio, verbatim. Empty string if the video has no speech. |
| transcriptSegments | Array of \`{ timestamp, text }\`. Timestamps are \`MM:SS\` and roughly align with scene or sentence boundaries. |
| summary | 2–4 sentence plain-English description of what the video is about. |
| hook | What specifically grabs attention in the first ~3 seconds — visual, verbal, or both. |
| topics | Short list of key topics covered. |
| tone | Overall tone/style — e.g., "educational, conversational" or "emotional, storytelling". |
| pacing | One-sentence read on the edit style and pacing. |
| whatWorked | 3–5 bullets explaining why the video might perform well. |
| suggestions | 3–5 actionable tweaks the creator could apply to future videos. |
| modelVersion | The Gemini model that produced this analysis. Useful for audit trails and deciding when to \`force\` a re-run after a model upgrade. |

**Meta fields:**
| Field | Description |
|-------|-------------|
| meta.cached | \`true\` if the response came from a stored analysis (no new Gemini call). \`false\` means a fresh analysis was just run. |
| meta.durationMs | How long the Gemini work took in milliseconds. \`0\` when \`cached: true\`. |

**Caching behavior:**
- The first call for a given video runs a fresh analysis and stores it on the video document.
- Every subsequent call with \`force: false\` (the default) returns the stored analysis in <500 ms with \`meta.cached: true\` and no Gemini cost.
- \`force: true\` bypasses the cache and always calls Gemini again. Use this when the model version has upgraded or the video's content has materially changed.
- Cached results persist on the video document until the video is deleted.

**Error responses:**

403 — Key lacks the required scope:
\`\`\`json
{ "success": false, "error": { "message": "Missing required scope: videos:analyze", "code": "FORBIDDEN" } }
\`\`\`

404 — videoId doesn't exist in your organization:
\`\`\`json
{ "success": false, "error": { "message": "Video not found", "code": "NOT_FOUND" } }
\`\`\`

409 — A concurrent request is already analyzing this video:
\`\`\`json
{ "success": false, "error": { "message": "Analysis already in progress for this video. Please wait.", "code": "ALREADY_PROCESSING" } }
\`\`\`
Retry the same request after ~30 seconds.

500 — Gemini call failed. The error message preserves the underlying reason (rate limit, blocked content, download failure, etc.). Safe to retry after a brief backoff:
\`\`\`json
{ "success": false, "error": { "message": "Gemini API 429: quota exceeded…", "code": "ANALYSIS_FAILED" } }
\`\`\`

**Common patterns:**
- **Transcript-only workflows:** use GET /api/v1/videos/:id — it returns the transcript faster (25 s max) and is free for YouTube videos.
- **Deep content analysis:** use this endpoint — you get the structured \`hook\`, \`whatWorked\`, and \`suggestions\` fields that the basic transcript endpoint doesn't provide.
- **Feeding LLM prompts:** the \`hook\`, \`pacing\`, and \`whatWorked\` fields are designed to drop directly into a downstream prompt template for script generation or creator coaching.
- **Batch analysis:** process videos serially (not in parallel) to stay within Gemini's rate limits and your own 100 req/min key rate limit.

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
| maxVideos | number | no       | 10      | Number of recent videos to fetch (1-1000) |

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

### 6. Creators

#### GET /api/v1/creators
List all creators in a project with their aggregated stats from linked accounts.

Required scope: \`creators:read\`

Query parameters:
| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| projectId | string | yes*     | —       | Target project (* not needed if API key is project-scoped) |
| limit     | number | no       | 50      | Max results (capped at 100) |
| offset    | number | no       | 0       | Pagination offset |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "creators": [
      {
        "id": "user123",
        "displayName": "Creator Name",
        "email": "creator@example.com",
        "photoURL": "https://...",
        "status": "active",
        "stats": {
          "totalViews": 1500000,
          "totalLikes": 85000,
          "totalComments": 3200,
          "totalShares": 12000,
          "totalVideos": 45,
          "engagementRate": 6.68
        },
        "linkedAccounts": [
          {
            "id": "tiktok_johndoe",
            "username": "johndoe",
            "platform": "tiktok",
            "followerCount": 50000,
            "totalViews": 800000,
            "totalVideos": 25
          }
        ]
      }
    ],
    "pagination": { "limit": 50, "offset": 0, "total": 12, "hasMore": false }
  }
}
\`\`\`

---

#### GET /api/v1/creators/:id
Get full details for a single creator including stats and linked accounts.

Required scope: \`creators:read\`

Query parameters:
| Parameter     | Type    | Required | Description |
|---------------|---------|----------|-------------|
| projectId     | string  | yes*     | Target project (* not needed if API key is project-scoped) |
| includeVideos | boolean | no       | Set "true" to include up to 50 recent videos sorted by views |

Response: Same shape as a single creator object from the list endpoint, plus an optional \`recentVideos\` array when \`includeVideos=true\`.

---

#### GET /api/v1/creators/leaderboard
Get a ranked leaderboard of creators sorted by a chosen metric. Ideal for Discord bots and external integrations.

Required scope: \`creators:read\`

Query parameters:
| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| projectId | string | yes*     | —       | Target project (* not needed if API key is project-scoped) |
| sortBy    | string | no       | views   | Metric to rank by: views, likes, comments, shares, engagement, videos |
| limit     | number | no       | 10      | Number of entries (max 50) |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "creatorId": "user123",
        "displayName": "Top Creator",
        "photoURL": "https://...",
        "score": 2500000,
        "metric": "views",
        "stats": {
          "totalViews": 2500000,
          "totalLikes": 150000,
          "totalComments": 8500,
          "totalShares": 22000,
          "totalVideos": 67,
          "engagementRate": 7.22
        },
        "linkedAccountsCount": 4
      }
    ],
    "meta": {
      "projectId": "proj_1",
      "sortedBy": "views",
      "totalCreators": 25,
      "generatedAt": "2026-04-01T12:00:00.000Z"
    }
  }
}
\`\`\`

---

### 7. Viral Content Library

#### GET /api/v1/viral
Browse the curated viral content library with filtering and pagination.

Required scope: \`analytics:read\`

Query parameters:
| Parameter   | Type   | Required | Default | Description |
|-------------|--------|----------|---------|-------------|
| platform    | string | no       | —       | Filter: tiktok, instagram, youtube |
| category    | string | no       | —       | Filter by category (e.g. "Business & Finance") |
| contentType | string | no       | —       | Filter: video, slideshow |
| tags        | string | no       | —       | Comma-separated tag filter |
| search      | string | no       | —       | Search title, description, handle, tags |
| minViews    | number | no       | —       | Minimum view count |
| maxViews    | number | no       | —       | Maximum view count |
| sortBy      | string | no       | views   | Sort: views, likes, comments, shares, saves, uploadDate, addedAt, order |
| sortOrder   | string | no       | desc    | Sort order: asc, desc |
| limit       | number | no       | 20      | Max results (capped at 100) |
| offset      | number | no       | 0       | Pagination offset |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "abc123",
        "url": "https://tiktok.com/@user/video/123",
        "platform": "tiktok",
        "title": "Video title",
        "description": "Full caption",
        "thumbnail": "https://...",
        "contentType": "video",
        "category": "Business & Finance",
        "tags": ["marketing", "saas"],
        "uploaderHandle": "username",
        "followerCount": 50000,
        "metrics": {
          "views": 1500000,
          "likes": 85000,
          "comments": 3200,
          "shares": 12000,
          "saves": 5000
        },
        "uploadDate": "2026-03-15T12:00:00.000Z",
        "addedAt": "2026-03-20T17:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 1500,
      "returned": 20,
      "hasMore": true
    }
  }
}
\`\`\`


---

### 8. Viral Admin (Admin Only)

These endpoints require the \`viral:write\` scope and are intended for admin use only.

#### POST /api/v1/viral/admin
Add a video to the viral content library. Automatically enriches with real metrics via Apify, transcribes the video, and runs AI analysis in the background.

Required scope: \`viral:write\`

Request body:
| Field          | Type     | Required | Default | Description |
|----------------|----------|----------|---------|-------------|
| url            | string   | yes      | —       | Full video URL |
| platform       | string   | yes      | —       | Platform: tiktok, instagram, youtube, twitter |
| title          | string   | no       | ""      | Video title (auto-filled by scraper if empty) |
| description    | string   | no       | ""      | Caption (auto-filled by scraper if empty) |
| uploaderHandle | string   | no       | ""      | Creator handle (auto-filled by scraper if empty) |
| thumbnail      | string   | no       | ""      | Thumbnail URL (auto-filled by scraper if empty) |
| contentType    | string   | no       | "video" | Content type: video, slideshow |
| category       | string   | no       | ""      | Category name |
| tags           | string[] | no       | []      | Array of tag strings |
| views          | number   | no       | 0       | View count (overwritten by scraper) |
| likes          | number   | no       | 0       | Like count (overwritten by scraper) |
| comments       | number   | no       | 0       | Comment count (overwritten by scraper) |
| shares         | number   | no       | 0       | Share count (overwritten by scraper) |
| saves          | number   | no       | 0       | Save count (overwritten by scraper) |
| followerCount  | number   | no       | 0       | Creator follower count |
| folderId       | string   | no       | —       | Also save to this folder in your org's saved collection |
| enrich         | boolean  | no       | true    | Auto-scrape metrics, transcribe, and AI-analyze |

\`\`\`json
// Request — just a URL and platform, everything else is auto-filled
POST /api/v1/viral/admin
{
  "url": "https://www.tiktok.com/@user/video/123",
  "platform": "tiktok",
  "folderId": "myFolder123"
}

// Response (201 Created) — returns immediately
{
  "success": true,
  "data": {
    "id": "newViralId123",
    "url": "https://www.tiktok.com/@user/video/123",
    "platform": "tiktok",
    "enriching": true,
    "enrichmentStatus": "pending",
    "savedToFolder": "myFolder123"
  }
}
\`\`\`

**Background enrichment pipeline** (runs automatically after response):

1. **Scraping** (\`enrichmentStatus: "scraping"\`) — Calls Apify/YouTube API to fetch real metrics:
   - TikTok: views, likes, comments, shares, saves, thumbnail, handle, follower count, duration, media URL
   - Instagram: same via hpix~ig-reels-scraper
   - YouTube: via YouTube Data API v3
   - Twitter: via gentle_cloud/twitter-tweets-scraper

2. **Transcription** (\`enrichmentStatus: "transcribing"\`):
   - YouTube: free platform captions via innertube API
   - TikTok/Instagram/Twitter: OpenAI Whisper API (downloads video file, transcribes)
   - Stores: full transcript text, language, timestamped segments, word count

3. **AI Analysis** (\`enrichmentStatus: "analyzing"\`) — GPT-4o-mini analyzes the video and returns:
   - \`productDetected\`: boolean — is a product being promoted?
   - \`productName\`: string — the product/brand name
   - \`productType\`: "app", "saas", "physical_product", "digital_product", "service", "course", "supplement", "fashion", "food", "other"
   - \`productCategory\`: specific category (e.g. "fitness app", "AI writing tool")
   - \`contentCategory\`: auto-categorized (Business & Finance, Tech, etc.)
   - \`hook\`: the hook/opening strategy used
   - \`viralFactors\`: 2-4 factors that made it go viral
   - \`targetAudience\`: who the video targets
   - \`contentFormat\`: "talking_head", "tutorial", "storytime", "skit", "product_review", etc.

Final \`enrichmentStatus\`: "completed" or "failed"

Set \`"enrich": false\` to skip all enrichment and just store the raw data.

Duplicate detection: Returns 409 if a video with the same URL already exists.

---

#### DELETE /api/v1/viral/admin?id=xxx
Remove a video from the viral content library.

Required scope: \`viral:write\`

Response:
\`\`\`json
{ "success": true, "data": { "id": "xxx", "deleted": true } }
\`\`\`

---

#### POST /api/v1/viral/admin/cleanup
Batch cleanup dead/broken videos from the viral library. Admin only.

Required scope: \`viral:write\`

---

### 9. Saved Content & Folders

Save/bookmark videos to your organization's personal library, organized into folders.

#### GET /api/v1/saved
List all saved videos, optionally filtered by folder.

Required scope: \`saved:write\`

Query parameters:
| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| folderId  | string | no       | —       | Filter to a specific folder. Use "default" for unsorted |

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": "docId",
        "videoId": "docId",
        "folderId": "default",
        "savedAt": "2026-04-01T12:00:00.000Z",
        "video": {
          "url": "https://tiktok.com/@user/video/123",
          "platform": "tiktok",
          "title": "Saved video",
          "thumbnail": "https://...",
          "views": 500000,
          "likes": 20000
        }
      }
    ],
    "total": 15
  }
}
\`\`\`

---

#### POST /api/v1/saved
Save a video to your library.

Required scope: \`saved:write\`

Request body:
| Field          | Type     | Required | Default   | Description |
|----------------|----------|----------|-----------|-------------|
| url            | string   | yes      | —         | Full video URL |
| platform       | string   | yes      | —         | Platform: tiktok, instagram, youtube, twitter |
| title          | string   | no       | ""        | Video title |
| description    | string   | no       | ""        | Caption |
| uploaderHandle | string   | no       | ""        | Creator handle |
| thumbnail      | string   | no       | ""        | Thumbnail URL |
| contentType    | string   | no       | "video"   | Content type: video, slideshow |
| folderId       | string   | no       | "default" | Folder to save into |

\`\`\`json
// Request
POST /api/v1/saved
{
  "url": "https://www.tiktok.com/@user/video/123",
  "platform": "tiktok",
  "title": "Great video",
  "uploaderHandle": "user",
  "folderId": "myFolder123"
}

// Response (201 Created)
{
  "success": true,
  "data": {
    "id": "base64urlEncodedId",
    "folderId": "myFolder123",
    "video": { ... }
  }
}
\`\`\`

---

#### DELETE /api/v1/saved?id=xxx
Remove a saved video.

Required scope: \`saved:write\`

Response:
\`\`\`json
{ "success": true, "data": { "id": "xxx", "deleted": true } }
\`\`\`

---

#### GET /api/v1/saved/folders
List all folders.

Required scope: \`saved:write\`

Response:
\`\`\`json
{
  "success": true,
  "data": {
    "folders": [
      { "id": "folder123", "name": "Inspiration", "createdAt": "2026-04-01T12:00:00.000Z" },
      { "id": "folder456", "name": "Competitors", "createdAt": "2026-04-02T10:00:00.000Z" }
    ]
  }
}
\`\`\`

---

#### POST /api/v1/saved/folders
Create a new folder.

Required scope: \`saved:write\`

Request body:
| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| name  | string | yes      | Folder name |

\`\`\`json
// Request
POST /api/v1/saved/folders
{ "name": "My Inspiration" }

// Response (201 Created)
{ "success": true, "data": { "id": "newFolderId", "name": "My Inspiration" } }
\`\`\`

---

#### PATCH /api/v1/saved/folders?id=xxx
Rename a folder.

Required scope: \`saved:write\`

Request body:
| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| name  | string | yes      | New folder name |

Response:
\`\`\`json
{ "success": true, "data": { "id": "xxx", "name": "New Name" } }
\`\`\`

---

#### DELETE /api/v1/saved/folders?id=xxx
Delete a folder. Videos inside are moved to "Unsorted" (default).

Required scope: \`saved:write\`

Response:
\`\`\`json
{ "success": true, "data": { "id": "xxx", "deleted": true, "videosMoved": 5 } }
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

### Workflow 4: Get a video transcript
\`\`\`
1. GET /api/v1/videos/:id
   → The transcript is generated automatically on the first request.
   → For most videos, the transcript is included in this same response.

2. If transcription.status is "processing":
   → Wait the number of seconds in retryAfterSeconds (usually 10).
   → Call GET /api/v1/videos/:id again.
   → The transcript will be ready.

3. To find which videos already have transcripts:
   → GET /api/v1/videos
   → Check the transcriptStatus field on each video.
   → Videos with transcriptStatus "completed" already have transcripts cached.
\`\`\`

### Workflow 5: Get analytics dashboard data
\`\`\`
1. GET /api/v1/analytics/overview?projectId=xxx
   → Full stats with platform breakdown, top performers, recent activity

2. GET /api/v1/refreshes?startDate=2025-06-01&endDate=2025-06-30
   → See when data was last refreshed and any failures
\`\`\`

### Workflow 6: Save a video from a browser extension
\`\`\`
1. GET /api/v1/saved/folders
   → Show folder picker to the user

2. POST /api/v1/saved  { url, platform, title, ..., folderId }
   → Saves to user's personal library in the chosen folder
\`\`\`

### Workflow 7: Organize saved content
\`\`\`
1. POST /api/v1/saved/folders  { name: "Competitors" }
   → Create a new folder

2. GET /api/v1/saved
   → List all saved videos

3. GET /api/v1/saved?folderId=folder123
   → List videos in a specific folder
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
- **Automatic Transcription:** Every video fetched through the API is automatically transcribed. YouTube videos use free platform captions. TikTok, Instagram, and Twitter videos are transcribed using OpenAI Whisper. Transcripts are generated on the first GET request and cached for all future requests. The transcript includes the full text, detected language, and timestamped segments.
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
