# ⚠️ REQUIRED: Vercel Environment Variables

You need to set these **IMMEDIATELY** in Vercel for the background sync to work!

## 🚨 Critical Variables (MUST SET NOW)

### 1. APIFY_TOKEN
```
Name:  APIFY_TOKEN
Value: apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu
```
**Without this, you'll get 401 errors for TikTok and YouTube!**

### 2. CRON_SECRET
```
Name:  CRON_SECRET
Value: cron_9k2mL7xP4vQn8wR5tYuH3jF6bN1dS0eZ
```
**Already set (you provided this earlier)**

### 3. RESEND_API_KEY
```
Name:  RESEND_API_KEY
Value: re_QdN3ugAr_NsKxb9N9tyfsj1pukCN3eUcT
```
**For email notifications**

## 🔥 Firebase Variables (MUST SET)

### 4. FIREBASE_PROJECT_ID
```
Name:  FIREBASE_PROJECT_ID
Value: trackview-6a3a5
```

### 5. FIREBASE_CLIENT_EMAIL
```
Name:  FIREBASE_CLIENT_EMAIL
Value: firebase-adminsdk-xxxxx@trackview-6a3a5.iam.gserviceaccount.com
```
**(Get from your Firebase service account key)**

### 6. FIREBASE_PRIVATE_KEY
```
Name:  FIREBASE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----\nMIIE...your key here...\n-----END PRIVATE KEY-----
```
**(Get from your Firebase service account key - keep the \n characters!)**

### 7. FIREBASE_SERVICE_ACCOUNT_KEY
```
Name:  FIREBASE_SERVICE_ACCOUNT_KEY
Value: {"type":"service_account","project_id":"trackview-6a3a5",...}
```
**(Full JSON service account key)**

---

## 📝 How to Set in Vercel:

1. Go to https://vercel.com/dashboard
2. Click your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New** for each variable above
5. Select **All Environments** (Production, Preview, Development)
6. Click **Save**
7. **IMPORTANT:** After adding all variables, click **Redeploy** at the top!

---

## ✅ Test After Setting:

1. Wait 2 minutes for redeploy
2. Delete any stuck accounts
3. Add a new account (MrBeast, trynocontact, etc.)
4. Should see:
   ```
   ✅ Fetched 50-100 videos
   ✅ Completed sync - 100 videos saved
   ```
5. Refresh dashboard → Videos appear!

---

## 🔍 Current Issue:

```
❌ YouTube API returned 401
❌ TikTok API returned 401
```

**This means `APIFY_TOKEN` is NOT set in Vercel!**

Without this token, the server can't authenticate with Apify to fetch videos.

---

## 🚨 DO THIS NOW:

1. Set `APIFY_TOKEN` in Vercel (value above)
2. Set all Firebase variables (if not already set)
3. Click **Redeploy** in Vercel
4. Wait 2 minutes
5. Test again

**This will fix the 401 errors!** 🚀

