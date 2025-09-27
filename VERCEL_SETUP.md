# 🚀 Vercel Deployment Setup

## 📋 **Environment Variables Required**

You need to set **ONE** environment variable in your Vercel dashboard:

### 🔑 **APIFY_TOKEN**
- **Value**: `apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu`
- **Description**: Your Apify API token for scraping Instagram/TikTok

## 🛠️ **How to Set Environment Variables in Vercel**

### Method 1: Vercel Dashboard (Recommended)
1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project → **Settings** → **Environment Variables**
3. Add new variable:
   - **Name**: `APIFY_TOKEN`
   - **Value**: `apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu`
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your project

### Method 2: Vercel CLI
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Set environment variable
vercel env add APIFY_TOKEN
# When prompted, enter: apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu
# Select: Production, Preview, Development

# Redeploy
vercel --prod
```

## 🔧 **Vercel Configuration**

Your `vercel.json` is already configured with:
- **API Route**: `/api/apify-proxy.ts` 
- **Timeout**: 5 minutes (300 seconds) for long-running scraping
- **CORS**: Handled automatically by the API proxy

## ✅ **Deployment Checklist**

- [ ] Set `APIFY_TOKEN` environment variable in Vercel
- [ ] Deploy/redeploy your project
- [ ] Test Instagram URL submission
- [ ] Test TikTok URL submission
- [ ] Verify charts display real data

## 🧪 **Testing After Deployment**

1. **Open your Vercel app**
2. **Submit an Instagram URL** (e.g., `https://www.instagram.com/reel/DHo-T-dp2QT/`)
3. **Check browser console** - you should see:
   ```
   🌐 Making Apify API call via Vercel proxy for actor: apify/instagram-scraper
   🎯 Actor run completed via proxy: [RUN_ID]
   ✅ Retrieved items from proxy response: 1
   ```
4. **Verify real data** appears in the dashboard

## 🚨 **If You Get Errors**

### "APIFY_TOKEN is not defined"
- Environment variable not set in Vercel
- **Solution**: Add `APIFY_TOKEN` in Vercel dashboard → Settings → Environment Variables

### "Function timeout"
- Apify scraping took longer than 5 minutes
- **Solution**: Already configured with 300s timeout in `vercel.json`

### "CORS errors"
- API proxy not working
- **Solution**: Ensure `/api/apify-proxy.ts` is deployed correctly

## 🎯 **Your App Structure**

```
Your Vercel App
├── Frontend (React) → Calls /api/apify-proxy
├── /api/apify-proxy.ts → Calls Apify API
└── Environment: APIFY_TOKEN
```

**No CORS issues because everything stays within your Vercel domain!** 🎉
