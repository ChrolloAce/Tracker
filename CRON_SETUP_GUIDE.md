# 🤖 Automated Video Refresh - Cron Job Setup Guide

This guide will help you set up automated video refreshing that runs every 12 hours on Vercel, even when your browser is closed.

## 📋 What It Does

The cron job automatically:
- ✅ Runs every 12 hours (at midnight and noon UTC)
- ✅ Refreshes all videos from all tracked accounts
- ✅ Updates metrics (views, likes, comments, shares)
- ✅ Works completely offline - no browser needed
- ✅ Logs detailed progress and errors
- ✅ Processes all organizations and projects

## 🔧 Setup Instructions

### 1. Get Firebase Service Account Key

You need a Firebase Admin SDK service account key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the **gear icon** ⚙️ > **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (keep it secret!)

### 2. Add Environment Variables to Vercel

Go to your Vercel project settings and add these environment variables:

#### Required Variables:

**`FIREBASE_SERVICE_ACCOUNT_KEY`**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```
*Paste the entire contents of your downloaded JSON file*

**`CRON_SECRET`**
```
your-random-secret-key-here
```
*Generate a random secret key (you can use: https://randomkeygen.com/)*

**`APIFY_TOKEN`**
```
apify_api_YOUR_TOKEN_HERE
```
*Your existing Apify API token*

### 3. Deploy to Vercel

After adding the environment variables:

```bash
git add -A
git commit -m "Add automated video refresh cron job"
git push origin main
```

Vercel will automatically deploy and start the cron job.

## 🎯 Cron Schedule

The default schedule is **every 12 hours**:
- **00:00 UTC** (midnight)
- **12:00 UTC** (noon)

To change the schedule, edit `vercel.json`:

```json
"crons": [
  {
    "path": "/api/cron-refresh-videos",
    "schedule": "0 */12 * * *"  // <- Change this
  }
]
```

### Common Schedules:

| Frequency | Cron Expression | Description |
|-----------|----------------|-------------|
| Every 6 hours | `0 */6 * * *` | 00:00, 06:00, 12:00, 18:00 UTC |
| Every 12 hours | `0 */12 * * *` | 00:00, 12:00 UTC |
| Every 24 hours | `0 0 * * *` | Midnight UTC |
| Every hour | `0 * * * *` | Every hour on the hour |
| Twice daily | `0 0,12 * * *` | Midnight and noon UTC |

## 🧪 Testing the Cron Job

### Manual Test (Recommended)

You can manually trigger the cron job to test it:

```bash
curl -X GET https://your-app.vercel.app/api/cron-refresh-videos \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use this command in your terminal:
```bash
curl -X GET https://tracker-red-zeta.vercel.app/api/cron-refresh-videos \
  -H "Authorization: Bearer $(echo $CRON_SECRET)"
```

### Check Logs

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Functions** tab
4. Click on `cron-refresh-videos`
5. View the logs to see execution details

## 📊 What Gets Logged

The cron job logs detailed information:

```
🚀 Starting automated video refresh job...
📊 Found 2 organizations

📁 Processing organization: org_abc123
  📂 Found 3 projects
  
  📦 Processing project: My Brand Project
    👥 Found 5 active accounts
    
    🔄 Refreshing @username (instagram)...
    ✅ Successfully refreshed 47 videos for @username
    
    🔄 Refreshing @another_user (tiktok)...
    ✅ Successfully refreshed 23 videos for @another_user

==========================================================
🎉 Video refresh job completed!
==========================================================
⏱️  Duration: 234.5s
📊 Accounts processed: 10
🎬 Videos refreshed: 478
❌ Failed accounts: 1
==========================================================
```

## 🔒 Security

The cron job is protected by:
- ✅ **CRON_SECRET** - Only requests with valid secret can execute
- ✅ **Vercel's built-in security** - Cron jobs are verified by Vercel
- ✅ **Firebase Admin SDK** - Secure server-side Firebase access

## ⚡ Performance Notes

- Each account has a **2-second delay** to avoid API rate limits
- Maximum execution time: **300 seconds (5 minutes)**
- Processes accounts sequentially to prevent overload
- Handles failures gracefully - continues even if one account fails

## 🐛 Troubleshooting

### Cron job not running?

1. **Check Environment Variables**
   - Make sure all 3 variables are set in Vercel
   - Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is valid JSON
   - Redeploy after adding variables

2. **Check Cron Configuration**
   - Verify `vercel.json` has the `crons` section
   - Make sure the schedule format is valid

3. **Check Logs**
   - Go to Vercel Dashboard → Functions → cron-refresh-videos
   - Look for error messages

### Getting 401 errors?

- The `CRON_SECRET` might be wrong or not set
- Make sure you're using the same secret in both:
  - Vercel environment variables
  - Your test curl command

### Videos not updating?

1. Check if the cron job is running (check logs)
2. Verify `APIFY_TOKEN` is valid
3. Make sure tracked accounts are marked as `isActive: true`

## 📈 Monitoring

You can monitor your cron jobs:

1. **Vercel Dashboard** → Your Project → **Crons**
   - See execution history
   - View success/failure rates
   - Check execution times

2. **Function Logs**
   - Detailed logs for each execution
   - Error messages and stack traces
   - Performance metrics

## 💡 Pro Tips

1. **Start with longer intervals** (12 hours) to avoid API rate limits
2. **Monitor the first few runs** to catch any issues early
3. **Set up Vercel notifications** to get alerts if cron jobs fail
4. **Check your Apify quota** - make sure you have enough runs
5. **Use the manual trigger** to test before relying on automation

## 🎉 Success!

Once set up, your videos will automatically refresh:
- ✅ No manual clicking required
- ✅ Works 24/7 even when offline
- ✅ Keeps your data fresh
- ✅ Scalable to hundreds of accounts
- ✅ Reliable and monitored by Vercel

## 🆘 Need Help?

If you encounter issues:
1. Check the logs in Vercel Dashboard
2. Verify all environment variables are set correctly
3. Test manually using the curl command
4. Make sure Firebase Admin SDK key is valid
5. Confirm Apify token has sufficient quota

