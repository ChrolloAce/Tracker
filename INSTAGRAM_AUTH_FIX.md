# 🔐 Instagram 401 Unauthorized - Authentication Fix

## The Problem
Instagram's API requires valid authentication cookies to access profile data. Without them, you get:
```
❌ Failed to get user ID: 401, message='Unauthorized'
```

## ✅ Solution: Add Instagram Session Cookies

### Step 1: Get Your Instagram Session Cookie

1. **Open Instagram in your browser** (Chrome/Firefox/Edge)
2. **Log in to Instagram** with your account
3. **Open Developer Tools**:
   - Press `F12` OR
   - Right-click → "Inspect" → "Application" tab

4. **Navigate to Cookies**:
   - Chrome: `Application` → `Storage` → `Cookies` → `https://www.instagram.com`
   - Firefox: `Storage` → `Cookies` → `https://www.instagram.com`

5. **Find the `sessionid` cookie**:
   - Look for a cookie named **`sessionid`**
   - Copy its **Value** (long string like: `54321%3AABCD1234...`)
   - ⚠️ **Keep this PRIVATE** - it's like your Instagram password!

### Step 2: Add to Your Environment Variables

#### Option A: Add to `.env` file (Local Development)

1. Create/edit `.env` file in your project root:
```bash
VITE_INSTAGRAM_SESSION_ID=your_sessionid_value_here
```

2. **Example**:
```bash
VITE_INSTAGRAM_SESSION_ID=54321%3AABCD1234xyz...
```

3. **Restart your dev server** for changes to take effect

#### Option B: Add to Vercel (Production)

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add new variable:
   - **Name**: `VITE_INSTAGRAM_SESSION_ID`
   - **Value**: `your_sessionid_value_here`
3. **Redeploy** your project

---

## 🔍 How to Test It Works

### Browser Console Test:
```javascript
console.log('Instagram Session ID:', import.meta.env.VITE_INSTAGRAM_SESSION_ID);
// Should log your session ID (not undefined)
```

### Check Scraping Logs:
When scraping Instagram, you should see:
```
🔐 Instagram auth: Using session cookies ✓
```

Instead of:
```
⚠️ No session cookies (may fail with 401)
```

---

## ⚠️ Important Notes

### Security
- **Never commit `.env` to Git** - it's already in `.gitignore`
- **Never share your session ID** - treat it like a password
- Session IDs can be used to access your Instagram account

### Session Expiry
- Instagram session cookies **expire** after a few weeks/months
- If scraping stops working, get a fresh session cookie
- Signs of expired session:
  - 401 Unauthorized errors return
  - Scraper logs show "No session cookies"

### Best Practices
1. **Use a dedicated Instagram account** for scraping (not your personal)
2. **Don't spam requests** - Instagram may ban the account
3. **Rotate accounts** if scraping frequently
4. **Keep session ID updated** - set a reminder to refresh monthly

---

## 🎯 Alternative Solutions

### Option 1: Instagram Basic Display API (Official)
- ✅ More reliable, won't break
- ❌ Requires Meta App approval
- ❌ Limited to your own account
- 📚 https://developers.facebook.com/docs/instagram-basic-display-api

### Option 2: Use Different Scraper
Try another Apify actor:
- `apify/instagram-scraper` (different implementation)
- `clockworks/instagram-scraper` (might have different auth method)

### Option 3: Use Proxies + Rotation
- Rotate session cookies from multiple accounts
- Use different proxies per request
- More complex but more robust

---

## 🐛 Troubleshooting

### Still Getting 401 Errors?

1. **Verify session ID is correct**:
   - Check it's not expired
   - Try getting a fresh one
   - Make sure there are no extra spaces/characters

2. **Check environment variable is loaded**:
   ```javascript
   console.log(import.meta.env.VITE_INSTAGRAM_SESSION_ID);
   ```

3. **Clear browser cache** and log in to Instagram again

4. **Try incognito mode** to get a clean session

5. **Check Instagram account status**:
   - Make sure account isn't rate-limited
   - Try logging out and back in on browser

### Still Not Working?

The scraper actor might need updates. Try:
1. Contact Apify support
2. Check actor's GitHub issues
3. Try a different Instagram scraper actor
4. Consider using official Instagram API

---

## 📊 What Changed in Your Code

### Files Updated:
1. **`src/services/InstagramApiService.ts`**
   - Now reads `VITE_INSTAGRAM_SESSION_ID` from environment
   - Passes session cookie to Apify actor
   - Logs authentication status

2. **`src/services/AccountTrackingServiceFirebase.ts`**
   - Updated `fetchInstagramProfile()`
   - Updated `syncInstagramVideos()`
   - Both now use session cookies

### Before (No Auth):
```typescript
input: {
  urls: [url],
  proxyConfiguration: {...}
}
```

### After (With Auth):
```typescript
input: {
  urls: [url],
  sessionCookie: sessionId,  // ← NEW
  additionalCookies: [{      // ← NEW
    name: 'sessionid',
    value: sessionId,
    domain: '.instagram.com'
  }],
  proxyConfiguration: {...}
}
```

---

## ✅ Summary

1. Get Instagram `sessionid` cookie from browser
2. Add to `.env` as `VITE_INSTAGRAM_SESSION_ID=your_value`
3. Restart dev server / redeploy to Vercel
4. Scraping should now work! ✨

**Remember**: Session cookies expire - plan to refresh them monthly!

