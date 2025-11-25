import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runApifyActor } from './apify-client.js';
import { ErrorNotificationService } from './services/ErrorNotificationService.js';
import { CleanupService } from './services/CleanupService.js';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight, validateRequiredFields } from './middleware/auth.js';
// @ts-ignore - heic-convert has no types
import convert from 'heic-convert';

// Initialize Firebase Admin (same as cron job)
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
  folder: string = 'profile'
): Promise<string> {
  try {
    const isInstagram = imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn');
    console.log(`📥 Downloading ${isInstagram ? 'Instagram' : 'image'} from: ${imageUrl.substring(0, 150)}...`);
    
    // Download image with proper headers for Instagram
    const isTikTok = imageUrl.includes('tiktokcdn');
    
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/heic,image/heif,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site'
      }
    };
    
    // Add Referer for Instagram
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
    // Add Referer for TikTok
    if (isTikTok) {
      fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
    }
    
    console.log(`🔧 Using headers:`, JSON.stringify(fetchOptions.headers, null, 2));
    
    const response = await fetch(imageUrl, fetchOptions);
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    if (!response.ok) {
      console.error(`❌ Image download failed with status ${response.status}`);
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 Downloaded ${buffer.length} bytes`);
    
    // Validate we got actual image data
    if (buffer.length < 100) {
      throw new Error(`Downloaded data too small (${buffer.length} bytes), likely not an image`);
    }
    
    // Determine content type from response or default to jpg
    let contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`📋 Original content type: ${contentType}`);
    
    // 🔥 HEIC Detection and Conversion using heic-convert (pure JS, works in serverless)
    // Check if content-type indicates HEIC or file signature matches HEIC
    const isHEIC = contentType.includes('heic') || 
                   contentType.includes('heif') || 
                   imageUrl.toLowerCase().includes('.heic') ||
                   imageUrl.toLowerCase().includes('.heif') ||
                   // Check HEIC file signature (ftyp heic)
                   (buffer.length > 12 && 
                    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 && 
                    buffer[8] === 0x68 && buffer[9] === 0x65 && buffer[10] === 0x69 && buffer[11] === 0x63);
    
    if (isHEIC) {
      console.log(`🔄 [HEIC] Converting HEIC image to JPG: ${imageUrl.substring(0, 100)}...`);
      try {
        // Convert HEIC to JPG using heic-convert (pure JS, serverless-friendly)
        const outputBuffer = await convert({
          buffer: buffer,
          format: 'JPEG',
          quality: 0.9
        });
        
        buffer = Buffer.from(outputBuffer);
        contentType = 'image/jpeg';
        filename = filename.replace(/\.(heic|heif)$/i, '.jpg');
        console.log(`✅ [HEIC] Successfully converted HEIC to JPG (${buffer.length} bytes)`);
      } catch (conversionError) {
        console.error(`❌ [HEIC] Conversion failed:`, conversionError);
        console.warn(`⚠️ [HEIC] Will upload as-is - may not display properly in browsers`);
        // Continue with original buffer if conversion fails
      }
    }
    
    console.log(`📋 Final content type: ${contentType}`);
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/${folder}/${filename}`;
    const file = bucket.file(storagePath);
    
    console.log(`☁️ Uploading ${buffer.length} bytes to Firebase Storage at: ${storagePath}`);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: imageUrl,
          fileFormat: contentType.split('/')[1] || 'unknown',
          convertedFromHEIC: isHEIC ? 'true' : 'false'
        }
      },
      public: true
    });
    
    // Make file public and get URL
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`✅ Uploaded image to Firebase Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to download/upload image:', error);
    console.log(`⚠️ Image download/upload failed for: ${imageUrl.substring(0, 100)}...`);
    
    // For Instagram and TikTok, DON'T return the original URL since it expires quickly
    // Better to have no thumbnail than a broken one - will retry on next sync
    if (imageUrl.includes('cdninstagram') || 
        imageUrl.includes('fbcdn') || 
        imageUrl.includes('tiktokcdn')) {
      console.log(`🚫 Instagram/TikTok CDN URL detected, returning empty string (URLs expire quickly)`);
      throw error; // Throw error so caller knows it failed
    }
    
    // For other platforms (YouTube, Twitter), return original URL as fallback
    console.log(`📷 Using original URL as fallback for non-CDN platform: ${imageUrl.substring(0, 100)}...`);
    return imageUrl;
  }
}

/**
 * Sync Single Account - Immediately processes one account
 * Called right after user adds an account for instant feedback
 * No auth required - this is a public endpoint for better UX
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (handleCorsPreFlight(req, res)) {
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, orgId, projectId } = req.body;
  const sessionId = req.body.sessionId || null;
  const jobId = req.body.jobId || null;

  console.log(`\n🎯 [SYNC-ACCOUNT] Received request for account: ${accountId}`);
  console.log(`   📦 Org: ${orgId}, Project: ${projectId}, Session: ${sessionId || 'none'}, Job: ${jobId || 'none'}`);

  // Validate required fields
  const validation = validateRequiredFields(req.body, ['accountId', 'orgId', 'projectId']);
  if (!validation.valid) {
    console.error(`❌ [SYNC-ACCOUNT] Validation failed: ${validation.missing.join(', ')}`);
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      missing: validation.missing 
    });
  }

  // 🔒 Authenticate - either user (manual) or cron secret (automated)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = authHeader === cronSecret;
  const isManualSync = !isCronRequest; // Manual = user triggered, Scheduled = cron triggered
  
  console.log(`   🔐 Auth: ${isCronRequest ? 'CRON' : 'USER'} | Manual: ${isManualSync}`);
  
  if (isCronRequest) {
    console.log(`🔒 Authenticated as CRON job for sync request (SCHEDULED REFRESH)`);
  } else {
    // Regular user authentication
    try {
      const { user } = await authenticateAndVerifyOrg(req, orgId);
      console.log(`🔒 Authenticated user ${user.userId} for sync request (MANUAL ADD)`);
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: authError.message 
      });
    }
  }

    console.log(`⚡ Sync started for account: ${accountId} [${isManualSync ? 'MANUAL' : 'SCHEDULED'}]`);

  try {
    // Read job metadata to determine sync strategy
    let syncStrategy = 'progressive'; // default for backwards compatibility
    let maxVideosOverride: number | null = null;
    // TODO: SPIDERWEB - Variables kept for backwards compatibility, but phase spawning is disabled
    let isSpiderwebPhase = false; // Keep variable but don't use for spawning
    let spiderwebPhase: number | null = null; // Keep variable but don't use for spawning
    let existingVideoIdsFromJob: string[] = [];
    
    if (jobId) {
      try {
        const jobDoc = await db.collection('syncQueue').doc(jobId).get();
        if (jobDoc.exists) {
          const jobData = jobDoc.data();
          syncStrategy = jobData?.syncStrategy || 'progressive';
          maxVideosOverride = jobData?.maxVideos || null;
          // TODO: SPIDERWEB - Read but don't use for spawning new phases
          isSpiderwebPhase = jobData?.isSpiderwebPhase || false;
          spiderwebPhase = jobData?.spiderwebPhase || null;
          existingVideoIdsFromJob = jobData?.existingVideoIds || [];
          
          console.log(`   📋 Job strategy: ${syncStrategy}`);
          if (maxVideosOverride) console.log(`   📊 Max videos: ${maxVideosOverride}`);
          // Log spiderweb info if present (legacy jobs may have it)
          if (isSpiderwebPhase) console.log(`   🕸️  Spiderweb phase detected: ${spiderwebPhase} (phase spawning disabled)`);
        }
        
        // Update job status to running
        await db.collection('syncQueue').doc(jobId).update({
          status: 'running',
          startedAt: Timestamp.now()
        });
        console.log(`   📝 Job ${jobId} marked as running`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to read/update job (non-critical):`, jobError.message);
      }
    }
    
    const accountRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);

    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      console.error(`❌ Account ${accountId} not found in Firestore!`);
      console.log(`   ℹ️  Account may have been deleted - cleaning up job if it exists...`);
      
      // If job exists, delete it (account was deleted)
      if (jobId) {
        try {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`   ✅ Job ${jobId} deleted (account no longer exists)`);
        } catch (jobError: any) {
          console.warn(`   ⚠️  Failed to delete job (non-critical):`, jobError.message);
        }
      }
      
      return res.status(404).json({ 
        error: 'Account not found',
        message: 'Account may have been deleted'
      });
    }

    // ==================== FIX #1: JOB-LEVEL LOCKING ====================
    // Prevent multiple simultaneous syncs for the same account
    const accountData = accountDoc.data();
    const lockKey = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    if (accountData?.syncLockId && accountData?.syncLockTimestamp) {
      const lockAge = Date.now() - accountData.syncLockTimestamp.toMillis();
      if (lockAge < 5 * 60 * 1000) { // Lock valid for 5 minutes
        console.log(`⏭️  Account ${accountId} is locked by another job (age: ${Math.round(lockAge/1000)}s), skipping to prevent duplicates`);
        
        // Delete this job since account is being processed
        if (jobId) {
          try {
            await db.collection('syncQueue').doc(jobId).delete();
            console.log(`   ✅ Job ${jobId} deleted (duplicate prevented)`);
          } catch (err: any) {
            console.warn(`   ⚠️  Could not delete job:`, err.message);
          }
        }
        
        return res.status(200).json({ 
          success: true,
          skipped: true,
          reason: 'Account locked by another sync job',
          lockAge: Math.round(lockAge/1000)
        });
      } else {
        console.log(`   🔓 Lock expired (${Math.round(lockAge/1000)}s old), proceeding`);
      }
    }
    
    // Acquire lock
    try {
      await accountRef.update({
        syncLockId: lockKey,
        syncLockTimestamp: Timestamp.now()
      });
      console.log(`🔒 Acquired sync lock: ${lockKey}`);
    } catch (lockError: any) {
      console.error(`❌ Failed to acquire lock:`, lockError.message);
      return res.status(500).json({ error: 'Failed to acquire sync lock' });
    }
    // ==================== END FIX #1 ====================

    const account = accountDoc.data() as any;
    
    console.log(`📊 Account info: @${account.username} (${account.platform})`);
    console.log(`   🔹 Creator Type: ${account.creatorType || 'automatic'}`);
    console.log(`   🔹 Is Active: ${account.isActive}`);
    console.log(`   🔹 Last synced: ${account.lastRefreshed?.toDate() || 'Never'}`);
    console.log(`   🔹 Total Videos: ${account.totalVideos || 0}`);
    console.log(`   🔹 Sync Status: ${account.syncStatus || 'unknown'}`);
    
    // Get maxVideos from account settings, default to 100 if not set
    const maxVideos = account.maxVideos || 100;
    console.log(`📊 Will scrape up to ${maxVideos} videos for @${account.username}`);

    // Update to syncing status (check account still exists first)
    try {
      const accountCheckDoc = await accountRef.get();
      if (!accountCheckDoc.exists) {
        console.log(`⚠️  Account ${accountId} was deleted before sync started`);
        if (jobId) {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`✅ Job ${jobId} deleted (account deleted before sync)`);
        }
        return res.status(404).json({ 
          error: 'Account not found',
          message: 'Account may have been deleted'
        });
      }
      
      await accountRef.update({
        syncStatus: 'syncing',
        syncProgress: {
          current: 10,
          total: 100,
          message: 'Starting sync...'
        }
      });
    } catch (error: any) {
      console.error(`❌ Error updating account to syncing:`, error.message);
      throw error;
    }

    // Fetch profile data if needed
    if (!account.displayName || account.displayName === account.username) {
      console.log(`👤 Fetching profile data for ${account.username}...`);
      
      try {
        const accountCheckDoc = await accountRef.get();
        if (accountCheckDoc.exists) {
          await accountRef.update({
            displayName: account.username.charAt(0).toUpperCase() + account.username.slice(1)
          });
        }
      } catch (error: any) {
        console.warn(`⚠️  Could not update display name:`, error.message);
      }
    }

    // Fetch videos based on platform
    let videos = [];

    if (account.platform === 'tiktok') {
      console.log(`🎵 Fetching TikTok videos for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newTikTokVideos: any[] = [];
        const username = account.username.replace('@', '');
        
        // Get existing video IDs for ALL accounts (needed for refresh and duplicate checking)
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'tiktok')
          .select('videoId')
          .get();
        
        const existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing TikTok videos in database`);
        
        // 🔧 SYNC STRATEGY (from job metadata):
        // - direct: Fetch exact amount user specified (for manual additions)
        // - progressive: Use spiderweb search phases (5→10→15→20) for scheduled refreshes
        // - refresh_only: Only refresh existing videos, no new video discovery
        
        // ===== NEW VIDEO DISCOVERY (only if NOT refresh_only) =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          // For new accounts: use maxVideos (manual sync)
          // For existing accounts: use 10 (scheduled discovery)
          const videosToFetch = existingVideoIds.size === 0 ? maxVideos : 10;
          const syncType = existingVideoIds.size === 0 ? 'MANUAL' : 'SCHEDULED';
          
          console.log(`🔍 [TIKTOK ${syncType}] Forward discovery - fetching ${videosToFetch} most recent videos...`);
          
          try {
            const data = await runApifyActor({
              actorId: 'apidojo/tiktok-scraper',
              input: {
                startUrls: [`https://www.tiktok.com/@${username}`],
                maxItems: videosToFetch,
                sortType: 'RELEVANCE',
                dateRange: 'DEFAULT',
                location: 'US',
                includeSearchKeywords: false,
                customMapFunction: '(object) => { return {...object} }',
                proxy: {
                  useApifyProxy: true,
                  apifyProxyGroups: ['RESIDENTIAL']
                }
              }
            });

            const batch = data.items || [];
            
            if (batch.length === 0) {
              console.log(`⚠️ [TIKTOK] No videos returned`);
            } else {
              // Process videos newest-first, stop at first duplicate
              let foundDuplicate = false;
              
              for (const video of batch) {
                const videoId = video.id || video.post_id || video.video_id;
                
                if (!videoId) {
                  console.warn(`⚠️ TikTok video missing ID, skipping`);
                  continue;
                }
                
                // Check if this video exists in database
                if (existingVideoIds.has(videoId)) {
                  console.log(`✓ [TIKTOK] Found duplicate: ${videoId} - stopping discovery`);
                  foundDuplicate = true;
                  break;
                }
                
                // This is a new video - add it
                newTikTokVideos.push(video);
              }
              
              console.log(`📊 [TIKTOK] Discovered ${newTikTokVideos.length} new videos${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
            }
          } catch (fetchError: any) {
            console.error(`❌ [TIKTOK] Discovery failed:`, fetchError.message);
            
            // Check if it's a memory limit error (402) - throw to trigger retry
            if (fetchError.message?.includes('actor-memory-limit-exceeded') || 
                fetchError.message?.includes('402') ||
                fetchError.statusCode === 402) {
              console.error(`💾 Apify memory limit exceeded - will retry later`);
              throw new Error(`Apify capacity exceeded - will retry: ${fetchError.message}`);
            }
          }
          
          // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
          // If progressive strategy and no duplicate found, queue next spiderweb phase
          // if (useProgressiveFetch && !foundDuplicate) {
          //   const currentPhase = isSpiderwebPhase ? (spiderwebPhase || 1) : 1;
          //   if (currentPhase < 4) { // Max 4 phases (5, 10, 15, 20)
          //     try {
          //       const nextPhase = currentPhase + 1;
          //       const nextJobRef = db.collection('syncQueue').doc();
          //       
          //       // Merge existing video IDs with newly seen ones for next phase
          //       const allKnownVideoIds = Array.from(new Set([
          //         ...existingVideoIdsFromJob,
          //         ...Array.from(existingVideoIds),
          //         ...Array.from(seenVideoIds)
          //       ]));
          //       
          //       await nextJobRef.set({
          //         type: 'account_sync',
          //         status: 'pending',
          //         syncStrategy: 'progressive',
          //         isSpiderwebPhase: true,
          //         spiderwebPhase: nextPhase,
          //         priority: 10, // Low priority for spiderweb searches
          //         orgId,
          //         projectId,
          //         accountId,
          //         sessionId: sessionId || null,
          //         accountUsername: account.username,
          //         accountPlatform: 'tiktok',
          //         existingVideoIds: allKnownVideoIds, // Pass known IDs to avoid re-fetching
          //         createdAt: Timestamp.now(),
          //         startedAt: null,
          //         completedAt: null,
          //         attempts: 0,
          //         maxAttempts: 3,
          //         error: null
          //       });
          //       
          //       console.log(`🕸️  [TIKTOK] Queued spiderweb phase ${nextPhase} job: ${nextJobRef.id}`);
          //     } catch (queueError: any) {
          //       console.error(`❌ [TIKTOK] Failed to queue next spiderweb phase:`, queueError.message);
          //     }
          //   } else {
          //     console.log(`✅ [TIKTOK] Spiderweb search complete (reached max phase 4)`);
          //   }
          // } else if (foundDuplicate) {
          //   console.log(`✅ [TIKTOK] Spiderweb search complete (found existing video, no more phases needed)`);
          // }
        } else if (syncStrategy === 'refresh_only') {
          console.log(`🔄 [TIKTOK] Refresh-only mode - skipping new video discovery`);
        } else {
          console.log(`🔒 [TIKTOK] Static account - skipping new video discovery`);
        }
        
        // ===== REFRESH EXISTING VIDEOS (runs for ALL accounts with existing videos) =====
        if (existingVideoIds.size > 0) {
          console.log(`🔄 [TIKTOK] Refreshing ALL ${existingVideoIds.size} existing videos...`);
          
          try {
            // Build video URLs for ALL existing videos
            const videoUrls = Array.from(existingVideoIds)
              .map(id => `https://www.tiktok.com/@${username}/video/${id}`);
            
            console.log(`📊 [TIKTOK] Fetching updated metrics for ${videoUrls.length} existing videos...`);
              
            const refreshData = await runApifyActor({
              actorId: 'apidojo/tiktok-scraper',
              input: {
                startUrls: videoUrls,
                maxItems: videoUrls.length, // ALL videos
                  sortType: 'RELEVANCE',
                  dateRange: 'DEFAULT',
                  location: 'US',
                  includeSearchKeywords: false,
                  customMapFunction: '(object) => { return {...object} }',
                  proxy: {
                    useApifyProxy: true,
                    apifyProxyGroups: ['RESIDENTIAL']
                  }
                }
              });
              
              const refreshedVideos = refreshData.items || [];
              console.log(`✅ [TIKTOK] Refreshed ${refreshedVideos.length} existing videos`);
              
              // CRITICAL: Mark these as refresh-only to prevent data corruption
              // Refreshed videos should ONLY update metrics, never overwrite title/date/etc
              const markedRefreshedVideos = refreshedVideos.map((v: any) => ({
                ...v,
                _isRefreshOnly: true // Flag to prevent treating as new video
              }));
              
              // Add refreshed videos to processing
              newTikTokVideos.push(...markedRefreshedVideos);
            } catch (refreshError) {
              console.error('⚠️ [TIKTOK] Failed to refresh existing videos (non-fatal):', refreshError);
              // Don't fail the whole sync if refresh fails
            }
        } else {
          console.log(`⚠️ [TIKTOK] No existing videos found - nothing to refresh`);
        }
        
        const tiktokVideos = newTikTokVideos;
        console.log(`📊 [TIKTOK] Processing ${tiktokVideos.length} new videos`);
        
        // Get profile data from first video (if available)
        if (tiktokVideos.length > 0 && tiktokVideos[0]) {
          const firstVideo = tiktokVideos[0];
          const channel = firstVideo.channel || {};
          const profilePictureUrl = channel.avatar || channel.avatar_url || '';
          const followerCount = channel.followers || 0;
          const displayName = channel.name || account.username;
          
          // Update account profile if we have new data
          if (profilePictureUrl || followerCount > 0) {
            try {
              const profileUpdates: any = {
                displayName: displayName,
                followerCount: followerCount,
                isVerified: channel.verified || false
              };
              
              // Download and upload TikTok profile pic to Firebase Storage
              if (profilePictureUrl) {
                console.log(`📸 Downloading TikTok profile pic for @${account.username}...`);
                const uploadedProfilePic = await downloadAndUploadImage(
                  profilePictureUrl,
                  orgId,
                  `tiktok_profile_${account.username}.jpg`,
                  'profile'
                );
                profileUpdates.profilePicture = uploadedProfilePic;
                console.log(`✅ TikTok profile picture uploaded to Firebase Storage`);
              }
              
              await accountRef.update(profileUpdates);
              console.log(`✅ Updated TikTok profile: ${followerCount} followers`);
            } catch (updateError) {
              console.warn('⚠️ Could not update profile:', updateError);
            }
          }
        }
        
        // Transform TikTok data to video format (apidojo/tiktok-scraper format)
        videos = tiktokVideos.map((item: any, index: number) => {
          // Check if this is a refresh-only video (should only update metrics)
          const isRefreshOnly = item._isRefreshOnly === true;
          
          // Handle both nested and flat key formats
          const channel = item.channel || {};
          const video = item.video || {};
          
          // THUMBNAIL EXTRACTION: Check flat keys FIRST (TikTok API returns flat keys like "video.cover")
          let thumbnail = '';
          if (item['video.cover']) { 
            // Flat key: "video.cover" (THIS IS THE PRIMARY SOURCE)
            thumbnail = item['video.cover'];
          } else if (item['video.thumbnail']) { 
            // Flat key: "video.thumbnail"
            thumbnail = item['video.thumbnail'];
          } else if (video.cover) {
            // Nested object: video.video.cover
            thumbnail = video.cover;
          } else if (video.thumbnail) {
            // Nested object: video.video.thumbnail
            thumbnail = video.thumbnail;
          } else if (item.cover) {
            thumbnail = item.cover;
          } else if (item.thumbnail) {
            thumbnail = item.thumbnail;
          } else if (item.images && item.images.length > 0) {
            thumbnail = item.images[0].url || '';
          }
          
          // Note: Keep original HEIC URLs - they will be converted server-side during download
          
          // 🔥 VIDEO URL: Always use postPage, fallback to reconstruction from video ID
          const videoId = item.id || item.post_id || '';
          let videoUrl = item.postPage || item.tiktok_url || video.url || item.videoUrl || '';
          
          // If no valid TikTok post URL (e.g., only have CDN URL) and we have a video ID, reconstruct it
          if ((!videoUrl || !videoUrl.includes('tiktok.com/@')) && videoId) {
            const username = channel.username || item['channel.username'] || account.username || 'user';
            videoUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
            console.log(`🔧 [TIKTOK] Reconstructed URL from ID: ${videoUrl}`);
          }
          
          // 🔧 CRITICAL FIX: For refresh-only videos, skip normalization with defaults
          // Refresh should ONLY update metrics, never overwrite title/date/etc
          let uploadTimestamp: FirebaseFirestore.Timestamp | null = null;
          let videoTitle: string | null = null;
          
          if (!isRefreshOnly) {
            // Normal discovery: use defaults if data is missing
            if (item.uploadedAt) {
              uploadTimestamp = Timestamp.fromMillis(item.uploadedAt * 1000);
            } else if (item.uploaded_at) {
              uploadTimestamp = Timestamp.fromMillis(item.uploaded_at * 1000);
            } else {
              console.warn(`⚠️ [TIKTOK] Video ${videoId} missing upload date - using epoch`);
              uploadTimestamp = Timestamp.fromMillis(0); // Unix epoch = Jan 1, 1970
            }
            
            videoTitle = item.title || item.caption || item.subtitle || 'Untitled TikTok';
          } else {
            // Refresh-only: use data if available, otherwise leave null (will preserve existing)
            if (item.uploadedAt) {
              uploadTimestamp = Timestamp.fromMillis(item.uploadedAt * 1000);
            } else if (item.uploaded_at) {
              uploadTimestamp = Timestamp.fromMillis(item.uploaded_at * 1000);
            }
            
            if (item.title || item.caption || item.subtitle) {
              videoTitle = item.title || item.caption || item.subtitle;
            }
          }
          
          const baseData: any = {
            videoId: videoId || `tiktok_${Date.now()}_${index}`,
            videoUrl: videoUrl,
            platform: 'tiktok',
            thumbnail: thumbnail,
            accountUsername: account.username,
            accountDisplayName: channel.name || item['channel.name'] || account.username,
            views: item.views || 0,
            likes: item.likes || 0,
            comments: item.comments || 0,
            shares: item.shares || 0,
            saves: item.bookmarks || 0, // ✅ ADD BOOKMARKS
            caption: item.title || item.subtitle || item.caption || '',
            duration: video.duration || 0,
            _isRefreshOnly: isRefreshOnly // Pass flag to save logic
          };
          
          // Only add title/date if we have them (or if not refresh-only)
          if (videoTitle) {
            baseData.videoTitle = videoTitle;
          }
          if (uploadTimestamp) {
            baseData.uploadDate = uploadTimestamp;
          }
          
          return baseData;
        });
      } catch (tiktokError) {
        console.error('TikTok fetch error:', tiktokError);
        throw tiktokError;
      }
    } else if (account.platform === 'youtube') {
      console.log(`📺 Fetching YouTube Shorts for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newYouTubeVideos: any[] = [];
        const channelHandle = account.username.startsWith('@') ? account.username : `@${account.username}`;
        
        // Get existing video IDs for ALL accounts (needed for refresh and duplicate checking)
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'youtube')
          .select('videoId')
          .get();
        
        const existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing YouTube Shorts in database`);
        
        // ===== NEW VIDEO DISCOVERY (only if NOT refresh_only) =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          // For new accounts: use maxVideos (manual sync)
          // For existing accounts: use 10 (scheduled discovery)
          const videosToFetch = existingVideoIds.size === 0 ? maxVideos : 10;
          const syncType = existingVideoIds.size === 0 ? 'MANUAL' : 'SCHEDULED';
          
          console.log(`🔍 [YOUTUBE ${syncType}] Forward discovery - fetching ${videosToFetch} most recent Shorts...`);
          
          try {
            const data = await runApifyActor({
              actorId: 'grow_media/youtube-shorts-scraper',
              input: {
                channels: [channelHandle],
                maxResults: videosToFetch,
                sortBy: 'latest',
                proxy: {
                  useApifyProxy: true,
                  apifyProxyGroups: ['RESIDENTIAL']
                }
              }
            });

            const batch = data.items || [];
            
            if (batch.length === 0) {
              console.log(`⚠️ [YOUTUBE] No Shorts returned`);
            } else {
              // Process videos newest-first, stop at first duplicate
              let foundDuplicate = false;
              
              for (const video of batch) {
                const videoId = video.id;
                
                if (!videoId) {
                  console.warn(`⚠️ YouTube Short missing ID, skipping`);
                  continue;
                }
                
                // Check if this video exists in database
                if (existingVideoIds.has(videoId)) {
                  console.log(`✓ [YOUTUBE] Found duplicate: ${videoId} - stopping discovery`);
                  foundDuplicate = true;
                  break;
                }
                
                // This is a new video - add it
                newYouTubeVideos.push(video);
              }
              
              console.log(`📊 [YOUTUBE] Discovered ${newYouTubeVideos.length} new Shorts${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
            }
          } catch (fetchError: any) {
            console.error(`❌ [YOUTUBE] Discovery failed:`, fetchError.message);
            
            // Check if it's a memory limit error (402) - throw to trigger retry
            if (fetchError.message?.includes('actor-memory-limit-exceeded') || 
                fetchError.message?.includes('402') ||
                fetchError.statusCode === 402) {
              console.error(`💾 Apify memory limit exceeded - will retry later`);
              throw new Error(`Apify capacity exceeded - will retry: ${fetchError.message}`);
            }
          }
          
          // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
          // If progressive strategy and no duplicate found, queue next spiderweb phase
          // if (useProgressiveFetch && !foundDuplicate) {
          //   const currentPhase = isSpiderwebPhase ? (spiderwebPhase || 1) : 1;
          //   if (currentPhase < 4) {
          //     try {
          //       const nextPhase = currentPhase + 1;
          //       const nextJobRef = db.collection('syncQueue').doc();
          //       
          //       const allKnownVideoIds = Array.from(new Set([
          //         ...existingVideoIdsFromJob,
          //         ...Array.from(existingVideoIds),
          //         ...Array.from(seenVideoIds)
          //       ]));
          //       
          //       await nextJobRef.set({
          //         type: 'account_sync',
          //         status: 'pending',
          //         syncStrategy: 'progressive',
          //         isSpiderwebPhase: true,
          //         spiderwebPhase: nextPhase,
          //         priority: 10,
          //         orgId,
          //         projectId,
          //         accountId,
          //         sessionId: sessionId || null,
          //         accountUsername: account.username,
          //         accountPlatform: 'youtube',
          //         existingVideoIds: allKnownVideoIds,
          //         createdAt: Timestamp.now(),
          //         startedAt: null,
          //         completedAt: null,
          //         attempts: 0,
          //         maxAttempts: 3,
          //         error: null
          //       });
          //       
          //       console.log(`🕸️  [YOUTUBE] Queued spiderweb phase ${nextPhase} job: ${nextJobRef.id}`);
          //     } catch (queueError: any) {
          //       console.error(`❌ [YOUTUBE] Failed to queue next spiderweb phase:`, queueError.message);
          //     }
          //   } else {
          //     console.log(`✅ [YOUTUBE] Spiderweb search complete (reached max phase 4)`);
          //   }
          // } else if (foundDuplicate) {
          //   console.log(`✅ [YOUTUBE] Spiderweb search complete (found existing video, no more phases needed)`);
          // }
        } else if (syncStrategy === 'refresh_only') {
          console.log(`🔄 [YOUTUBE] Refresh-only mode - skipping new video discovery`);
        } else {
          console.log(`🔒 [YOUTUBE] Static account - skipping new video discovery`);
        }
        
        // ===== REFRESH EXISTING VIDEOS (runs for ALL accounts with existing videos) =====
        if (existingVideoIds.size > 0) {
          console.log(`🔄 [YOUTUBE] Refreshing ALL ${existingVideoIds.size} existing Shorts using YouTube Data API...`);
          
          try {
            // Build video IDs for ALL existing videos
            const videoIds = Array.from(existingVideoIds);
            
            console.log(`📊 [YOUTUBE] Fetching updated metrics for ${videoIds.length} existing Shorts from YouTube API...`);
            
            // Use YouTube Data API directly (free, fast, reliable)
            // YouTube API supports up to 50 IDs per request, so batch them
            const allRefreshedVideos: any[] = [];
            
            for (let i = 0; i < videoIds.length; i += 50) {
              const batchIds = videoIds.slice(i, i + 50);
              console.log(`📦 [YOUTUBE] Batch ${Math.floor(i / 50) + 1}: Fetching ${batchIds.length} videos...`);
              
              const apiKey = process.env.YOUTUBE_API_KEY;
              if (!apiKey) {
                console.error('❌ [YOUTUBE] YOUTUBE_API_KEY not configured');
                break;
              }
              
              const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batchIds.join(',')}&key=${apiKey}`;
              const videoRes = await fetch(videoUrl);
              
              if (!videoRes.ok) {
                console.error(`❌ [YOUTUBE] Batch ${Math.floor(i / 50) + 1} failed: ${videoRes.status}`);
                continue;
              }
              
              const videoData = await videoRes.json();
              const items = videoData.items || [];
              allRefreshedVideos.push(...items);
              console.log(`✅ [YOUTUBE] Batch ${Math.floor(i / 50) + 1}: Got ${items.length} videos`);
            }
            
            // Normalize YouTube API format to match expected format
            const refreshedVideos = allRefreshedVideos.map((video: any) => {
              // Parse duration from ISO 8601 format (PT1M30S)
              let durationSeconds = 0;
              if (video.contentDetails?.duration) {
                const durationStr = video.contentDetails.duration;
                const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
                if (match) {
                  const minutes = parseInt(match[1] || '0', 10);
                  const seconds = parseInt(match[2] || '0', 10);
                  durationSeconds = minutes * 60 + seconds;
                }
              }
              
              // Get best thumbnail
              let thumbnail = '';
              if (video.snippet?.thumbnails?.maxres?.url) {
                thumbnail = video.snippet.thumbnails.maxres.url;
              } else if (video.snippet?.thumbnails?.standard?.url) {
                thumbnail = video.snippet.thumbnails.standard.url;
              } else if (video.snippet?.thumbnails?.high?.url) {
                thumbnail = video.snippet.thumbnails.high.url;
              } else if (video.snippet?.thumbnails?.medium?.url) {
                thumbnail = video.snippet.thumbnails.medium.url;
              } else if (video.snippet?.thumbnails?.default?.url) {
                thumbnail = video.snippet.thumbnails.default.url;
              }
              
              // Normalize to Apify-like format for compatibility with existing code
              return {
                id: video.id,
                title: video.snippet?.title || '',
                url: `https://www.youtube.com/shorts/${video.id}`,
                channelId: video.snippet?.channelId,
                channelName: video.snippet?.channelTitle || '',
                channel_id: video.snippet?.channelId, // Alias
                channel_name: video.snippet?.channelTitle || '', // Alias
                thumbnailUrl: thumbnail,
                thumbnails: video.snippet?.thumbnails,
                duration: video.contentDetails?.duration || '',
                viewCount: parseInt(video.statistics?.viewCount || '0', 10),
                likes: parseInt(video.statistics?.likeCount || '0', 10),
                commentsCount: parseInt(video.statistics?.commentCount || '0', 10),
                date: video.snippet?.publishedAt,
                text: video.snippet?.description || ''
              };
            });
            
            console.log(`✅ [YOUTUBE] Refreshed ${refreshedVideos.length}/${videoIds.length} Shorts via YouTube API`);
            
            // ===== CRITICAL: VALIDATE CHANNEL OWNERSHIP =====
            // Extract the expected channel ID from the account or from discovered videos
            let expectedChannelId = account.youtubeChannelId || null;
            
            // If we don't have a stored channelId, try to extract it from new videos
            if (!expectedChannelId && newYouTubeVideos.length > 0) {
              expectedChannelId = newYouTubeVideos[0].channelId || newYouTubeVideos[0].channel_id || null;
              console.log(`📌 [YOUTUBE] Using channelId from discovered videos: ${expectedChannelId}`);
            }
            
            // Filter out videos from wrong channels
            const validVideos = refreshedVideos.filter(video => {
              const videoChannelId = video.channelId || video.channel_id || null;
              const videoChannelName = video.channelName || video.channel_name || '';
              
              // If we have a channel ID to validate against
              if (expectedChannelId && videoChannelId) {
                if (videoChannelId !== expectedChannelId) {
                  console.warn(`⚠️ [YOUTUBE] FILTERED OUT video ${video.id} from wrong channel!`);
                  console.warn(`   Expected: ${expectedChannelId} (${account.username})`);
                  console.warn(`   Got: ${videoChannelId} (${videoChannelName})`);
                  return false;
                }
              }
              
              // Additional check: if channel name doesn't match username (fuzzy)
              if (videoChannelName && account.username) {
                const normalizedChannelName = videoChannelName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const normalizedUsername = account.username.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                // If names are VERY different (no overlap), warn but don't filter yet
                if (normalizedChannelName.length > 3 && 
                    normalizedUsername.length > 3 && 
                    !normalizedChannelName.includes(normalizedUsername.substring(0, 4)) &&
                    !normalizedUsername.includes(normalizedChannelName.substring(0, 4))) {
                  console.warn(`⚠️ [YOUTUBE] Possible channel mismatch for video ${video.id}:`);
                  console.warn(`   Channel: "${videoChannelName}" vs Username: "${account.username}"`);
                }
              }
              
              return true;
            });
            
            console.log(`✅ [YOUTUBE] Validated ${validVideos.length}/${refreshedVideos.length} videos belong to correct channel`);
            if (validVideos.length < refreshedVideos.length) {
              console.warn(`🚨 [YOUTUBE] Filtered out ${refreshedVideos.length - validVideos.length} videos from wrong channels!`);
            }
            
            // Add ONLY validated videos to processing
            newYouTubeVideos.push(...validVideos);
          } catch (refreshError) {
            console.error('⚠️ [YOUTUBE] Failed to refresh existing videos (non-fatal):', refreshError);
            // Don't fail the whole sync if refresh fails
          }
        } else {
          console.log(`⚠️ [YOUTUBE] No existing videos found - nothing to refresh`);
        }
        
        const youtubeVideos = newYouTubeVideos;
        console.log(`📊 [YOUTUBE] Processing ${youtubeVideos.length} Shorts`);
        
        // Extract profile/channel data from first video
        if (youtubeVideos.length > 0 && youtubeVideos[0]) {
          const firstVideo = youtubeVideos[0];
          const channelAvatarUrl = firstVideo.channelAvatarUrl || '';
          const followerCount = firstVideo.numberOfSubscribers || 0;
          const channelName = firstVideo.channelName || account.username;
          
          console.log(`👤 Channel: ${channelName} (${followerCount} subscribers)`);
          
          // Update profile data
          const profileUpdates: any = {
            displayName: channelName,
            followerCount: followerCount,
            isVerified: firstVideo.isChannelVerified || false
          };
          
          // Download and upload YouTube profile pic to Firebase Storage
          if (channelAvatarUrl) {
            try {
              console.log(`📸 Downloading YouTube profile pic for ${channelHandle}...`);
              const uploadedProfilePic = await downloadAndUploadImage(
                channelAvatarUrl,
                orgId,
                `youtube_profile_${account.username}.jpg`,
                'profile'
              );
              profileUpdates.profilePicture = uploadedProfilePic;
              console.log(`✅ YouTube profile picture uploaded to Firebase Storage`);
            } catch (uploadError: any) {
              console.error(`❌ Error uploading YouTube profile picture:`, uploadError);
              console.warn(`⚠️ Skipping profile picture - will retry on next sync`);
            }
          }
          
          await accountRef.update(profileUpdates);
          console.log(`✅ Updated YouTube profile: ${followerCount} subscribers`);
        }

        // Transform YouTube data to video format
        videos = youtubeVideos.map((video: any) => {
          // Parse duration (format: "PT27S" or "PT1M7S")
          let durationSeconds = 0;
          if (video.duration) {
            const durationStr = video.duration;
            const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
              const minutes = parseInt(match[1] || '0', 10);
              const seconds = parseInt(match[2] || '0', 10);
              durationSeconds = minutes * 60 + seconds;
            }
          }
          
          // Get best thumbnail (maxres > standard > high > medium > default)
          let thumbnail = '';
          if (video.thumbnails?.maxres?.url) {
            thumbnail = video.thumbnails.maxres.url;
          } else if (video.thumbnails?.standard?.url) {
            thumbnail = video.thumbnails.standard.url;
          } else if (video.thumbnails?.high?.url) {
            thumbnail = video.thumbnails.high.url;
          } else if (video.thumbnails?.medium?.url) {
            thumbnail = video.thumbnails.medium.url;
          } else if (video.thumbnails?.default?.url) {
            thumbnail = video.thumbnails.default.url;
          } else if (video.thumbnailUrl) {
            thumbnail = video.thumbnailUrl;
          }
          
          // 🔧 FIX: Use Unix epoch (Jan 1, 1970) for videos without upload date
          let uploadTimestamp: FirebaseFirestore.Timestamp;
          if (video.date) {
            uploadTimestamp = Timestamp.fromDate(new Date(video.date));
          } else {
            console.warn(`⚠️ [YOUTUBE] Video ${video.id} missing upload date - using epoch`);
            uploadTimestamp = Timestamp.fromMillis(0); // Unix epoch = Jan 1, 1970
          }
          
          return {
            videoId: video.id,
            videoTitle: video.title || 'Untitled Short',
            videoUrl: video.url || `https://youtube.com/shorts/${video.id}`,
            platform: 'youtube',
            thumbnail: thumbnail,
            accountUsername: account.username,
            accountDisplayName: video.channelName || account.username,
            uploadDate: uploadTimestamp,
            views: video.viewCount || 0,
            likes: video.likes || 0,
            comments: video.commentsCount || 0,
            shares: 0, // YouTube doesn't expose share count via API
            saves: video.favoriteCount || video.favorites || 0, // ✅ YouTube favoriteCount = saves/bookmarks
            caption: video.text || '',
            duration: durationSeconds
          };
        });
        
        console.log(`✅ Processed ${videos.length} YouTube Shorts`);
      } catch (youtubeError) {
        console.error('❌ YouTube fetch error:', youtubeError);
        throw youtubeError;
      }
    } else if (account.platform === 'twitter') {
      console.log(`🐦 Fetching tweets for ${account.username}...`);
      
      // First, fetch profile data
      try {
        console.log(`👤 Fetching profile data for ${account.username}...`);
        const profileData = await runApifyActor({
          actorId: 'apidojo/tweet-scraper',
          input: {
            twitterHandles: [account.username],
            maxItems: 1,
            onlyVerifiedUsers: false,
          }
        });

        console.log(`📊 Profile data received`);
        const firstTweet = profileData.items?.[0];
        
        if (firstTweet?.author) {
          const profileUpdates: any = {
            displayName: firstTweet.author.name || account.username,
            followerCount: firstTweet.author.followers || 0,
            followingCount: firstTweet.author.following || 0,
            isVerified: firstTweet.author.isVerified || firstTweet.author.isBlueVerified || false
          };
          
          // Download and upload Twitter profile pic to Firebase Storage
          const profilePictureUrl = firstTweet.author.profilePicture || '';
          if (profilePictureUrl) {
            console.log(`📸 Downloading Twitter profile pic for @${account.username}...`);
            const uploadedProfilePic = await downloadAndUploadImage(
              profilePictureUrl,
              orgId,
              `twitter_profile_${account.username}.jpg`,
              'profile'
            );
            profileUpdates.profilePicture = uploadedProfilePic;
            console.log(`✅ Twitter profile picture uploaded to Firebase Storage`);
          }
          
          await accountRef.update(profileUpdates);
          console.log(`✅ Updated profile data for @${account.username}`);
        } else {
          console.warn(`⚠️ No author data found in first tweet for ${account.username}`);
        }
      } catch (profileError) {
        console.error('Profile fetch error:', profileError);
      }

      // Now fetch tweets using progressive strategy
      console.log(`📥 Fetching tweets for ${account.username}...`);
      
      const creatorType = account.creatorType || 'automatic';
      console.log(`🔧 Account type: ${creatorType}`);
      
      let allTweets: any[] = [];
      
      // Get existing tweet IDs for ALL accounts (needed for refresh and duplicate checking)
      const existingTweetsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .where('trackedAccountId', '==', accountId)
        .where('platform', '==', 'twitter')
        .select('videoId')
        .get();
      
      const existingTweetIds = new Set(
        existingTweetsSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
      );
      
      console.log(`📊 Found ${existingTweetIds.size} existing tweets in database`);
      
      // ===== NEW TWEET DISCOVERY (only if NOT refresh_only) =====
      if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
        // For new accounts: use maxVideos (manual sync)
        // For existing accounts: use 10 (scheduled discovery)
        const tweetsToFetch = existingTweetIds.size === 0 ? maxVideos : 10;
        const syncType = existingTweetIds.size === 0 ? 'MANUAL' : 'SCHEDULED';
        
        console.log(`🔍 [TWITTER ${syncType}] Forward discovery - fetching ${tweetsToFetch} most recent tweets (excluding retweets)...`);
        
        try {
          // Use searchTerms with -filter:nativeretweets to exclude retweets
          // This ensures we get ACTUAL posts (original tweets + quotes, no retweets)
          const searchQuery = `from:${account.username.replace('@', '')} -filter:nativeretweets`;
          
          const tweetsData = await runApifyActor({
            actorId: 'apidojo/tweet-scraper',
            input: {
              searchTerms: [searchQuery], // ✅ Use searchTerms to exclude retweets
              maxItems: tweetsToFetch,
              sort: 'Latest',
              onlyImage: false,
              onlyVideo: false, // ✅ Fetch ALL tweet types (text, images, videos)
              onlyQuote: false, // ✅ Include quotes
              onlyVerifiedUsers: false,
              onlyTwitterBlue: false,
              includeSearchTerms: false,
            }
          });

          const batch = tweetsData.items || [];
          
          if (batch.length === 0) {
            console.log(`⚠️ [TWITTER] No tweets returned`);
          } else {
            // Process tweets newest-first, stop at first duplicate
            let foundDuplicate = false;
            
            for (const tweet of batch) {
              const tweetId = tweet.id;
              
              if (!tweetId) {
                console.warn(`⚠️ Tweet missing ID, skipping`);
                continue;
              }
              
              // Check if this tweet exists in database
              if (existingTweetIds.has(tweetId)) {
                console.log(`✓ [TWITTER] Found duplicate: ${tweetId} - stopping discovery`);
                foundDuplicate = true;
                break;
              }
              
              // This is a new tweet - add it
              allTweets.push(tweet);
            }
            
            console.log(`📊 [TWITTER] Discovered ${allTweets.length} new tweets${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
          }
        } catch (fetchError: any) {
          console.error(`❌ [TWITTER] Discovery failed:`, fetchError.message);
        }
        
        // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
        // If progressive strategy and no duplicate found, queue next spiderweb phase
        // if (useProgressiveFetch && !foundDuplicate) {
        //   const currentPhase = isSpiderwebPhase ? (spiderwebPhase || 1) : 1;
        //   if (currentPhase < 4) {
        //     try {
        //       const nextPhase = currentPhase + 1;
        //       const nextJobRef = db.collection('syncQueue').doc();
        //       
        //       const allKnownTweetIds = Array.from(new Set([
        //         ...existingVideoIdsFromJob,
        //         ...Array.from(existingTweetIds),
        //         ...Array.from(seenTweetIds)
        //       ]));
        //       
        //       await nextJobRef.set({
        //         type: 'account_sync',
        //         status: 'pending',
        //         syncStrategy: 'progressive',
        //         isSpiderwebPhase: true,
        //         spiderwebPhase: nextPhase,
        //         priority: 10,
        //         orgId,
        //         projectId,
        //         accountId,
        //         sessionId: sessionId || null,
        //         accountUsername: account.username,
        //         accountPlatform: 'twitter',
        //         existingVideoIds: allKnownTweetIds,
        //         createdAt: Timestamp.now(),
        //         startedAt: null,
        //         completedAt: null,
        //         attempts: 0,
        //         maxAttempts: 3,
        //         error: null
        //       });
        //       
        //       console.log(`🕸️  [TWITTER] Queued spiderweb phase ${nextPhase} job: ${nextJobRef.id}`);
        //     } catch (queueError: any) {
        //       console.error(`❌ [TWITTER] Failed to queue next spiderweb phase:`, queueError.message);
        //     }
        //   } else {
        //     console.log(`✅ [TWITTER] Spiderweb search complete (reached max phase 4)`);
        //   }
        // } else if (foundDuplicate) {
        //   console.log(`✅ [TWITTER] Spiderweb search complete (found existing tweet, no more phases needed)`);
        // }
      } else if (syncStrategy === 'refresh_only') {
        console.log(`🔄 [TWITTER] Refresh-only mode - skipping new tweet discovery`);
      } else {
        console.log(`🔒 [TWITTER] Static account - skipping new tweet discovery`);
      }
      
      // ===== REFRESH EXISTING TWEETS (runs for ALL accounts with existing tweets) =====
      if (existingTweetIds.size > 0) {
        console.log(`🔄 [TWITTER] Refreshing ALL ${existingTweetIds.size} existing tweets using specific tweet IDs...`);
        
        try {
          // ✅ Use SPECIFIC tweet IDs, not account handle!
          const refreshData = await runApifyActor({
            actorId: 'apidojo/tweet-scraper',
            input: {
              tweetIds: Array.from(existingTweetIds), // ✅ Specific tweet IDs
              sort: 'Latest'
            }
          });
          
          const refreshedTweets = refreshData.items || [];
          console.log(`✅ [TWITTER] Refreshed ${refreshedTweets.length} existing tweets`);
          
          // Add refreshed tweets to processing
          allTweets.push(...refreshedTweets);
        } catch (refreshError) {
          console.error('⚠️ [TWITTER] Failed to refresh existing tweets (non-fatal):', refreshError);
          // Don't fail the whole sync if refresh fails
        }
      } else {
        console.log(`⚠️ [TWITTER] No existing tweets found - nothing to refresh`);
      }
      
      console.log(`📊 Total items to process: ${allTweets.length}`);
      
      if (allTweets.length === 0) {
        console.warn(`⚠️ No tweets found for @${account.username}`);
      }
      
      // Filter out retweets
      const tweets = allTweets.filter((tweet: any) => !tweet.isRetweet);
      
      console.log(`📊 Fetched ${tweets.length} tweets (${allTweets.length} total, retweets filtered)`);
      
      // Transform tweets to video format
      videos = tweets.map((tweet: any, index: number) => {
        let thumbnail = '';
        if (tweet.media && tweet.media.length > 0) {
          thumbnail = tweet.media[0];
        } else if (tweet.extendedEntities?.media && tweet.extendedEntities.media.length > 0) {
          thumbnail = tweet.extendedEntities.media[0].media_url_https || '';
        }

        const tweetId = tweet.id || `tweet_${Date.now()}_${index}`;
        const tweetUrl = tweet.url || `https://twitter.com/i/status/${tweetId}`;
        const tweetText = tweet.fullText || tweet.text || '';

        // 🔧 FIX: Use Unix epoch (Jan 1, 1970) for tweets without creation date
        let uploadTimestamp: FirebaseFirestore.Timestamp;
        if (tweet.createdAt) {
          uploadTimestamp = Timestamp.fromDate(new Date(tweet.createdAt));
        } else {
          console.warn(`⚠️ [TWITTER] Tweet ${tweetId} missing creation date - using epoch`);
          uploadTimestamp = Timestamp.fromMillis(0); // Unix epoch = Jan 1, 1970
        }

        return {
          videoId: tweetId,
          videoTitle: tweetText ? tweetText.substring(0, 100) + (tweetText.length > 100 ? '...' : '') : 'Untitled Tweet',
          videoUrl: tweetUrl,
          platform: 'twitter',
          thumbnail: thumbnail,
          accountUsername: account.username,
          accountDisplayName: tweet.author?.name || account.username,
          uploadDate: uploadTimestamp,
          views: tweet.viewCount || 0,
          likes: tweet.likeCount || 0,
          comments: tweet.replyCount || 0,
          shares: tweet.retweetCount || 0,
          caption: tweetText,
          duration: 0 // Twitter doesn't provide video duration
        };
      });
    } else if (account.platform === 'instagram') {
      console.log(`👤 Fetching Instagram reels for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newInstagramReels: any[] = [];
        let existingVideoIds = new Set<string>();
        
        // Get existing video IDs (used for duplicate checking)
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'instagram')
          .select('videoId')
          .get();
        
        existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing Instagram reels in database`);
        
        // ===== NEW VIDEO DISCOVERY (only if NOT refresh_only) =====
        if (syncStrategy !== 'refresh_only' && creatorType === 'automatic') {
          // For new accounts: use maxVideos (manual sync)
          // For existing accounts: use 10 (scheduled discovery)
          const videosToFetch = existingVideoIds.size === 0 ? maxVideos : 10;
          const syncType = existingVideoIds.size === 0 ? 'MANUAL' : 'SCHEDULED';
          
          console.log(`🔍 [INSTAGRAM ${syncType}] Forward discovery - fetching ${videosToFetch} most recent reels...`);
          
          try {
            const scraperInput: any = {
              tags: [`https://www.instagram.com/${account.username}/reels/`],
              target: 'reels_only',
              reels_count: videosToFetch,
              include_raw_data: true,
              // NO beginDate/endDate - date filtering doesn't work reliably
              custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
              proxy: {
                useApifyProxy: true,
                apifyProxyGroups: ['RESIDENTIAL'],
                apifyProxyCountry: 'US'
              },
              maxConcurrency: 1,
              maxRequestRetries: 3,
              handlePageTimeoutSecs: 120,
              debugLog: false
            };
            
            const data = await runApifyActor({
              actorId: 'hpix~ig-reels-scraper',
              input: scraperInput
            });

            const batch = data.items || [];
            
            if (batch.length === 0) {
              console.log(`⚠️ [INSTAGRAM] No reels returned`);
            } else {
              // Process reels newest-first, stop at first duplicate
              let foundDuplicate = false;
              
              for (const reel of batch) {
                const videoId = reel.video_id || reel.shortcode || reel.id;
                
                if (!videoId) {
                  console.warn(`⚠️ Reel missing video_id, skipping`);
                  continue;
                }
                
                // Check if this video exists in database
                if (existingVideoIds.has(videoId)) {
                  console.log(`✓ [INSTAGRAM] Found duplicate: ${videoId} - stopping discovery`);
                  foundDuplicate = true;
                  break;
                }
                
                // This is a new video - add it
                newInstagramReels.push(reel);
              }
              
              console.log(`📊 [INSTAGRAM] Discovered ${newInstagramReels.length} new reels${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
            }
          } catch (fetchError: any) {
            console.error(`❌ [INSTAGRAM] Discovery failed:`, fetchError.message);
            
            // Check if it's a memory limit error (402) - throw to trigger retry
            if (fetchError.message?.includes('actor-memory-limit-exceeded') || 
                fetchError.message?.includes('402') ||
                fetchError.statusCode === 402) {
              console.error(`💾 Apify memory limit exceeded - will retry later`);
              throw new Error(`Apify capacity exceeded - will retry: ${fetchError.message}`);
            }
          }
          
          // TODO: SPIDERWEB - Re-enable later (multi-phase discovery)
          // If progressive strategy and no duplicate found, queue next spiderweb phase
          // if (useProgressiveFetch && !foundDuplicate) {
          //   const currentPhase = isSpiderwebPhase ? (spiderwebPhase || 1) : 1;
          //   if (currentPhase < 4) {
          //     try {
          //       const nextPhase = currentPhase + 1;
          //       const nextJobRef = db.collection('syncQueue').doc();
          //       
          //       const allKnownVideoIds = Array.from(new Set([
          //         ...existingVideoIdsFromJob,
          //         ...Array.from(existingVideoIds),
          //         ...Array.from(seenVideoIds)
          //       ]));
          //       
          //       await nextJobRef.set({
          //         type: 'account_sync',
          //         status: 'pending',
          //         syncStrategy: 'progressive',
          //         isSpiderwebPhase: true,
          //         spiderwebPhase: nextPhase,
          //         priority: 10,
          //         orgId,
          //         projectId,
          //         accountId,
          //         sessionId: sessionId || null,
          //         accountUsername: account.username,
          //         accountPlatform: 'instagram',
          //         existingVideoIds: allKnownVideoIds,
          //         createdAt: Timestamp.now(),
          //         startedAt: null,
          //         completedAt: null,
          //         attempts: 0,
          //         maxAttempts: 3,
          //         error: null
          //       });
          //       
          //       console.log(`🕸️  [INSTAGRAM] Queued spiderweb phase ${nextPhase} job: ${nextJobRef.id}`);
          //     } catch (queueError: any) {
          //       console.error(`❌ [INSTAGRAM] Failed to queue next spiderweb phase:`, queueError.message);
          //     }
          //   } else {
          //     console.log(`✅ [INSTAGRAM] Spiderweb search complete (reached max phase 4)`);
          //   }
          // } else if (foundDuplicate) {
          //   console.log(`✅ [INSTAGRAM] Spiderweb search complete (found existing reel, no more phases needed)`);
          // }
        } else if (syncStrategy === 'refresh_only') {
          console.log(`🔄 [INSTAGRAM] Refresh-only mode - skipping new video discovery`);
        } else {
          console.log(`🔒 [INSTAGRAM] Static account - skipping new video discovery`);
        }
        
        const instagramItems = newInstagramReels;
        console.log(`📊 [INSTAGRAM] Processing ${instagramItems.length} new reels`);
        
        // ===== REFRESH EXISTING REELS (runs for ALL accounts with existing videos) =====
        if (existingVideoIds.size > 0) {
          console.log(`🔄 Fetching updated metrics for existing reels...`);
          
          try {
            // Get all existing Instagram reels for this account
            const allExistingReelsSnapshot = await db
              .collection('organizations')
              .doc(orgId)
              .collection('projects')
              .doc(projectId)
              .collection('videos')
              .where('trackedAccountId', '==', accountId)
              .where('platform', '==', 'instagram')
              .get();
            
            if (!allExistingReelsSnapshot.empty) {
              // Build post URLs for existing reels
              const postUrls = allExistingReelsSnapshot.docs
                .map(doc => {
                  const videoId = doc.data().videoId;
                  if (!videoId) return null;
                  // Instagram URLs are: https://www.instagram.com/p/{videoId}/ or /reel/{videoId}/
                  return `https://www.instagram.com/p/${videoId}/`;
                })
                .filter(Boolean) as string[];
              
              if (postUrls.length > 0) {
                console.log(`📊 Refreshing metrics for ${postUrls.length} existing reels...`);
                
                // Make second API call with post_urls
                const refreshData = await runApifyActor({
          actorId: 'hpix~ig-reels-scraper',
          input: {
                    post_urls: postUrls,
            target: 'reels_only',
                    reels_count: postUrls.length,
            include_raw_data: true,
            custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
            proxy: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
            },
            maxConcurrency: 1,
            maxRequestRetries: 3,
            handlePageTimeoutSecs: 120,
            debugLog: false
          }
        });

                const refreshedReels = refreshData.items || [];
                console.log(`✅ Refreshed ${refreshedReels.length} existing reels`);
                
                // Add refreshed reels to instagramItems array (will be processed together)
                instagramItems.push(...refreshedReels);
              }
            }
          } catch (refreshError) {
            console.error('⚠️ Failed to refresh existing reels (non-fatal):', refreshError);
            // Don't fail the whole sync if refresh fails
          }
        }
        
        console.log(`📦 Total reels to process: ${instagramItems.length}`);
        
        // ALWAYS use apify/instagram-profile-scraper for profile pic + follower count
        // (hpix~ig-reels-scraper doesn't consistently include follower count)
        console.log(`👤 Fetching complete profile data via apify/instagram-profile-scraper...`);
      try {
        const profileData = await runApifyActor({
            actorId: 'apify~instagram-profile-scraper',
          input: {
              usernames: [account.username.replace('@', '')],
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
              },
              includeAboutSection: false
          }
        });

        const profiles = profileData.items || [];
        if (profiles.length > 0) {
          const profile = profiles[0];
            console.log(`✅ Fetched profile: ${profile.followersCount || 0} followers`);
          
          const profileUpdates: any = {
            displayName: profile.fullName || account.username,
            followerCount: profile.followersCount || 0,
            followingCount: profile.followsCount || 0,
            isVerified: profile.verified || false
          };

            // Download and upload profile pic to Firebase Storage (same as TikTok)
            if (profile.profilePicUrl) {
            try {
                console.log(`📸 Downloading Instagram profile pic for @${account.username}...`);
              const uploadedProfilePic = await downloadAndUploadImage(
                  profile.profilePicUrl,
                orgId,
                `instagram_profile_${account.username}.jpg`,
                'profile'
              );
                profileUpdates.profilePicture = uploadedProfilePic;
                console.log(`✅ Instagram profile picture uploaded to Firebase Storage`);
              } catch (uploadError: any) {
              console.error(`❌ Error uploading Instagram profile picture:`, uploadError);
                console.warn(`⚠️ Skipping profile picture - will retry on next sync`);
            }
          }

          await accountRef.update(profileUpdates);
            console.log(`✅ Updated Instagram profile: ${profile.fullName || account.username}`);
          } else {
            console.warn(`⚠️ No profile data returned from apify/instagram-profile-scraper`);
        }
      } catch (profileError) {
          console.error(`❌ Failed to fetch profile via apify/instagram-profile-scraper:`, profileError);
        }
        
        // Transform Instagram data to video format
        for (const item of instagramItems) {
          // 🔍 Check if this is an error response from Apify (deleted/restricted/private)
          if (item.error) {
            console.warn(`⚠️ [INSTAGRAM] Video error: ${item.error}`);
            console.warn(`   Input URL: ${item.input}`);
            
            // Extract video code from URL to mark it in database
            const urlMatch = item.input?.match(/\/p\/([^\/]+)/);
            const videoCode = urlMatch ? urlMatch[1] : null;
            
            if (videoCode) {
              console.log(`🔍 Marking video ${videoCode} as deleted/restricted in database...`);
              
              // Find the video in database and mark it with error status
              const videoQuery = await db
                .collection('organizations')
                .doc(orgId)
                .collection('projects')
                .doc(projectId)
                .collection('videos')
                .where('videoId', '==', videoCode)
                .where('platform', '==', 'instagram')
                .limit(1)
                .get();
              
              if (!videoQuery.empty) {
                const videoRef = videoQuery.docs[0].ref;
                await videoRef.update({
                  status: 'error',
                  lastRefreshError: item.error,
                  lastRefreshed: Timestamp.now(),
                  errorDetails: {
                    type: item.error.includes('Restricted') ? 'restricted' : 
                          item.error.includes('private') ? 'private' : 'deleted',
                    message: item.error,
                    detectedAt: Timestamp.now()
                  }
                });
                console.log(`✅ Marked video ${videoCode} with error status: ${item.error}`);
              } else {
                console.warn(`⚠️ Could not find video ${videoCode} in database to mark as error`);
              }
            }
            
            continue;
          }
          
          // 🔍 DEBUG: Log item structure to see what fields we have
          console.log(`🔍 [INSTAGRAM] Item keys:`, Object.keys(item).join(', '));
          console.log(`🔍 [INSTAGRAM] Checking for video code: code=${item.code}, id=${item.id}, shortcode=${item.shortcode}, pk=${item.pk}`);
          
          const videoCode = item.code || item.id || item.shortcode || item.pk;
          if (!videoCode) {
            console.warn(`⚠️ Skipping item - no video code found. Available keys: ${Object.keys(item).join(', ')}`);
            console.warn(`⚠️ Item structure:`, JSON.stringify(item, null, 2).substring(0, 500));
            continue;
          }
          
          // Profile data is at raw_data.caption.user (NOT raw_data.owner!)
          const user = item.raw_data?.caption?.user || {};
          const views = item.play_count || item.view_count || 0;
          const likes = item.like_count || 0;
          const comments = item.comment_count || 0;
          const caption = item.caption || '';
          
          // 🔧 FIX: Use Unix epoch (Jan 1, 1970) for reels without upload date
          let uploadTimestamp: FirebaseFirestore.Timestamp;
          if (item.taken_at) {
            uploadTimestamp = Timestamp.fromMillis(item.taken_at * 1000);
          } else {
            console.warn(`⚠️ [INSTAGRAM] Reel ${videoCode} missing taken_at date - using epoch`);
            uploadTimestamp = Timestamp.fromMillis(0); // Unix epoch = Jan 1, 1970
          }
          
          const thumbnailUrl = item.thumbnail_url || '';
          const duration = item.raw_data?.video_duration || item.duration || 0;
          
          videos.push({
            videoId: videoCode,
            videoTitle: caption.substring(0, 100) + (caption.length > 100 ? '...' : '') || 'Instagram Reel',
            videoUrl: `https://www.instagram.com/reel/${videoCode}/`,
            platform: 'instagram',
            thumbnail: thumbnailUrl,
            accountUsername: user.username || account.username,
            accountDisplayName: user.full_name || account.username,
            uploadDate: uploadTimestamp,
            views: views,
            likes: likes,
            comments: comments,
            shares: 0, // Instagram API doesn't provide share count
            caption: caption,
            duration: duration,
            isVerified: user.is_verified || false
          });
        }
        
        console.log(`✅ Processed ${videos.length} Instagram reels`);
      } catch (instagramError) {
        console.error('❌ Instagram fetch error:', instagramError);
        throw instagramError;
      }
    }

    console.log(`📊 Found ${videos.length} videos/posts`);

    // Update progress
    await accountRef.update({
      syncProgress: {
        current: 50,
        total: 100,
        message: `Saving ${videos.length} videos...`
      }
    });

    // Save videos to Firestore (BOTH locations for compatibility)
    const batch = db.batch();
    let savedCount = 0;

    for (const video of videos) {
      // Download and upload thumbnail to Firebase Storage (REQUIRED - no fallback to direct URLs)
      let firebaseThumbnailUrl = '';
      if (video.thumbnail && video.thumbnail.startsWith('http')) {
        try {
          console.log(`    📸 [${account.platform.toUpperCase()}] Downloading thumbnail for video ${video.videoId}...`);
          console.log(`    🌐 [${account.platform.toUpperCase()}] Thumbnail URL: ${video.thumbnail.substring(0, 100)}...`);
          firebaseThumbnailUrl = await downloadAndUploadImage(
            video.thumbnail,
            orgId,
            `${account.platform}_${video.videoId}_thumb.jpg`,
            'thumbnails'
          );
          console.log(`    ✅ [${account.platform.toUpperCase()}] Thumbnail uploaded to Firebase Storage: ${firebaseThumbnailUrl}`);
        } catch (thumbError) {
          console.error(`    ❌ [${account.platform.toUpperCase()}] Thumbnail upload failed for ${video.videoId}:`, thumbError);
          // DO NOT use direct URLs as fallback (they expire)
          // Leave empty - will retry on next sync
          console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No fallback - thumbnail will retry on next sync`);
        }
      } else {
        console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No valid thumbnail URL for video ${video.videoId}`);
      }

      // ==================== FIX #2 & #3: DETERMINISTIC IDs + NO DUPLICATES ====================
      // Use deterministic doc ID: {platform}_{accountId}_{videoId}
      // This prevents race conditions - if 2 jobs try to create same video, only one succeeds
      const videoDocId = `${account.platform}_${accountId}_${video.videoId}`;
      const videoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc(videoDocId); // DETERMINISTIC ID

      const snapshotTime = Timestamp.now();
      const isManualTrigger = account.syncRequestedBy ? true : false;

      // Check if video already exists (fast doc.get instead of query)
      const existingVideo = await videoRef.get();
      const isRefreshOnly = video._isRefreshOnly === true;
        
      if (existingVideo.exists) {
        // VIDEO EXISTS - Update metrics only (and thumbnail if we have a new one)
        const updateData: any = {
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          lastRefreshed: snapshotTime
        };
        
        // Update thumbnail only if we have a new one
        if (firebaseThumbnailUrl) {
          updateData.thumbnail = firebaseThumbnailUrl;
        }
        
        // For non-refresh videos, also update title/date if provided
        // (Refresh-only videos should NEVER overwrite title/date)
        if (!isRefreshOnly) {
          if (video.videoTitle) {
            updateData.videoTitle = video.videoTitle;
          }
          if (video.uploadDate) {
            updateData.uploadDate = video.uploadDate;
          }
        }
        
        batch.update(videoRef, updateData);

        // ==================== FIX #4: SNAPSHOT DEDUPLICATION ====================
        // Check for recent snapshot to prevent duplicates
        const fiveMinutesAgo = Timestamp.fromMillis(snapshotTime.toMillis() - (5 * 60 * 1000));
        const recentSnapshotQuery = await videoRef.collection('snapshots')
          .where('capturedAt', '>=', fiveMinutesAgo)
          .limit(1)
          .get();

        if (!recentSnapshotQuery.empty) {
          const snapshotAge = Math.round((snapshotTime.toMillis() - recentSnapshotQuery.docs[0].data().capturedAt.toMillis()) / 1000);
          console.log(`    ⏭️  Skipping snapshot for ${video.videoId} - recent one exists (${snapshotAge}s ago)`);
        } else {
        // Create refresh snapshot
        const snapshotRef = videoRef.collection('snapshots').doc();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: video.videoId,
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: snapshotTime,
          timestamp: snapshotTime,
          capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh',
            isInitialSnapshot: false
        });
          console.log(`    🔄 Updated video ${video.videoId} + created refresh snapshot`);
        }
      } else {
        // Video doesn't exist
        
        if (isRefreshOnly) {
          // CRITICAL: Refresh-only videos should NEVER create new entries
          // If video doesn't exist, it was probably deleted - skip it
          console.log(`    ⏭️  Skipping refresh-only video ${video.videoId} - doesn't exist in DB (likely deleted)`);
          continue; // Skip to next video
        }
        
        // NEW VIDEO - Create with initial snapshot (only for discovery, not refresh)
        // Remove internal flags before saving
        const { _isRefreshOnly, ...cleanVideoData } = video;
        
      batch.set(videoRef, {
        ...cleanVideoData,
          thumbnail: firebaseThumbnailUrl,
        orgId: orgId,
        projectId: projectId,
        trackedAccountId: accountId,
        platform: account.platform,
          dateAdded: snapshotTime,
        addedBy: account.syncRequestedBy || account.addedBy || 'system',
          lastRefreshed: snapshotTime,
        status: 'active',
        isRead: false,
        isSingular: false
      });

        // Create initial snapshot (no deduplication needed for new videos)
      const snapshotRef = videoRef.collection('snapshots').doc();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: video.videoId,
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
          saves: video.saves || 0,
        capturedAt: snapshotTime,
        timestamp: snapshotTime,
          capturedBy: 'initial_sync',
          isInitialSnapshot: true
      });

        console.log(`    ✅ Created new video ${video.videoId} + initial snapshot`);
      }
      // ==================== FIX #3: REMOVED DUPLICATE SUBCOLLECTION ====================
      // The accountVideoRef subcollection was causing duplicate entries - REMOVED!
      // Videos are stored ONCE in /organizations/{org}/projects/{project}/videos/{deterministicId}

      savedCount++;

      // Commit in batches of 500 (Firestore limit)
      if (savedCount % 500 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining
    if (savedCount % 500 !== 0) {
      await batch.commit();
    }

    // Mark as completed (but first check if account still exists)
    try {
      const accountCheckDoc = await accountRef.get();
      
      if (!accountCheckDoc.exists) {
        console.log(`⚠️  Account ${accountId} was deleted during sync - discarding results`);
        
        // Delete job if it exists
        if (jobId) {
          await db.collection('syncQueue').doc(jobId).delete();
          console.log(`✅ Job ${jobId} deleted (account was deleted during sync)`);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Account was deleted during sync - results discarded',
          accountId,
          videosSynced: 0
        });
      }
      
      // Account still exists - update it
      await accountRef.update({
        syncStatus: 'completed',
        lastSyncAt: Timestamp.now(),
        lastSynced: Timestamp.now(),
        lastRefreshed: Timestamp.now(), // Update lastRefreshed for UI display
        lastSyncError: null,
        syncRetryCount: 0,
        syncProgress: {
          current: 100,
          total: 100,
          message: `Successfully synced ${savedCount} videos`
        }
      });

      console.log(`✅ Completed immediate sync: ${account.username} - ${savedCount} videos saved`);
      console.log(`📊 Summary: Org=${orgId}, Project=${projectId}, Account=${accountId}, Videos=${savedCount}, Session=${sessionId || 'none'}`);
    } catch (checkError: any) {
      console.error(`❌ Error checking/updating account status:`, checkError.message);
      // Continue anyway - don't fail the whole sync
    }

    // NOTE: Email notifications are handled by cron-orchestrator.ts
    // which sends a single summary email per organization instead of individual emails per account.
    // This prevents email spam and provides a better user experience with aggregated stats.

    // 🧹 Auto-cleanup: Delete any invalid videos/accounts (no username, no stats, etc.)
    try {
      console.log(`🧹 Running auto-cleanup for invalid videos/accounts...`);
      const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
      console.log(`✅ Cleanup complete: ${cleanupStats.videosDeleted} videos, ${cleanupStats.accountsDeleted} accounts deleted`);
    } catch (cleanupError) {
      console.error('❌ Cleanup failed (non-fatal):', cleanupError);
      // Don't fail the request if cleanup fails
    }

    // ===============================================================================
    // 📊 SESSION TRACKING & "LAST ONE OUT" EMAIL
    // ===============================================================================
    // If this sync is part of a coordinated refresh session (from cron orchestrator),
    // track progress and send email when ALL accounts in the org have completed.
    // sessionId is already extracted at the top of the function
    
    if (sessionId) {
      try {
        console.log(`📊 Updating session progress: ${sessionId}`);
        
        // Get current account stats for email
        const accountSnapshot = await accountRef.get();
        const accountData = accountSnapshot.data() as any;
        const currentViews = accountData?.totalViews || 0;
        const currentLikes = accountData?.totalLikes || 0;
        const currentComments = accountData?.totalComments || 0;
        const currentShares = accountData?.totalShares || 0;
        
        const sessionRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('refreshSessions')
          .doc(sessionId);
        
        // Atomically increment completed count and add account stats
        await sessionRef.update({
          completedAccounts: FieldValue.increment(1),
          totalVideos: FieldValue.increment(savedCount),
          totalViews: FieldValue.increment(currentViews),
          totalLikes: FieldValue.increment(currentLikes),
          totalComments: FieldValue.increment(currentComments),
          totalShares: FieldValue.increment(currentShares),
          [`accountStats.${accountId}`]: {
            username: account.username,
            platform: account.platform,
            videosSynced: savedCount,
            views: currentViews,
            likes: currentLikes,
            comments: currentComments,
            shares: currentShares,
            displayName: accountData?.displayName || account.username,
            profilePicture: accountData?.profilePicture || ''
          }
        });
        
        // Check if this is the last account to complete ("last one out")
        const sessionSnapshot = await sessionRef.get();
        const session = sessionSnapshot.data() as any;
        
        if (session && session.completedAccounts === session.totalAccounts) {
          console.log(`🎉 Last account completed! Sending summary email...`);
          
          // Mark session as completed
          await sessionRef.update({
            status: 'completed',
            completedAt: Timestamp.now()
          });
          
          // Send summary email
          await sendRefreshSummaryEmail(session, db);
          
          // Mark email as sent
          await sessionRef.update({
            emailSent: true,
            emailSentAt: Timestamp.now()
          });
          
          console.log(`✅ Summary email sent successfully`);
        } else {
          console.log(`⏳ Session progress: ${session?.completedAccounts || 0}/${session?.totalAccounts || 0} accounts`);
        }
        
      } catch (sessionError: any) {
        console.error('❌ Session tracking failed (non-critical):', sessionError.message);
        // Don't fail the request if session tracking fails
      }
    }

    // Delete completed job from queue
    if (jobId) {
      try {
        await db.collection('syncQueue').doc(jobId).delete();
        console.log(`   ✅ Job ${jobId} deleted from queue (${savedCount} videos synced)`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to delete job (non-critical):`, jobError.message);
      }
    }
    
    console.log(`\n✅ [SYNC-ACCOUNT] Successfully completed sync for @${account.username}`);
    console.log(`   📊 Final stats: ${savedCount} videos, Session: ${sessionId || 'none'}, Job: ${jobId || 'none'}\n`);
    
    // Release sync lock
    try {
      await accountRef.update({
        syncLockId: null,
        syncLockTimestamp: null
      });
      console.log(`🔓 Released sync lock for ${accountId}`);
    } catch (unlockError: any) {
      console.warn(`⚠️  Failed to release lock (non-critical):`, unlockError.message);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Account synced successfully',
      videosCount: savedCount,
      username: account.username
    });

  } catch (error: any) {
    console.error(`❌ [SYNC-ACCOUNT] Error for account ${accountId}:`, error.message);
    console.error(`   Stack trace:`, error.stack);

    // Release sync lock on error
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);
      
      await accountRef.update({
        syncLockId: null,
        syncLockTimestamp: null
      });
      console.log(`🔓 Released sync lock for ${accountId} (error path)`);
    } catch (unlockError: any) {
      console.warn(`⚠️  Failed to release lock on error (non-critical):`, unlockError.message);
    }

    // Update job status on error if jobId provided
    if (jobId) {
      try {
        const jobDoc = await db.collection('syncQueue').doc(jobId).get();
        const jobData = jobDoc.data();
        
        if (jobData) {
          const attempts = jobData.attempts || 0;
          const maxAttempts = jobData.maxAttempts || 3;
          
          if (attempts + 1 >= maxAttempts) {
            // Max retries exceeded - mark as failed
            await db.collection('syncQueue').doc(jobId).update({
              status: 'failed',
              completedAt: Timestamp.now(),
              attempts: attempts + 1,
              error: error.message || String(error)
            });
            console.log(`   ❌ Job ${jobId} marked as failed (max retries exceeded)`);
          } else {
            // Reset to pending for retry
            await db.collection('syncQueue').doc(jobId).update({
              status: 'pending',
              attempts: attempts + 1,
              error: error.message || String(error),
              startedAt: null
            });
            console.log(`   🔄 Job ${jobId} reset to pending for retry (attempt ${attempts + 1}/${maxAttempts})`);
          }
        }
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to update job status (non-critical):`, jobError.message);
      }
    }

    // Mark account with error status and send notifications
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);

      // Get account data for error notification
      const accountDoc = await accountRef.get();
      const account = accountDoc.data();

      await accountRef.update({
        syncStatus: 'error',
        hasError: true,
        lastSyncError: error.message || String(error),
        lastSyncErrorAt: Timestamp.now(),
        syncRetryCount: (account?.syncRetryCount || 0) + 1,
        syncProgress: {
          current: 0,
          total: 100,
          message: `Error: ${error.message || String(error)}`
        }
      });

      // Send error notification email and log to Firestore
      await ErrorNotificationService.notifyError({
        type: 'account_sync',
        platform: account?.platform || 'unknown',
        accountId: accountId,
        username: account?.username || 'unknown',
        errorMessage: error.message || String(error),
        errorStack: error.stack,
        orgId: orgId,
        projectId: projectId,
        timestamp: new Date(),
        attemptNumber: (account?.syncRetryCount || 0) + 1
      });
    } catch (updateError) {
      console.error('Failed to update account status:', updateError);
    }

    return res.status(500).json({
      success: false,
      error: error.message || String(error),
      message: 'Sync failed - admin notified'
    });
  }
}

/**
 * Send refresh summary email after all accounts in an organization have completed syncing
 * This implements the "last one out" pattern - only the final account to complete triggers the email
 * 
 * Shows DELTA metrics (what changed since last refresh) not absolute totals
 */
async function sendRefreshSummaryEmail(session: any, db: any) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set - skipping email');
    return;
  }
  
  if (!session.ownerEmail) {
    console.warn('⚠️ No owner email found - skipping email');
    return;
  }
  
  console.log(`📧 Preparing email for: ${session.ownerEmail} (Org: ${session.orgName})`);
  console.log(`   Owner ID: ${session.ownerId || 'Not set'}`);
  console.log(`   Org ID: ${session.orgId}`);
  
  // Calculate time since last refresh (not this session duration)
  let timeSinceLastRefreshText = 'first refresh';
  let timeSinceLastRefreshMs = 0;
  
  if (session.previousRefreshTimestamp) {
    timeSinceLastRefreshMs = Date.now() - session.previousRefreshTimestamp.toMillis();
    const hours = Math.floor(timeSinceLastRefreshMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeSinceLastRefreshMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      timeSinceLastRefreshText = `${days}d`;
    } else if (hours > 0) {
      timeSinceLastRefreshText = `${hours}h`;
    } else if (minutes > 0) {
      timeSinceLastRefreshText = `${minutes}m`;
    } else {
      timeSinceLastRefreshText = '<1m';
    }
  }
  
  // Calculate DELTA metrics (what changed since last refresh)
  const viewsGained = Math.max(0, (session.totalViews || 0) - (session.previousTotalViews || 0));
  const likesGained = Math.max(0, (session.totalLikes || 0) - (session.previousTotalLikes || 0));
  const commentsGained = Math.max(0, (session.totalComments || 0) - (session.previousTotalComments || 0));
  const sharesGained = Math.max(0, (session.totalShares || 0) - (session.previousTotalShares || 0));
  const linkClicksGained = Math.max(0, (session.totalLinkClicks || 0) - (session.previousTotalLinkClicks || 0));
  
  // Calculate engagement rate from deltas
  const totalEngagement = likesGained + commentsGained + sharesGained;
  const engagementRate = viewsGained > 0 
    ? ((totalEngagement / viewsGained) * 100).toFixed(2)
    : '0.00';
  
  // Get top 5 videos from THIS refresh cycle (sorted by views)
  console.log(`🔍 Fetching top videos from this refresh...`);
  const videosSnapshot = await db
    .collectionGroup('videos')
    .where('lastRefreshed', '>=', session.startedAt)
    .orderBy('lastRefreshed', 'desc')
    .orderBy('viewCount', 'desc')
    .limit(50) // Get more to filter to org
    .get();
  
  // Filter to only videos from this org
  const orgVideos = videosSnapshot.docs.filter((doc: any) => {
    const path = doc.ref.path;
    return path.includes(`organizations/${session.orgId}/`);
  });
  
  const topVideos = orgVideos.slice(0, 5);
  console.log(`   Found ${topVideos.length} top videos from this refresh`);
  
  // Sort accounts by views gained (top performers)
  const accountStats = Object.values(session.accountStats || {}) as any[];
  const topPerformers = accountStats
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);
  
  // Generate top videos HTML from this refresh
  const topVideosHtml = topVideos
    .map((videoDoc: any, index: number) => {
      const video = videoDoc.data();
      const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
      const platform = video.platform || 'unknown';
      const platformEmoji = platform === 'tiktok' ? '📱' : platform === 'youtube' ? '▶️' : platform === 'instagram' ? '📷' : '🐦';
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div>
              <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${rankEmoji} ${video.title || 'Untitled'}</div>
              <div style="font-size: 12px; color: #6b7280;">${platformEmoji} ${platform.charAt(0).toUpperCase() + platform.slice(1)} • @${video.accountUsername || 'Unknown'}</div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #667eea;">${(video.viewCount || 0).toLocaleString()}</div>
            <div style="font-size: 11px; color: #6b7280;">views</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #f56565;">${(video.likeCount || 0).toLocaleString()}</div>
            <div style="font-size: 11px; color: #6b7280;">likes</div>
          </td>
        </tr>
      `;
    })
    .join('');
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
                    <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 40px; width: auto; margin-bottom: 20px;" />
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                      ${session.orgName}
                    </h1>
                    <p style="margin: 12px 0 0; color: rgba(255,255,255,0.95); font-size: 18px; font-weight: 500;">
                      Data Refresh Complete
                    </p>
                  </td>
                </tr>
                
                <!-- Time Since Last Refresh Banner -->
                <tr>
                  <td style="background: #f9fafb; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 15px; color: #6b7280;">
                      📊 In the last <strong style="color: #111827; font-weight: 700;">${timeSinceLastRefreshText}</strong>, you've gained:
                    </p>
                  </td>
                </tr>
                
                <!-- Delta Metrics -->
                <tr>
                  <td style="padding: 40px;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px;">
                      <!-- Views Gained -->
                      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; text-align: center;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Views</div>
                        <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 4px;">+${viewsGained.toLocaleString()}</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 12px;">gained</div>
                      </div>
                      
                      <!-- Link Clicks -->
                      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 24px; border-radius: 12px; text-align: center;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Link Clicks</div>
                        <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 4px;">+${linkClicksGained.toLocaleString()}</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 12px;">gained</div>
                      </div>
                    </div>
                    
                    <!-- Engagement Rate Card -->
                    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 28px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
                      <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Engagement Rate</div>
                      <div style="color: #ffffff; font-size: 48px; font-weight: 800; margin-bottom: 4px;">${engagementRate}%</div>
                      <div style="color: rgba(255,255,255,0.8); font-size: 13px;">${totalEngagement.toLocaleString()} total engagements (likes + comments + shares)</div>
                    </div>
                    
                    <!-- Top Videos Section -->
                    ${topVideos.length > 0 ? `
                    <div style="margin: 40px 0;">
                      <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
                        🔥 Top 5 Videos from this Refresh
                      </h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #ffffff;">
                        ${topVideosHtml}
                      </table>
                    </div>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 48px 0 24px;">
                      <a href="https://www.viewtrack.app" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                        View Full Dashboard →
                      </a>
                    </div>
                    
                    <!-- Summary Footer -->
                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 10px; text-align: center;">
                      <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        <strong style="color: #111827;">${session.completedAccounts || 0}</strong> account${session.completedAccounts !== 1 ? 's' : ''} refreshed • 
                        <strong style="color: #111827;">${session.totalVideos || 0}</strong> new video${session.totalVideos !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #111827; padding: 28px 40px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 15px; color: #ffffff; font-weight: 600;">
                      ViewTrack
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                      Professional Social Media Analytics
                    </p>
                    <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
                      Automated refresh • ${new Date().toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  
  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ViewTrack <team@viewtrack.app>',
        to: [session.ownerEmail],
        subject: `${session.orgName} - Data Refresh Complete (+${viewsGained.toLocaleString()} Views | ${engagementRate}% Engagement)`,
        html: emailHtml
      })
    });
    
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`❌ Email API error (${emailResponse.status}):`, errorText);
      throw new Error(`Email API returned ${emailResponse.status}: ${errorText}`);
    }
    
    const emailResult = await emailResponse.json();
    console.log(`✅ Refresh summary email sent successfully!`);
    console.log(`   📧 Recipient: ${session.ownerEmail}`);
    console.log(`   🏢 Organization: ${session.orgName} (${session.orgId})`);
    console.log(`   👤 Owner ID: ${session.ownerId || 'Not set'}`);
    console.log(`   📊 Deltas: +${viewsGained.toLocaleString()} views, ${engagementRate}% engagement`);
    console.log(`   📨 Email ID: ${emailResult.id || 'Unknown'}`);
    
  } catch (error: any) {
    console.error('❌ Failed to send refresh summary email:', error.message);
    throw error;
  }
}

