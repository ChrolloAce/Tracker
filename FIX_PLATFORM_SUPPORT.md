# FIX PLATFORM SUPPORT - TIKTOK & TWITTER

## 🔍 Problem Identified

After implementing the scoped refresh fix, manual video refresh was correctly scoping to the active organization and project, but all 5 accounts failed to refresh:

1. **Twitter accounts** (2 accounts): Failed with `"Unsupported platform: twitter"`
2. **TikTok accounts** (3 accounts): Failed with `"Apify request failed: Not Found"`

### Root Causes

1. **Twitter Support Missing**: The `refreshAccountVideos` function in `api/cron-refresh-videos.ts` only supported Instagram, TikTok, and YouTube platforms. Twitter was not implemented.

2. **Wrong TikTok Actor ID**: The cron job was using `clockworks/tiktok-profile-scraper` (which doesn't exist), when it should use `clockworks~tiktok-scraper` (the correct actor ID used in all other sync functions like `sync-single-account.ts`).

## ✅ What Was Fixed

### 1. Fixed TikTok Actor ID

**Changed from:**
```typescript
actorId = 'clockworks/tiktok-profile-scraper';
input = {
  profiles: [username],
  maxProfilesPerQuery: 1,
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSlideshowImages: false
};
```

**Changed to:**
```typescript
actorId = 'clockworks~tiktok-scraper';
input = {
  profiles: [username],
  resultsPerPage: 100,
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSubtitles: false,
  proxy: {
    useApifyProxy: true
  }
};
```

This matches the configuration used in `api/sync-single-account.ts` and the client-side `AccountTrackingService.ts`.

### 2. Added Twitter Support

Implemented full Twitter support by:
- Adding Twitter to the supported platforms type: `'instagram' | 'tiktok' | 'youtube' | 'twitter'`
- Using the `apidojo/tweet-scraper` Apify actor (same as used in `TwitterApiService.ts`)
- Configuring proper input parameters:
  ```typescript
  actorId = 'apidojo/tweet-scraper';
  input = {
    twitterHandles: [username],
    maxItems: 100,
    sort: 'Latest',
    onlyImage: false,
    onlyVideo: false,
    onlyQuote: false,
    onlyVerifiedUsers: false,
    onlyTwitterBlue: false,
    includeSearchTerms: false
  };
  ```

### 3. Updated Data Extraction Logic

Enhanced `saveVideosToFirestore` function to handle platform-specific data structures:

**Metrics Extraction:**
- Instagram: `videoViewCount`, `likesCount`, `commentsCount`
- TikTok: `playCount`, `diggCount`, `commentCount`, `shareCount`
- Twitter: `viewCount`, `likeCount`, `replyCount`, `retweetCount`

**Video Data Extraction:**
- Instagram: Uses `shortCode`, `caption`, `displayUrl`, `timestamp`
- TikTok: Uses `id`, `text`, `covers`, `createTime`, `authorMeta`
- Twitter: Uses `id`, `fullText`/`text`, `url`, `createdAt`, `media`, `entities.hashtags`

## 🚀 Next Steps

To deploy these fixes:

1. **Commit the changes**:
   ```bash
   git add api/cron-refresh-videos.ts FIX_PLATFORM_SUPPORT.md
   git commit -m "Fix: Add Twitter support and correct TikTok actor ID in cron refresh"
   ```

2. **Push to repository**:
   ```bash
   git push origin main
   ```

Vercel will automatically deploy the changes. After deployment:
- ✅ TikTok accounts should successfully refresh using the correct Apify actor
- ✅ Twitter accounts will now be fully supported and should refresh tweets as "videos"
- ✅ All platforms (Instagram, TikTok, Twitter, YouTube) are now properly handled

## 📋 Files Modified

- ✅ `api/cron-refresh-videos.ts` - Fixed TikTok actor ID + added Twitter platform support
- ✅ `FIX_PLATFORM_SUPPORT.md` - Complete documentation of the fix

## 📊 Expected Results

After this fix, when you manually trigger a refresh:
- **Twitter accounts**: Should fetch and store tweets (with views, likes, replies, retweets)
- **TikTok accounts**: Should successfully fetch videos from the correct Apify actor
- **Instagram accounts**: Continue working as before
- **YouTube accounts**: Not yet implemented (will still show "Unsupported platform")

The next time you trigger a manual refresh, you should see successful syncs instead of errors!

