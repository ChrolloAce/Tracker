# Google Authentication Redirect Diagnostic Guide

## The Issue

After clicking "Sign in with Google", users are redirected to Google OAuth, complete authentication, but when redirected back to the app, `getRedirectResult()` returns `null` instead of capturing the authenticated user.

## Root Causes (Most Likely to Least Likely)

### 1. ❗️ Unauthorized Domain in Firebase Console

**The #1 most common issue** - The domain you're testing on isn't authorized in Firebase.

**Check this:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `trackview-6a3a5`
3. Go to **Authentication → Settings → Authorized domains**
4. Make sure these domains are listed:
   - `localhost` (for local development)
   - Your production domain (e.g., `viewtrack.app`)
   - Any staging domains

**If `localhost` is missing, ADD IT NOW.**

### 2. 🔐 Browser Blocking Third-Party Cookies

Some browsers (especially Safari, Firefox Private Mode, or Brave) block third-party cookies which Firebase Auth requires.

**Check this:**
1. Open your browser's developer tools
2. Go to the Application/Storage tab
3. Check if localStorage has any keys starting with `firebase:`
4. If not, your browser is blocking storage

**Solutions:**
- Test in Chrome (most permissive)
- Disable strict tracking prevention
- Test in regular (non-private) mode

### 3. 📍 Redirect URI Mismatch

Google OAuth might be redirecting to a different URL than expected.

**Check the logs for:**
```
📍 Current URL: http://localhost:3000/login
📍 Current pathname: /login
```

If the pathname is something unexpected (like `/` or `/auth/callback`), that's the issue.

### 4. 🔄 React StrictMode Double-Rendering

In development, React StrictMode causes components to mount/unmount twice, which can consume the redirect result before it's processed.

**This is now handled** with the sessionStorage lock (`firebase_redirect_check_in_progress`).

### 5. ⚙️ Firebase Auth Persistence Not Set

The auth state needs to persist across the redirect.

**This is already configured** in `src/services/firebase.ts` with `browserLocalPersistence`.

## New Diagnostic Logs

I've added comprehensive logging to help diagnose the issue. When you refresh the page after Google redirects back, you should see:

```javascript
🔍 Checking for Google redirect result...
📍 Current URL: http://localhost:3000/login
📍 Current pathname: /login
📍 Current search: 
🌐 Auth domain configured: trackview-6a3a5.firebaseapp.com
🔐 Current auth state before redirect check: No user
🔑 Firebase localStorage keys: ["firebase:authUser:AIzaSy...", "firebase:host:..."]
  - firebase:authUser:AIzaSy...: User abc123xyz
📦 getRedirectResult returned: USER OBJECT or NULL
```

## What to Look For

### ✅ GOOD Signs (Working):
```
🔑 Firebase localStorage keys: ["firebase:authUser:...", ...]
  - firebase:authUser:...: User abc123xyz
📦 getRedirectResult returned: USER OBJECT
✅ Google sign-in redirect successful: user@example.com
```

### ❌ BAD Signs (Not Working):

**No Firebase Data:**
```
🔑 Firebase localStorage keys: NONE FOUND
📦 getRedirectResult returned: NULL
```
→ **Browser is blocking storage OR domain not authorized**

**Has Firebase Data But No Result:**
```
🔑 Firebase localStorage keys: ["firebase:authUser:..."]
  - firebase:authUser:...: User abc123xyz
📦 getRedirectResult returned: NULL
```
→ **React StrictMode consumed the result OR redirect happened to wrong URL**

## Testing Steps

1. **Clear all browser data:**
   ```javascript
   // Run in browser console:
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Refresh the page** to start fresh

3. **Click "Sign in with Google"** and watch the console

4. **After Google redirects back**, check the console for the diagnostic logs

5. **Copy and paste ALL the logs** so we can analyze them

## Quick Fixes to Try

### Fix #1: Add localhost to Firebase
1. Firebase Console → Authentication → Settings → Authorized domains
2. Click "Add domain"
3. Enter `localhost`
4. Click "Add"

### Fix #2: Use Chrome in Normal Mode
- Don't use Incognito/Private mode
- Don't use Firefox/Safari (they have stricter cookie policies)
- Use Chrome with default settings

### Fix #3: Check Google OAuth Consent Screen
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. APIs & Services → OAuth consent screen
4. Make sure:
   - App is in "Testing" or "Production" mode
   - Your email is added as a test user (if in Testing mode)
   - Authorized redirect URIs include your domains

## Expected Flow (Working)

1. User clicks "Sign in with Google" on `/login`
2. Browser redirects to `accounts.google.com`
3. User authenticates with Google
4. Google redirects back to `localhost:3000/login` (or your domain)
5. Firebase captures the redirect with `getRedirectResult()`
6. User object is retrieved
7. User account is created in Firestore
8. User is redirected to `/create-organization` or `/dashboard`

## Popup Mode Fallback

If redirect mode continues to fail, you can force popup mode by running this in your browser console:

```javascript
sessionStorage.setItem('use_popup_auth', 'true');
```

Then refresh and try signing in again. Popup mode works differently and can bypass some redirect issues.

**Pros of Popup Mode:**
- Works even if redirects are broken
- Doesn't reload the page
- Easier to debug

**Cons of Popup Mode:**
- Can be blocked by popup blockers
- Less seamless UX
- Doesn't work well on mobile

## Next Steps

1. ✅ Try the updated code with comprehensive logging
2. ✅ Check Firebase Console for authorized domains
3. ✅ Share the diagnostic logs from your console
4. ⚠️ If still not working, enable popup mode with the command above

---

**Need More Help?**

If you've checked all the above and it's still not working, run this in your browser console and share the output:

```javascript
// Firebase diagnostic script
console.log('=== FIREBASE AUTH DIAGNOSTIC ===');
console.log('Current URL:', window.location.href);
console.log('LocalStorage Firebase keys:', Object.keys(localStorage).filter(k => k.startsWith('firebase:')));
console.log('SessionStorage keys:', Object.keys(sessionStorage));
console.log('Cookies:', document.cookie);
console.log('User agent:', navigator.userAgent);
```

