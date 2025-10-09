# FIX APIFY AND FIRESTORE API ISSUES

## 🔍 Problem Identified

After deploying the platform support fix, the manual video refresh was still failing on all 5 accounts:

1. **Twitter accounts** (2 accounts): Failed with `"Apify request failed: Not Found"`
2. **TikTok accounts** (3 accounts): Failed with `"existingDoc.exists is not a function"`

### Root Causes

1. **Direct Apify API Calls Not Working**: The `cron-refresh-videos.ts` was making direct fetch calls to Apify's API endpoint, which were failing with "Not Found" errors. The working code (`sync-single-account.ts`) uses a helper function `runApifyActor` from `apify-client.ts` that properly handles:
   - Actor ID normalization (converting `/` to `~`)
   - Fallback from sync endpoint to regular run endpoint
   - Proper error handling and response parsing

2. **Wrong Firestore API Usage**: The code was using `existingDoc.exists()` (as a method), but Firebase Admin SDK uses `existingDoc.exists` as a **property**, not a method. This is different from the client-side Firebase SDK where `.exists()` is a method.

## ✅ What Was Fixed

### 1. Import and Use `runApifyActor` Helper

**Added import:**
```typescript
import { runApifyActor } from './apify-client';
```

**Replaced direct fetch call:**
```typescript
// OLD (not working):
const runResponse = await fetch(
  `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  }
);

// NEW (working):
const result = await runApifyActor({
  actorId: actorId,
  input: input
});

const videos = result.items || [];
```

The `runApifyActor` helper:
- Automatically normalizes actor IDs (e.g., `apidojo/tweet-scraper` → `apidojo~tweet-scraper`)
- Tries the fast `run-sync-get-dataset-items` endpoint first
- Falls back to the regular `runs` endpoint with polling if sync fails
- Properly handles token management from environment variables
- Returns a consistent response format with `items` array

### 2. Fixed Firestore `exists` API

**Changed from:**
```typescript
if (existingDoc.exists()) {
  // This is client-side Firebase SDK syntax
```

**Changed to:**
```typescript
if (existingDoc.exists) {
  // This is Firebase Admin SDK syntax - exists is a property
```

In Firebase Admin SDK (used in serverless functions):
- `DocumentSnapshot.exists` is a **property** (boolean)

In Client-side Firebase SDK (used in React/browser):
- `DocumentSnapshot.exists()` is a **method** that returns boolean

### 3. Removed Redundant Token Check

Removed manual `APIFY_TOKEN` validation since `runApifyActor` handles it internally:
```typescript
// REMOVED:
const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  throw new Error('APIFY_TOKEN not configured');
}
```

## 🚀 Next Steps

To deploy these fixes:

1. **Commit the changes**:
   ```bash
   git add api/cron-refresh-videos.ts FIX_APIFY_AND_FIRESTORE.md
   git commit -m "Fix: Use runApifyActor helper and correct Firestore exists API"
   ```

2. **Push to repository**:
   ```bash
   git push origin main
   ```

Vercel will automatically deploy the changes. After deployment:
- ✅ **Twitter accounts** should successfully fetch tweets using the proper Apify integration
- ✅ **TikTok accounts** should successfully fetch videos without Firestore errors
- ✅ **Instagram accounts** should continue working correctly
- ✅ All platforms should save videos to Firestore properly

## 📋 Files Modified

- ✅ `api/cron-refresh-videos.ts` - Import runApifyActor + fix Firestore API
- ✅ `FIX_APIFY_AND_FIRESTORE.md` - Complete documentation

## 🔑 Key Learnings

1. **Always use established patterns**: The working `sync-single-account.ts` was using `runApifyActor` helper for a reason - it handles edge cases and normalization properly.

2. **Firebase Admin SDK vs Client SDK**: These two SDKs have different APIs:
   - Admin SDK: `doc.exists` (property)
   - Client SDK: `doc.exists()` (method)
   
3. **Don't reinvent the wheel**: When there's a helper function that handles API calls properly (with retries, normalization, etc.), use it instead of writing direct fetch calls.

## 📊 Expected Results

After this fix, when you trigger a manual refresh:
- **Twitter accounts**: Will fetch tweets successfully using the Apify helper
- **TikTok accounts**: Will fetch videos successfully without Firestore errors
- **All platforms**: Videos will be saved to Firestore with proper snapshots
- **Metrics tracking**: Views, likes, comments, and shares will be properly recorded

The refresh should now work end-to-end for all your accounts!

