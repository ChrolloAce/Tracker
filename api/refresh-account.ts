import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runApifyActor } from './apify-client.js';

// Initialize Firebase Admin
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

    initializeApp({ 
      credential: cert(serviceAccount as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app'
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();
const storage = getStorage();

/**
 * Download image from URL and upload to Firebase Storage
 */
async function downloadAndUploadImage(
  imageUrl: string, 
  orgId: string, 
  filename: string,
  folder: string = 'thumbnails'
): Promise<string> {
  try {
    console.log(`📥 Downloading thumbnail from ${imageUrl.includes('instagram') ? 'Instagram' : 'platform'}...`);
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/${folder}/${filename}`;
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: response.headers.get('content-type') || 'image/jpeg',
      },
      public: true,
    });
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    console.log(`    ✅ Uploaded thumbnail to Firebase Storage`);
    return publicUrl;
  } catch (error) {
    console.error(`    ❌ Failed to download/upload thumbnail:`, error);
    return '';
  }
}

/**
 * Refresh Single Account
 * Called by orchestrator for each account
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authorization (cron secret or authenticated user)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  const isAuthorizedCron = authHeader === cronSecret;
  const isManualTrigger = !isAuthorizedCron; // For now, allow manual triggers

  if (!isAuthorizedCron && !isManualTrigger) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orgId, projectId, accountId } = req.body;

  if (!orgId || !projectId || !accountId) {
    return res.status(400).json({ 
      error: 'Missing required fields: orgId, projectId, accountId' 
    });
  }

  const startTime = Date.now();
  console.log(`🔄 Refreshing account: ${accountId} in org: ${orgId}, project: ${projectId}`);

  try {
    // Get account details
    const accountRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);

    const accountDoc = await accountRef.get();
    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountDoc.data();
    if (!account) {
      return res.status(404).json({ error: 'Account data not found' });
    }

    // Update status to processing
    await accountRef.update({
      lastRefreshStarted: Timestamp.now(),
      refreshStatus: 'processing'
    });

    console.log(`  📱 Account: @${account.username} (${account.platform})`);

    // Prepare Apify input
    let apifyInput: any = {};
    let actorId = '';

    if (account.platform === 'instagram') {
      actorId = 'scraper-engine~instagram-reels-scraper';
      apifyInput = {
        urls: [`https://www.instagram.com/${account.username}/`],
        sortOrder: 'most-recent',
        maxComments: 0,
        maxReels: 50,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        maxRequestRetries: 3,
        requestHandlerTimeoutSecs: 60,
        maxConcurrency: 10
      };
    } else if (account.platform === 'tiktok') {
      actorId = 'clockworks~tiktok-scraper';
      apifyInput = {
        profiles: [`https://www.tiktok.com/@${account.username}`],
        resultsPerPage: 50,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false
      };
    } else {
      throw new Error(`Unsupported platform: ${account.platform}`);
    }

    // Run Apify scraper
    console.log(`  🔄 Calling Apify actor: ${actorId}`);
    const results = await runApifyActor(actorId, apifyInput);
    
    if (!results || results.length === 0) {
      console.log(`  ⚠️ No videos returned from Apify`);
      await accountRef.update({
        lastRefreshed: Timestamp.now(),
        refreshStatus: 'completed',
        lastRefreshError: null
      });
      return res.status(200).json({
        success: true,
        message: 'No new videos found',
        videosUpdated: 0,
        videosAdded: 0
      });
    }

    console.log(`  ✅ Apify returned ${results.length} items`);

    // Get video usage limits
    const billingRef = db.collection('organizations').doc(orgId).collection('billing').doc('usage');
    const billingDoc = await billingRef.get();
    const billingData = billingDoc.data();
    const currentVideos = billingData?.trackedVideos || 0;
    const videoLimit = billingData?.videoLimit || 100;

    console.log(`  📊 Video limits - Current: ${currentVideos}, Limit: ${videoLimit}`);

    // Process videos
    let batch: WriteBatch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    let updatedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    for (const media of results) {
      // Extract platform video ID
      let platformVideoId = '';
      if (account.platform === 'instagram') {
        platformVideoId = media.shortCode || media.code || media.id;
      } else if (account.platform === 'tiktok') {
        platformVideoId = media.id || media.video_id;
      }

      if (!platformVideoId) {
        skippedCount++;
        continue;
      }

      // Query for existing video
      const videosCollectionRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos');
      
      const videoQuery = videosCollectionRef
        .where('videoId', '==', platformVideoId)
        .limit(1);
      
      const querySnapshot = await videoQuery.get();

      // Extract metrics
      let views = 0, likes = 0, comments = 0, shares = 0;
      let url = '', thumbnail = '', caption = '';
      let uploadDate: Date = new Date();

      if (account.platform === 'instagram') {
        views = media.play_count || media.ig_play_count || 0;
        likes = media.like_count || 0;
        comments = media.comment_count || 0;
        shares = 0;
        url = `https://www.instagram.com/reel/${media.code || media.shortCode}/`;
        
        const instaThumbnail = 
          media.image_versions2?.additional_candidates?.first_frame?.url || 
          media.image_versions2?.candidates?.[0]?.url || 
          media.thumbnail_url || 
          media.display_url || 
          '';
        
        if (instaThumbnail) {
          console.log(`  📸 Instagram thumbnail URL found: ${instaThumbnail.substring(0, 80)}...`);
          thumbnail = await downloadAndUploadImage(
            instaThumbnail,
            orgId,
            `${platformVideoId}_thumb.jpg`,
            'thumbnails'
          );
        }
        
        caption = media.caption?.text || media.caption || '';
        uploadDate = media.taken_at ? new Date(media.taken_at * 1000) : new Date();
      } else if (account.platform === 'tiktok') {
        views = media.playCount || 0;
        likes = media.diggCount || 0;
        comments = media.commentCount || 0;
        shares = media.shareCount || 0;
        url = media.webVideoUrl || media.videoUrl || '';
        
        const tiktokThumbnail = media['videoMeta.coverUrl'] || 
                               media.videoMeta?.coverUrl || 
                               media.coverUrl || 
                               media.thumbnail || 
                               '';
        
        if (tiktokThumbnail) {
          console.log(`  🎬 TikTok thumbnail URL found: ${tiktokThumbnail.substring(0, 80)}...`);
          thumbnail = await downloadAndUploadImage(
            tiktokThumbnail,
            orgId,
            `tt_${platformVideoId}_thumb.jpg`,
            'thumbnails'
          );
        }
        
        caption = media.text || '';
        uploadDate = media.createTime ? new Date(media.createTime * 1000) : new Date();
      }

      if (querySnapshot.empty) {
        // Check if we have space to add new videos
        if (currentVideos + addedCount >= videoLimit) {
          console.log(`  ⚠️ Video limit reached. Skipping: ${platformVideoId}`);
          skippedCount++;
          continue;
        }

        // Add new video
        const newVideoRef = videosCollectionRef.doc();
        batch.set(newVideoRef, {
          videoId: platformVideoId,
          url,
          thumbnail,
          caption,
          description: caption,
          uploadDate: Timestamp.fromDate(uploadDate),
          views,
          likes,
          comments,
          shares,
          orgId,
          projectId,
          trackedAccountId: accountId,
          platform: account.platform,
          dateAdded: Timestamp.now(),
          addedBy: 'auto_refresh',
          lastRefreshed: Timestamp.now(),
          status: 'active',
          isRead: false,
          isSingular: false,
          duration: 0,
          hashtags: [],
          mentions: []
        });

        // Create initial snapshot
        const snapshotRef = newVideoRef.collection('snapshots').doc();
        const snapshotTime = Timestamp.now();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: platformVideoId,
          views,
          likes,
          comments,
          shares,
          capturedAt: snapshotTime,
          timestamp: snapshotTime,
          capturedBy: isManualTrigger ? 'manual_refresh_initial' : 'scheduled_refresh_initial'
        });

        addedCount++;
        batchCount += 2;
      } else {
        // Update existing video
        const existingDoc = querySnapshot.docs[0];
        const videoRef = existingDoc.ref;
        const existingData = existingDoc.data();

        const videoData: any = {
          views,
          likes,
          comments,
          shares,
          lastRefreshed: Timestamp.now()
        };

        // Update thumbnail if needed
        const shouldUpdateThumbnail = 
          (!existingData.thumbnail || existingData.thumbnail.trim() === '') && thumbnail;

        if (shouldUpdateThumbnail && thumbnail) {
          console.log(`    🔄 Updating thumbnail (old: ${existingData.thumbnail ? existingData.thumbnail.substring(0, 50) : 'EMPTY'}, new: ${thumbnail.substring(0, 50)}...)`);
          videoData.thumbnail = thumbnail;
        }

        batch.update(videoRef, videoData);

        // Create snapshot
        const snapshotRef = videoRef.collection('snapshots').doc();
        const now = Timestamp.now();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: platformVideoId,
          views,
          likes,
          comments,
          shares,
          capturedAt: now,
          timestamp: now,
          capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh'
        });

        updatedCount++;
        batchCount += 2;
      }

      // Commit batch if needed
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    // Update usage counter if we added videos
    if (addedCount > 0) {
      await billingRef.update({
        trackedVideos: currentVideos + addedCount,
        lastUpdated: Timestamp.now()
      });
    }

    // Update account status
    await accountRef.update({
      lastRefreshed: Timestamp.now(),
      refreshStatus: 'completed',
      lastRefreshError: null,
      lastRefreshDuration: Date.now() - startTime
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`  ✅ @${account.username}: Updated ${updatedCount}, Added ${addedCount}, Skipped ${skippedCount} (${duration}s)`);

    return res.status(200).json({
      success: true,
      account: account.username,
      platform: account.platform,
      videosUpdated: updatedCount,
      videosAdded: addedCount,
      videosSkipped: skippedCount,
      duration: parseFloat(duration)
    });

  } catch (error: any) {
    console.error(`  ❌ Error refreshing account:`, error);

    // Update account with error status
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);

      await accountRef.update({
        refreshStatus: 'failed',
        lastRefreshError: error.message || 'Unknown error',
        lastRefreshAttempt: Timestamp.now()
      });
    } catch (updateError) {
      console.error(`  ❌ Failed to update error status:`, updateError);
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh account'
    });
  }
}

