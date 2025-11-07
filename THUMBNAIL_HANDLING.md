# Thumbnail Handling - Firebase Storage Implementation 📸

## Problem Fixed
TikTok (and all platform) thumbnails were not loading because:
1. Direct CDN URLs have expiring signatures (`x-expires`, `refresh_token`, etc.)
2. Code was falling back to these expiring URLs when Firebase Storage upload failed
3. After signatures expired, thumbnails would stop loading in the UI

## Solution
**Force Firebase Storage upload for ALL platforms** - no fallback to direct CDN URLs.

---

## How It Works Now

### 1. Thumbnail Extraction
Robust extraction from multiple possible locations:

**TikTok**:
```javascript
let thumbnail = '';
if (video.cover) thumbnail = video.cover;
else if (video.thumbnail) thumbnail = video.thumbnail;
else if (item['video.cover']) thumbnail = item['video.cover'];  // Flat key
else if (item['video.thumbnail']) thumbnail = item['video.thumbnail'];  // Flat key
else if (item.cover) thumbnail = item.cover;
else if (item.thumbnail) thumbnail = item.thumbnail;
else if (item.images && item.images.length > 0) thumbnail = item.images[0].url;
```

**Instagram**:
```javascript
let thumbnail = '';
if (raw_data.thumbnail_url) thumbnail = raw_data.thumbnail_url;
else if (raw_data.display_url) thumbnail = raw_data.display_url;
else if (raw_data.thumbnail_src) thumbnail = raw_data.thumbnail_src;
// ... more fallbacks
```

### 2. Firebase Storage Upload
```javascript
let firebaseThumbnailUrl = '';
if (video.thumbnail && video.thumbnail.startsWith('http')) {
  try {
    console.log(`📸 [TIKTOK] Downloading thumbnail...`);
    firebaseThumbnailUrl = await downloadAndUploadImage(
      video.thumbnail,
      orgId,
      `tiktok_${video.videoId}_thumb.jpg`,
      'thumbnails'
    );
    console.log(`✅ [TIKTOK] Thumbnail uploaded to Firebase Storage`);
  } catch (thumbError) {
    console.error(`❌ [TIKTOK] Thumbnail upload failed:`, thumbError);
    // DO NOT use direct URL as fallback (it expires)
    // Leave empty - will retry on next sync
    console.warn(`⚠️ [TIKTOK] No fallback - will retry on next sync`);
  }
}
```

### 3. Save to Firestore
```javascript
batch.set(videoRef, {
  ...video,
  thumbnail: firebaseThumbnailUrl, // ✅ Firebase Storage URL or empty string
  // ...
});
```

---

## Files Updated

### ✅ `api/sync-single-account.ts`
- **Before**: Kept original URL as fallback on upload failure
- **After**: Empty string if upload fails (will retry on next sync)
- **Enhancement**: Added detailed logging with platform name

### ✅ `api/process-single-video.ts`
- **Before**: Background upload (don't wait), use original URL
- **After**: Await upload, empty string if fails
- **Enhancement**: `downloadAndUploadThumbnail` now throws error on failure

### ✅ `api/cron-refresh-videos.ts`
- **Before**: Original URL fallback for non-Instagram platforms
- **After**: Throw error for ALL platforms (no fallback)
- **Enhancement**: `downloadAndUploadImage` now throws error on failure

---

## Why CDN URLs Expire

### TikTok Example:
```
https://p16-common-sign.tiktokcdn-us.com/tos-useast8-p-0068-tx2/...
?dr=8596
&refresh_token=50c35625
&x-expires=1762639200        ← EXPIRES at this timestamp!
&x-signature=pZc0KoajmuWA... ← Signature becomes invalid
&t=bacd0480
&ps=933b5bde
...
```

**After `x-expires` timestamp**: URL returns 403 or 404 → thumbnail broken ❌

### Instagram Example:
```
https://scontent-lga3-3.cdninstagram.com/v/t51.71878-15/...
?stp=dst-jpg_e15_p360x360_tt6
&_nc_cat=108
&ig_cache_key=MzcyNzQ2MjU0NzgwNTgxMTEwNA%3D%3D.3-ccb1-7
&ccb=1-7
&_nc_sid=58cdad
&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjY0MHg3NTguc2RyLkMzIn0%3D
&_nc_ohc=1NyENBKtP88Q7kNvwHSti8y  ← Expires
&_nc_oc=AdmbRKif342dmhC8...      ← Expires
...
```

**After some time**: Instagram rotates tokens → URL stops working ❌

---

## Firebase Storage URLs (Permanent!)

### Example Firebase Storage URL:
```
https://storage.googleapis.com/scrpa-tracker.appspot.com/organizations/abc123/thumbnails/tiktok_7519910249533377823_thumb.jpg
```

**Benefits**:
✅ No expiration  
✅ No signatures  
✅ No tokens  
✅ Public access forever  
✅ Fast CDN delivery  
✅ No rate limiting  

---

## Retry Logic

If thumbnail upload fails:
1. ✅ Video is still saved (with empty thumbnail)
2. ✅ Video appears in UI (no thumbnail image)
3. ✅ Next sync will retry the upload
4. ✅ Once successful, thumbnail appears

**No broken URLs stored in database!**

---

## Testing

### 1. Add a new TikTok account
- Thumbnails should appear immediately
- Check browser console for Firebase Storage URLs

### 2. Check existing videos
- If thumbnail is empty, wait for next sync
- Sync will retry upload and populate thumbnail

### 3. Verify Firebase Storage
- Go to Firebase Console → Storage
- Check `organizations/{orgId}/thumbnails/`
- See uploaded thumbnail files

---

## Logging Enhanced

```
📸 [TIKTOK] Downloading thumbnail for video 7519910249533377823...
🌐 [TIKTOK] Thumbnail URL: https://p16-common-sign.tiktokcdn-us.com/tos-useast8-p-0068-tx2/osoX56dFISBfB4KEEYLccEAMBRFpEVfxL...
    📥 Downloading thumbnail from platform...
    ✅ Uploaded thumbnail to Firebase Storage
✅ [TIKTOK] Thumbnail uploaded to Firebase Storage: https://storage.googleapis.com/scrpa-tracker.appspot.com/...
```

**If upload fails:**
```
📸 [TIKTOK] Downloading thumbnail for video 7519910249533377823...
🌐 [TIKTOK] Thumbnail URL: https://p16-common-sign.tiktokcdn-us.com/...
    ❌ Failed to download/upload thumbnail: Error: Failed to download: 403
❌ [TIKTOK] Thumbnail upload failed: Error: Failed to download: 403
⚠️ [TIKTOK] No fallback - thumbnail will retry on next sync
```

---

## Result

✅ **All platform thumbnails now load reliably**  
✅ **No more expiring CDN URLs**  
✅ **Permanent Firebase Storage URLs**  
✅ **Automatic retry on failure**  
✅ **Consistent behavior across all platforms**  

**TikTok thumbnails fixed! 🎉**
