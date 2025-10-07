# ⚡ QUICK FIX: 401 Error (2 minutes)

## The Problem
**All platforms returning 401?** → Your Apify token is missing/invalid.

## The Fix (2 Steps)

### 1️⃣ Get Your Apify Token
Go to: https://console.apify.com/account/integrations
- Copy your "Personal API token" (starts with `apify_api_`)
- If you don't have one, click "Create new token"

### 2️⃣ Set in Vercel
Go to: https://vercel.com/dashboard
- Select your project
- Settings → Environment Variables
- Add new variable:
  - **Name:** `APIFY_TOKEN`
  - **Value:** `apify_api_YOUR_TOKEN_HERE`
  - **Environments:** Check ALL (Production, Preview, Development)
- Click Save
- **IMPORTANT:** Click "Redeploy" on your latest deployment

## ✅ Test It
Visit: `https://your-vercel-app.vercel.app/api/test-apify-token`

Should see:
```json
{"success": true, "message": "Apify token is valid! ✅"}
```

## That's It!
Now try adding a TikTok/Instagram/Twitter account again. Should work! 🎉

---

**Still stuck?** See `FIX_401_ERROR.md` for detailed troubleshooting.

