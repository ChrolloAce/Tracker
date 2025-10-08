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
 * Process a single video immediately (like sync-single-account)
 * Triggered right after video is queued for instant feedback
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId, orgId, projectId } = req.body;

  if (!videoId || !orgId || !projectId) {
    return res.status(400).json({ 
      error: 'Missing required fields: videoId, orgId, projectId' 
    });
  }

  console.log(`⚡ Processing video immediately: ${videoId}`);

  try {
    const videoRef = db.doc(`organizations/${orgId}/projects/${projectId}/videos/${videoId}`);
    const videoDoc = await videoRef.get();

    if (!videoDoc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videoDoc.data();

    if (!video) {
      return res.status(404).json({ error: 'Video data not found' });
    }

    // Update status to processing
    await videoRef.update({
      syncStatus: 'processing',
      lastRefreshed: Timestamp.now()
    });

    console.log(`🎯 Fetching video data from: ${video.url}`);

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
      const FieldValue = require('firebase-admin').firestore.FieldValue;
      
      await accountRef.update({
        totalVideos: FieldValue.increment(1),
        totalViews: FieldValue.increment(videoData.view_count || 0),
        totalLikes: FieldValue.increment(videoData.like_count || 0),
        totalComments: FieldValue.increment(videoData.comment_count || 0),
        totalShares: FieldValue.increment(videoData.share_count || 0)
      });
    }

    console.log(`✅ Successfully processed video: ${video.url}`);

    return res.status(200).json({
      success: true,
      message: 'Video processed successfully',
      videoId,
      accountId
    });

  } catch (error) {
    console.error(`❌ Failed to process video ${videoId}:`, error);
    
    // Update video with error
    try {
      const videoRef = db.doc(`organizations/${orgId}/projects/${projectId}/videos/${videoId}`);
      await videoRef.update({
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : String(error),
        lastRefreshed: Timestamp.now()
      });
    } catch (updateError) {
      console.error('Failed to update video with error:', updateError);
    }

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

