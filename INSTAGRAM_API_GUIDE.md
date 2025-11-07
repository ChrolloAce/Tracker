# Instagram API Integration Guide

This guide documents all 3 Instagram scraping APIs and how to use them.

## 📋 Overview

We have **3 specialized Instagram scrapers** for different use cases:

| Scraper | Purpose | Actor ID | Endpoint |
|---------|---------|----------|----------|
| **Profile Scraper** | Get account profile data | `apify/instagram-profile-scraper` | `/api/instagram-profile` |
| **Reels Scraper** | Fetch multiple reels from a profile | `scraper-engine~instagram-reels-scraper` | `/api/instagram-reels` |
| **Post Scraper** | Fetch individual post/reel data | `hpix~ig-reels-scraper` | `/api/instagram-post` |

Plus a **combined endpoint** that fetches profile + reels in one call: `/api/instagram-full`

---

## 🎯 1. Profile Scraper

**Purpose:** Get Instagram account profile data (followers, bio, verification, etc.)

### Endpoint
```
POST /api/instagram-profile
```

### Request Body
```json
{
  "username": "cristiano"
}
```

### Response
```json
{
  "success": true,
  "data": {
    "username": "cristiano",
    "fullName": "Cristiano Ronaldo",
    "followersCount": 612000000,
    "followsCount": 567,
    "postsCount": 3500,
    "biography": "⚽️ Footballer | Al Nassr",
    "verified": true,
    "profilePicUrl": "https://...",
    "isPrivate": false
  }
}
```

### Use Cases
- Getting follower count for account tracking
- Checking if account is verified
- Getting profile picture
- Checking if account is private

---

## 📸 2. Reels Scraper

**Purpose:** Fetch multiple reels from an Instagram profile (bulk fetching)

### Endpoint
```
POST /api/instagram-reels
```

### Request Body
```json
{
  "username": "cristiano",
  "maxReels": 30
}
```

### Response
```json
{
  "success": true,
  "count": 30,
  "data": [
    {
      "id": "3234567890",
      "shortCode": "DNuPngaWJCN",
      "url": "https://www.instagram.com/reel/DNuPngaWJCN/",
      "caption": "⚽️ Training hard!",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "videoViewCount": 1500000,
      "likeCount": 250000,
      "commentCount": 5000,
      "playCount": 1500000,
      "thumbnailUrl": "https://...",
      "videoUrl": "https://...",
      "ownerUsername": "cristiano",
      "ownerFullName": "Cristiano Ronaldo",
      "ownerId": "123456789",
      "width": 1080,
      "height": 1920,
      "duration": 15.5
    }
    // ... more reels
  ]
}
```

### Parameters
- `username` (required): Instagram username
- `maxReels` (optional): Number of reels to fetch (default: 30, max: 100)

### Use Cases
- Syncing all reels from a tracked account
- Getting initial reels when adding a new account
- Bulk refreshing account videos

---

## 🎬 3. Post Scraper

**Purpose:** Fetch detailed data for individual Instagram posts/reels

### Endpoint
```
POST /api/instagram-post
```

### Single Post Request
```json
{
  "url": "https://www.instagram.com/reel/DNuPngaWJCN/"
}
```

### Batch Request (Multiple Posts)
```json
{
  "urls": [
    "https://www.instagram.com/reel/DNuPngaWJCN/",
    "https://www.instagram.com/p/ABC123XYZ/",
    "https://www.instagram.com/reel/XYZ789ABC/"
  ],
  "delayMs": 2000
}
```

### Response (Single)
```json
{
  "success": true,
  "data": {
    "id": "3234567890",
    "shortCode": "DNuPngaWJCN",
    "url": "https://www.instagram.com/reel/DNuPngaWJCN/",
    "caption": "⚽️ Training hard!",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "likes": 250000,
    "comments": 5000,
    "shares": 1200,
    "plays": 1500000,
    "thumbnailUrl": "https://...",
    "videoUrl": "https://...",
    "ownerUsername": "cristiano",
    "ownerFullName": "Cristiano Ronaldo",
    "ownerProfilePicUrl": "https://...",
    "width": 1080,
    "height": 1920,
    "duration": 15.5
  }
}
```

### Response (Batch)
```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "data": [
    { /* post 1 data */ },
    { /* post 2 data */ },
    { /* post 3 data */ }
  ]
}
```

### Parameters
- `url` (string): Single Instagram post URL
- `urls` (array): Multiple Instagram post URLs (max 50)
- `delayMs` (optional): Delay between batch requests in milliseconds (default: 2000)

### Use Cases
- Refreshing metrics for a single video
- Getting detailed data for user-submitted video URLs
- Batch refreshing multiple videos with rate limiting

---

## 🎯 4. Full Profile API (Combined)

**Purpose:** Fetch profile data AND reels in one optimized call

### Endpoint
```
POST /api/instagram-full
```

### Request Body
```json
{
  "username": "cristiano",
  "maxReels": 30
}
```

### Response
```json
{
  "success": true,
  "profile": {
    "username": "cristiano",
    "fullName": "Cristiano Ronaldo",
    "followersCount": 612000000,
    "followsCount": 567,
    "postsCount": 3500,
    "biography": "⚽️ Footballer | Al Nassr",
    "verified": true,
    "profilePicUrl": "https://...",
    "isPrivate": false
  },
  "reels": {
    "count": 30,
    "data": [
      { /* reel 1 */ },
      { /* reel 2 */ },
      // ... more reels
    ]
  }
}
```

### Use Cases
- Syncing a new account (get everything at once)
- Refreshing account data efficiently
- Getting complete account snapshot

---

## 🔧 Service Architecture

All Instagram scrapers are managed by a centralized service:

### File Structure
```
api/
├── services/
│   └── InstagramScraperService.ts   # Main service class
├── instagram-profile.ts              # Profile API endpoint
├── instagram-reels.ts                # Reels API endpoint
├── instagram-post.ts                 # Post API endpoint
└── instagram-full.ts                 # Combined API endpoint
```

### Service Class (`InstagramScraperService`)

```typescript
import { InstagramScraperService } from './services/InstagramScraperService';

// Fetch profile
const profile = await InstagramScraperService.fetchProfile('cristiano');

// Fetch reels
const reels = await InstagramScraperService.fetchProfileReels('cristiano', 30);

// Fetch single post
const post = await InstagramScraperService.fetchPost('https://instagram.com/reel/...');

// Batch fetch posts
const posts = await InstagramScraperService.fetchPostsBatch([url1, url2, url3], 2000);

// Fetch profile + reels (optimized)
const { profile, reels } = await InstagramScraperService.fetchProfileWithReels('cristiano', 30);
```

### Utility Methods

```typescript
// Validate Instagram URL
InstagramScraperService.isValidInstagramUrl(url);

// Validate username
InstagramScraperService.isValidUsername(username);

// Build profile URL
InstagramScraperService.buildProfileUrl('cristiano');

// Build post URL
InstagramScraperService.buildPostUrl('DNuPngaWJCN', 'reel');

// Extract shortcode from URL
InstagramScraperService.extractShortCodeFromUrl(url);
```

---

## 🔐 Authentication

All scrapers use:
- **Residential proxies** (to avoid Instagram rate limits)
- **Session cookies** (optional, from `INSTAGRAM_SESSION_ID` env var)
- **Retry logic** with exponential backoff

### Environment Variables
```bash
INSTAGRAM_SESSION_ID=your_session_cookie_here  # Optional but recommended
APIFY_TOKEN=your_apify_token_here              # Required
```

---

## ⚙️ Proxy Configuration

All scrapers use the same proxy config:

```typescript
{
  useApifyProxy: true,
  apifyProxyGroups: ['RESIDENTIAL'],  // Prevents 429 rate limits
  apifyProxyCountry: 'US'             // US proxies for better compatibility
}
```

### Why Residential Proxies?
- **Lower block rates** - Instagram blocks datacenter IPs aggressively
- **Higher success rates** - Residential IPs look like real users
- **Avoid 429 errors** - Rate limits are much more lenient

---

## 📊 Usage Examples

### Example 1: Sync New Account
```typescript
// Get profile + initial reels
const result = await fetch('/api/instagram-full', {
  method: 'POST',
  body: JSON.stringify({
    username: 'cristiano',
    maxReels: 50
  })
});

// Save profile data to database
// Save reels to video collection
```

### Example 2: Refresh Video Metrics
```typescript
// Refresh single video
const result = await fetch('/api/instagram-post', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://www.instagram.com/reel/DNuPngaWJCN/'
  })
});

// Update video document with new metrics
```

### Example 3: Batch Refresh Multiple Videos
```typescript
// Refresh 20 videos with 2 second delay between each
const result = await fetch('/api/instagram-post', {
  method: 'POST',
  body: JSON.stringify({
    urls: [/* array of 20 video URLs */],
    delayMs: 2000
  })
});
```

### Example 4: Track Profile Growth
```typescript
// Get current follower count
const result = await fetch('/api/instagram-profile', {
  method: 'POST',
  body: JSON.stringify({
    username: 'cristiano'
  })
});

// Compare with previous follower count
// Track growth over time
```

---

## ⚠️ Rate Limiting

### Recommended Delays
- **Profile scraping**: 5-10 seconds between requests
- **Reels scraping**: 10-15 seconds between profiles
- **Post scraping**: 2-3 seconds between individual posts

### Best Practices
1. **Use batch endpoints** instead of individual requests
2. **Add delays** between batch requests
3. **Cache results** when possible
4. **Monitor 429 errors** and back off if needed
5. **Use session cookies** for higher rate limits

---

## 🚨 Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

### Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Invalid URL/username | Check format and try again |
| 404 | Profile/Post not found | Account may be private or deleted |
| 429 | Rate limited | Add delay and retry with exponential backoff |
| 500 | Scraper failed | Check logs, may need to retry |

---

## 📝 Notes

### When to Use Each Scraper

**Profile Scraper:**
- Getting follower counts
- Checking verification status
- Getting profile pictures
- Checking if account is private

**Reels Scraper:**
- Syncing new accounts (get all videos)
- Periodic refreshes of account videos
- Getting latest uploads

**Post Scraper:**
- Refreshing individual video metrics
- Getting data for user-submitted URLs
- Detailed analytics for specific posts

**Full API:**
- Initial account sync
- Complete account refresh
- Getting snapshot of account + videos

---

## 🔄 Migration from Old Code

If you're using old Instagram scraping code, here's how to migrate:

### Old Code (Scattered)
```typescript
// Multiple different scrapers used inconsistently
actorId: 'apify~instagram-scraper'
actorId: 'scraper-engine~instagram-reels-scraper'
actorId: 'pratikdani~instagram-reels-scraper'
actorId: 'alpha-scraper~instagram-video-scraper'
```

### New Code (Centralized)
```typescript
import { InstagramScraperService } from './services/InstagramScraperService';

// Everything goes through the service
const profile = await InstagramScraperService.fetchProfile(username);
const reels = await InstagramScraperService.fetchProfileReels(username);
const post = await InstagramScraperService.fetchPost(url);
```

---

## 🎯 Summary

You now have **3 specialized Instagram scrapers** working together:

1. ✅ **Profile Scraper** - Get account data
2. ✅ **Reels Scraper** - Bulk fetch videos  
3. ✅ **Post Scraper** - Individual video data

All managed through a **clean, centralized service** with proper OOP architecture! 🚀

