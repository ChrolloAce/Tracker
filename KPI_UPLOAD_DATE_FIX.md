# KPI Upload Date Fix

## Problem
Videos uploaded days/weeks ago were appearing in "NEW UPLOADS" for today in the KPI graphs. The KPI tooltips were showing old content as if it was published today.

## Root Cause
When syncing videos from social media platforms, if the scraper failed to provide an upload date, the code was falling back to `Timestamp.now()` (current time). This meant:

1. A video uploaded 30 days ago
2. Gets synced today
3. No `uploadDate` in scraper response
4. System sets `uploadDate = Timestamp.now()` (today's date)
5. KPI graphs correctly use `uploadDate` to filter
6. Video appears in "today's NEW UPLOADS" ❌

## The Fix
**Changed all platforms to use Unix epoch (Jan 1, 1970) instead of `Timestamp.now()` when upload date is missing.**

### Before (WRONG):
```typescript
// TikTok
uploadDate: item.uploadedAt ? Timestamp.fromMillis(item.uploadedAt * 1000) : Timestamp.now()

// YouTube
uploadDate: video.date ? Timestamp.fromDate(new Date(video.date)) : Timestamp.now()

// Twitter
uploadDate: tweet.createdAt ? Timestamp.fromDate(new Date(tweet.createdAt)) : Timestamp.now()

// Instagram
const uploadDate = item.taken_at ? Timestamp.fromMillis(item.taken_at * 1000) : Timestamp.now()
```

### After (CORRECT):
```typescript
// All platforms now follow this pattern:
let uploadTimestamp: FirebaseFirestore.Timestamp;
if (platformDateField) {
  uploadTimestamp = Timestamp.fromMillis/fromDate(platformDateField);
} else {
  console.warn(`⚠️ [PLATFORM] Video ${videoId} missing upload date - using epoch`);
  uploadTimestamp = Timestamp.fromMillis(0); // Unix epoch = Jan 1, 1970
}
```

## Why Unix Epoch?
1. **Clearly Identifiable**: Jan 1, 1970 is an obviously invalid date for social media content
2. **Doesn't Pollute "Today"**: Videos with missing dates won't appear in current day's metrics
3. **Still Trackable**: Videos remain in the system but sorted to the beginning of the timeline
4. **Logged Warnings**: Admins can identify and investigate videos with missing dates

## Files Changed
- `api/sync-single-account.ts`
  - Line ~522-524: TikTok upload date handling
  - Line ~728-730: YouTube upload date handling  
  - Line ~938-940: Twitter upload date handling
  - Line ~1203-1205: Instagram upload date handling

## Impact
✅ **Fixed**: "NEW UPLOADS" sections now only show videos actually uploaded in that time period
✅ **Fixed**: KPI graphs accurately reflect real upload dates, not sync dates
✅ **Added**: Warning logs for videos without proper upload dates
✅ **Preserved**: All videos still stored in system (none are lost)

## Testing
1. Trigger a sync for an account
2. Check logs for any "missing upload date" warnings
3. View KPI graphs and click on today's data point
4. Verify "NEW UPLOADS" only shows videos actually uploaded today
5. Check that old videos with missing dates appear at Jan 1, 1970 (beginning of timeline)

## Future Improvements
Consider adding a UI indicator for videos with invalid/unknown upload dates so users can manually correct them.

