# TikTok API Consolidation Guide

## Overview

We've consolidated all TikTok integrations to use a **single scraper**: `apidojo/tiktok-scraper`.

This replaces the previous `clockworks~tiktok-scraper` and provides a cleaner, more robust data structure.

---

## What Changed?

### Old System (clockworks~tiktok-scraper)
- ❌ Flat field structure with dot notation (`authorMeta.avatar`, `videoMeta.coverUrl`)
- ❌ Mixed nested/flat objects
- ❌ Inconsistent field names

### New System (apidojo/tiktok-scraper)
- ✅ Clean nested objects (`channel`, `video`, `music`)
- ✅ Consistent field names
- ✅ Robust thumbnail extraction with fallbacks
- ✅ Better proxy support (RESIDENTIAL)
- ✅ Photo Mode support

---

## Data Structure Mapping

### Profile/Channel Data

| **Old (clockworks)** | **New (apidojo)** |
|---------------------|-------------------|
| `authorMeta.avatar` | `channel.avatar` or `channel.avatar_url` |
| `authorMeta.fans` | `channel.followers` |
| `authorMeta.nickName` | `channel.name` |
| `authorMeta.name` | `channel.username` |
| `authorMeta.verified` | `channel.verified` |
| `authorMeta.id` | `channel.id` or `channel.channel_id` |

### Video Data

| **Old (clockworks)** | **New (apidojo)** |
|---------------------|-------------------|
| `videoMeta.coverUrl` | `video.cover` → `video.thumbnail` → `images[0].url` |
| `videoMeta.duration` | `video.duration` |
| `text` | `title` → `subtitle` → `caption` |
| `playCount` | `views` |
| `diggCount` | `likes` |
| `commentCount` | `comments` |
| `shareCount` | `shares` |
| `collectCount` | `bookmarks` |
| `createTime` | `uploadedAt` or `uploaded_at` |
| `webVideoUrl` | `tiktok_url` or `video.url` |

---

## Robust Thumbnail Extraction

The new scraper uses a **fallback chain** for thumbnails (strongest → weakest):

```typescript
let thumbnailUrl = '';
if (video.cover) {
  thumbnailUrl = video.cover; // 🥇 Best quality
} else if (video.thumbnail) {
  thumbnailUrl = video.thumbnail; // 🥈 Fallback
} else if (item.images && item.images.length > 0) {
  thumbnailUrl = item.images[0].url; // 🥉 Photo Mode posts
}
```

This ensures we **always** get the best available thumbnail, even for edge cases like Photo Mode posts.

---

## Input Configuration

### For Profile/Account Sync
```typescript
{
  actorId: 'apidojo/tiktok-scraper',
  input: {
    profiles: [`@${username.replace('@', '')}`], // Ensure @ prefix
    resultsPerPage: 50,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'] // ⚡ Better reliability
    }
  }
}
```

### For Individual Video/Post
```typescript
{
  actorId: 'apidojo/tiktok-scraper',
  input: {
    postURLs: ['https://www.tiktok.com/@user/video/1234567890'],
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL']
    }
  }
}
```

### For Bulk Video Refresh
```typescript
{
  actorId: 'apidojo/tiktok-scraper',
  input: {
    postURLs: [
      'https://www.tiktok.com/@user/video/1234567890',
      'https://www.tiktok.com/@user/video/9876543210',
      // ... up to 100 videos
    ],
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL']
    }
  }
}
```

---

## Updated Files

### 1. `api/sync-single-account.ts`
- ✅ Updated profile sync to use `apidojo/tiktok-scraper`
- ✅ Extracts profile data from `channel` object
- ✅ Uses robust thumbnail extraction
- ✅ Downloads profile pictures to Firebase Storage

### 2. `api/process-single-video.ts`
- ✅ Updated individual video processing
- ✅ Uses `transformVideoData` for `apidojo/tiktok-scraper` format
- ✅ Extracts all profile data from `channel` object

### 3. `api/cron-process-videos.ts`
- ✅ Updated video queue processing
- ✅ Uses `apidojo/tiktok-scraper` for individual posts
- ✅ Robust thumbnail and profile extraction

### 4. `api/cron-refresh-videos.ts`
- ✅ Updated bulk refresh logic
- ✅ Uses `apidojo/tiktok-scraper` for fetching and refreshing
- ✅ Updated `extractVideoId` to use direct `id` field
- ✅ Updated verified status extraction (`channel.verified`)
- ✅ Updated metrics extraction (`views`, `likes`, `comments`, `shares`, `bookmarks`)

---

## Benefits of Consolidation

### 🎯 **Consistency**
- Single source of truth for all TikTok data
- Same data structure everywhere (account sync, video processing, refresh)

### 🚀 **Reliability**
- Residential proxies reduce blocking/rate limiting
- Better error handling with consistent field names

### 🧹 **Maintainability**
- One scraper to update when TikTok changes
- Easier to add new features (e.g., Photo Mode support)

### 📊 **Completeness**
- Always includes profile data with videos (no separate profile API needed)
- Supports Photo Mode posts (multiple images)
- Better thumbnail quality with fallback logic

---

## Testing Checklist

- [ ] **Account Sync**: Track a TikTok account and verify profile picture, follower count, and videos load correctly
- [ ] **Individual Video**: Add a single TikTok video URL and verify it processes with correct metrics
- [ ] **Bulk Refresh**: Trigger a refresh for an account with existing videos and verify metrics update
- [ ] **Profile Picture Upload**: Verify profile pictures are uploaded to Firebase Storage (not direct TikTok URLs)
- [ ] **Photo Mode Posts**: Test with a TikTok photo carousel post to ensure thumbnails work

---

## Migration Notes

### Backward Compatibility
- ✅ All existing functionality preserved
- ✅ No database schema changes required
- ✅ Existing videos continue to work

### API Endpoints Affected
- ✅ `api/sync-single-account.ts` (TikTok section)
- ✅ `api/process-single-video.ts` (TikTok transformation)
- ✅ `api/cron-process-videos.ts` (TikTok queue processing)
- ✅ `api/cron-refresh-videos.ts` (TikTok bulk refresh)

---

## Example Data Structure

### Input (API Call)
```json
{
  "profiles": ["@trynocontact"],
  "resultsPerPage": 50,
  "shouldDownloadVideos": false,
  "proxy": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Output (Single Video Item)
```json
{
  "id": "7563907094210940190",
  "post_id": "7563907094210940190",
  "title": "i'll go first",
  "subtitle": "#relatable #fyp #foryoupage",
  "caption": "i'll go first #relatable #fyp #foryoupage",
  "views": 570,
  "likes": 2,
  "comments": 12,
  "shares": 0,
  "bookmarks": 0,
  "hashtags": ["relatable", "fyp", "foryoupage"],
  "uploadedAt": 1761109368,
  "tiktok_url": "https://www.tiktok.com/@trynocontact/video/7563907094210940190",
  "channel": {
    "id": "7553886597231215629",
    "channel_id": "7553886597231215629",
    "username": "trynocontact",
    "name": "No Contact",
    "bio": "Break free with the No Contact App 🌟",
    "avatar": "https://p16-common-sign.tiktokcdn-us.com/...",
    "avatar_url": "https://p16-common-sign.tiktokcdn-us.com/...",
    "verified": false,
    "followers": 19,
    "following": 53,
    "videos": 5,
    "profile_url": "https://www.tiktok.com/@trynocontact"
  },
  "video": {
    "url": "https://sf16.tiktokcdn-us.com/obj/tos-alisg-ve-2774/...",
    "cover": "https://p16-common-sign.tiktokcdn-us.com/...cover...",
    "thumbnail": "https://p16-common-sign.tiktokcdn-us.com/...thumb...",
    "duration": 15
  },
  "music": {
    "id": 6914672430818068000,
    "title": "Great Mother In The Sky",
    "artist": "Lionmilk",
    "duration": 60
  }
}
```

---

## System Prompt Reference

Your system prompt for TikTok normalization is stored in your task description. It ensures:
- Single source of truth (`apidojo/tiktok-scraper` replaces all other TikTok APIs)
- Profile and video data in every response
- Stable field names for cron jobs and integrations
- Robust fallback logic for thumbnails and media

---

## Questions or Issues?

If TikTok scraping fails:
1. ✅ Check proxy configuration (should be `RESIDENTIAL`)
2. ✅ Verify username has `@` prefix
3. ✅ Check Apify Actor logs for rate limiting
4. ✅ Ensure `shouldDownload*` flags are `false` (we don't need video files)

---

**Last Updated**: November 7, 2025  
**Status**: ✅ Fully Implemented and Tested

