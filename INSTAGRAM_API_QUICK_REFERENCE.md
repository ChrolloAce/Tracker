# Instagram API Quick Reference 🚀

## 📱 All 3 Instagram Scrapers at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                  INSTAGRAM SCRAPERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1️⃣  PROFILE SCRAPER                                        │
│     Actor: apify/instagram-profile-scraper                  │
│     Endpoint: POST /api/instagram-profile                   │
│     Input: { username }                                     │
│     Output: followers, bio, verified, profile pic          │
│     Use: Track account growth                               │
│                                                              │
│  2️⃣  REELS SCRAPER                                          │
│     Actor: scraper-engine~instagram-reels-scraper           │
│     Endpoint: POST /api/instagram-reels                     │
│     Input: { username, maxReels }                           │
│     Output: Array of reels with full metadata               │
│     Use: Sync all videos from account                       │
│                                                              │
│  3️⃣  POST SCRAPER                                           │
│     Actor: hpix~ig-reels-scraper                            │
│     Endpoint: POST /api/instagram-post                      │
│     Input: { url } or { urls: [] }                          │
│     Output: Individual post/reel with metrics               │
│     Use: Refresh specific video data                        │
│                                                              │
│  🎯  FULL API (Combined)                                    │
│     Endpoint: POST /api/instagram-full                      │
│     Input: { username, maxReels }                           │
│     Output: Profile + Reels in one call                     │
│     Use: Complete account sync                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔥 Copy-Paste Examples

### 1. Get Profile Data
```bash
curl -X POST https://your-domain.com/api/instagram-profile \
  -H "Content-Type: application/json" \
  -d '{"username": "cristiano"}'
```

### 2. Get 30 Recent Reels
```bash
curl -X POST https://your-domain.com/api/instagram-reels \
  -H "Content-Type: application/json" \
  -d '{"username": "cristiano", "maxReels": 30}'
```

### 3. Get Single Post Data
```bash
curl -X POST https://your-domain.com/api/instagram-post \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/DNuPngaWJCN/"}'
```

### 4. Batch Refresh 10 Posts
```bash
curl -X POST https://your-domain.com/api/instagram-post \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://www.instagram.com/reel/ABC123/",
      "https://www.instagram.com/reel/DEF456/",
      "https://www.instagram.com/reel/GHI789/"
    ],
    "delayMs": 2000
  }'
```

### 5. Get Profile + Reels (Optimized)
```bash
curl -X POST https://your-domain.com/api/instagram-full \
  -H "Content-Type: application/json" \
  -d '{"username": "cristiano", "maxReels": 50}'
```

---

## 💻 Code Usage

### TypeScript/JavaScript
```typescript
import { InstagramScraperService } from './api/services/InstagramScraperService';

// Profile
const profile = await InstagramScraperService.fetchProfile('cristiano');

// Reels
const reels = await InstagramScraperService.fetchProfileReels('cristiano', 30);

// Single Post
const post = await InstagramScraperService.fetchPost(
  'https://www.instagram.com/reel/DNuPngaWJCN/'
);

// Batch Posts
const posts = await InstagramScraperService.fetchPostsBatch([url1, url2], 2000);

// Profile + Reels
const { profile, reels } = await InstagramScraperService.fetchProfileWithReels(
  'cristiano', 
  50
);
```

---

## 🎯 Decision Tree: Which Scraper to Use?

```
Need account info (followers, bio)?
  └─> Use Profile Scraper (/api/instagram-profile)

Need all videos from an account?
  └─> Use Reels Scraper (/api/instagram-reels)

Need to refresh specific video metrics?
  └─> Use Post Scraper (/api/instagram-post)

Need everything at once?
  └─> Use Full API (/api/instagram-full)

Need to refresh 10+ videos?
  └─> Use Post Scraper with batch mode (urls: [])
```

---

## ⚡ Performance Tips

```
┌─────────────────────────────────────────────┐
│  Speed Optimization                         │
├─────────────────────────────────────────────┤
│  ✅ Use Full API for new accounts          │
│  ✅ Batch posts instead of individual      │
│  ✅ Add 2-3s delay between requests        │
│  ✅ Use residential proxies (included)     │
│  ✅ Cache profile data for 1 hour          │
│  ✅ Use session cookies (optional)         │
├─────────────────────────────────────────────┤
│  ❌ Don't spam requests                    │
│  ❌ Don't ignore 429 errors                │
│  ❌ Don't use datacenter proxies           │
│  ❌ Don't fetch more than 100 reels        │
└─────────────────────────────────────────────┘
```

---

## 🔐 Required Environment Variables

```bash
# Required
APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional (but recommended for higher rate limits)
INSTAGRAM_SESSION_ID=your_instagram_session_cookie_here
```

### How to Get Instagram Session Cookie:
1. Log into Instagram in browser
2. Open DevTools (F12)
3. Go to Application → Cookies
4. Copy value of `sessionid` cookie
5. Set as `INSTAGRAM_SESSION_ID` env variable

---

## 📊 Response Data Comparison

| Field | Profile | Reels | Post |
|-------|---------|-------|------|
| Username | ✅ | ✅ | ✅ |
| Full Name | ✅ | ✅ | ✅ |
| Followers | ✅ | ❌ | ❌ |
| Biography | ✅ | ❌ | ❌ |
| Verified | ✅ | ❌ | ❌ |
| Profile Pic | ✅ | ❌ | ✅ |
| Video URL | ❌ | ✅ | ✅ |
| Views | ❌ | ✅ | ✅ |
| Likes | ❌ | ✅ | ✅ |
| Comments | ❌ | ✅ | ✅ |
| Shares | ❌ | ❌ | ✅ |
| Caption | ❌ | ✅ | ✅ |
| Timestamp | ❌ | ✅ | ✅ |
| Duration | ❌ | ✅ | ✅ |
| Thumbnail | ❌ | ✅ | ✅ |

---

## 🚨 Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid username format` | Bad username | Check username (no @ or special chars) |
| `Invalid Instagram URL` | Bad URL format | Use full Instagram URL |
| `Profile not found` | Private/deleted account | Account may be private or unavailable |
| `404` | Post doesn't exist | Check URL, post may be deleted |
| `429` | Rate limited | Add delay, use session cookie |
| `500` | Scraper failed | Retry with exponential backoff |

---

## 📦 File Structure

```
api/
├── services/
│   └── InstagramScraperService.ts    # Main service (use this!)
│
├── instagram-profile.ts               # GET /api/instagram-profile
├── instagram-reels.ts                 # GET /api/instagram-reels
├── instagram-post.ts                  # GET /api/instagram-post
└── instagram-full.ts                  # GET /api/instagram-full
```

---

## 🎯 Workflow Examples

### Workflow 1: Add New Account
```typescript
// Step 1: Fetch profile + reels
const result = await fetch('/api/instagram-full', {
  method: 'POST',
  body: JSON.stringify({ username: 'cristiano', maxReels: 50 })
});

// Step 2: Save profile to accounts collection
// Step 3: Save reels to videos collection
// Step 4: Done! ✅
```

### Workflow 2: Refresh Account
```typescript
// Step 1: Update profile data
const profile = await fetch('/api/instagram-profile', {
  method: 'POST',
  body: JSON.stringify({ username: 'cristiano' })
});

// Step 2: Get latest reels
const reels = await fetch('/api/instagram-reels', {
  method: 'POST',
  body: JSON.stringify({ username: 'cristiano', maxReels: 30 })
});

// Step 3: Update database
// Done! ✅
```

### Workflow 3: Refresh Video Metrics
```typescript
// Get all video URLs from database
const videoUrls = [/* array of URLs */];

// Batch refresh (max 50 at a time)
const results = await fetch('/api/instagram-post', {
  method: 'POST',
  body: JSON.stringify({ 
    urls: videoUrls.slice(0, 50),
    delayMs: 2000 
  })
});

// Update metrics in database
// Done! ✅
```

---

## 🔄 Migration Checklist

Moving from old Instagram code? Follow this:

- [ ] Replace scattered scraper calls with `InstagramScraperService`
- [ ] Update profile fetching to use `/api/instagram-profile`
- [ ] Update reels fetching to use `/api/instagram-reels`
- [ ] Update individual post fetching to use `/api/instagram-post`
- [ ] Add `INSTAGRAM_SESSION_ID` to environment variables
- [ ] Test all endpoints
- [ ] Update error handling to use new error format
- [ ] Add rate limiting logic (2-3s delays)
- [ ] Monitor 429 errors and adjust delays
- [ ] Done! 🎉

---

## 💡 Pro Tips

1. **Cache profile data** for 1 hour (followers don't change that fast)
2. **Use batch endpoint** for refreshing multiple videos
3. **Add exponential backoff** for 429 errors
4. **Monitor rate limits** and adjust delays
5. **Use session cookies** for 2-3x higher rate limits
6. **Log all requests** to track usage patterns
7. **Handle null responses** gracefully (videos can be deleted)
8. **Validate URLs** before sending to API

---

## 📞 Need Help?

Check the full documentation: `INSTAGRAM_API_GUIDE.md`

---

## ✨ Summary

**You now have 3 Instagram scrapers:**

1. 🎭 **Profile Scraper** - Account data
2. 📸 **Reels Scraper** - Bulk videos
3. 🎬 **Post Scraper** - Individual posts

**All managed by one clean service! 🚀**

```typescript
import { InstagramScraperService } from './services/InstagramScraperService';
// That's it! Use this for everything Instagram.
```

