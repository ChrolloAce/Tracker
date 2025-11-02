# TikTok Thumbnail Fix Summary

## Issues Identified

After investigating the TikTok thumbnail problem, I found several root causes:

### 1. **Inconsistent Naming Conventions**
- Frontend service was using: `tt_${videoId}.jpg`
- Cron job was using: `${videoId}_thumb.jpg`
- This caused confusion and potential conflicts

### 2. **Limited Thumbnail Field Extraction**
- Only checking `video.videoMeta?.coverUrl`
- TikTok's API structure changes and has multiple possible field paths

### 3. **No Update for Empty Thumbnails**
- Cron job only updated thumbnails for Instagram CDN URLs
- TikTok videos with empty/missing thumbnails were never fixed on refresh

### 4. **Placeholder Image Problem**
- On download failure, cron was saving placeholder URLs
- Placeholder images looked unprofessional and couldn't be fixed automatically

### 5. **No API Response Validation**
- When TikTok API didn't return thumbnail URLs, this went unlogged
- No visibility into whether problem was with our code or TikTok's API

## Fixes Implemented

### ✅ 1. Background Color (Fixed)
**File**: `src/index.css`
- Changed global background from light `#FAFAFB` to dark `#0A0A0A`
- Updated color scheme to dark mode
- Now consistent when scrolling beyond content

### ✅ 2. Cron Job Thumbnail Handling (Fixed)
**File**: `api/cron-refresh-videos.ts`

**Changes:**
- **Consistent naming**: Now using `tt_${videoId}_thumb.jpg` for all TikTok thumbnails
- **Multiple field paths**: Tries 6 different thumbnail field names from TikTok API:
  - `video.videoMeta?.coverUrl`
  - `video['videoMeta.coverUrl']`
  - `video.covers?.default`
  - `video.coverUrl`
  - `video.thumbnail`
  - `video.cover`
- **Better logging**: Logs when thumbnail URL is found vs missing
- **Smart updates**: Now updates thumbnails if:
  - Existing is Instagram CDN URL (expires)
  - Existing is empty and we have a new one
  - Existing is placeholder and we have a real one
- **No more placeholders**: Returns original URL or empty string instead of placeholder

### ✅ 3. Frontend Service (Fixed)
**File**: `src/services/AccountTrackingServiceFirebase.ts`

**Changes:**
- Same multiple field path checking as cron job
- Consistent naming: `tt_${videoId}_thumb.jpg`
- Better error logging
- Validates upload success before using Firebase URL

### ✅ 4. Diagnostic Tool (New)
**File**: `api/diagnose-tiktok-thumbnails.ts`

**Usage:**
```bash
GET /api/diagnose-tiktok-thumbnails?orgId=YOUR_ORG_ID&projectId=YOUR_PROJECT_ID
```

**What it does:**
- Scans all TikTok videos in your project
- Counts videos with:
  - No thumbnail
  - Placeholder thumbnails
  - Firebase Storage thumbnails
  - External URL thumbnails
  - Broken Firebase URLs (URL exists but file doesn't)
- Shows sample videos
- Provides actionable recommendations

### ✅ 5. Fix Script (New)
**File**: `api/fix-tiktok-thumbnails.ts`

**Usage:**
```bash
# Dry run (no changes)
POST /api/fix-tiktok-thumbnails
Body: {
  "orgId": "YOUR_ORG_ID",
  "projectId": "YOUR_PROJECT_ID",
  "dryRun": true
}

# Actual fix
POST /api/fix-tiktok-thumbnails
Body: {
  "orgId": "YOUR_ORG_ID",
  "projectId": "YOUR_PROJECT_ID",
  "dryRun": false
}
```

**What it does:**
- Identifies all TikTok videos with missing/placeholder/broken thumbnails
- Groups videos by account for efficient API calls
- Fetches fresh data from TikTok API
- Downloads and uploads thumbnails to Firebase Storage
- Updates video records with new thumbnail URLs
- Reports success/failure counts

## How to Fix Your Existing Data

### Step 1: Diagnose the Problem
```bash
curl "https://your-domain.com/api/diagnose-tiktok-thumbnails?orgId=YOUR_ORG&projectId=YOUR_PROJECT"
```

This will show you:
- How many videos are affected
- What types of issues exist
- Sample videos with problems

### Step 2: Test the Fix (Dry Run)
```bash
curl -X POST https://your-domain.com/api/fix-tiktok-thumbnails \
  -H "Content-Type: application/json" \
  -d '{"orgId":"YOUR_ORG","projectId":"YOUR_PROJECT","dryRun":true}'
```

This will show you what would be fixed without making changes.

### Step 3: Run the Actual Fix
```bash
curl -X POST https://your-domain.com/api/fix-tiktok-thumbnails \
  -H "Content-Type: application/json" \
  -d '{"orgId":"YOUR_ORG","projectId":"YOUR_PROJECT","dryRun":false}'
```

This will fix all affected videos.

### Step 4: Verify the Fix
Run the diagnostic tool again to confirm thumbnails are now properly stored.

## Why This Happened

The issue was likely a combination of:

1. **TikTok API Changes**: TikTok occasionally changes their data structure, and the thumbnail field moved or was renamed
2. **Cron Job Overwriting**: If videos were initially scraped successfully but then the cron job ran when TikTok's API was unavailable or changed, it could have overwritten good thumbnails with empty ones
3. **No Retry Logic**: Once a thumbnail was empty, it stayed empty because cron only updated Instagram thumbnails

## Prevention for the Future

The fixes ensure:

✅ **Resilience**: Multiple field paths checked for thumbnails  
✅ **Smart Updates**: Only overwrites bad thumbnails, preserves good ones  
✅ **Better Logging**: Can identify API issues quickly  
✅ **Fallback Strategy**: Uses original URL if Firebase upload fails  
✅ **Consistency**: Same naming convention everywhere  

## Monitoring

After deploying these fixes, monitor your cron job logs for:

- `⚠️ TikTok video X has no thumbnail URL in API response` - Indicates TikTok API issue
- `✅ Uploaded thumbnail to Firebase Storage` - Success messages
- `⚠️ Using original URL as fallback` - Download failed but URL preserved

If you see many "no thumbnail URL" warnings, it indicates TikTok's API might have changed again or has rate limiting issues.

## Files Modified

1. ✅ `src/index.css` - Dark background fix
2. ✅ `api/cron-refresh-videos.ts` - Cron job fixes
3. ✅ `src/services/AccountTrackingServiceFirebase.ts` - Frontend service fixes
4. ✅ `api/diagnose-tiktok-thumbnails.ts` - New diagnostic tool
5. ✅ `api/fix-tiktok-thumbnails.ts` - New fix script

All changes are backward compatible and have no linting errors.

