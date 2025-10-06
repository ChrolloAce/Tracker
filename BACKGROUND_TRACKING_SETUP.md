# 🚀 Background Tracking System Setup

## Overview

Your account tracking system now runs **completely in the background**! When you add an account to track, the request is queued and processed by serverless functions. **You can close the tab immediately** - the job will continue running and complete automatically.

## How It Works

```
User Clicks "Track Account"
        ↓
Job Created in Firestore (pending)
        ↓
UI Shows Job Status (real-time)
        ↓
Cron Triggers Processor (every minute)
        ↓
Serverless Function Processes Job
        ↓
Account & Videos Added to Database
        ↓
Job Marked as Completed
        ↓
UI Updates Automatically ✅
```

## Architecture

### 1. **TrackingJobService** (`src/services/TrackingJobService.ts`)
- Creates tracking jobs in Firestore
- Watches job status in real-time
- Provides retry/cancel functionality

### 2. **Process Tracking Job API** (`api/process-tracking-job.ts`)
- Serverless function that processes one job at a time
- Fetches account data from social media platforms
- Saves account and videos to Firestore
- Updates job progress in real-time (0% → 100%)
- Automatic retry logic (3 attempts)

### 3. **Trigger Tracking Processor** (`api/trigger-tracking-processor.ts`)
- Cron job that runs **every minute**
- Finds pending jobs and triggers the processor
- Configured in `vercel.json`

### 4. **TrackingJobsPanel** (`src/components/TrackingJobsPanel.tsx`)
- Real-time UI panel showing job progress
- Appears bottom-right when jobs are active
- Auto-updates via Firestore listeners
- Shows progress bars, status, and error messages

## Environment Variables Required

Add these to your Vercel project settings:

### Required
```bash
# Firebase Admin (for serverless functions)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'

# Security
CRON_SECRET='your-random-secret-here'

# Base URL (auto-set by Vercel)
VERCEL_URL='your-app.vercel.app'

# Apify Proxy URL (if using Apify)
APIFY_PROXY_URL='https://your-app.vercel.app'
```

### Frontend (.env)
```bash
# For triggering processor from UI
VITE_CRON_SECRET='same-as-above'
```

## Deployment Steps

### 1. **Add Environment Variables to Vercel**

```bash
# Via Vercel Dashboard
Settings → Environment Variables → Add New

# Or via CLI
vercel env add CRON_SECRET production
vercel env add FIREBASE_SERVICE_ACCOUNT_KEY production
```

### 2. **Deploy Firestore Rules**

```bash
./deploy-firestore.sh
```

This adds security rules for the `trackingJobs` collection.

### 3. **Deploy to Vercel**

```bash
git add -A
git commit -m "feat: Add background tracking system"
git push origin main
```

Vercel will automatically:
- Deploy the serverless functions
- Set up the cron job
- Enable the background processor

### 4. **Verify Cron is Running**

Check Vercel Dashboard:
- Go to **Deployments** → **Functions** → **Cron Jobs**
- You should see `/api/trigger-tracking-processor` scheduled for `* * * * *` (every minute)

## How to Use

### For Users

1. **Add Account** → Click "Track Account" button
2. **See Job Status** → Panel appears bottom-right showing progress
3. **Close Tab** → Feel free! Job continues in background
4. **Come Back Later** → Account will be tracked with all videos

### For Developers

#### Create a Tracking Job

```typescript
import TrackingJobService from './services/TrackingJobService';

const jobId = await TrackingJobService.createJob(
  orgId,
  projectId,
  userId,
  'influencer_username',
  'instagram', // or 'tiktok', 'youtube', 'twitter'
  'competitor' // or 'my'
);
```

#### Watch Job Progress

```typescript
const unsubscribe = TrackingJobService.watchJob(
  jobId,
  (job) => {
    console.log(`Progress: ${job.progress}%`);
    console.log(`Status: ${job.status}`);
    console.log(`Message: ${job.message}`);
    
    if (job.status === 'completed') {
      console.log(`Account ID: ${job.accountId}`);
    }
  },
  (error) => console.error(error)
);

// Cleanup
unsubscribe();
```

#### Retry a Failed Job

```typescript
await TrackingJobService.retryJob(jobId);
```

#### Cancel a Pending Job

```typescript
await TrackingJobService.cancelJob(jobId);
```

## Integration with AccountsPage

The `TrackingJobsPanel` component should be added to pages where you add accounts:

```tsx
import TrackingJobsPanel from './TrackingJobsPanel';

function AccountsPage() {
  return (
    <div>
      {/* Your existing content */}
      
      {/* Add this at the end */}
      <TrackingJobsPanel 
        onJobCompleted={(accountId) => {
          // Refresh your accounts list
          loadAccounts();
        }}
      />
    </div>
  );
}
```

## Job Lifecycle

### Status Flow
```
pending → processing → completed
   ↓           ↓
   ↓       failed (auto-retry up to 3x)
   ↓
cancelled
```

### Progress Stages
- **0%** - Job created, waiting to start
- **30%** - Account data fetched
- **50%** - Account saved to database
- **70%** - Videos fetched
- **100%** - All videos saved, job complete

## Monitoring

### View All Jobs (Admin)

```typescript
const jobs = await TrackingJobService.getProjectJobs(orgId, projectId);
console.log(`Total jobs: ${jobs.length}`);
```

### Cleanup Old Jobs (Optional)

```typescript
// Delete jobs older than 7 days
const deletedCount = await TrackingJobService.cleanupOldJobs(7);
console.log(`Cleaned up ${deletedCount} old jobs`);
```

## Troubleshooting

### Job Stuck in "Pending"

**Problem:** Job stays at "Waiting to start..." forever

**Solution:**
1. Check if cron job is running in Vercel dashboard
2. Manually trigger processor: `curl https://your-app.vercel.app/api/trigger-tracking-processor?secret=YOUR_SECRET`
3. Check logs in Vercel for errors

### Job Failed After 3 Retries

**Problem:** Job status is "failed" with error message

**Common Causes:**
- Invalid username (doesn't exist)
- Platform API down or rate-limited
- Missing API credentials

**Solution:**
- Fix the issue
- Click "Retry" button in the UI
- Or manually: `TrackingJobService.retryJob(jobId)`

### Cron Not Running

**Problem:** Cron job doesn't trigger every minute

**Solution:**
1. Verify `vercel.json` has correct cron configuration
2. Check Vercel plan supports cron jobs (Pro plan required)
3. Redeploy: `vercel --prod`

### Firestore Permission Denied

**Problem:** Can't create or read tracking jobs

**Solution:**
1. Deploy updated Firestore rules: `./deploy-firestore.sh`
2. Verify user is authenticated
3. Check user is a member of the organization

## Performance

- **Max Duration:** 300 seconds (5 minutes) per job
- **Concurrent Jobs:** 1 at a time (sequential processing)
- **Retry Limit:** 3 attempts
- **Auto-cleanup:** Jobs older than 7 days can be deleted

## Security

- ✅ Jobs are organization-scoped (users only see their org's jobs)
- ✅ Firestore rules prevent unauthorized access
- ✅ Cron endpoint requires secret key
- ✅ Serverless functions use Firebase Admin SDK

## Future Enhancements

- [ ] Process multiple jobs in parallel
- [ ] Priority queue for urgent accounts
- [ ] Email notifications on job completion
- [ ] Webhook support for job events
- [ ] Scheduled periodic refreshes for accounts

## Cost Optimization

- Cron runs every minute but only processes if jobs exist
- Jobs auto-cleanup after 7 days to reduce Firestore reads
- Functions have 5-minute timeout (adjust if needed)
- Consider increasing cron interval to save costs: `*/5 * * * *` (every 5 minutes)

---

**Need help?** Check Vercel function logs for detailed error messages.
