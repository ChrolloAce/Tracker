import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

interface TrackingJob {
  id: string;
  orgId: string;
  projectId: string;
  userId: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  accountType: 'my' | 'competitor';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  accountId?: string;
  error?: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  retryCount: number;
}

/**
 * Process Tracking Job API
 * 
 * This endpoint processes account tracking jobs in the background.
 * It can be called manually or via a cron job to process pending jobs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId, secret } = req.body;

    // Verify secret key for security
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If jobId is provided, process that specific job
    // Otherwise, find and process the next pending job
    let jobDoc;
    
    if (jobId) {
      jobDoc = await db.collection('trackingJobs').doc(jobId).get();
      if (!jobDoc.exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
    } else {
      // Find the oldest pending job
      const pendingJobs = await db.collection('trackingJobs')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (pendingJobs.empty) {
        return res.status(200).json({ message: 'No pending jobs to process' });
      }

      jobDoc = pendingJobs.docs[0];
    }

    const job = jobDoc.data() as TrackingJob;
    const jobRef = jobDoc.ref;

    // Update job status to processing
    await jobRef.update({
      status: 'processing',
      startedAt: Timestamp.now(),
      message: 'Starting to fetch account data...'
    });

    console.log(`🚀 Processing job ${jobDoc.id} for @${job.username} on ${job.platform}`);

    // Process the account based on platform
    try {
      let accountData: any;
      
      if (job.platform === 'youtube') {
        accountData = await fetchYoutubeAccount(job.username);
      } else if (job.platform === 'twitter') {
        accountData = await fetchTwitterAccount(job.username);
      } else {
        accountData = await fetchInstagramTikTokAccount(job.username, job.platform);
      }

      // Update progress
      await jobRef.update({
        progress: 30,
        message: 'Account data fetched, saving to database...'
      });

      // Create the tracked account in Firestore
      const accountRef = await db
        .collection('organizations')
        .doc(job.orgId)
        .collection('projects')
        .doc(job.projectId)
        .collection('trackedAccounts')
        .add({
          username: job.username,
          platform: job.platform,
          accountType: job.accountType,
          displayName: accountData.displayName,
          followerCount: accountData.followerCount || 0,
          followingCount: accountData.followingCount || 0,
          bio: accountData.bio || '',
          profilePicture: accountData.profilePicture || '',
          isVerified: accountData.isVerified || false,
          isActive: true,
          totalVideos: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          dateAdded: Timestamp.now(),
          addedBy: job.userId,
          orgId: job.orgId,
          projectId: job.projectId
        });

      const accountId = accountRef.id;

      // Update progress
      await jobRef.update({
        progress: 50,
        message: 'Fetching videos...',
        accountId
      });

      // Fetch videos (limit to first 50 for initial load)
      const videos = await fetchAccountVideos(job.username, job.platform, 50);

      // Update progress
      await jobRef.update({
        progress: 70,
        message: `Saving ${videos.length} videos...`
      });

      // Save videos to Firestore
      const videoPromises = videos.map((video: any) => {
        return db
          .collection('organizations')
          .doc(job.orgId)
          .collection('projects')
          .doc(job.projectId)
          .collection('trackedAccounts')
          .doc(accountId)
          .collection('videos')
          .add({
            platform: job.platform,
            url: video.url || '',
            videoId: video.videoId,
            title: video.title || '',
            description: video.description || '',
            thumbnail: video.thumbnail || '',
            uploadDate: video.uploadDate ? Timestamp.fromDate(new Date(video.uploadDate)) : Timestamp.now(),
            views: video.views || 0,
            likes: video.likes || 0,
            comments: video.comments || 0,
            shares: video.shares || 0,
            duration: video.duration || 0,
            status: 'active',
            trackedAccountId: accountId,
            dateAdded: Timestamp.now(),
            addedBy: job.userId,
            orgId: job.orgId
          });
      });

      await Promise.all(videoPromises);

      // Update account stats
      const totalViews = videos.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
      const totalLikes = videos.reduce((sum: number, v: any) => sum + (v.likes || 0), 0);
      const totalComments = videos.reduce((sum: number, v: any) => sum + (v.comments || 0), 0);
      const totalShares = videos.reduce((sum: number, v: any) => sum + (v.shares || 0), 0);

      await accountRef.update({
        totalVideos: videos.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        lastSynced: Timestamp.now()
      });

      // Mark job as completed
      await jobRef.update({
        status: 'completed',
        progress: 100,
        message: `Successfully tracked @${job.username} with ${videos.length} videos`,
        completedAt: Timestamp.now()
      });

      console.log(`✅ Job ${jobDoc.id} completed successfully`);

      return res.status(200).json({
        success: true,
        jobId: jobDoc.id,
        accountId,
        videosAdded: videos.length
      });

    } catch (error: any) {
      console.error(`❌ Job ${jobDoc.id} failed:`, error);

      // Increment retry count
      const newRetryCount = (job.retryCount || 0) + 1;
      const maxRetries = 3;

      if (newRetryCount >= maxRetries) {
        // Max retries reached, mark as failed
        await jobRef.update({
          status: 'failed',
          error: error.message || 'Unknown error',
          message: `Failed after ${maxRetries} attempts: ${error.message}`,
          completedAt: Timestamp.now()
        });

        return res.status(500).json({
          success: false,
          error: `Failed after ${maxRetries} attempts`,
          jobId: jobDoc.id
        });
      } else {
        // Retry later
        await jobRef.update({
          status: 'pending',
          retryCount: newRetryCount,
          message: `Retry ${newRetryCount}/${maxRetries}: ${error.message}`,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: error.message,
          willRetry: true,
          retryCount: newRetryCount,
          jobId: jobDoc.id
        });
      }
    }

  } catch (error: any) {
    console.error('❌ Error processing job:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper functions to fetch data from different platforms
async function fetchInstagramTikTokAccount(username: string, platform: string) {
  const response = await fetch(`${process.env.APIFY_PROXY_URL || 'http://localhost:3000'}/api/apify-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform,
      username,
      action: 'profile'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${platform} profile`);
  }

  return response.json();
}

async function fetchYoutubeAccount(username: string) {
  const response = await fetch(`${process.env.APIFY_PROXY_URL || 'http://localhost:3000'}/api/youtube-channel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch YouTube channel');
  }

  return response.json();
}

async function fetchTwitterAccount(username: string) {
  // Implement Twitter fetching logic
  throw new Error('Twitter fetching not yet implemented');
}

async function fetchAccountVideos(username: string, platform: string, limit: number = 50) {
  const response = await fetch(`${process.env.APIFY_PROXY_URL || 'http://localhost:3000'}/api/apify-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform,
      username,
      action: 'videos',
      limit
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${platform} videos`);
  }

  const data = await response.json();
  return data.videos || [];
}
