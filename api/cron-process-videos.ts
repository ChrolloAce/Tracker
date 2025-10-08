import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin (same as sync-single-account)
if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

interface VideoData {
  id: string;
  thumbnail_url: string;
  caption: string;
  username: string;
  like_count: number;
  comment_count: number;
  view_count?: number;
  timestamp: string;
  share_count?: number;
  profile_pic_url?: string;
  display_name?: string;
  follower_count?: number;
}

/**
 * Cron job to process pending videos
 * Runs every 2 minutes to fetch video data and update records
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  console.log(`🎬 [${new Date().toISOString()}] Starting video processing cron job...`);

  try {
    // Query all pending videos across all organizations
    const videosRef = db.collectionGroup('videos');
    const pendingQuery = videosRef.where('syncStatus', '==', 'pending').limit(10);
    
    const snapshot = await pendingQuery.get();
    
    if (snapshot.empty) {
      console.log('✅ No pending videos to process');
      return res.status(200).json({
        success: true,
        message: 'No pending videos',
        processed: 0
      });
    }

    console.log(`📋 Found ${snapshot.size} pending videos to process`);

    let successCount = 0;
    let failureCount = 0;

    for (const doc of snapshot.docs) {
      const video = doc.data();
      const videoRef = doc.ref;

      try {
        console.log(`\n🎯 Processing video: ${video.url}`);
        
        // Update status to processing
        await videoRef.update({
          syncStatus: 'processing',
          lastRefreshed: Timestamp.now()
        });

        // Fetch video data from Apify
        const videoData = await fetchVideoData(video.url, video.platform);
        
        if (!videoData) {
          throw new Error('Failed to fetch video data');
        }

        // Parse upload date
        let uploadDate: Date;
        if (videoData.timestamp) {
          if (typeof videoData.timestamp === 'string') {
            uploadDate = new Date(videoData.timestamp);
          } else {
            uploadDate = new Date(Number(videoData.timestamp) * 1000);
          }
        } else {
          uploadDate = new Date();
        }

        // Check if account exists or needs to be created
        const orgId = video.orgId;
        const projectId = doc.ref.parent.parent?.id;
        
        if (!projectId) {
          throw new Error('Could not determine project ID');
        }

        const accountsRef = db.collection(`organizations/${orgId}/projects/${projectId}/trackedAccounts`);
        const accountQuery = accountsRef
          .where('username', '==', videoData.username.toLowerCase())
          .where('platform', '==', video.platform)
          .limit(1);
        
        const accountSnapshot = await accountQuery.get();
        let accountId = video.trackedAccountId;

        // Create account if it doesn't exist
        if (accountSnapshot.empty && !accountId) {
          console.log(`✨ Creating account for @${videoData.username}`);
          
          const newAccountRef = accountsRef.doc();
          await newAccountRef.set({
            id: newAccountRef.id,
            username: videoData.username,
            platform: video.platform,
            displayName: videoData.display_name || videoData.username,
            profilePicture: videoData.profile_pic_url || '',
            followerCount: videoData.follower_count || 0,
            isActive: true,
            accountType: 'my',
            orgId: orgId,
            dateAdded: Timestamp.now(),
            addedBy: video.addedBy,
            lastSynced: Timestamp.now(),
            totalVideos: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            syncStatus: 'completed',
            syncRequestedBy: video.addedBy,
            syncRequestedAt: Timestamp.now(),
            syncRetryCount: 0,
            maxRetries: 3,
            syncProgress: {
              current: 100,
              total: 100,
              message: 'Account created via video addition'
            }
          });
          
          accountId = newAccountRef.id;
          console.log(`✅ Created account: ${accountId}`);
        } else if (!accountSnapshot.empty) {
          accountId = accountSnapshot.docs[0].id;
        }

        // Update video with fetched data
        await videoRef.update({
          videoId: videoData.id,
          title: videoData.caption?.split('\n')[0] || 'Untitled Video',
          description: videoData.caption || '',
          thumbnail: videoData.thumbnail_url || '',
          uploadDate: Timestamp.fromDate(uploadDate),
          views: videoData.view_count || 0,
          likes: videoData.like_count || 0,
          comments: videoData.comment_count || 0,
          shares: videoData.share_count || 0,
          trackedAccountId: accountId,
          syncStatus: 'completed',
          syncCompletedAt: Timestamp.now(),
          syncError: null,
          lastRefreshed: Timestamp.now()
        });

        // Update account stats if linked
        if (accountId) {
          const accountRef = accountsRef.doc(accountId);
          await accountRef.update({
            totalVideos: require('firebase-admin').firestore.FieldValue.increment(1),
            totalViews: require('firebase-admin').firestore.FieldValue.increment(videoData.view_count || 0),
            totalLikes: require('firebase-admin').firestore.FieldValue.increment(videoData.like_count || 0),
            totalComments: require('firebase-admin').firestore.FieldValue.increment(videoData.comment_count || 0),
            totalShares: require('firebase-admin').firestore.FieldValue.increment(videoData.share_count || 0)
          });
        }

        console.log(`✅ Successfully processed video: ${video.url}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to process video ${video.url}:`, error);
        
        const retryCount = (video.syncRetryCount || 0) + 1;
        const maxRetries = 3;

        if (retryCount >= maxRetries) {
          // Mark as failed after max retries
          await videoRef.update({
            syncStatus: 'failed',
            syncError: error instanceof Error ? error.message : String(error),
            syncRetryCount: retryCount,
            lastRefreshed: Timestamp.now()
          });
        } else {
          // Reset to pending for retry
          await videoRef.update({
            syncStatus: 'pending',
            syncError: error instanceof Error ? error.message : String(error),
            syncRetryCount: retryCount,
            lastRefreshed: Timestamp.now()
          });
        }

        failureCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n📊 Video processing complete:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   ⏱️ Duration: ${duration}ms`);

    return res.status(200).json({
      success: true,
      processed: successCount + failureCount,
      successful: successCount,
      failed: failureCount,
      duration
    });

  } catch (error) {
    console.error('💥 Cron job failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Fetch video data from Apify
 */
async function fetchVideoData(url: string, platform: string): Promise<VideoData | null> {
  try {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) {
      throw new Error('APIFY_TOKEN not configured');
    }

    let actorId: string;
    let input: any;

    if (platform === 'tiktok') {
      actorId = 'clockworks~tiktok-scraper';
      input = {
        postURLs: [url],
        resultsPerPage: 1
      };
    } else if (platform === 'instagram') {
      actorId = 'apify~instagram-scraper';
      input = {
        directUrls: [url],
        resultsType: 'posts',
        resultsLimit: 1
      };
    } else if (platform === 'youtube') {
      actorId = 'streamers~youtube-scraper';
      input = {
        startUrls: [{ url }],
        maxResults: 1
      };
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`🔄 Calling Apify actor: ${actorId}`);
    
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    );

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.status}`);
    }

    const items = await response.json();
    
    if (!items || items.length === 0) {
      throw new Error('No data returned from Apify');
    }

    const videoData = items[0];
    console.log(`✅ Fetched video data for: ${videoData.username || 'unknown'}`);
    
    return videoData;

  } catch (error) {
    console.error('Failed to fetch video data:', error);
    return null;
  }
}

