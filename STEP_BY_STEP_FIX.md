# 🚨 STEP-BY-STEP FIX FOR 401 ERROR

## You're Getting 401 Because...

Your Apify token is either:
1. ❌ NOT set in Vercel environment variables
2. ❌ Set with the wrong name
3. ❌ Not applied (forgot to redeploy)
4. ❌ Invalid token value

---

## ✅ EXACT STEPS TO FIX (Follow in Order)

### STEP 1: Get Your Real Apify Token

1. Open new tab: https://console.apify.com/account/integrations
2. Log in to your Apify account
3. Look for **"Personal API tokens"** section
4. You should see a token that starts with `apify_api_`
5. Click the **COPY** button (or "Show" then copy)

**IMPORTANT:** The token in your `instagram.txt` shows as `***` - that's just a placeholder. You need the REAL token from Apify console.

---

### STEP 2: Set Token in Vercel (EXACT STEPS)

1. **Open Vercel Dashboard:**
   - Go to: https://vercel.com/dashboard
   - Click on your project (tracker)

2. **Go to Settings:**
   - Click **"Settings"** tab at the top
   - Click **"Environment Variables"** in the left sidebar

3. **Check if APIFY_TOKEN exists:**
   - Do you see a variable named `APIFY_TOKEN`?
   
   **If YES:** 
   - Click the **3 dots** next to it
   - Click **"Edit"**
   - Paste your NEW token from Step 1
   - Make sure ALL environments are checked (Production, Preview, Development)
   - Click **"Save"**
   
   **If NO:**
   - Click **"Add New"** button
   - **Name:** Type exactly: `APIFY_TOKEN` (all caps, no spaces)
   - **Value:** Paste your token from Step 1
   - **Environments:** Check ALL three boxes:
     - ☑️ Production
     - ☑️ Preview  
     - ☑️ Development
   - Click **"Save"**

---

### STEP 3: Redeploy (CRITICAL!)

Environment variables only work AFTER you redeploy!

**Option A - Quick Redeploy:**
1. In Vercel Dashboard, click **"Deployments"** tab
2. Find the latest deployment (top one)
3. Click the **3 dots** on the right
4. Click **"Redeploy"**
5. Click **"Redeploy"** again to confirm
6. Wait 1-2 minutes for it to finish

**Option B - Git Push:**
```bash
cd /Users/ernestolopez/Desktop/Scrpa
git add .
git commit -m "Fix Apify token"
git push
```

**⚠️ WAIT for the deployment to finish before testing!**

---

### STEP 4: Test Your Token

After deployment finishes, open this URL:
```
https://tracker-o2vmd0zhn-chrolloaces-projects.vercel.app/api/test-apify-token
```

**What you should see:**

✅ **SUCCESS (Token is valid):**
```json
{
  "success": true,
  "message": "Apify token is valid! ✅",
  "accountInfo": {
    "username": "your-username",
    "plan": "FREE"
  }
}
```

❌ **FAILURE (Token not set):**
```json
{
  "success": false,
  "error": "APIFY_TOKEN not set"
}
```

❌ **FAILURE (Token invalid):**
```json
{
  "success": false,
  "error": "Invalid Apify token",
  "status": 401
}
```

---

### STEP 5: Try Adding Account Again

Once the test endpoint shows SUCCESS:
1. Go to your app
2. Try adding a TikTok/Instagram account
3. Should work now! 🎉

---

## 🔍 Common Mistakes (Check These!)

### Mistake 1: Variable Name is Wrong
- ❌ WRONG: `APIFY_API_TOKEN`
- ❌ WRONG: `APIFY-TOKEN`
- ❌ WRONG: `apify_token` (lowercase)
- ✅ CORRECT: `APIFY_TOKEN` (exactly like this)

### Mistake 2: Forgot to Redeploy
- Setting the variable is NOT enough
- You MUST redeploy for it to take effect
- Check Deployments tab - should see a new deployment after Step 3

### Mistake 3: Wrong Environments
- Must check ALL three boxes (Production, Preview, Development)
- If you only checked one, edit it and check all

### Mistake 4: Token has Extra Spaces
- Make sure no spaces before/after the token
- Should be: `apify_api_xxxxxxxxx` (no spaces)

### Mistake 5: Used the `***` from instagram.txt
- The `***` is just a placeholder in documentation
- You need the REAL token from Apify console

---

## 📸 Visual Checklist

In Vercel Settings → Environment Variables, you should see:

```
Name: APIFY_TOKEN
Value: apify_api_7wvIrJjtE... (your actual token)
Environments: Production, Preview, Development ✓ ✓ ✓
```

---

## 🆘 Still Getting 401?

Run through this checklist:

- [ ] I copied the token from https://console.apify.com/account/integrations
- [ ] I set APIFY_TOKEN (exact spelling) in Vercel
- [ ] I checked ALL three environment boxes
- [ ] I clicked "Save"
- [ ] I redeployed (saw new deployment in Deployments tab)
- [ ] I waited for deployment to finish (green checkmark)
- [ ] I tested /api/test-apify-token endpoint
- [ ] The test shows "success": true

If all checked and still failing:

1. **Screenshot your Vercel Environment Variables page** (blur the token value)
2. **Copy the full error** from /api/test-apify-token
3. **Check Apify billing:** https://console.apify.com/billing - do you have credits?

---

## 🎯 Quick Test Command

After fixing, run this:

```bash
# Test token
curl https://tracker-o2vmd0zhn-chrolloaces-projects.vercel.app/api/test-apify-token

# Should see: "success": true
```

---

## Why This Happens

```
Your Code
    ↓
Calls /api/apify-proxy
    ↓
Reads process.env.APIFY_TOKEN
    ↓
Token is undefined/invalid ← YOU ARE HERE
    ↓
Apify API returns 401
    ↓
"TikTok API returned 401"
```

The error message is misleading - it's not TikTok that's rejecting you, it's Apify!

---

**Ready?** Follow Steps 1-5 above in exact order. Should take 5 minutes total.

