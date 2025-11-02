import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', 'base64').toString('utf-8')
  );

  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'viewtrack-25d71.appspot.com'
  });
}

const db = getFirestore();
const storage = getStorage();

/**
 * Fix TikTok videos with missing or placeholder thumbnails
 * by re-fetching them from the TikTok API
 * 
 * Usage: POST /api/fix-tiktok-thumbnails
 * Body: { orgId: string, projectId: string, dryRun?: boolean }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, projectId, dryRun = false } = req.body;

  if (!orgId || !projectId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['orgId', 'projectId']
    });
  }

  console.log(`🔧 ${dryRun ? '[DRY RUN] ' : ''}Fixing TikTok thumbnails for org ${orgId}, project ${projectId}...`);

  try {
    // Get all TikTok videos with missing or placeholder thumbnails
    const videosRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos');

    const tiktokQuery = videosRef.where('platform', '==', 'tiktok');
    const snapshot = await tiktokQuery.get();

    console.log(`📊 Found ${snapshot.size} TikTok videos`);

    let needsFixCount = 0;
    let fixedCount = 0;
    let failedCount = 0;
    const videosToFix: any[] = [];

    // Identify videos that need fixing
    for (const doc of snapshot.docs) {
      const video = doc.data();
      const thumbnail = video.thumbnail || '';

      const needsFix = !thumbnail || 
                      thumbnail.includes('placeholder') || 
                      (!thumbnail.includes('storage.googleapis.com') && 
                       !thumbnail.includes('firebasestorage'));

      if (needsFix) {
        needsFixCount++;
        videosToFix.push({
          id: doc.id,
          videoId: video.videoId,
          url: video.url,
          oldThumbnail: thumbnail,
          ref: doc.ref
        });
      }
    }

    console.log(`🔍 Found ${needsFixCount} videos that need thumbnail fixes`);

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        totalVideos: snapshot.size,
        needsFixCount,
        samples: videosToFix.slice(0, 10).map(v => ({
          videoId: v.videoId,
          url: v.url,
          currentThumbnail: v.oldThumbnail || 'empty'
        }))
      });
    }

    // Process each video that needs fixing
    const APIFY_TOKEN = process.env.APIFY_TOKEN;
    if (!APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN not set');
    }

    // Group videos by tracked account for efficient API calls
    const videosByAccount: { [key: string]: any[] } = {};
    for (const video of videosToFix) {
      const accountId = video.ref.parent.parent?.parent.parent?.id || 'unknown';
      if (!videosByAccount[accountId]) {
        videosByAccount[accountId] = [];
      }
      videosByAccount[accountId].push(video);
    }

    console.log(`📦 Videos grouped into ${Object.keys(videosByAccount).length} accounts`);

    // For each account, fetch fresh data and update thumbnails
    for (const [accountId, videos] of Object.entries(videosByAccount)) {
      console.log(`\n🔄 Processing ${videos.length} videos from account ${accountId}...`);

      // Get account info
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);

      const accountDoc = await accountRef.get();
      const account = accountDoc.data();

      if (!account || account.platform !== 'tiktok') {
        console.warn(`⚠️ Skipping account ${accountId} (not a TikTok account)`);
        continue;
      }

      // Fetch fresh TikTok data
      try {
        console.log(`📡 Fetching fresh data for @${account.username}...`);
        
        const actorId = 'clockworks~tiktok-scraper';
        const input = {
          profiles: [account.username],
          resultsPerPage: 100,
          shouldDownloadCovers: false,
          shouldDownloadVideos: false,
          shouldDownloadSubtitles: false,
          proxy: { useApifyProxy: true }
        };

        const syncItemsUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
        
        const response = await fetch(syncItemsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error(`Apify API error: ${response.status}`);
        }

        const items = await response.json();
        const itemsArray = Array.isArray(items) ? items : [];
        
        console.log(`✅ Fetched ${itemsArray.length} videos from TikTok API`);

        // Match fetched videos with our database videos
        for (const video of videos) {
          const matchingItem = itemsArray.find((item: any) => item.id === video.videoId);
          
          if (!matchingItem) {
            console.warn(`⚠️ Video ${video.videoId} not found in fresh data`);
            failedCount++;
            continue;
          }

          // Extract thumbnail URL
          const thumbnailUrl = matchingItem['videoMeta.coverUrl'] || 
                              matchingItem.videoMeta?.coverUrl || 
                              matchingItem.covers?.default || 
                              matchingItem.coverUrl || 
                              matchingItem.thumbnail || 
                              matchingItem.cover || 
                              '';

          if (!thumbnailUrl) {
            console.warn(`⚠️ No thumbnail URL found for video ${video.videoId}`);
            failedCount++;
            continue;
          }

          console.log(`🖼️ Found thumbnail URL for ${video.videoId}: ${thumbnailUrl.substring(0, 80)}...`);

          // Download and upload to Firebase Storage
          try {
            const newThumbnail = await downloadAndUploadThumbnail(
              thumbnailUrl,
              orgId,
              `tt_${video.videoId}_thumb.jpg`
            );

            if (newThumbnail) {
              await video.ref.update({
                thumbnail: newThumbnail,
                lastRefreshed: Timestamp.now()
              });

              console.log(`✅ Fixed thumbnail for video ${video.videoId}`);
              fixedCount++;
            } else {
              console.warn(`⚠️ Failed to download thumbnail for video ${video.videoId}`);
              failedCount++;
            }
          } catch (error) {
            console.error(`❌ Error fixing video ${video.videoId}:`, error);
            failedCount++;
          }
        }

      } catch (error) {
        console.error(`❌ Failed to process account ${accountId}:`, error);
        failedCount += videos.length;
      }
    }

    console.log(`\n✅ Fix complete: ${fixedCount} fixed, ${failedCount} failed`);

    return res.status(200).json({
      success: true,
      totalVideos: snapshot.size,
      needsFixCount,
      fixedCount,
      failedCount
    });

  } catch (error: any) {
    console.error('❌ Fix failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Fix failed',
      message: error.message
    });
  }
}

/**
 * Download thumbnail and upload to Firebase Storage
 */
async function downloadAndUploadThumbnail(
  thumbnailUrl: string,
  orgId: string,
  filename: string
): Promise<string> {
  try {
    console.log(`    📥 Downloading thumbnail...`);
    
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    
    const response = await fetch(thumbnailUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      throw new Error(`Data too small (${buffer.length} bytes)`);
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const storagePath = `organizations/${orgId}/thumbnails/${filename}`;
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: thumbnailUrl,
          fixedBy: 'fix-tiktok-thumbnails-script'
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`    ✅ Uploaded thumbnail to Firebase Storage`);
    return publicUrl;
  } catch (error) {
    console.error(`    ❌ Failed to download/upload thumbnail:`, error);
    return '';
  }
}

