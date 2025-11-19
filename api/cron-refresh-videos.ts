import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runApifyActor } from './apify-client.js';
// @ts-ignore - heic-convert has no types
import convert from 'heic-convert';

// Initialize Firebase Admin (same pattern as other API files)
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
 * Cron Job: Refresh all videos for all tracked accounts
 * Now superseded by cron-orchestrator.ts which runs every 6 hours
 * Can still be triggered manually by authenticated users
 * 
 * Security: 
 * - Cron jobs: Requires CRON_SECRET in Authorization header
 * - Manual triggers: Accepts authenticated user requests (no CRON_SECRET needed)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add top-level error handling
  try {
    // Verify Firebase is initialized
    if (!getApps().length) {
      console.error('❌ Firebase Admin not initialized');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Firebase not initialized',
        errorType: 'FIREBASE_INIT_ERROR'
      });
    }

    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    // Allow requests with valid CRON_SECRET OR from authenticated users
    const isCronJob = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isManualTrigger = req.body?.manual === true; // Manual trigger from authenticated user
    
    if (!isCronJob && !isManualTrigger) {
      console.warn('⚠️ Unauthorized refresh attempt');
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized: Must be a scheduled cron job or manual trigger' 
      });
    }

    // Get scope from request body (for manual triggers)
    const scopedOrgId = req.body?.organizationId;
    const scopedProjectId = req.body?.projectId;
    
    const triggerType = isCronJob ? 'Scheduled Cron Job' : 'Manual Trigger';
    const scopeInfo = scopedOrgId ? ` (Org: ${scopedOrgId}${scopedProjectId ? `, Project: ${scopedProjectId}` : ''})` : ' (All Organizations)';
    console.log(`🚀 Starting automated video refresh (${triggerType}${scopeInfo})...`);
    const startTime = Date.now();

    try {
    // Get organizations to process
    let orgsSnapshot;
    if (scopedOrgId) {
      // Manual trigger: only process specified organization
      const orgDoc = await db.collection('organizations').doc(scopedOrgId).get();
      if (!orgDoc.exists) {
        return res.status(404).json({
          success: false,
          error: `Organization ${scopedOrgId} not found`,
          errorType: 'ORG_NOT_FOUND'
        });
      }
      orgsSnapshot = { docs: [orgDoc], size: 1 };
    } else {
      // Scheduled cron: process all organizations
      orgsSnapshot = await db.collection('organizations').get();
    }
    console.log(`📊 Found ${orgsSnapshot.size} organization(s) to process`);

    let totalAccountsProcessed = 0;
    let totalVideosRefreshed = 0;
    let totalVideosAdded = 0;
    let totalVideosUpdated = 0;
    let failedAccounts: Array<{ org: string; project: string; account: string; error: string }> = [];
    const processedOrgs = new Map<string, { email: string; orgName: string; accountsProcessed: number; videosAdded: number; videosUpdated: number }>();

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      console.log(`\n📁 Processing organization: ${orgId}`);
      
      // Track org stats for email notifications
      if (!processedOrgs.has(orgId)) {
        // Get owner email from users collection (same as sync-single-account logic)
        let ownerEmail = '';
        if (orgData.ownerId) {
          try {
            const ownerDoc = await db.collection('users').doc(orgData.ownerId).get();
            if (ownerDoc.exists) {
              const ownerData = ownerDoc.data();
              ownerEmail = ownerData?.email || '';
              console.log(`  📧 Owner email found: ${ownerEmail}`);
            }
          } catch (err) {
            console.error(`  ⚠️ Failed to fetch owner email:`, err);
          }
        }
        
        processedOrgs.set(orgId, {
          email: ownerEmail,
          orgName: orgData.name || 'Your Organization',
          accountsProcessed: 0,
          videosAdded: 0,
          videosUpdated: 0
        });
      }

      // Get projects to process
      let projectsSnapshot;
      if (scopedProjectId && scopedOrgId === orgId) {
        // Manual trigger with specific project: only process that project
        const projectDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(scopedProjectId)
          .get();
        
        if (!projectDoc.exists) {
          console.error(`  ⚠️ Project ${scopedProjectId} not found in organization ${orgId}`);
          continue;
        }
        projectsSnapshot = { docs: [projectDoc], size: 1 };
      } else {
        // Get all projects for this org
        projectsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .get();
      }

      console.log(`  📂 Found ${projectsSnapshot.size} project(s) to process`);

      // Process each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        console.log(`\n  📦 Processing project: ${projectData.name || projectId}`);

        // Get all tracked accounts for this project
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('isActive', '==', true)
          .get();

        console.log(`    👥 Found ${accountsSnapshot.size} active accounts`);

        // Process accounts in parallel batches for maximum performance
        // With 12-hour intervals, we can handle large batches aggressively
        const BATCH_SIZE = 50; // Process 50 accounts at once (lightning fast!)
        const accounts = accountsSnapshot.docs;
        
        for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
          const batch = accounts.slice(i, i + BATCH_SIZE);
          console.log(`\n    ⚡ Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accounts.length / BATCH_SIZE)} (${batch.length} accounts)...`);
          
          // Process this batch in parallel
          const batchPromises = batch.map(async (accountDoc) => {
            const accountId = accountDoc.id;
            const accountData = accountDoc.data();
            const username = accountData.username;
            const platform = accountData.platform;
            const creatorType = accountData.creatorType || 'automatic'; // Default to automatic for backward compatibility

            try {
              // Fetch creatorType from account data and pass to refreshAccountVideos
              const result = await refreshAccountVideos(
                orgId,
                projectId,
                accountId,
                username,
                platform,
                isManualTrigger,
                creatorType
              );

              // Always update lastSynced for all accounts (even if 0 videos updated)
              // This ensures we track that the refresh attempt was made
              const updateData: any = {
                lastSynced: new Date()
              };
              
              // Add verified status if available
              if (result.verified !== undefined) {
                updateData.isVerified = result.verified;
              }
              if (result.blueVerified !== undefined) {
                updateData.isBlueVerified = result.blueVerified;
              }
              
              await accountDoc.ref.update(updateData);
              
              if (result.fetched > 0 || result.updated > 0) {
                console.log(`    ✅ @${username} [${creatorType.toUpperCase()}]: Updated ${result.updated} videos, Added ${result.added} new videos, Skipped ${result.skipped} invalid videos`);
                
                // Track stats
                const orgStats = processedOrgs.get(orgId);
                if (orgStats) {
                  orgStats.accountsProcessed++;
                  orgStats.videosAdded += result.added;
                  orgStats.videosUpdated += result.updated;
                }
                
                return { success: true, username, updated: result.updated, added: result.added };
              } else {
                console.warn(`    ⚠️ @${username} [${creatorType.toUpperCase()}]: No videos updated (fetched=${result.fetched}, updated=${result.updated}) - possible API issue or no videos to refresh`);
                return { success: true, username, updated: 0, added: 0 };
              }

            } catch (error: any) {
              console.error(`    ❌ Failed to refresh @${username}:`, error.message);
              return {
                success: false,
                username,
                error: error.message,
                org: orgId,
                project: projectId
              };
            }
          });

          // Wait for all accounts in this batch to complete
          const results = await Promise.allSettled(batchPromises);
          
          // Process results
          results.forEach((result) => {
            if (result.status === 'fulfilled') {
              const data = result.value;
              if (data.success) {
                totalAccountsProcessed++;
                const videosChanged = (data.updated || 0) + (data.added || 0);
                totalVideosRefreshed += videosChanged;
                totalVideosUpdated += (data.updated || 0);
                totalVideosAdded += (data.added || 0);
              } else {
                failedAccounts.push({
                  org: data.org,
                  project: data.project,
                  account: data.username,
                  error: data.error
                });
              }
            }
          });
          
          // No delay needed - with 12 hour intervals, we maximize speed
          // Apify proxy handles rate limiting automatically
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const summary = {
      success: true,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
      stats: {
        totalOrganizations: orgsSnapshot.size,
        totalAccountsProcessed,
        totalVideosRefreshed,
        failedAccounts: failedAccounts.length
      },
      failures: failedAccounts
    };

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Video refresh job completed!');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Accounts processed: ${totalAccountsProcessed}`);
    console.log(`🎬 Videos refreshed: ${totalVideosRefreshed}`);
    console.log(`➕ New videos added: ${totalVideosAdded}`);
    console.log(`🔄 Videos updated: ${totalVideosUpdated}`);
    console.log(`❌ Failed accounts: ${failedAccounts.length}`);
    console.log('='.repeat(60) + '\n');

    // Send email notifications to organization owners (for both manual AND automatic cron runs)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      console.log('\n📧 Sending refresh summary emails...');
      let emailsSent = 0;
      let emailsFailed = 0;
      
      for (const [orgId, stats] of processedOrgs.entries()) {
        // Send email if there was any activity (added, updated, or just refreshed)
        if (!stats.email) {
          console.log(`  ⏭️ Skipping org ${orgId} - no email found`);
          continue;
        }
        
        if (stats.videosAdded === 0 && stats.videosUpdated === 0 && stats.accountsProcessed === 0) {
          console.log(`  ⏭️ Skipping ${stats.email} - no activity to report`);
          continue;
        }
        
        try {
          console.log(`  📤 Sending to ${stats.email} (${stats.accountsProcessed} accounts, +${stats.videosAdded} new, ~${stats.videosUpdated} updated)...`);
            const triggerTypeText = isManualTrigger ? 'Manual' : 'Automated';
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'ViewTrack <team@viewtrack.app>',
                to: [stats.email],
                subject: `📊 ${stats.orgName} - Video Refresh Complete${stats.videosAdded > 0 ? ` (+${stats.videosAdded} New)` : ''}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="padding: 30px 20px;">
                    <h2 style="color: #f5576c; margin-top: 0;">${triggerTypeText} Refresh Complete! 🎉</h2>
                    <p>Your tracked accounts for <strong>${stats.orgName}</strong> have been refreshed with the latest data.</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #333;">📊 Summary</h3>
                      <div style="display: grid; gap: 10px;">
                        <p style="margin: 5px 0;"><strong>Accounts Refreshed:</strong> ${stats.accountsProcessed}</p>
                        <p style="margin: 5px 0; color: #10b981; font-size: 16px;"><strong>✨ New Videos Added:</strong> ${stats.videosAdded}</p>
                        <p style="margin: 5px 0; color: #3b82f6; font-size: 16px;"><strong>🔄 Videos Updated:</strong> ${stats.videosUpdated}</p>
                        <p style="margin: 5px 0;"><strong>Total Changes:</strong> ${stats.videosAdded + stats.videosUpdated}</p>
                      </div>
                    </div>
                    ${stats.videosAdded > 0 ? `
                      <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #065f46;"><strong>🎉 ${stats.videosAdded} new video${stats.videosAdded === 1 ? '' : 's'} discovered!</strong></p>
                        <p style="margin: 5px 0 0 0; color: #065f46; font-size: 14px;">Check your dashboard to see the latest content from your tracked accounts.</p>
                      </div>
                    ` : ''}
                    ${stats.videosUpdated > 0 ? `
                      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #1e40af;"><strong>📈 ${stats.videosUpdated} video${stats.videosUpdated === 1 ? '' : 's'} updated!</strong></p>
                        <p style="margin: 5px 0 0 0; color: #1e40af; font-size: 14px;">All metrics refreshed with latest views, likes, comments, and engagement data.</p>
                      </div>
                    ` : ''}
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">Stay on top of your content performance and track what's trending!</p>
                    <div style="text-align: center; margin-top: 25px;">
                      <a href="https://www.viewtrack.app" style="display: inline-block; padding: 14px 28px; background: #f5576c; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard →</a>
                    </div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-top: 1px solid #e9ecef; margin-top: 30px;">
                      <p style="margin: 0; color: #666; font-size: 12px;">Trigger Type: ${triggerTypeText} | ${new Date().toLocaleString()}</p>
                    </div>
                  </div>
                `,
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              console.log(`  ✅ Email sent successfully (ID: ${emailData.id})`);
              emailsSent++;
            } else {
              const errorData = await emailResponse.json();
              console.error(`  ❌ Failed to send email:`, errorData);
              emailsFailed++;
            }
          } catch (emailError) {
            console.error(`  ❌ Email error:`, emailError);
            emailsFailed++;
          }
        }
      }
      
      console.log(`\n📧 Email summary: ${emailsSent} sent, ${emailsFailed} failed`);
    } else {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping email notifications');
    }

    return res.status(200).json(summary);

    } catch (error: any) {
      console.error('❌ Cron job failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        errorType: 'PROCESSING_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    // Top-level catch for any unhandled errors
    console.error('❌ Unhandled error in cron-refresh-videos:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
      errorType: 'UNHANDLED_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Download image from URL and upload to Firebase Storage
 * Returns Firebase Storage URL or fallback placeholder
 */
async function downloadAndUploadImage(
  imageUrl: string, 
  orgId: string, 
  filename: string,
  folder: string = 'thumbnails'
): Promise<string> {
  try {
    const isInstagram = imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn');
    const isTikTok = imageUrl.includes('tiktokcdn');
    console.log(`    📥 Downloading thumbnail from ${isInstagram ? 'Instagram' : isTikTok ? 'TikTok' : 'platform'}...`);
    
    // Download image with proper headers for Instagram and TikTok
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/heic,image/heif,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site'
      }
    };
    
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    } else if (isTikTok) {
      fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
    }
    
    const response = await fetch(imageUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      throw new Error(`Data too small (${buffer.length} bytes)`);
    }
    
    // Determine content type from response or detect from URL
    let contentType = response.headers.get('content-type') || 'image/jpeg';
    
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
      console.log(`    🔄 [HEIC] Converting HEIC thumbnail to JPG...`);
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
        console.log(`    ✅ [HEIC] Successfully converted HEIC to JPG (${buffer.length} bytes)`);
      } catch (conversionError) {
        console.error(`    ❌ [HEIC] Conversion failed:`, conversionError);
        console.warn(`    ⚠️ [HEIC] Will upload as-is - may not display properly in browsers`);
        // Continue with original buffer if conversion fails
      }
    }
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/${folder}/${filename}`;
    const file = bucket.file(storagePath);
    
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
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`    ✅ Uploaded thumbnail to Firebase Storage`);
    return publicUrl;
  } catch (error) {
    console.error(`    ❌ Failed to download/upload thumbnail:`, error);
    // DO NOT return original URL as fallback for ANY platform (all CDN URLs expire)
    // Instagram, TikTok, YouTube, Twitter URLs all have expiring signatures
    console.warn(`    ⚠️ Thumbnail download failed, returning empty (CDN URLs expire - will retry later)`);
    throw error; // Throw error so caller knows upload failed
  }
}

/**
 * OPTIMIZED: Refresh videos for a single account using incremental fetch + bulk refresh
 * 
 * Strategy:
 * - Static mode: Only refresh existing videos, no new fetches
 * - Automatic mode with 0 videos: Fetch exactly 10 videos
 * - Automatic mode with existing videos: Progressive fetch 5, 10, 15, 20... until duplicate found
 * - Always refresh all existing videos at the end
 */
async function refreshAccountVideos(
  orgId: string,
  projectId: string,
  accountId: string,
  username: string,
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
  isManualTrigger: boolean,
  creatorType: 'automatic' | 'static' = 'automatic'
): Promise<{ fetched: number; updated: number; added: number; skipped: number; verified?: boolean; blueVerified?: boolean }> {
  console.log(`    🔄 [${platform.toUpperCase()}] Starting refresh for @${username} (${creatorType} mode)...`);
  
  let added = 0;
  let newVideos: any[] = [];
  let isVerified: boolean | undefined;
  let isBlueVerified: boolean | undefined;

  // STEP 1: Handle new video fetching based on creatorType
  if (creatorType === 'static') {
    console.log(`    🔒 [${platform.toUpperCase()}] Static mode - skipping new video discovery, will only refresh existing videos`);
    // Skip new video discovery entirely for static accounts
  } else if (creatorType === 'automatic') {
    // Check if account has any videos in DB
    const existingCount = await getAccountVideoCount(orgId, projectId, accountId);
    console.log(`    📊 [${platform.toUpperCase()}] Account has ${existingCount} existing videos`);
  
    if (existingCount === 0) {
      // NEW ACCOUNT: Fetch exactly 10 videos
      console.log(`    ✨ [${platform.toUpperCase()}] New account - fetching 10 videos`);
      try {
        const batch = await fetchVideosFromPlatform(platform, username, 10);
        newVideos = batch;

        // Extract verified status from first video
        if (batch.length > 0) {
          isVerified = extractVerifiedStatus(batch[0], platform);
          isBlueVerified = extractBlueVerifiedStatus(batch[0], platform);
        }
      } catch (fetchError: any) {
        console.error(`    ❌ [${platform.toUpperCase()}] Failed to fetch videos:`, fetchError.message);
        // Return early with zero results instead of crashing
    return { fetched: 0, updated: 0, added: 0, skipped: 0 };
  }

    } else {
      // EXISTING ACCOUNT: Progressive fetch 5, 10, 15, 20... until duplicate
      console.log(`    🔄 [${platform.toUpperCase()}] Existing account - progressive fetch`);
      const batchSizes = [5, 10, 15, 20];
      let foundDuplicate = false;
      
      for (const size of batchSizes) {
        console.log(`    📥 [${platform.toUpperCase()}] Fetching ${size} videos...`);
        
        try {
          const batch = await fetchVideosFromPlatform(platform, username, size);
      
          if (!batch || batch.length === 0) {
            console.log(`    ⚠️ [${platform.toUpperCase()}] No videos returned`);
            break;
          }
          
          // Extract verified status from first batch
          if (newVideos.length === 0 && batch.length > 0) {
            isVerified = extractVerifiedStatus(batch[0], platform);
            isBlueVerified = extractBlueVerifiedStatus(batch[0], platform);
  }

          // Check each video in batch
          for (const video of batch) {
    const videoId = extractVideoId(video, platform);
    if (!videoId) continue;

    const exists = await videoExistsInDatabase(orgId, projectId, videoId);
    
    if (exists) {
              console.log(`    ✓ [${platform.toUpperCase()}] Found duplicate: ${videoId} - stopping fetch`);
              foundDuplicate = true;
      break;
    } else {
      newVideos.push(video);
    }
  }

          if (foundDuplicate) break;
    
          // Stop if we got fewer videos than requested (reached end of account's content)
          if (batch.length < size) {
            console.log(`    ⏹️ [${platform.toUpperCase()}] Got ${batch.length} < ${size} (end of content)`);
        break;
      }
        } catch (fetchError: any) {
          console.error(`    ❌ [${platform.toUpperCase()}] Fetch failed at size ${size}:`, fetchError.message);
          break; // Stop trying to fetch more
    }
  }

  console.log(`    📊 [${platform.toUpperCase()}] Found ${newVideos.length} new videos`);
    }

    // STEP 2: Save new videos
  if (newVideos.length > 0) {
    const counts = await saveVideosToFirestore(orgId, projectId, accountId, newVideos, platform, isManualTrigger);
    added = counts.added;
    }
  }

  // STEP 3: Refresh all existing videos (for BOTH automatic and static)
  console.log(`    🔄 [${platform.toUpperCase()}] Refreshing existing videos...`);
  const updated = await refreshExistingVideos(orgId, projectId, accountId, platform);
  
  console.log(`    ✅ [${platform.toUpperCase()}] Complete: ${added} new, ${updated} refreshed`);

  return {
    fetched: newVideos.length,
    updated: updated,
    added: added,
    skipped: 0,
    verified: isVerified,
    blueVerified: isBlueVerified
  };
}

/**
 * Fetch videos from platform with specified batch size
 */
async function fetchVideosFromPlatform(
  platform: string,
  username: string,
  maxVideos: number,
  skipVideos: number = 0
): Promise<any[]> {
  console.log(`    🔍 [FETCH] Platform: "${platform}", Username: "${username}", MaxVideos: ${maxVideos}`);
  
  let actorId: string;
  let input: any;

  // Normalize platform to lowercase for comparison
  const platformLower = platform.toLowerCase().trim();

  if (platformLower === 'instagram') {
    // DO NOT use beginDate/endDate for cron refreshes - just fetch latest reels
    // Date filtering is only used in sync-single-account.ts for incremental syncs
    actorId = 'hpix~ig-reels-scraper';
    input = {
      tags: [`https://www.instagram.com/${username}/reels/`],
      target: 'reels_only',
      reels_count: maxVideos,
      // NO beginDate or endDate - fetch latest reels
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
    };
  } else if (platformLower === 'tiktok') {
    actorId = 'apidojo/tiktok-scraper';
    const usernameClean = username.replace('@', '');
    input = {
      startUrls: [`https://www.tiktok.com/@${usernameClean}`],
      maxItems: maxVideos,
      sortType: 'RELEVANCE',
      dateRange: 'DEFAULT',
      location: 'US',
      includeSearchKeywords: false,
      customMapFunction: '(object) => { return {...object} }',
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };
  } else if (platformLower === 'twitter') {
    actorId = 'apidojo/tweet-scraper';
    input = {
      twitterHandles: [username],
      maxItems: maxVideos,
      sort: 'Latest',
      onlyImage: false,
      onlyVideo: true, // ✅ ONLY fetch video tweets
      onlyQuote: false,
      onlyVerifiedUsers: false,
      onlyTwitterBlue: false,
      includeSearchTerms: false
    };
  } else if (platformLower === 'youtube') {
    // YouTube: Use YouTube Data API v3 to fetch channel videos
    console.log(`    🎥 [YOUTUBE] Fetching latest videos from channel...`);
    
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      console.error(`    ❌ [YOUTUBE] YOUTUBE_API_KEY not configured`);
      return [];
    }

    try {
      // Step 1: Search for the channel by username/handle
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(username)}&key=${youtubeApiKey}&maxResults=1`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (!searchData.items || searchData.items.length === 0) {
        console.log(`    ⚠️ [YOUTUBE] No channel found for: ${username}`);
        return [];
      }
      
      const channelId = searchData.items[0].snippet.channelId || searchData.items[0].id.channelId;
      console.log(`    ✅ [YOUTUBE] Found channel ID: ${channelId}`);
      
      // Step 2: Get channel's uploads playlist
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${youtubeApiKey}`;
      const channelResponse = await fetch(channelUrl);
      const channelData = await channelResponse.json();
      
      if (!channelData.items || channelData.items.length === 0) {
        console.log(`    ⚠️ [YOUTUBE] No channel data found`);
        return [];
      }
      
      const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
      
      // Step 3: Get videos from uploads playlist
      const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxVideos}&key=${youtubeApiKey}`;
      const playlistResponse = await fetch(playlistUrl);
      const playlistData = await playlistResponse.json();
      
      if (!playlistData.items || playlistData.items.length === 0) {
        console.log(`    ⚠️ [YOUTUBE] No videos found in uploads playlist`);
        return [];
      }

      // Step 4: Get detailed stats for these videos
      const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).filter(Boolean);
      
      if (videoIds.length === 0) {
        return [];
      }

      const videoDetailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${youtubeApiKey}`;
      const videoDetailsResponse = await fetch(videoDetailsUrl);
      const videoDetailsData = await videoDetailsResponse.json();
      
      console.log(`    ✅ [YOUTUBE] Fetched ${videoDetailsData.items?.length || 0} videos with full details`);
      
      // Skip videos if needed (for pagination)
      const videos = videoDetailsData.items || [];
      return skipVideos > 0 ? videos.slice(skipVideos) : videos;
      
    } catch (error: any) {
      console.error(`    ❌ [YOUTUBE] Failed to fetch videos:`, error.message);
      return [];
    }
  } else {
    console.error(`    ❌ [FETCH] Unsupported platform received: "${platform}" (normalized: "${platformLower}")`);
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const result = await runApifyActor({
    actorId: actorId,
    input: input
  });

  const videos = result.items || [];
  
  // Check if the response contains an error (Apify returns 200 but with error in JSON)
  if (videos.length === 1 && videos[0]?.error === true) {
    const errorMessage = videos[0].message || 'Unknown error from scraper';
    const errorCode = videos[0].code || 'UNKNOWN';
    console.error(`    ❌ [${platform.toUpperCase()}] Scraper returned error:`, errorMessage, `(${errorCode})`);
    throw new Error(errorMessage);
  }
  
  // Also check for noResults flag
  if (videos.length === 1 && videos[0]?.noResults === true) {
    const errorMessage = videos[0].message || 'No results found';
    console.error(`    ❌ [${platform.toUpperCase()}] No results:`, errorMessage);
    throw new Error(errorMessage);
  }

  // Skip videos if needed (for pagination)
  return skipVideos > 0 ? videos.slice(skipVideos) : videos;
}

/**
 * Check if a video exists in the database
 */
async function videoExistsInDatabase(
  orgId: string,
  projectId: string,
  videoId: string
): Promise<boolean> {
  const videosRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos');
    
  const query = videosRef.where('videoId', '==', videoId).limit(1);
  const snapshot = await query.get();
  
  return !snapshot.empty;
}

/**
 * Extract video ID from platform-specific video object
 */
function extractVideoId(video: any, platform: string): string | null {
    const platformLower = platform.toLowerCase().trim();
    
    if (platformLower === 'instagram') {
    // hpix~ig-reels-scraper format
    return video.code || video.id || null;
    } else if (platformLower === 'tiktok') {
    // apidojo/tiktok-scraper format: direct id field or extract from postPage URL
    if (video.id || video.post_id) {
      return video.id || video.post_id;
    }
    // Try to extract from postPage URL: https://www.tiktok.com/@user/video/7563144408766450975
    if (video.postPage) {
      const match = video.postPage.match(/\/video\/(\d+)/);
      if (match) return match[1];
    }
    // Fallback to tiktok_url
    if (video.tiktok_url) {
      const match = video.tiktok_url.match(/\/video\/(\d+)/);
      if (match) return match[1];
    }
    return null;
    } else if (platformLower === 'twitter') {
    return video.id || null;
  } else if (platformLower === 'youtube') {
    // YouTube Data API v3 format
    return video.id || null;
  }
  return null;
}

/**
 * Get count of videos for an account
 */
async function getAccountVideoCount(
  orgId: string,
  projectId: string,
  accountId: string
): Promise<number> {
  const snapshot = await db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos')
    .where('trackedAccountId', '==', accountId)
    .count()
    .get();
  
  return snapshot.data().count;
}

/**
 * Extract verified status from video data
 */
function extractVerifiedStatus(video: any, platform: string): boolean | undefined {
  const platformLower = platform.toLowerCase().trim();
  if (platformLower === 'instagram') {
    return video.raw_data?.owner?.is_verified || false;
  } else if (platformLower === 'tiktok') {
    return video.channel?.verified || false;
  } else if (platformLower === 'twitter') {
    return video.isVerified || false;
  }
  return undefined;
}

/**
 * Extract blue verified status (Twitter only)
 */
function extractBlueVerifiedStatus(video: any, platform: string): boolean | undefined {
  if (platform.toLowerCase().trim() === 'twitter') {
    return video.isBlueVerified || false;
  }
  return undefined;
}

/**
 * Refresh all existing videos for an account using platform-specific bulk endpoints
 */
async function refreshExistingVideos(
  orgId: string,
  projectId: string,
  accountId: string,
  platform: string
): Promise<number> {
  const platformLower = platform.toLowerCase().trim();
  
  // Get ALL existing videos for this account (NO LIMIT - refresh everything)
  const videosRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(projectId)
    .collection('videos');
    
  const query = videosRef.where('trackedAccountId', '==', accountId); // ✅ NO LIMIT - refresh ALL videos
  const snapshot = await query.get();
  
  if (snapshot.empty) {
    console.log(`    ℹ️ [${platformLower.toUpperCase()}] No existing videos to refresh`);
    return 0;
  }

  console.log(`    📊 [${platformLower.toUpperCase()}] Refreshing ALL ${snapshot.size} existing videos (no limit)...`);

  if (platformLower === 'tiktok') {
    // TikTok: Bulk refresh using unique videos API
    return await refreshTikTokVideosBulk(orgId, projectId, snapshot.docs);
  } else if (platformLower === 'instagram') {
    // Instagram: Sequential refresh using unique video endpoint
    return await refreshInstagramVideosSequential(orgId, projectId, snapshot.docs);
  } else if (platformLower === 'twitter') {
    // Twitter: Batch refresh (can submit multiple URLs)
    return await refreshTwitterVideosBatch(orgId, projectId, snapshot.docs);
  } else if (platformLower === 'youtube') {
    // YouTube: Bulk refresh using YouTube Data API v3
    return await refreshYouTubeVideosBulk(orgId, projectId, snapshot.docs);
  }

  console.warn(`    ⚠️ [REFRESH] Unsupported platform for refresh: "${platform}" (normalized: "${platformLower}")`);
  return 0;
}

/**
 * TikTok: Bulk refresh using unique videos API
 */
async function refreshTikTokVideosBulk(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  // TikTok has a unique videos API that accepts multiple video URLs
  const validVideos = videoDocs.filter(doc => {
    const data = doc.data();
    return data.url || data.videoUrl;
  });
  
  const videoUrls = validVideos.map(doc => doc.data().url || doc.data().videoUrl);
  
  const missingUrlCount = videoDocs.length - validVideos.length;
  if (missingUrlCount > 0) {
    console.warn(`    ⚠️ [TIKTOK] ${missingUrlCount} videos missing URL field - skipping`);
    const missingVideos = videoDocs.filter(doc => !doc.data().url && !doc.data().videoUrl);
    missingVideos.forEach(doc => {
      console.warn(`      - Video ${doc.id}: videoId=${doc.data().videoId}, no URL`);
    });
  }
  
  if (videoUrls.length === 0) {
    console.error(`    ❌ [TIKTOK] No valid video URLs found in ${videoDocs.length} videos`);
    return 0;
  }

  console.log(`    🔄 [TIKTOK] Bulk refreshing ${videoUrls.length} videos (${missingUrlCount} skipped)...`);
  
  try {
    const result = await runApifyActor({
      actorId: 'apidojo/tiktok-scraper',
      input: {
        startUrls: videoUrls,
        maxItems: videoUrls.length,
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

    const refreshedVideos = result.items || [];
    let updatedCount = 0;

    console.log(`    🔍 [TIKTOK] Matching ${refreshedVideos.length} API results with ${validVideos.length} DB videos...`);

    // Update each video with fresh metrics (apidojo/tiktok-scraper format)
    const unmatchedVideos: string[] = [];
    const matchedVideoIds = new Set<string>();
    
    for (const video of refreshedVideos) {
      const videoId = extractVideoId(video, 'tiktok');
      if (!videoId) {
        console.warn(`    ⚠️ [TIKTOK] Could not extract videoId from:`, {
          id: video.id,
          post_id: video.post_id,
          tiktok_url: video.tiktok_url?.substring(0, 50)
        });
        continue;
      }

      const videoDoc = validVideos.find(doc => doc.data().videoId === videoId);
      if (!videoDoc) {
        console.warn(`    ⚠️ [TIKTOK] No DB match for videoId: ${videoId}`);
        unmatchedVideos.push(videoId);
        continue;
      }

      matchedVideoIds.add(videoId);
      console.log(`    ✓ [TIKTOK] Matched videoId ${videoId}, updating metrics...`);

      const now = Timestamp.now();
      const metrics = {
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        saves: video.bookmarks || 0, // ✅ BOOKMARKS
        lastRefreshed: now
      };

      // Update video metrics
      await videoDoc.ref.update(metrics);

      // Create refresh snapshot
      const snapshotRef = videoDoc.ref.collection('snapshots').doc();
      await snapshotRef.set({
        id: snapshotRef.id,
        videoId: videoId,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        capturedAt: now,
        timestamp: now, // Backwards compatibility
        capturedBy: 'scheduled_refresh',
        isInitialSnapshot: false // This is a refresh snapshot
      });

      updatedCount++;
    }

    // Report detailed results
    const notRefreshedCount = validVideos.length - updatedCount;
    const successRate = validVideos.length > 0 ? Math.round((updatedCount / validVideos.length) * 100) : 0;
    
    console.log(`    ✅ [TIKTOK] Bulk refresh complete: ${updatedCount}/${validVideos.length} videos updated (${successRate}% success)`);
    
    if (unmatchedVideos.length > 0) {
      console.warn(`    ⚠️ [TIKTOK] ${unmatchedVideos.length} videos returned by API but not matched to DB`);
    }
    
    if (notRefreshedCount > 0) {
      console.warn(`    ⚠️ [TIKTOK] ${notRefreshedCount} videos not refreshed - possible API issues or missing data`);
      // Log which videos weren't refreshed
      const notRefreshed = validVideos.filter(doc => !matchedVideoIds.has(doc.data().videoId));
      notRefreshed.slice(0, 5).forEach(doc => {
        console.warn(`      - VideoId: ${doc.data().videoId}, URL: ${doc.data().url || doc.data().videoUrl}`);
      });
      if (notRefreshed.length > 5) {
        console.warn(`      ... and ${notRefreshed.length - 5} more`);
      }
    }
    
    return updatedCount;
  } catch (error: any) {
    console.error(`    ❌ [TIKTOK] Bulk refresh failed:`, error.message || error);
    console.error(`    ❌ [TIKTOK] Error details:`, {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return 0;
  }
}

/**
 * Instagram: Batch refresh using multiple post_urls in ONE API call
 */
async function refreshInstagramVideosSequential(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  console.log(`    🔄 [INSTAGRAM] Batch refresh of ${videoDocs.length} videos in ONE call...`);
  
  // Collect all post URLs
  const postUrls: string[] = [];
  const videoDocMap = new Map<string, any>(); // Map videoId -> videoDoc
  let skippedCount = 0;

  for (const videoDoc of videoDocs) {
    const videoData = videoDoc.data();
    const videoUrl = videoData.url || videoData.videoUrl;
    const videoId = videoData.videoId;
  
    if (!videoUrl || !videoId) {
      console.warn(`    ⚠️ [INSTAGRAM] Video ${videoDoc.id} missing URL or videoId - skipping`);
      skippedCount++;
      continue;
    }

    postUrls.push(videoUrl);
    videoDocMap.set(videoId, videoDoc);
  }
  
  if (skippedCount > 0) {
    console.warn(`    ⚠️ [INSTAGRAM] Skipped ${skippedCount} videos with missing data`);
  }
  
  if (postUrls.length === 0) {
    console.error(`    ❌ [INSTAGRAM] No valid videos to refresh out of ${videoDocs.length} videos`);
    return 0;
      }

  console.log(`    📦 [INSTAGRAM] Fetching metrics for ${postUrls.length} videos (${skippedCount} skipped)...`);

  try {
    // Make ONE API call with ALL post URLs
      const result = await runApifyActor({
        actorId: 'hpix~ig-reels-scraper',
        input: {
        post_urls: postUrls, // ALL VIDEOS IN ONE CALL!
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

    const refreshedVideos = result.items || [];
    console.log(`    📊 [INSTAGRAM] API returned ${refreshedVideos.length} videos, matching to ${videoDocMap.size} DB videos...`);
    
    let updatedCount = 0;
    let failedCount = 0;
    
    // Match API results to DB videos and update
    const unmatchedVideos: string[] = [];
    const matchedVideoIds = new Set<string>();
    
    for (const video of refreshedVideos) {
      const videoCode = video.code || video.id;
      if (!videoCode) {
        console.warn(`    ⚠️ [INSTAGRAM] Skipping video - no code/id in API response`);
        continue;
      }
      
      const videoDoc = videoDocMap.get(videoCode);
      if (!videoDoc) {
        console.warn(`    ⚠️ [INSTAGRAM] No DB match for video: ${videoCode}`);
        unmatchedVideos.push(videoCode);
        failedCount++;
        continue;
      }
      
      matchedVideoIds.add(videoCode);
      
      const now = Timestamp.now();
      const metrics = {
        views: video.play_count || video.video_view_count || 0,
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        saves: video.save_count || 0,
        lastRefreshed: now
      };

      // Update video metrics
      await videoDoc.ref.update(metrics);

      // Create refresh snapshot
      const snapshotRef = videoDoc.ref.collection('snapshots').doc();
      await snapshotRef.set({
        id: snapshotRef.id,
        videoId: videoCode,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        capturedAt: now,
        timestamp: now,
        capturedBy: 'scheduled_refresh',
        isInitialSnapshot: false
      });

      updatedCount++;
      console.log(`    ✓ [INSTAGRAM] Updated ${videoCode}: ${metrics.views} views`);
    }
    
    // Report detailed results
    failedCount = videoDocMap.size - updatedCount;
    const successRate = videoDocMap.size > 0 ? Math.round((updatedCount / videoDocMap.size) * 100) : 0;
    console.log(`    ✅ [INSTAGRAM] Batch complete: ${updatedCount}/${videoDocMap.size} updated (${successRate}% success)`);
    
    if (unmatchedVideos.length > 0) {
      console.warn(`    ⚠️ [INSTAGRAM] ${unmatchedVideos.length} videos returned by API but not matched to DB`);
    }
    
    if (failedCount > 0) {
      console.warn(`    ⚠️ [INSTAGRAM] ${failedCount} videos not refreshed - possible API issues or missing data`);
      // Log which videos weren't refreshed
      const notRefreshed = Array.from(videoDocMap.values()).filter(doc => !matchedVideoIds.has(doc.data().videoId));
      notRefreshed.slice(0, 5).forEach(doc => {
        console.warn(`      - VideoId: ${doc.data().videoId}, URL: ${doc.data().url || doc.data().videoUrl}`);
      });
      if (notRefreshed.length > 5) {
        console.warn(`      ... and ${notRefreshed.length - 5} more`);
      }
    }
    
    return updatedCount;
    } catch (error: any) {
      const errorMsg = error.message || String(error);
    console.error(`    ❌ [INSTAGRAM] Batch refresh failed: ${errorMsg}`);
    console.error(`    ❌ [INSTAGRAM] Error details:`, {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return 0;
  }
}

/**
 * Twitter: Batch refresh (can submit multiple URLs)
 */
async function refreshTwitterVideosBatch(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  // Twitter API can handle multiple tweet IDs at once
  const validVideos = videoDocs.filter(doc => doc.data().videoId);
  const tweetIds = validVideos.map(doc => doc.data().videoId);
  
  const missingIdCount = videoDocs.length - validVideos.length;
  if (missingIdCount > 0) {
    console.warn(`    ⚠️ [TWITTER] ${missingIdCount} videos missing videoId - skipping`);
  }
  
  if (tweetIds.length === 0) {
    console.error(`    ❌ [TWITTER] No valid tweet IDs found in ${videoDocs.length} videos`);
    return 0;
  }

  console.log(`    🔄 [TWITTER] Batch refreshing ${tweetIds.length} tweets (${missingIdCount} skipped)...`);
  
  try {
    const result = await runApifyActor({
      actorId: 'apidojo/tweet-scraper',
      input: {
        tweetIds: tweetIds,
        sort: 'Latest'
      }
    });

    const refreshedTweets = result.items || [];
    let updatedCount = 0;
    const matchedVideoIds = new Set<string>();
    const unmatchedVideos: string[] = [];

    console.log(`    📊 [TWITTER] API returned ${refreshedTweets.length} tweets, matching to ${validVideos.length} DB videos...`);

    // Update each tweet with fresh metrics
    for (const tweet of refreshedTweets) {
      const tweetId = tweet.id;
      if (!tweetId) continue;

      const videoDoc = validVideos.find(doc => doc.data().videoId === tweetId);
      if (!videoDoc) {
        console.warn(`    ⚠️ [TWITTER] No DB match for tweetId: ${tweetId}`);
        unmatchedVideos.push(tweetId);
        continue;
      }
      
      matchedVideoIds.add(tweetId);

      const now = Timestamp.now();
      const metrics = {
        views: tweet.viewCount || 0,
        likes: tweet.likeCount || 0,
        comments: tweet.replyCount || 0,
        shares: tweet.retweetCount || 0,
        saves: tweet.bookmarkCount || 0, // ✅ BOOKMARKS
        lastRefreshed: now
      };

      // Update video metrics
      await videoDoc.ref.update(metrics);

      // Create refresh snapshot
      const snapshotRef = videoDoc.ref.collection('snapshots').doc();
      await snapshotRef.set({
        id: snapshotRef.id,
        videoId: tweetId,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        capturedAt: now,
        timestamp: now, // Backwards compatibility
        capturedBy: 'scheduled_refresh',
        isInitialSnapshot: false // This is a refresh snapshot
      });

      updatedCount++;
    }

    // Report detailed results
    const notRefreshedCount = validVideos.length - updatedCount;
    const successRate = validVideos.length > 0 ? Math.round((updatedCount / validVideos.length) * 100) : 0;
    
    console.log(`    ✅ [TWITTER] Batch refresh complete: ${updatedCount}/${validVideos.length} tweets updated (${successRate}% success)`);
    
    if (unmatchedVideos.length > 0) {
      console.warn(`    ⚠️ [TWITTER] ${unmatchedVideos.length} tweets returned by API but not matched to DB`);
    }
    
    if (notRefreshedCount > 0) {
      console.warn(`    ⚠️ [TWITTER] ${notRefreshedCount} tweets not refreshed - possible API issues or deleted tweets`);
      // Log which videos weren't refreshed
      const notRefreshed = validVideos.filter(doc => !matchedVideoIds.has(doc.data().videoId));
      notRefreshed.slice(0, 5).forEach(doc => {
        console.warn(`      - TweetId: ${doc.data().videoId}`);
      });
      if (notRefreshed.length > 5) {
        console.warn(`      ... and ${notRefreshed.length - 5} more`);
      }
    }
    
    return updatedCount;
  } catch (error: any) {
    console.error(`    ❌ [TWITTER] Batch refresh failed:`, error.message || error);
    console.error(`    ❌ [TWITTER] Error details:`, {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return 0;
  }
}

/**
 * YouTube: Bulk refresh using YouTube Data API v3
 */
async function refreshYouTubeVideosBulk(
  orgId: string,
  projectId: string,
  videoDocs: any[]
): Promise<number> {
  console.log(`    🔄 [YOUTUBE] Bulk refreshing ${videoDocs.length} videos using YouTube Data API v3...`);
  
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) {
    console.error(`    ❌ [YOUTUBE] YOUTUBE_API_KEY not configured`);
    return 0;
  }

  // YouTube Data API v3 supports up to 50 video IDs per request
  const validVideos = videoDocs.filter(doc => doc.data().videoId);
  const videoIds = validVideos.map(doc => doc.data().videoId);
  
  const missingIdCount = videoDocs.length - validVideos.length;
  if (missingIdCount > 0) {
    console.warn(`    ⚠️ [YOUTUBE] ${missingIdCount} videos missing videoId - skipping`);
  }
  
  if (videoIds.length === 0) {
    console.error(`    ❌ [YOUTUBE] No valid video IDs to refresh out of ${videoDocs.length} videos`);
    return 0;
  }

  console.log(`    📊 [YOUTUBE] Fetching metrics for ${videoIds.length} videos (${missingIdCount} skipped)...`);
  
  let updatedCount = 0;
  const matchedVideoIds = new Set<string>();
  const unmatchedVideos: string[] = [];

  try {
    // Process in batches of 50 (YouTube API limit)
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      const batchIds = videoIds.slice(i, i + BATCH_SIZE);
      const idsParam = batchIds.join(',');
      
      console.log(`    📦 [YOUTUBE] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batchIds.length} videos)...`);
      
      const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(idsParam)}&key=${youtubeApiKey}`;
      const ytResponse = await fetch(ytUrl);
      
      if (!ytResponse.ok) {
        const errorText = await ytResponse.text();
        console.error(`    ❌ [YOUTUBE] API error: ${ytResponse.status} - ${errorText}`);
        continue; // Skip this batch and continue with next one
      }
      
      const ytData = await ytResponse.json();
      const refreshedVideos = ytData.items || [];
      
      console.log(`    📊 [YOUTUBE] API returned ${refreshedVideos.length}/${batchIds.length} videos for this batch`);
      
      // Update each video with fresh metrics
      for (const video of refreshedVideos) {
        const videoId = video.id;
        if (!videoId) continue;

        const videoDoc = validVideos.find(doc => doc.data().videoId === videoId);
        if (!videoDoc) {
          console.warn(`    ⚠️ [YOUTUBE] No DB match for videoId: ${videoId}`);
          unmatchedVideos.push(videoId);
          continue;
        }
        
        matchedVideoIds.add(videoId);

        const now = Timestamp.now();
        const metrics = {
          views: video.statistics?.viewCount ? Number(video.statistics.viewCount) : 0,
          likes: video.statistics?.likeCount ? Number(video.statistics.likeCount) : 0,
          comments: video.statistics?.commentCount ? Number(video.statistics.commentCount) : 0,
          shares: 0, // YouTube API doesn't provide share count
          saves: video.statistics?.favoriteCount ? Number(video.statistics.favoriteCount) : 0, // ✅ YouTube favoriteCount = saves/bookmarks
          lastRefreshed: now
        };

        // Update video metrics
        await videoDoc.ref.update(metrics);

        // Create refresh snapshot
        const snapshotRef = videoDoc.ref.collection('snapshots').doc();
        await snapshotRef.set({
          id: snapshotRef.id,
          videoId: videoId,
          views: metrics.views,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          saves: metrics.saves,
          capturedAt: now,
          timestamp: now,
          capturedBy: 'scheduled_refresh',
          isInitialSnapshot: false
        });

        updatedCount++;
        console.log(`    ✓ [YOUTUBE] Updated ${videoId}: ${metrics.views} views, ${metrics.likes} likes`);
      }
    }

    // Report detailed results
    const notRefreshedCount = validVideos.length - updatedCount;
    const successRate = validVideos.length > 0 ? Math.round((updatedCount / validVideos.length) * 100) : 0;
    
    console.log(`    ✅ [YOUTUBE] Bulk refresh complete: ${updatedCount}/${validVideos.length} videos updated (${successRate}% success)`);
    
    if (unmatchedVideos.length > 0) {
      console.warn(`    ⚠️ [YOUTUBE] ${unmatchedVideos.length} videos returned by API but not matched to DB`);
    }
    
    if (notRefreshedCount > 0) {
      console.warn(`    ⚠️ [YOUTUBE] ${notRefreshedCount} videos not refreshed - possible API issues or deleted videos`);
      // Log which videos weren't refreshed
      const notRefreshed = validVideos.filter(doc => !matchedVideoIds.has(doc.data().videoId));
      notRefreshed.slice(0, 5).forEach(doc => {
        console.warn(`      - VideoId: ${doc.data().videoId}`);
      });
      if (notRefreshed.length > 5) {
        console.warn(`      ... and ${notRefreshed.length - 5} more`);
      }
    }
    
    return updatedCount;
  } catch (error: any) {
    console.error(`    ❌ [YOUTUBE] Bulk refresh failed:`, error.message);
    console.error(`    ❌ [YOUTUBE] Error details:`, {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      updatedSoFar: updatedCount
    });
    return updatedCount; // Return partial success
  }
}

/**
 * Save videos to Firestore with batched writes
 * Updates existing videos AND adds new ones
 */
async function saveVideosToFirestore(
  orgId: string,
  projectId: string,
  accountId: string,
  videos: any[],
  platform: string,
  isManualTrigger: boolean
): Promise<{ updated: number; skipped: number; added: number }> {
  const batch = db.batch();
  let batchCount = 0;
  let updatedCount = 0;
  let addedCount = 0;
  let skippedCount = 0;
  const BATCH_SIZE = 500;

  // Check video limits before adding new videos
  const usageDoc = await db
    .collection('organizations')
    .doc(orgId)
    .collection('billing')
    .doc('usage')
    .get();
  
  const usage = usageDoc.data();
  const currentVideos = usage?.trackedVideos || 0;
  const videoLimit = usage?.limits?.trackedVideos || 100;
  const availableSpace = videoLimit - currentVideos;
  
  console.log(`📊 Video limits - Current: ${currentVideos}, Limit: ${videoLimit}, Available: ${availableSpace}`);

  const platformLower = platform.toLowerCase().trim();

  for (const video of videos) {
    // Extract video ID and media object based on platform (this is the platform's video ID, not Firestore doc ID)
    let platformVideoId: string;
    let media: any = video; // Default to the video object itself
    
    if (platformLower === 'instagram') {
      // hpix~ig-reels-scraper format
      media = video;
      
      platformVideoId = video.code || video.id;
    } else if (platformLower === 'tiktok') {
      // apidojo/tiktok-scraper: direct id field
      platformVideoId = video.id || video.post_id || '';
    } else if (platformLower === 'twitter') {
      platformVideoId = video.id;
    } else if (platformLower === 'youtube') {
      // YouTube Data API v3 format
      platformVideoId = video.id;
    } else {
      console.warn(`    ⚠️ [SAVE] Skipping video with unsupported platform: "${platform}"`);
      continue;
    }

    if (!platformVideoId) continue;

    // ⚫ NEW: Check if video is blacklisted (user deleted it)
    try {
      const deletedVideoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('deletedVideos')
        .doc(platformVideoId);
      
      const deletedVideoSnap = await deletedVideoRef.get();
      
      if (deletedVideoSnap.exists) {
        console.log(`    🚫 Skipping blacklisted video ${platformVideoId} (user deleted it)`);
        skippedCount++;
        continue;
      }
    } catch (blacklistError) {
      // Non-critical - proceed if blacklist check fails
      console.warn(`    ⚠️ Failed to check deletion blacklist for ${platformVideoId}:`, blacklistError);
    }

    // Query for the video by its videoId field (not document ID)
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
    
    // Extract metrics based on platform
    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let saves = 0; // ✅ ADD SAVES DECLARATION
    let url = '';
    let thumbnail = '';
    let caption = '';
    let uploadDate: Date = new Date();

    if (platformLower === 'instagram') {
      // hpix~ig-reels-scraper field names
      const owner = video.raw_data?.owner || {};
      views = video.play_count || video.view_count || 0;
      likes = video.like_count || 0;
      comments = video.comment_count || 0;
      shares = 0; // Instagram API doesn't provide share count
      url = `https://www.instagram.com/reel/${video.code}/`;
      
      // Get thumbnail from hpix~ig-reels-scraper
      const instaThumbnail = video.thumbnail_url || '';
      
      // Download and upload thumbnail to Firebase Storage
      if (instaThumbnail) {
        console.log(`    📸 Instagram thumbnail URL found: ${instaThumbnail.substring(0, 80)}...`);
        thumbnail = await downloadAndUploadImage(
          instaThumbnail,
          orgId,
          `${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      } else {
        console.warn(`    ⚠️ Instagram reel ${platformVideoId} has no thumbnail in API response`);
      }
      caption = video.caption || '';
      uploadDate = video.taken_at ? new Date(video.taken_at * 1000) : new Date();
    } else if (platformLower === 'tiktok') {
      // apidojo/tiktok-scraper format
      const videoObj = video.video || {};
      const channel = video.channel || {};
      views = video.views || 0;
      likes = video.likes || 0;
      comments = video.comments || 0;
      shares = video.shares || 0;
      saves = video.bookmarks || 0; // Bookmarks (TikTok only)
      
      // 🔥 VIDEO URL: Always use postPage, fallback to reconstruction from video ID
      const videoId = video.id || video.post_id || platformVideoId || '';
      url = video.postPage || video.tiktok_url || videoObj.url || '';
      
      // If no valid TikTok post URL (e.g., only have CDN URL) and we have a video ID, reconstruct it
      if ((!url || !url.includes('tiktok.com/@')) && videoId) {
        const username = channel.username || video['channel.username'] || videoData?.uploaderHandle || 'user';
        url = `https://www.tiktok.com/@${username}/video/${videoId}`;
        console.log(`    🔧 [TIKTOK] Reconstructed URL from ID: ${url}`);
      }
      
      // THUMBNAIL EXTRACTION: Check flat keys FIRST (TikTok API returns flat keys like "video.cover")
      let tiktokThumbnail = '';
      if (video['video.cover']) { 
        // Flat key: "video.cover" (THIS IS THE PRIMARY SOURCE)
        tiktokThumbnail = video['video.cover'];
      } else if (video['video.thumbnail']) { 
        // Flat key: "video.thumbnail"
        tiktokThumbnail = video['video.thumbnail'];
      } else if (videoObj.cover) {
        // Nested object: video.video.cover
        tiktokThumbnail = videoObj.cover;
      } else if (videoObj.thumbnail) {
        // Nested object: video.video.thumbnail
        tiktokThumbnail = videoObj.thumbnail;
      } else if (video.images && Array.isArray(video.images) && video.images.length > 0) {
        tiktokThumbnail = video.images[0].url || '';
      }
      
      // Note: Keep original HEIC URLs - they will be converted server-side during download
      
      // Download and upload thumbnail to Firebase Storage
      if (tiktokThumbnail) {
        console.log(`    🎬 TikTok thumbnail URL found: ${tiktokThumbnail.substring(0, 80)}...`);
        thumbnail = await downloadAndUploadImage(
          tiktokThumbnail,
          orgId,
          `tt_${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      } else {
        console.warn(`    ⚠️ TikTok video ${platformVideoId} has no thumbnail URL in API response`);
        console.log(`    🔍 Available TikTok fields:`, Object.keys(video).slice(0, 20).join(', '));
      }
      caption = video.title || video.subtitle || video.caption || '';
      uploadDate = video.uploadedAt ? new Date(video.uploadedAt * 1000) : 
                   video.uploaded_at ? new Date(video.uploaded_at * 1000) : 
                   new Date();
    } else if (platformLower === 'twitter') {
      views = video.viewCount || 0;
      likes = video.likeCount || 0;
      comments = video.replyCount || 0;
      shares = video.retweetCount || 0;
      url = video.url || '';
      const twitterThumbnail = video.media?.[0]?.thumbnail_url || '';
      // Download and upload thumbnail to Firebase Storage
      if (twitterThumbnail) {
        thumbnail = await downloadAndUploadImage(
          twitterThumbnail,
          orgId,
          `${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      }
      caption = video.text || '';
      uploadDate = video.created_at ? new Date(video.created_at) : new Date();
    } else if (platformLower === 'youtube') {
      // YouTube Data API v3 format
      views = video.statistics?.viewCount ? Number(video.statistics.viewCount) : 0;
      likes = video.statistics?.likeCount ? Number(video.statistics.likeCount) : 0;
      comments = video.statistics?.commentCount ? Number(video.statistics.commentCount) : 0;
      shares = 0; // YouTube API doesn't provide share count
      saves = video.statistics?.favoriteCount ? Number(video.statistics.favoriteCount) : 0; // ✅ YouTube favoriteCount = saves/bookmarks
      url = `https://www.youtube.com/watch?v=${platformVideoId}`;
      
      // Get thumbnail from YouTube API (use highest quality available)
      const youtubeThumbnail = video.snippet?.thumbnails?.maxres?.url ||
                               video.snippet?.thumbnails?.standard?.url ||
                               video.snippet?.thumbnails?.high?.url ||
                               video.snippet?.thumbnails?.medium?.url ||
                               video.snippet?.thumbnails?.default?.url || '';
      
      // Download and upload thumbnail to Firebase Storage
      if (youtubeThumbnail) {
        console.log(`    🎥 YouTube thumbnail URL found: ${youtubeThumbnail.substring(0, 80)}...`);
        thumbnail = await downloadAndUploadImage(
          youtubeThumbnail,
          orgId,
          `yt_${platformVideoId}_thumb.jpg`,
          'thumbnails'
        );
      } else {
        console.warn(`    ⚠️ YouTube video ${platformVideoId} has no thumbnail in API response`);
      }
      
      caption = video.snippet?.title || '';
      uploadDate = video.snippet?.publishedAt ? new Date(video.snippet.publishedAt) : new Date();
    }
    
    // Check if video exists
    if (querySnapshot.empty) {
      // Check if we have space to add new videos
      if (currentVideos + addedCount >= videoLimit) {
        console.warn(`⚠️ Video limit reached. Skipping new video: ${platformVideoId}`);
        skippedCount++;
        continue;
      }
      
      // Video doesn't exist - ADD IT as a new video!
      const newVideoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc();

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
        saves: platformLower === 'tiktok' ? (saves || 0) : 0, // ✅ ADD BOOKMARKS (TikTok only)
        orgId,
        projectId,
        trackedAccountId: accountId,
        platform,
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

      // Create initial snapshot for new video
      const initialSnapshotRef = newVideoRef.collection('snapshots').doc();
      const snapshotTime = Timestamp.now();
      batch.set(initialSnapshotRef, {
        id: initialSnapshotRef.id,
        videoId: platformVideoId,
        views,
        likes,
        comments,
        shares,
        saves: platformLower === 'tiktok' ? (saves || 0) : 0, // ✅ ADD BOOKMARKS
        capturedAt: snapshotTime,
        timestamp: snapshotTime, // Backwards compatibility
        capturedBy: isManualTrigger ? 'manual_refresh_initial' : 'scheduled_refresh_initial'
      });

      addedCount++;
      batchCount++;
    } else {
      // Video exists - UPDATE IT
      const existingDoc = querySnapshot.docs[0];
      const videoRef = existingDoc.ref;
      const existingData = existingDoc.data();

      const videoData: any = {
        views,
        likes,
        comments,
        shares,
        saves: platformLower === 'tiktok' ? (saves || 0) : (existingData.saves || 0), // ✅ ADD BOOKMARKS
        lastRefreshed: Timestamp.now()
      };

      // Update thumbnail if:
      // 1. Existing thumbnail is empty/missing and we have a new one
      // 2. Existing thumbnail is a placeholder and we have a real one
      // 3. Existing thumbnail is NOT already a Firebase Storage URL and IS a CDN URL
      // 4. Existing thumbnail is empty string, null, or undefined
      const isFirebaseStorage = existingData.thumbnail && existingData.thumbnail.includes('storage.googleapis.com');
      const isCDNUrl = existingData.thumbnail && 
        (existingData.thumbnail.includes('cdninstagram.com') || 
         existingData.thumbnail.includes('fbcdn.net') ||
         existingData.thumbnail.includes('tiktokcdn.com') ||
         existingData.thumbnail.includes('twimg.com'));
      
      const existingThumbnailEmpty = !existingData.thumbnail || existingData.thumbnail.trim() === '';
      
      const shouldUpdateThumbnail = 
        (existingThumbnailEmpty && thumbnail && thumbnail.trim() !== '') ||
        (existingData.thumbnail && 
         existingData.thumbnail.includes('placeholder') && 
         thumbnail && 
         !thumbnail.includes('placeholder')) ||
        (!isFirebaseStorage && isCDNUrl && thumbnail && thumbnail.includes('storage.googleapis.com'));

      if (shouldUpdateThumbnail && thumbnail) {
        console.log(`    🔄 Updating thumbnail (old: ${existingData.thumbnail ? existingData.thumbnail.substring(0, 50) : 'EMPTY'}, new: ${thumbnail.substring(0, 50)}...)`);
        videoData.thumbnail = thumbnail;
      } else if (isFirebaseStorage) {
        console.log(`    ✅ Thumbnail already in Firebase Storage, keeping it unchanged`);
      } else if (existingThumbnailEmpty && (!thumbnail || thumbnail.trim() === '')) {
        console.warn(`    ⚠️ Video has no thumbnail - both existing and new are empty`);
      }

      // Update existing video metrics
      batch.update(videoRef, videoData);
      
      // Create a snapshot for the updated metrics
      const snapshotRef = videoRef.collection('snapshots').doc();
      const now = Timestamp.now();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: platformVideoId,
        views: videoData.views,
        likes: videoData.likes,
        comments: videoData.comments,
        shares: videoData.shares,
        saves: videoData.saves || 0, // ✅ ADD BOOKMARKS
        capturedAt: now,
        timestamp: now, // Backwards compatibility
        capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh',
        isInitialSnapshot: false // This is a refresh snapshot, not initial
      });

      updatedCount++;
      batchCount++;
    }

    // Commit batch if we reach the limit
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batchCount = 0;
    }
  }

  // Commit remaining operations
  if (batchCount > 0) {
    await batch.commit();
  }

  // Update usage counter if we added new videos
  if (addedCount > 0) {
    try {
      await db
        .collection('organizations')
        .doc(orgId)
        .collection('billing')
        .doc('usage')
        .update({
          trackedVideos: currentVideos + addedCount,
          lastUpdated: Timestamp.now()
        });
      console.log(`✅ Updated video usage counter: +${addedCount} videos`);
    } catch (error) {
      console.error('⚠️ Failed to update usage counter (non-critical):', error);
    }
  }

  console.log(`      📊 Updated: ${updatedCount} videos, Added: ${addedCount} new videos, Skipped: ${skippedCount} invalid videos`);
  
  return { updated: updatedCount, skipped: skippedCount, added: addedCount };
}

