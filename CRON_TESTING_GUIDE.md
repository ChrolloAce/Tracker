# 🧪 Cron Testing & Debugging Guide

Complete guide to test, debug, and monitor your automated video refresh cron jobs.

## 🎯 Quick Testing Options

### Option 1: Manual Trigger (Instant Test)

Call this URL anytime to trigger the cron job immediately:

```
https://tracker-red-zeta.vercel.app/api/cron-test
```

Just open that URL in your browser or use:

```bash
curl https://tracker-red-zeta.vercel.app/api/cron-test
```

✅ **No authentication needed** - It's a test endpoint!

---

### Option 2: Status Dashboard (Visual Monitoring)

View real-time status of all your accounts:

```
https://tracker-red-zeta.vercel.app/api/cron-status
```

This shows:
- ✅ All organizations, projects, and accounts
- ✅ How many videos each account has
- ✅ When each account was last synced
- ✅ Time since last sync (color-coded)
- ✅ One-click manual trigger button

---

### Option 3: Test with Short Intervals

To test with shorter intervals (every 1 minute, every hour, etc.), temporarily update `vercel.json`:

**For 1-minute testing:**
```json
"crons": [
  {
    "path": "/api/cron-refresh-videos",
    "schedule": "* * * * *",
    "comment": "TEST ONLY: Every minute"
  }
]
```

**For 5-minute testing:**
```json
"crons": [
  {
    "path": "/api/cron-refresh-videos",
    "schedule": "*/5 * * * *",
    "comment": "TEST ONLY: Every 5 minutes"
  }
]
```

**For hourly testing:**
```json
"crons": [
  {
    "path": "/api/cron-refresh-videos",
    "schedule": "0 * * * *",
    "comment": "TEST ONLY: Every hour"
  }
]
```

⚠️ **Remember to change it back to production schedule:**
```json
"crons": [
  {
    "path": "/api/cron-refresh-videos",
    "schedule": "0 */12 * * *",
    "comment": "Production: Every 12 hours"
  }
]
```

---

## 📊 Monitoring & Debugging

### 1. View Cron Execution Logs

**Vercel Dashboard:**
1. Go to your project → **Crons** tab
2. See all executions with timestamps
3. Click any execution to see detailed logs

**Or view function logs:**
1. Go to **Functions** tab
2. Click `cron-refresh-videos`
3. View real-time logs

### 2. Check What's Being Processed

The cron job logs detailed information:

```
🚀 Starting automated video refresh job...
📊 Found 2 organizations

📁 Processing organization: org_abc123
  📂 Found 3 projects
  
  📦 Processing project: My Brand
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

### 3. Monitor from Command Line

Test with curl and see the response:

```bash
curl -X GET https://tracker-red-zeta.vercel.app/api/cron-test
```

You'll get a JSON response with:
```json
{
  "success": true,
  "duration": "234.5s",
  "timestamp": "2025-10-02T12:00:00.000Z",
  "stats": {
    "totalOrganizations": 2,
    "totalAccountsProcessed": 10,
    "totalVideosRefreshed": 478,
    "failedAccounts": 1
  },
  "failures": [
    {
      "org": "org_123",
      "project": "project_456",
      "account": "username",
      "error": "Rate limited"
    }
  ]
}
```

---

## 🎮 Testing Workflow

### Full Testing Sequence:

1. **Check Current Status**
   ```
   Open: https://tracker-red-zeta.vercel.app/api/cron-status
   ```
   - See when accounts were last synced
   - Note the current video counts

2. **Trigger Manual Refresh**
   ```
   Open: https://tracker-red-zeta.vercel.app/api/cron-test
   ```
   - Wait for it to complete (can take 2-5 minutes)

3. **Verify Changes**
   ```
   Refresh: https://tracker-red-zeta.vercel.app/api/cron-status
   ```
   - Check if "Last Synced" times updated
   - Verify video counts increased

4. **Check Vercel Logs**
   - Go to Vercel Dashboard → Functions → cron-refresh-videos
   - Review detailed execution logs

---

## 🔧 Common Testing Scenarios

### Test a Single Account Refresh
Use the manual trigger and watch the logs to see how one account gets processed.

### Test Rate Limiting
Set cron to 1-minute intervals and see how the 2-second delay between accounts works.

### Test Error Handling
Temporarily add an invalid account and see how the cron handles failures without stopping.

### Test Large Datasets
If you have many accounts, measure how long the full refresh takes.

---

## 📈 Performance Monitoring

Track these metrics:

| Metric | Good | Warning | Action Needed |
|--------|------|---------|---------------|
| Duration | < 2 min | 2-4 min | > 5 min |
| Success Rate | > 95% | 90-95% | < 90% |
| Videos Refreshed | As expected | Fewer than expected | Very few |
| Failed Accounts | 0-1 | 2-3 | > 3 |

---

## 🐛 Troubleshooting

### Cron isn't running?

1. **Check Environment Variables**
   - Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is set
   - Verify `CRON_SECRET` is set
   - Verify `APIFY_TOKEN` is set

2. **Check Vercel Cron Configuration**
   - Go to Vercel → Project → Crons
   - Make sure the cron is listed and enabled
   - Check for any error indicators

3. **Test Manually First**
   - Use `/api/cron-test` to verify the logic works
   - If manual test fails, fix before relying on automated cron

### Videos not updating?

1. **Check Apify Quota**
   - You might have hit your Apify API limit
   - Check Apify dashboard for usage

2. **Check Account Status**
   - Make sure accounts are marked as `isActive: true`
   - Verify accounts exist in Firebase

3. **Check API Responses**
   - Look at logs for Apify API errors
   - Might be rate limited or invalid credentials

### Slow Performance?

1. **Reduce Accounts**
   - The more accounts, the longer it takes
   - Each account has a 2-second delay

2. **Optimize Delay**
   - Current: 2 seconds between accounts
   - Can reduce if not hitting rate limits

3. **Batch Processing**
   - Consider processing different projects in parallel (future enhancement)

---

## 📅 Schedule Reference

Quick reference for cron schedules:

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every minute | `* * * * *` | Testing only |
| Every 5 minutes | `*/5 * * * *` | Testing only |
| Every 15 minutes | `*/15 * * * *` | Testing only |
| Every hour | `0 * * * *` | Frequent updates |
| Every 6 hours | `0 */6 * * *` | Good balance |
| Every 12 hours | `0 */12 * * *` | **Production default** |
| Daily at midnight | `0 0 * * *` | Once per day |
| Twice daily | `0 0,12 * * *` | Noon & midnight |

---

## 🚨 Important Notes

### During Testing:

- ⚠️ Short intervals (1-5 min) consume Apify quota quickly
- ⚠️ Don't leave 1-minute crons running in production
- ⚠️ Monitor Vercel function execution time (max 5 minutes)
- ⚠️ Check Apify pricing if testing extensively

### Best Practices:

- ✅ Test with manual trigger first
- ✅ Use status dashboard to verify results
- ✅ Start with longer intervals (1-6 hours)
- ✅ Monitor logs for first few executions
- ✅ Set up Vercel notifications for failures

---

## 🎉 Success Checklist

After testing, verify:

- [ ] Manual trigger works (`/api/cron-test`)
- [ ] Status dashboard shows accounts (`/api/cron-status`)
- [ ] Videos are updating (check lastSynced times)
- [ ] Logs show successful execution
- [ ] No errors in Vercel function logs
- [ ] Apify quota is sufficient
- [ ] Cron schedule is set to production (12 hours)

---

## 🆘 Get Help

If issues persist:

1. Check the function logs in Vercel
2. Run manual test and copy the full response
3. Verify environment variables are correct
4. Check Apify dashboard for API issues
5. Verify Firebase has active accounts with `isActive: true`

---

## 🔗 Quick Links

- **Status Dashboard**: https://tracker-red-zeta.vercel.app/api/cron-status
- **Manual Trigger**: https://tracker-red-zeta.vercel.app/api/cron-test
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Apify Dashboard**: https://console.apify.com/
- **Firebase Console**: https://console.firebase.google.com/

Happy testing! 🚀

