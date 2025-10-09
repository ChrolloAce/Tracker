# Fix Summary: 500 Server Error - FUNCTION_INVOCATION_FAILED

## Problem Identified

The `/api/cron-refresh-videos` endpoint was returning a 500 server error with an HTML response instead of JSON, causing the error:
```
Failed to parse JSON response: A server error has occurred
FUNCTION_INVOCATION_FAILED
```

## Root Cause

**Firebase Admin Initialization Mismatch**

Two API files were using an incompatible Firebase initialization pattern:
- `api/cron-refresh-videos.ts`
- `api/cron-status.ts`

These files expected `FIREBASE_SERVICE_ACCOUNT_KEY` as a single JSON string, while your Vercel environment is configured with separate environment variables:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

When Firebase Admin failed to initialize, the functions crashed before they could return proper JSON error responses, resulting in HTML error pages.

## Changes Made

### 1. Updated `api/cron-refresh-videos.ts`
- ✅ Changed Firebase initialization to use individual env vars (matching other working API files)
- ✅ Added top-level error handling with nested try-catch blocks
- ✅ Added Firebase initialization verification
- ✅ Improved error responses with `errorType` field

### 2. Updated `api/cron-status.ts`
- ✅ Changed Firebase initialization to use individual env vars
- ✅ Added Firebase initialization verification
- ✅ Improved error responses with `errorType` field

## Next Steps

### 1. Deploy to Vercel
```bash
# If using Vercel CLI
vercel --prod

# Or push to your main branch if auto-deployment is enabled
git add .
git commit -m "Fix 500 error: Update Firebase initialization"
git push origin main
```

### 2. Verify Environment Variables in Vercel

Make sure these environment variables are set in your Vercel project settings:

**Required Variables:**
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account email
- `FIREBASE_PRIVATE_KEY` - Service account private key
- `APIFY_TOKEN` - Your Apify API token
- `CRON_SECRET` - Secret for authenticating cron jobs

**To check/set these:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Verify all required variables are set

### 3. Test the Fix

After deployment, test the manual refresh feature:
1. Log into your dashboard
2. Try the "Manual Refresh" button
3. Check that you get a proper JSON response (success or error)
4. Check Vercel Function Logs for any remaining errors

## Expected Behavior After Fix

### Success Response:
```json
{
  "success": true,
  "duration": "45.2s",
  "timestamp": "2025-10-09T...",
  "stats": {
    "totalOrganizations": 1,
    "totalAccountsProcessed": 5,
    "totalVideosRefreshed": 123,
    "failedAccounts": 0
  },
  "failures": []
}
```

### Error Response (if something fails):
```json
{
  "success": false,
  "error": "Detailed error message",
  "errorType": "FIREBASE_INIT_ERROR | PROCESSING_ERROR | UNHANDLED_ERROR",
  "timestamp": "2025-10-09T..."
}
```

## Files Modified

1. `/api/cron-refresh-videos.ts` - Firebase init + error handling
2. `/api/cron-status.ts` - Firebase init + error handling

## Prevention

All API files now use the same Firebase initialization pattern. If you create new API files, use this template:

```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

export default async function handler(req, res) {
  try {
    // Verify Firebase is initialized
    if (!getApps().length) {
      return res.status(500).json({
        error: 'Server configuration error: Firebase not initialized',
        errorType: 'FIREBASE_INIT_ERROR'
      });
    }
    
    // Your function logic here
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error',
      errorType: 'PROCESSING_ERROR'
    });
  }
}
```

## Need Help?

If the error persists after deployment:

1. Check Vercel Function Logs for detailed error messages
2. Verify all environment variables are correctly set
3. Test individual components:
   - `/api/cron-status` - Should show dashboard
   - `/api/cron-refresh-videos` - Should return JSON response
4. Check the browser console for additional error details

