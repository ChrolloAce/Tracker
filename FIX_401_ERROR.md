# 🚨 FIX: 401 Unauthorized Error

## Problem
You're getting **401 errors** for ALL platforms (TikTok, YouTube, Instagram, Twitter). This means your **Apify API token is invalid or not set**.

```
TikTok API returned 401
```

This is NOT a TikTok issue - it's an Apify authentication issue.

---

## ✅ SOLUTION (5 minutes)

### Step 1: Test Your Token

First, check if your token is set correctly:

```bash
# Visit this URL (replace with your Vercel URL)
https://tracker-o2vmd0zhn-chrolloaces-projects.vercel.app/api/test-apify-token
```

Or via cURL:
```bash
curl "https://tracker-o2vmd0zhn-chrolloaces-projects.vercel.app/api/test-apify-token"
```

### Step 2: Get a New Apify Token

1. **Go to Apify Console:**
   - Visit: https://console.apify.com/account/integrations
   - Log in if needed

2. **Copy Your Personal API Token:**
   - Look for "Personal API tokens" section
   - Copy the token (starts with `apify_api_`)
   - **OR** Create a new one if you don't have one

3. **Check Your Apify Credits:**
   - While you're there, check: https://console.apify.com/billing
   - Make sure you have credits available (even free tier should work)

### Step 3: Set Token in Vercel

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Go to Settings → Environment Variables:**
   - Click "Settings" in the top menu
   - Click "Environment Variables" in the left sidebar

3. **Add or Update APIFY_TOKEN:**
   - **If it exists:** Edit it and paste your new token
   - **If it doesn't exist:** Click "Add New"
     - Name: `APIFY_TOKEN`
     - Value: `apify_api_YOUR_TOKEN_HERE`
     - Environment: Select ALL (Production, Preview, Development)
   - Click "Save"

### Step 4: Redeploy

1. **Trigger a new deployment:**
   - Go to Deployments tab
   - Click "Redeploy" on the latest deployment
   - **OR** push a small change to git

2. **Wait ~1 minute** for deployment to complete

3. **Test immediately:**
   ```bash
   curl "https://your-app.vercel.app/api/test-apify-token"
   ```

---

## 🧪 Quick Test

After setting the token, test with this simple command:

```bash
# This should return "success": true
curl "https://your-app.vercel.app/api/test-apify-token"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Apify token is valid! ✅",
  "accountInfo": {
    "username": "your-username",
    "plan": "FREE" or "PAID"
  }
}
```

---

## 🔍 Common Issues

### Issue 1: Token Not Set
**Error:** "APIFY_TOKEN not set"

**Solution:** You forgot to set the environment variable in Vercel. Go to Step 3 above.

### Issue 2: Token Invalid
**Error:** "Your APIFY_TOKEN is set but it's invalid"

**Solution:** The token is wrong or expired. Get a fresh token from Apify (Step 2).

### Issue 3: Out of Credits
**Error:** Token is valid but actors fail

**Solution:** 
- Check https://console.apify.com/billing
- Add credits or upgrade plan
- Even free tier should work for basic scraping

### Issue 4: Didn't Redeploy
**Error:** Still getting 401 after setting token

**Solution:** You MUST redeploy after changing environment variables! Go to Step 4.

---

## 📊 What's Happening

The error flow:
```
Your App → Apify API → 401 Unauthorized → Fails
```

Why:
- Your code is trying to use Apify scrapers (TikTok, Instagram, etc.)
- Apify requires an API token for authentication
- Your token is either missing, invalid, or expired
- Apify rejects the request with 401

---

## ✅ Verification Checklist

After fixing, verify:

- [ ] Test endpoint returns "success": true
- [ ] Token is set in Vercel environment variables
- [ ] Token is valid (check on Apify console)
- [ ] You redeployed after setting the token
- [ ] Apify account has credits available
- [ ] Try adding a TikTok account again

---

## 🎯 One-Command Test

After deploying, run this to test everything:

```bash
# Test token (should work)
curl "https://your-app.vercel.app/api/test-apify-token"

# Test TikTok scraper (should work)
curl "https://your-app.vercel.app/api/test-apify-token" && \
echo "Token OK! Now testing actual account sync..."

# Then try adding an account in your app
```

---

## 💡 Pro Tip

Add this to your `.env.local` for local development:

```bash
APIFY_TOKEN=apify_api_YOUR_TOKEN_HERE
```

This way it works locally too!

---

## 🆘 Still Not Working?

If you followed all steps and still get 401:

1. **Check Vercel deployment logs:**
   - Go to Vercel Dashboard → Deployments → Latest → View Function Logs
   - Look for "🔑 Using token:" message
   - Should show "Token found"

2. **Verify environment variable is set:**
   - Vercel Dashboard → Settings → Environment Variables
   - APIFY_TOKEN should be there

3. **Make sure you redeployed:**
   - Environment variables only take effect after redeployment
   - Push a commit or manually redeploy

4. **Check Apify status:**
   - Visit https://status.apify.com/
   - Make sure Apify isn't down

---

## 📁 Files Changed

- ✅ `api/test-apify-token.ts` - NEW diagnostic endpoint
- ✅ `api/apify-proxy.ts` - Better 401 error messages
- ✅ `FIX_401_ERROR.md` - This guide

Deploy these changes, set your token, and you're good to go! 🚀

