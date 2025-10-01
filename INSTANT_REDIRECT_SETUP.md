# Instant Server-Side Redirect Setup

## Overview

We've implemented **server-side redirects** for lightning-fast link redirects! Instead of loading the entire React app, links now redirect instantly using a Vercel serverless function.

## How It Works

### Before (SLOW ❌)
```
User clicks /l/abc123
↓
Load entire React app (764KB JS!)
↓
Boot up React
↓
Make Firestore query
↓
Redirect
```
**Total time:** 2-5 seconds 😢

### After (INSTANT ⚡)
```
User clicks /l/abc123
↓
Server-side function runs
↓
Fast Firestore query
↓
302 Redirect
```
**Total time:** ~200ms 🚀

## Required Environment Variables

You need to add these to your Vercel project settings:

### 1. Go to Firebase Console
Visit: https://console.firebase.google.com/project/trackview-6a3a5/settings/serviceaccounts/adminsdk

### 2. Generate a new private key
- Click "Generate new private key"
- Download the JSON file

### 3. Add to Vercel
Go to: https://vercel.com/your-project/settings/environment-variables

Add these three variables:

```
FIREBASE_PROJECT_ID=trackview-6a3a5
FIREBASE_CLIENT_EMAIL=[from the downloaded JSON file]
FIREBASE_PRIVATE_KEY=[from the downloaded JSON file - the entire private key including -----BEGIN/END-----]
```

**Important:** For `FIREBASE_PRIVATE_KEY`, copy the entire value including the line breaks. Vercel will handle it correctly.

## Testing

After deploying with the environment variables:

1. Create a new tracked link in the dashboard
2. Copy the short URL (e.g., https://yoursite.com/l/abc123)
3. Open it in an incognito window
4. Should redirect INSTANTLY! ⚡

## Fallback

If the server-side redirect fails for any reason, the React app still has the client-side redirect as a backup.

## Analytics

Click tracking still works perfectly - it happens in the background after the redirect starts, so it never delays the user.

