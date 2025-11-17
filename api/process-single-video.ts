import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runApifyActor } from './apify-client.js';
import { ErrorNotificationService } from './services/ErrorNotificationService.js';
import { CleanupService } from './services/CleanupService.js';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight, validateRequiredFields } from './middleware/auth.js';
// @ts-ignore - heic-convert has no types
import convert from 'heic-convert';

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

interface VideoData {
  id: string;
  url?: string; // ✅ ADD URL for proper post links
  thumbnail_url: string;
  caption: string;
  username: string;
  like_count: number;
  comment_count: number;
  view_count?: number;
  timestamp: string;
  share_count?: number;
  save_count?: number; // ✅ ADD BOOKMARKS/SAVES
  profile_pic_url?: string;
  cover_pic_url?: string; // ✅ ADD COVER/BANNER IMAGE (Twitter profile banners, etc)
  display_name?: string;
  follower_count?: number;
}

/**
 * Process a single video immediately (like sync-single-account)
 * Triggered right after video is queued for instant feedback
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (handleCorsPreFlight(req, res)) {
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId, orgId, projectId, jobId } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ['videoId', 'orgId', 'projectId']);
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Missing required fields', 
      missing: validation.missing 
    });
  }
  
  // If jobId provided, update job status to running
  if (jobId) {
    try {
      await db.collection('syncQueue').doc(jobId).update({
        status: 'running',
        startedAt: Timestamp.now()
      });
      console.log(`   📝 Job ${jobId} marked as running`);
    } catch (jobError: any) {
      console.warn(`   ⚠️  Failed to update job status (non-critical):`, jobError.message);
    }
  }

  // 🔒 Authenticate user and verify organization access
  try {
    const { user } = await authenticateAndVerifyOrg(req, orgId);
    console.log(`🔒 Authenticated user ${user.userId} for video processing`);
  } catch (authError: any) {
    console.error('❌ Authentication failed:', authError.message);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: authError.message 
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

    // Update status to syncing
    await videoRef.update({
      syncStatus: 'syncing',
      lastSyncedAt: Timestamp.now()
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

    // Validate we have required data
    if (!videoData.username) {
      throw new Error('Video data missing username');
    }

    // Log Instagram profile data (already extracted from hpix~ig-reels-scraper)
    if (video.platform === 'instagram') {
      console.log(`✅ [INSTAGRAM] Profile data extracted from scraper: @${videoData.username}`);
      console.log(`📊 [INSTAGRAM] Followers: ${videoData.follower_count || 0}, Profile pic: ${videoData.profile_pic_url ? 'YES' : 'NO'}`);
    }

    // Check if account exists or needs to be created
    const accountsRef = db.collection(`organizations/${orgId}/projects/${projectId}/trackedAccounts`);
    const accountQuery = accountsRef
      .where('username', '==', videoData.username.toLowerCase())
      .where('platform', '==', video.platform)
      .limit(1);
    
    const accountSnapshot = await accountQuery.get();
    let accountId = video.trackedAccountId;

    console.log(`🔍 [${video.platform.toUpperCase()}] Account search for @${videoData.username.toLowerCase()}: ${accountSnapshot.empty ? 'NOT FOUND - Will create' : 'FOUND - Will use existing'}`);

    // Create account if it doesn't exist
    if (accountSnapshot.empty && !accountId) {
      console.log(`✨ [${video.platform.toUpperCase()}] Creating new account for @${videoData.username}`);
      
      // For Instagram, ALWAYS use apify/instagram-profile-scraper for complete profile data
      // DO NOT use videoData.profile_pic_url - it's from the wrong API!
      let uploadedProfilePic = '';
      let uploadedCoverPic = '';
      let followerCount = videoData.follower_count || 0;
      let displayName = videoData.display_name || videoData.username;
      let isVerified = false;
      
      if (video.platform === 'youtube') {
        // For YouTube, upload the channel thumbnail to Firebase Storage
        console.log(`👤 [YOUTUBE] Uploading channel thumbnail for @${videoData.username}...`);
        if (videoData.profile_pic_url) {
          try {
            uploadedProfilePic = await downloadAndUploadImage(
              videoData.profile_pic_url,
              orgId,
              `youtube_profile_${videoData.username}.jpg`,
              'profile'
            );
            console.log(`✅ [YOUTUBE] Channel thumbnail uploaded to Firebase Storage: ${uploadedProfilePic}`);
          } catch (uploadError) {
            console.error(`❌ [YOUTUBE] Channel thumbnail upload failed:`, uploadError);
            console.warn(`⚠️ [YOUTUBE] Using original URL as fallback`);
            uploadedProfilePic = videoData.profile_pic_url; // Fallback to original URL
          }
        }
        followerCount = videoData.follower_count || 0;
        displayName = videoData.display_name || videoData.username;
      } else if (video.platform === 'tiktok') {
        // For TikTok, upload profile pic from video data (channel.avatar)
        console.log(`👤 [TIKTOK] Uploading profile pic for @${videoData.username}...`);
        if (videoData.profile_pic_url) {
          try {
            uploadedProfilePic = await downloadAndUploadImage(
              videoData.profile_pic_url,
              orgId,
              `tiktok_profile_${videoData.username}.jpg`,
              'profile'
            );
            console.log(`✅ [TIKTOK] Profile pic uploaded to Firebase Storage: ${uploadedProfilePic}`);
          } catch (uploadError) {
            console.error(`❌ [TIKTOK] Profile pic upload failed:`, uploadError);
            console.warn(`⚠️ [TIKTOK] No fallback - will retry on next sync`);
          }
        }
        followerCount = videoData.follower_count || 0;
        displayName = videoData.display_name || videoData.username;
      } else if (video.platform === 'twitter') {
        // For Twitter, upload profile pic and cover pic from video data
        console.log(`👤 [TWITTER] Uploading profile pic and cover pic for @${videoData.username}...`);
        
        // Upload profile picture
        if (videoData.profile_pic_url) {
          try {
            uploadedProfilePic = await downloadAndUploadImage(
              videoData.profile_pic_url,
              orgId,
              `twitter_profile_${videoData.username}.jpg`,
              'profile'
            );
            console.log(`✅ [TWITTER] Profile pic uploaded to Firebase Storage: ${uploadedProfilePic}`);
          } catch (uploadError) {
            console.error(`❌ [TWITTER] Profile pic upload failed:`, uploadError);
            console.warn(`⚠️ [TWITTER] Using original URL as fallback`);
            uploadedProfilePic = videoData.profile_pic_url; // Fallback to original URL
          }
        }
        
        // Upload cover picture (banner)
        if (videoData.cover_pic_url) {
          try {
            uploadedCoverPic = await downloadAndUploadImage(
              videoData.cover_pic_url,
              orgId,
              `twitter_cover_${videoData.username}.jpg`,
              'profile'
            );
            console.log(`✅ [TWITTER] Cover pic uploaded to Firebase Storage: ${uploadedCoverPic}`);
          } catch (uploadError) {
            console.error(`❌ [TWITTER] Cover pic upload failed:`, uploadError);
            console.warn(`⚠️ [TWITTER] Using original cover URL as fallback`);
            uploadedCoverPic = videoData.cover_pic_url; // Fallback to original URL
          }
        }
        
        followerCount = videoData.follower_count || 0;
        displayName = videoData.display_name || videoData.username;
      } else if (video.platform === 'instagram') {
        console.log(`👤 [INSTAGRAM] Fetching complete profile data via apify/instagram-profile-scraper (ONLY SOURCE)...`);
        try {
          const profileResponse = await fetch(
            `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                usernames: [videoData.username.replace('@', '')],
                proxyConfiguration: {
                  useApifyProxy: true,
                  apifyProxyGroups: ['RESIDENTIAL'],
                  apifyProxyCountry: 'US'
                },
                includeAboutSection: false
              })
            }
          );
          
          if (profileResponse.ok) {
            const profiles = await profileResponse.json();
            if (profiles && profiles.length > 0) {
              const profile = profiles[0];
              console.log(`✅ [INSTAGRAM] Fetched profile from profile scraper: ${profile.followersCount || 0} followers`);
              console.log(`🔍 [INSTAGRAM] Profile pic URL from profile scraper: ${profile.profilePicUrl ? 'YES' : 'NO'}`);
              
              followerCount = profile.followersCount || 0;
              displayName = profile.fullName || videoData.username;
              isVerified = profile.verified || false;
              
              // Download and upload profile pic from profile scraper ONLY
              if (profile.profilePicUrl) {
                try {
                  console.log(`📸 [INSTAGRAM] Downloading profile pic from PROFILE SCRAPER for @${videoData.username}...`);
                  console.log(`🌐 [INSTAGRAM] Profile pic URL: ${profile.profilePicUrl.substring(0, 100)}...`);
                  uploadedProfilePic = await downloadAndUploadImage(
                    profile.profilePicUrl,
                    orgId,
                    `instagram_profile_${videoData.username}.jpg`,
                    'profile'
                  );
                  console.log(`✅ [INSTAGRAM] Profile picture uploaded to Firebase Storage: ${uploadedProfilePic}`);
                } catch (uploadError) {
                  console.error(`❌ [INSTAGRAM] Profile pic upload failed:`, uploadError);
                  // DO NOT fallback to videoData.profile_pic_url - it's from the wrong API!
                  console.warn(`⚠️ [INSTAGRAM] No fallback - will retry on next sync`);
                }
              } else {
                console.warn(`⚠️ [INSTAGRAM] Profile scraper returned no profile pic URL`);
              }
            } else {
              console.warn(`⚠️ [INSTAGRAM] No profile data returned from profile scraper`);
            }
          } else {
            console.warn(`⚠️ [INSTAGRAM] Profile scraper request failed: ${profileResponse.status}`);
          }
        } catch (profileError) {
          console.error(`❌ [INSTAGRAM] Failed to fetch profile:`, profileError);
        }
      }
      
      const newAccountRef = accountsRef.doc();
      await newAccountRef.set({
        id: newAccountRef.id,
        username: videoData.username.toLowerCase(), // Lowercase for consistency with queries
        platform: video.platform,
        displayName: displayName,
        profilePicture: uploadedProfilePic,
        coverPicture: uploadedCoverPic, // ✅ ADD COVER/BANNER IMAGE
        followerCount: followerCount,
        isVerified: isVerified,
        isActive: true,
        isRead: false,
        accountType: 'my',
        creatorType: 'manual', // Manual tracking - only refreshes existing videos (created from video URL)
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
      console.log(`✅ [${video.platform.toUpperCase()}] Created account: ${accountId}`);
    } else if (!accountSnapshot.empty) {
      accountId = accountSnapshot.docs[0].id;
      const existingAccountRef = accountSnapshot.docs[0].ref;
      
      // Update existing account with latest profile data from video scrape
      const updateData: any = {
        lastSynced: Timestamp.now()
      };
      
      // Update follower count if available (Instagram single video scrape provides this)
      if (videoData.follower_count && videoData.follower_count > 0) {
        updateData.followerCount = videoData.follower_count;
        console.log(`📊 [${video.platform.toUpperCase()}] Updating follower count: ${videoData.follower_count}`);
    }

      // Update profile pic if available - for Instagram and Twitter, upload to Firebase Storage
      if (videoData.profile_pic_url) {
        if (video.platform === 'instagram') {
          try {
            console.log(`📸 [INSTAGRAM] Downloading updated profile pic to Firebase Storage for @${videoData.username}...`);
            const uploadedProfilePic = await downloadAndUploadThumbnail(
              videoData.profile_pic_url,
              orgId,
              `instagram_profile_${videoData.username}.jpg`
            );
            updateData.profilePicture = uploadedProfilePic;
            console.log(`✅ [INSTAGRAM] Updated profile picture uploaded to Firebase Storage`);
          } catch (uploadError) {
            console.warn(`⚠️ [INSTAGRAM] Profile pic upload failed, using direct URL:`, uploadError);
            updateData.profilePicture = videoData.profile_pic_url; // Fallback to direct URL
          }
        } else if (video.platform === 'twitter') {
          try {
            console.log(`📸 [TWITTER] Downloading updated profile pic to Firebase Storage for @${videoData.username}...`);
            const uploadedProfilePic = await downloadAndUploadThumbnail(
              videoData.profile_pic_url,
              orgId,
              `twitter_profile_${videoData.username}.jpg`
            );
            updateData.profilePicture = uploadedProfilePic;
            console.log(`✅ [TWITTER] Updated profile picture uploaded to Firebase Storage`);
          } catch (uploadError) {
            console.warn(`⚠️ [TWITTER] Profile pic upload failed, using direct URL:`, uploadError);
            updateData.profilePicture = videoData.profile_pic_url; // Fallback to direct URL
          }
        } else {
          updateData.profilePicture = videoData.profile_pic_url;
          console.log(`📸 [${video.platform.toUpperCase()}] Updating profile picture`);
        }
      }
      
      // Update cover pic if available (Twitter only)
      if (videoData.cover_pic_url && video.platform === 'twitter') {
        try {
          console.log(`🖼️ [TWITTER] Downloading updated cover pic to Firebase Storage for @${videoData.username}...`);
          const uploadedCoverPic = await downloadAndUploadThumbnail(
            videoData.cover_pic_url,
            orgId,
            `twitter_cover_${videoData.username}.jpg`
          );
          updateData.coverPicture = uploadedCoverPic;
          console.log(`✅ [TWITTER] Updated cover picture uploaded to Firebase Storage`);
        } catch (uploadError) {
          console.warn(`⚠️ [TWITTER] Cover pic upload failed, using direct URL:`, uploadError);
          updateData.coverPicture = videoData.cover_pic_url; // Fallback to direct URL
        }
      }
      
      // Update display name if available
      if (videoData.display_name) {
        updateData.displayName = videoData.display_name;
      }
      
      await existingAccountRef.update(updateData);
      console.log(`✅ [${video.platform.toUpperCase()}] Using existing account: ${accountId} (updated profile data)`);
    }

    // Download and upload thumbnail to Firebase Storage for permanent URL
    // DO NOT use direct URLs as fallback (they expire quickly)
    let finalThumbnail = '';
    if (videoData.thumbnail_url) {
      try {
        console.log(`📸 [${video.platform.toUpperCase()}] Downloading thumbnail to Firebase Storage...`);
        console.log(`🌐 [${video.platform.toUpperCase()}] Thumbnail URL: ${videoData.thumbnail_url.substring(0, 100)}...`);
        finalThumbnail = await downloadAndUploadThumbnail(
          videoData.thumbnail_url,
          orgId,
          `${video.platform}_${videoData.id}_thumb.jpg`
        );
        console.log(`✅ [${video.platform.toUpperCase()}] Thumbnail uploaded to Firebase Storage: ${finalThumbnail}`);
      } catch (thumbError) {
        console.error(`❌ [${video.platform.toUpperCase()}] Thumbnail upload failed:`, thumbError);
        // DO NOT use direct URLs as fallback (they expire)
        // Leave empty - will retry on next sync
        console.warn(`⚠️ [${video.platform.toUpperCase()}] No fallback - thumbnail will retry on next sync`);
      }
    } else {
      console.warn(`⚠️ [${video.platform.toUpperCase()}] No thumbnail URL provided`);
    }

    // Update video with fetched data
    const updateData: any = {
      videoId: videoData.id,
      title: videoData.caption?.split('\n')[0] || 'Untitled Video',
      caption: videoData.caption || '',
      description: videoData.caption || '',
      thumbnail: finalThumbnail,
      uploader: videoData.display_name || videoData.username || 'Unknown',
      uploaderHandle: videoData.username || '',
      uploaderProfilePicture: videoData.profile_pic_url || '', // May be empty for alpha-scraper
      uploaderCoverPicture: videoData.cover_pic_url || '', // ✅ ADD COVER/BANNER IMAGE
      uploadDate: Timestamp.fromDate(uploadDate),
      views: videoData.view_count || 0,
      likes: videoData.like_count || 0,
      comments: videoData.comment_count || 0,
      shares: videoData.share_count || 0,
      saves: videoData.save_count || 0, // ✅ ADD BOOKMARKS
      trackedAccountId: accountId,
      status: 'active', // ✅ Change from 'processing' to 'active' to hide loading indicator
      syncStatus: 'completed',
      syncError: null,
      lastSyncedAt: Timestamp.now(),
      lastRefreshed: Timestamp.now(),
      isRead: false // Mark as unread for notification badge
    };
    
    // 🔥 Update URL if we have a proper TikTok post URL (not CDN)
    if (videoData.url && video.platform === 'tiktok') {
      updateData.url = videoData.url;
      console.log(`✅ [TIKTOK] Updated video URL to proper post link: ${videoData.url}`);
    }
    
    await videoRef.update(updateData);

    // Create initial snapshot for this video
    const snapshotRef = videoRef.collection('snapshots').doc();
    const snapshotTime = Timestamp.now();
    await snapshotRef.set({
      id: snapshotRef.id,
      videoId: videoData.id,
      views: videoData.view_count || 0,
      likes: videoData.like_count || 0,
      comments: videoData.comment_count || 0,
      shares: videoData.share_count || 0,
      saves: videoData.save_count || 0, // ✅ ADD BOOKMARKS
      capturedAt: snapshotTime,
      timestamp: snapshotTime,
      capturedBy: 'initial_manual_add',
      isInitialSnapshot: true // Mark as initial snapshot - won't count towards graphs
    });

    console.log(`📸 Created initial snapshot for manually added video`);

    // Update account stats if linked
    if (accountId) {
      const accountRef = accountsRef.doc(accountId);
      
      await accountRef.update({
        totalVideos: FieldValue.increment(1),
        totalViews: FieldValue.increment(videoData.view_count || 0),
        totalLikes: FieldValue.increment(videoData.like_count || 0),
        totalComments: FieldValue.increment(videoData.comment_count || 0),
        totalShares: FieldValue.increment(videoData.share_count || 0)
      });
    }

    console.log(`✅ Successfully processed video: ${video.url}`);

    // Send email notification to user
    try {
      const userId = video.addedBy;
      if (userId) {
        // Get user document to find email
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        if (userData?.email) {
          const RESEND_API_KEY = process.env.RESEND_API_KEY;
          
          if (!RESEND_API_KEY) {
            console.warn('⚠️ RESEND_API_KEY not configured - skipping email notification');
          } else {
            console.log(`📧 Sending video processed notification to ${userData.email}...`);
            
            const videoTitle = videoData.caption?.substring(0, 100) || 'Video';
            
            const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
            body: JSON.stringify({
                from: 'ViewTrack <team@viewtrack.app>',
                to: [userData.email],
                subject: `🎬 Video processed successfully`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="padding: 30px 20px;">
                    <h2 style="color: #f5576c; margin-top: 0;">Video Processed!</h2>
                    <p>Your video has been successfully processed and added to your dashboard!</p>
                    ${videoData.thumbnail_url ? `
                    <div style="text-align: center; margin: 20px 0;">
                      <img src="${videoData.thumbnail_url}" alt="Video thumbnail" style="max-width: 100%; height: auto; border-radius: 8px;">
                    </div>
                    ` : ''}
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p><strong>Title:</strong> ${videoTitle}</p>
                      <p><strong>Platform:</strong> ${video.platform}</p>
                      <p><strong>Account:</strong> @${videoData.username}</p>
                      <p><strong>Views:</strong> ${(videoData.view_count || 0).toLocaleString()}</p>
                      <p><strong>Likes:</strong> ${(videoData.like_count || 0).toLocaleString()}</p>
                    </div>
                    <p>The video is now available in your dashboard with full analytics tracking.</p>
                    <a href="https://www.viewtrack.app" style="display: inline-block; padding: 12px 24px; background: #f5576c; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Dashboard</a>
                    </div>
                  </div>
                `,
              }),
            });

            if (emailResponse.ok) {
              const emailData = await emailResponse.json();
              console.log(`✅ Video processed email sent to ${userData.email} (ID: ${emailData.id})`);
            } else {
              const errorData = await emailResponse.json();
              console.error('❌ Failed to send email:', errorData);
            }
          }
        }
      }
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }

    // 🧹 Auto-cleanup: Delete any invalid videos/accounts (no username, no stats, etc.)
    try {
      console.log(`🧹 Running auto-cleanup for invalid videos/accounts...`);
      const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
      console.log(`✅ Cleanup complete: ${cleanupStats.videosDeleted} videos, ${cleanupStats.accountsDeleted} accounts deleted`);
    } catch (cleanupError) {
      console.error('❌ Cleanup failed (non-fatal):', cleanupError);
      // Don't fail the request if cleanup fails
    }

    // Mark job as completed if jobId provided
    if (jobId) {
      try {
        await db.collection('syncQueue').doc(jobId).update({
          status: 'completed',
          completedAt: Timestamp.now(),
          result: 'success'
        });
        console.log(`   ✅ Job ${jobId} marked as completed`);
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to update job status (non-critical):`, jobError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Video processed successfully',
      videoId,
      accountId
    });

  } catch (error) {
    console.error(`❌ Failed to process video ${videoId}:`, error);
    
    // Update video with error and send notifications
    try {
      const videoRef = db.doc(`organizations/${orgId}/projects/${projectId}/videos/${videoId}`);
      const videoDoc = await videoRef.get();
      const video = videoDoc.data();

      await videoRef.update({
        status: 'active', // ✅ Change from 'processing' to 'active' to hide loading indicator
        syncStatus: 'error',
        hasError: true,
        syncError: error instanceof Error ? error.message : String(error),
        lastSyncErrorAt: Timestamp.now(),
        lastRefreshed: Timestamp.now()
      });

      // Send error notification email and log to Firestore
      await ErrorNotificationService.notifyError({
        type: 'video_processing',
        platform: video?.platform || 'unknown',
        videoId: videoId,
        videoUrl: video?.url || 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        orgId: orgId,
        projectId: projectId,
        timestamp: new Date()
      });
    } catch (updateError) {
      console.error('Failed to update video with error:', updateError);
    }

    // Mark job as failed if jobId provided
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
              error: error instanceof Error ? error.message : String(error)
            });
            console.log(`   ❌ Job ${jobId} marked as failed (max retries exceeded)`);
          } else {
            // Reset to pending for retry
            await db.collection('syncQueue').doc(jobId).update({
              status: 'pending',
              attempts: attempts + 1,
              error: error instanceof Error ? error.message : String(error),
              startedAt: null
            });
            console.log(`   🔄 Job ${jobId} reset to pending for retry (attempt ${attempts + 1}/${maxAttempts})`);
          }
        }
      } catch (jobError: any) {
        console.warn(`   ⚠️  Failed to update job status (non-critical):`, jobError.message);
      }
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Video processing failed - admin notified'
    });
  }
}

/**
 * Transform raw Apify data to standardized VideoData format
 */
function transformVideoData(rawData: any, platform: string): VideoData {
  if (platform === 'tiktok') {
    // TikTok uses apidojo/tiktok-scraper format (channel + video objects or flat keys)
    const channel = rawData.channel || {};
    const video = rawData.video || {};
    
    // Log channel data for debugging
    console.log('🎵 [TIKTOK Transform] Channel keys:', Object.keys(channel).join(', '));
    console.log('🎵 [TIKTOK Transform] Followers data:', {
      'channel.followers': channel.followers,
      'channel.followerCount': channel.followerCount,
      'channel.fans': channel.fans,
      'rawData.followers': rawData.followers,
      'rawData.followerCount': rawData.followerCount
    });
    
    // ROBUST THUMBNAIL EXTRACTION (strongest → weakest fallback)
    // Now we can handle HEIC thumbnails with heic-convert!
    let thumbnailUrl = '';
    if (video.cover) {
      thumbnailUrl = video.cover;
    } else if (video.thumbnail) {
      thumbnailUrl = video.thumbnail;
    } else if (rawData['video.cover']) {
      thumbnailUrl = rawData['video.cover'];
    } else if (rawData['video.thumbnail']) {
      thumbnailUrl = rawData['video.thumbnail'];
    } else if (rawData.cover) {
      thumbnailUrl = rawData.cover;
    } else if (rawData.thumbnail) {
      thumbnailUrl = rawData.thumbnail;
    } else if (rawData.images && Array.isArray(rawData.images) && rawData.images.length > 0) {
      thumbnailUrl = rawData.images[0].url || '';
    }
    
    if (thumbnailUrl) {
      const isHEIC = thumbnailUrl.toLowerCase().includes('.heic') || thumbnailUrl.toLowerCase().includes('.heif');
      console.log(`📸 [TIKTOK] Thumbnail URL: ${thumbnailUrl.substring(0, 100)}... ${isHEIC ? '(HEIC - will convert)' : '(JPG/PNG)'}`);
    }
    
    // 🔥 VIDEO URL: Always use postPage, fallback to reconstruction from video ID
    const videoId = rawData.id || rawData.post_id || '';
    let videoUrl = rawData.postPage || rawData.tiktok_url || video.url || rawData.videoUrl || '';
    
    // If no valid TikTok post URL (e.g., only have CDN URL) and we have a video ID, reconstruct it
    if ((!videoUrl || !videoUrl.includes('tiktok.com/@')) && videoId) {
      const username = channel.username || rawData['channel.username'] || 'user';
      videoUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
      console.log(`🔧 [TIKTOK] Reconstructed URL from ID: ${videoUrl}`);
    }
    
    // 🔥 FOLLOWER COUNT: Try multiple possible field names (handle null explicitly)
    const followerCount = (typeof channel.followers === 'number' ? channel.followers : null) ||
                         (typeof channel.followerCount === 'number' ? channel.followerCount : null) ||
                         (typeof channel.fans === 'number' ? channel.fans : null) ||
                         (typeof rawData.followers === 'number' ? rawData.followers : null) ||
                         (typeof rawData.followerCount === 'number' ? rawData.followerCount : null) ||
                         (typeof rawData['channel.followers'] === 'number' ? rawData['channel.followers'] : null) ||
                         0;
    
    console.log(`📊 [TIKTOK Transform] Final follower count: ${followerCount}`);
    if (followerCount === 0) {
      console.warn(`⚠️ [TIKTOK] No follower data available from TikTok API - this is normal for some accounts`);
    }
    
    return {
      id: videoId,
      url: videoUrl,
      thumbnail_url: thumbnailUrl,
      caption: rawData.title || rawData.subtitle || rawData.caption || '',
      username: channel.username || rawData['channel.username'] || '',
      like_count: rawData.likes || 0,
      comment_count: rawData.comments || 0,
      view_count: rawData.views || 0,
      share_count: rawData.shares || 0,
      save_count: rawData.bookmarks || 0, // ✅ ADD BOOKMARKS
      timestamp: rawData.uploadedAt || rawData.uploaded_at || Math.floor(Date.now() / 1000),
      profile_pic_url: channel.avatar || channel.avatar_url || rawData['channel.avatar'] || '',
      display_name: channel.name || rawData['channel.name'] || channel.username || '',
      follower_count: followerCount
    };
  } else if (platform === 'instagram') {
    // Instagram - Handle hpix~ig-reels-scraper format
    console.log('📸 [INSTAGRAM Transform] Raw data keys:', Object.keys(rawData).join(', '));
    console.log('📸 [INSTAGRAM Transform] Raw data:', JSON.stringify(rawData, null, 2));
    
    // hpix~ig-reels-scraper format - owner data is inside raw_data
    const owner = rawData.raw_data?.owner || {};
    const caption = rawData.caption || '';
    const username = owner.username || '';
    const displayName = owner.full_name || username;
    
    // ROBUST THUMBNAIL EXTRACTION (strongest → weakest fallback)
    let thumbnailUrl = '';
    if (rawData.thumbnail_url) {
      thumbnailUrl = rawData.thumbnail_url;
    } else if (rawData.raw_data?.thumbnail_src) {
      thumbnailUrl = rawData.raw_data.thumbnail_src;
    } else if (rawData.raw_data?.display_url) {
      thumbnailUrl = rawData.raw_data.display_url;
    } else if (rawData.raw_data?.display_resources && Array.isArray(rawData.raw_data.display_resources)) {
      // Pick the largest image (highest config_width) or last item
      const resources = rawData.raw_data.display_resources;
      const largest = resources.reduce((best: any, current: any) => {
        if (!best) return current;
        return (current.config_width || 0) > (best.config_width || 0) ? current : best;
      }, null);
      thumbnailUrl = largest?.src || resources[resources.length - 1]?.src || '';
    } else {
      // Last resort: scan caption for HTTPS image URL
      const urlMatch = caption.match(/https:\/\/[^\s]+\.(jpg|jpeg|png|webp)/i);
      thumbnailUrl = urlMatch ? urlMatch[0] : '';
    }
    console.log(`📸 [INSTAGRAM] Thumbnail extracted: ${thumbnailUrl ? 'YES' : 'NO'} (${thumbnailUrl.substring(0, 50)}...)`);
    
    // ROBUST PROFILE PIC EXTRACTION (strongest → weakest fallback)
    let profilePicUrl = '';
    if (owner.profile_pic_url_hd) {
      profilePicUrl = owner.profile_pic_url_hd;
    } else if (owner.profile_pic_url) {
      profilePicUrl = owner.profile_pic_url;
    } else {
      // Last resort: scan caption for profile image URL
      const profileUrlMatch = caption.match(/https:\/\/[^\s]+profile[^\s]+\.(jpg|jpeg|png)/i);
      profilePicUrl = profileUrlMatch ? profileUrlMatch[0] : '';
    }
    console.log(`👤 [INSTAGRAM] Profile pic extracted: ${profilePicUrl ? 'YES' : 'NO'} (${profilePicUrl.substring(0, 50)}...)`);
    
    // ROBUST VIEW COUNT EXTRACTION (prefer play_count → view_count → video_view_count → video_play_count)
    const viewCount = rawData.play_count || rawData.view_count || rawData.video_view_count || rawData.video_play_count || 0;
    console.log(`📊 [INSTAGRAM] View count: ${viewCount}`);
    
    // EXTRACT FOLLOWER COUNT from owner.edge_followed_by.count
    const followerCount = owner.edge_followed_by?.count || 0;
    console.log(`👥 [INSTAGRAM] Followers extracted: ${followerCount} (from owner.edge_followed_by.count)`);
    console.log(`✨ [INSTAGRAM] Complete profile data: @${username} (${displayName}) - ${followerCount} followers`);
    
    return {
      id: rawData.id || rawData.code || '',
      thumbnail_url: thumbnailUrl,
      caption: caption,
      username: username,
      like_count: rawData.like_count || 0,
      comment_count: rawData.comment_count || 0,
      view_count: viewCount,
      share_count: 0, // Not provided by hpix scraper
      timestamp: rawData.taken_at ? new Date(rawData.taken_at * 1000).toISOString() : new Date().toISOString(),
      profile_pic_url: profilePicUrl,
      display_name: displayName,
      follower_count: followerCount
    };
  } else if (platform === 'youtube') {
    // YouTube structure - handle both YouTube API v3 and Apify scraper formats
    console.log('[YouTube Transform] Raw data keys:', Object.keys(rawData));
    console.log('[YouTube Transform] Statistics:', rawData.statistics);
    console.log('[YouTube Transform] Snippet:', rawData.snippet);
    
    // YouTube API v3 format (from /api/youtube-video)
    if (rawData.snippet || rawData.statistics) {
      const thumbnails = rawData.snippet?.thumbnails;
      const thumbnail = thumbnails?.maxres?.url || 
                       thumbnails?.standard?.url || 
                       thumbnails?.high?.url || 
                       thumbnails?.medium?.url || 
                       thumbnails?.default?.url || '';
      
      return {
        id: rawData.id || '',
        thumbnail_url: thumbnail,
        caption: rawData.snippet?.title || rawData.snippet?.description || '',
        username: rawData.snippet?.channelTitle || '',
        like_count: parseInt(rawData.statistics?.likeCount || '0', 10),
        comment_count: parseInt(rawData.statistics?.commentCount || '0', 10),
        view_count: parseInt(rawData.statistics?.viewCount || '0', 10),
        share_count: 0, // YouTube doesn't provide shares
        save_count: parseInt(rawData.statistics?.favoriteCount || '0', 10), // ✅ YouTube favoriteCount = saves/bookmarks
        timestamp: rawData.snippet?.publishedAt || new Date().toISOString(),
        profile_pic_url: rawData.channelThumbnail || '',
        display_name: rawData.snippet?.channelTitle || '',
        follower_count: rawData.subscribers || 0
      };
    }
    
    // Apify scraper format (fallback)
    return {
      id: rawData.id || '',
      thumbnail_url: rawData.thumbnail || rawData.thumbnails?.default?.url || '',
      caption: rawData.description || rawData.title || '',
      username: rawData.channelName || rawData.author || '',
      like_count: rawData.likes || 0,
      comment_count: rawData.comments || 0,
      view_count: rawData.views || 0,
      share_count: 0, // YouTube doesn't provide shares
      save_count: rawData.favoriteCount || rawData.favorites || 0, // ✅ YouTube favoriteCount = saves/bookmarks
      timestamp: rawData.uploadDate || rawData.publishedAt || new Date().toISOString(),
      profile_pic_url: rawData.channelThumbnail || '',
      display_name: rawData.channelName || '',
      follower_count: rawData.subscribers || 0
    };
  } else if (platform === 'twitter') {
    // Twitter/X structure - apidojo~tweet-scraper format
    console.log('🐦 [TWITTER/X Transform] Raw data keys:', Object.keys(rawData).join(', '));
    console.log('🐦 [TWITTER/X Transform] Raw data:', JSON.stringify(rawData, null, 2));
    
    // Extract username from URL if author info not available
    let username = rawData.author?.userName || '';
    if (!username && rawData.url) {
      const urlMatch = rawData.url.match(/(?:x\.com|twitter\.com)\/([^\/]+)\//);
      if (urlMatch) {
        username = urlMatch[1];
      }
    }
    
    return {
      id: rawData.id || '',
      thumbnail_url: rawData.media?.[0]?.url || rawData.extendedEntities?.media?.[0]?.media_url_https || '',
      caption: rawData.text || rawData.fullText || '',
      username: username,
      like_count: rawData.likeCount || 0,
      comment_count: rawData.replyCount || 0,
      view_count: rawData.viewCount || rawData.views || 0,
      share_count: rawData.retweetCount || 0,
      timestamp: rawData.createdAt || new Date().toISOString(),
      profile_pic_url: rawData.author?.profilePicture || '',
      cover_pic_url: rawData.author?.coverPicture || '', // ✅ EXTRACT COVER/BANNER IMAGE
      display_name: rawData.author?.name || username,
      follower_count: rawData.author?.followers || 0
    };
  }
  
  // Fallback for unknown platforms
  return rawData as VideoData;
}

/**
 * Download thumbnail and upload to Firebase Storage for permanent URL
 */
async function downloadAndUploadThumbnail(
  thumbnailUrl: string,
  orgId: string,
  filename: string
): Promise<string> {
  try {
    const isInstagram = thumbnailUrl.includes('cdninstagram') || thumbnailUrl.includes('fbcdn');
    const isTikTok = thumbnailUrl.includes('tiktokcdn');
    
    // Download image with proper headers
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/heic,image/heif,image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
    if (isTikTok) {
      fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
    }
    
    const response = await fetch(thumbnailUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      throw new Error(`Data too small (${buffer.length} bytes)`);
    }
    
    let contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // 🔥 HEIC Detection and Conversion using heic-convert (pure JS, works in serverless)
    // Check if content-type indicates HEIC or file signature matches HEIC
    const isHEIC = contentType.includes('heic') || 
                   contentType.includes('heif') || 
                   thumbnailUrl.toLowerCase().includes('.heic') ||
                   // Check HEIC file signature (ftyp heic)
                   (buffer.length > 12 && 
                    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 && 
                    buffer[8] === 0x68 && buffer[9] === 0x65 && buffer[10] === 0x69 && buffer[11] === 0x63);
    
    if (isHEIC) {
      console.log(`🔄 [HEIC] Converting HEIC thumbnail to JPG: ${thumbnailUrl.substring(0, 100)}...`);
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
        console.warn(`⚠️ [HEIC] Skipping thumbnail - will retry on next sync`);
        throw new Error(`HEIC conversion failed: ${conversionError}`);
      }
    }
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/thumbnails/${filename}`;
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: thumbnailUrl,
          convertedFromHEIC: isHEIC ? 'true' : 'false'
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`✅ Uploaded thumbnail to Firebase Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`Failed to download/upload thumbnail:`, error);
    // DO NOT return original URL as fallback for ANY platform (all CDN URLs expire)
    // Instagram, TikTok, YouTube, Twitter URLs all have expiring signatures
    console.warn(`Thumbnail download failed, returning empty (CDN URLs expire - will retry later)`);
    throw error; // Throw error so caller knows upload failed
  }
}

/**
 * Download profile image and upload to Firebase Storage for permanent URL
 * (Same as sync-single-account.ts - for profile pictures)
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
    
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
    if (isTikTok) {
      fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
    }
    
    const response = await fetch(imageUrl, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      throw new Error(`Downloaded data too small (${buffer.length} bytes)`);
    }
    
    let contentType = response.headers.get('content-type') || 'image/jpeg';
    
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
          originalUrl: imageUrl
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`✅ Uploaded profile image to Firebase Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to download/upload profile image:', error);
    // For Instagram/TikTok, don't return original URL as it expires quickly
    if (imageUrl.includes('cdninstagram') || imageUrl.includes('tiktokcdn') || imageUrl.includes('fbcdn')) {
      console.warn(`⚠️ CDN URL expires quickly - not using as fallback`);
      throw error;
    }
    // For other sources, return original URL as fallback
    return imageUrl;
  }
}

/**
 * Extract video ID from TikTok CDN URL and validate/reconstruct proper post URL
 */
function validateTikTokUrl(url: string): string {
  // If it's already a proper TikTok post URL, return as-is
  if (url.includes('tiktok.com/@') && url.includes('/video/')) {
    return url;
  }
  
  // If it's a CDN URL, try to extract video ID
  // CDN URLs look like: https://v16m.tiktokcdn-us.com/.../6910857f/video/...
  const cdnMatch = url.match(/\/(\d{8,})\//);
  if (cdnMatch && url.includes('tiktokcdn')) {
    const videoId = cdnMatch[1];
    console.warn(`⚠️ [TIKTOK] CDN URL detected, cannot reconstruct without username. Video ID: ${videoId}`);
    console.warn(`⚠️ [TIKTOK] User should submit proper TikTok post URLs: https://www.tiktok.com/@username/video/${videoId}`);
    throw new Error(`Invalid TikTok URL. Please submit the actual TikTok post URL (https://www.tiktok.com/@username/video/${videoId}), not the CDN video link.`);
  }
  
  return url;
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
      // 🔥 Validate/reconstruct TikTok URL before calling Apify
      const validatedUrl = validateTikTokUrl(url);
      console.log(`✅ [TIKTOK] Using validated URL: ${validatedUrl}`);
      
      actorId = 'apidojo/tiktok-scraper';
      input = {
        customMapFunction: "(object) => { return { ...object } } \n",
        dateRange: "DEFAULT",
        includeSearchKeywords: false,
        location: "US",
        maxItems: 1,
        sortType: "RELEVANCE",
        startUrls: [validatedUrl],
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      console.log(`🔧 [TIKTOK] API Input:`, JSON.stringify(input, null, 2));
    } else if (platform === 'instagram') {
      // Use hpix~ig-reels-scraper for individual Instagram posts/reels
      console.log('📸 [INSTAGRAM] Using hpix~ig-reels-scraper for video:', url);
      actorId = 'hpix~ig-reels-scraper';
      
      input = {
        post_urls: [url],
        target: 'reels_only',
        reels_count: 12,
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
      console.log('📸 [INSTAGRAM] Input:', JSON.stringify(input, null, 2));
    } else if (platform === 'youtube') {
      // Use YouTube API directly instead of Apify for better reliability
      console.log('🎥 [YOUTUBE] Using YouTube Data API v3 for video:', url);
      
      // Extract video ID from URL
      let videoId = '';
      try {
        const urlObj = new URL(url);
        console.log('🔍 [YOUTUBE] Parsing URL - hostname:', urlObj.hostname, 'pathname:', urlObj.pathname);
        
        if (urlObj.hostname.includes('youtube.com')) {
          if (urlObj.pathname.includes('/shorts/')) {
            videoId = urlObj.pathname.split('/shorts/')[1]?.split('/')[0] || '';
            console.log('🔍 [YOUTUBE] Extracted from /shorts/ path:', videoId);
          } else {
            videoId = urlObj.searchParams.get('v') || '';
            console.log('🔍 [YOUTUBE] Extracted from ?v= param:', videoId);
          }
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.substring(1).split('/')[0];
          console.log('🔍 [YOUTUBE] Extracted from youtu.be shortlink:', videoId);
        }
      } catch (e) {
        console.error('❌ [YOUTUBE] Failed to parse URL:', e);
        throw new Error('Could not parse YouTube video ID from URL');
      }
      
      if (!videoId) {
        console.error('❌ [YOUTUBE] No video ID extracted from URL:', url);
        throw new Error('Could not extract video ID from YouTube URL');
      }
      
      console.log('✅ [YOUTUBE] Video ID extracted:', videoId);
      
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      if (!youtubeApiKey) {
        console.error('❌ [YOUTUBE] YOUTUBE_API_KEY not configured in environment variables');
        throw new Error('YOUTUBE_API_KEY not configured');
      }
      
      console.log('✅ [YOUTUBE] API key found, calling YouTube API...');
      const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${youtubeApiKey}`;
      const ytResponse = await fetch(ytUrl);
      
      if (!ytResponse.ok) {
        const errorText = await ytResponse.text();
        console.error('❌ [YOUTUBE] API error:', ytResponse.status, errorText);
        throw new Error(`YouTube API error: ${ytResponse.status} - ${errorText}`);
      }
      
      const ytData = await ytResponse.json();
      console.log('📦 [YOUTUBE] API response:', {
        itemsCount: ytData.items?.length || 0,
        pageInfo: ytData.pageInfo
      });
      
      if (!ytData.items || ytData.items.length === 0) {
        console.error('❌ [YOUTUBE] No items in API response. Video might be private, deleted, or ID is wrong.');
        throw new Error('Video not found on YouTube');
      }
      
      const rawVideoData = ytData.items[0];
      console.log('✅ [YOUTUBE] API returned video:', {
        title: rawVideoData.snippet?.title,
        channelTitle: rawVideoData.snippet?.channelTitle,
        channelId: rawVideoData.snippet?.channelId,
        views: rawVideoData.statistics?.viewCount,
        likes: rawVideoData.statistics?.likeCount
      });
      
      // 🔥 Fetch channel data to get channel thumbnail and subscriber count
      const channelId = rawVideoData.snippet?.channelId;
      let channelThumbnail = '';
      let subscriberCount = 0;
      
      if (channelId) {
        try {
          console.log('👤 [YOUTUBE] Fetching channel data for:', channelId);
          const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${youtubeApiKey}`;
          const channelResponse = await fetch(channelUrl);
          
          if (channelResponse.ok) {
            const channelData = await channelResponse.json();
            if (channelData.items && channelData.items.length > 0) {
              const channel = channelData.items[0];
              // Get highest quality channel thumbnail
              const channelThumbnails = channel.snippet?.thumbnails;
              channelThumbnail = channelThumbnails?.high?.url || 
                                channelThumbnails?.medium?.url || 
                                channelThumbnails?.default?.url || '';
              subscriberCount = parseInt(channel.statistics?.subscriberCount || '0', 10);
              
              console.log('✅ [YOUTUBE] Channel data fetched:', {
                thumbnail: channelThumbnail ? 'YES' : 'NO',
                subscribers: subscriberCount
              });
            }
          } else {
            console.warn('⚠️ [YOUTUBE] Failed to fetch channel data:', channelResponse.status);
          }
        } catch (channelError) {
          console.warn('⚠️ [YOUTUBE] Error fetching channel data:', channelError);
        }
      }
      
      // Add channel data to raw video data before transforming
      rawVideoData.channelThumbnail = channelThumbnail;
      rawVideoData.subscribers = subscriberCount;
      
      const transformedData = transformVideoData(rawVideoData, platform);
      console.log('🔄 [YOUTUBE] Transformed data:', {
        id: transformedData.id,
        username: transformedData.username,
        view_count: transformedData.view_count,
        like_count: transformedData.like_count,
        profile_pic_url: transformedData.profile_pic_url ? 'YES' : 'NO',
        follower_count: transformedData.follower_count
      });
      
      return transformedData;
    } else if (platform === 'twitter') {
      // Use startUrls to fetch specific tweets directly
      console.log('🐦 [TWITTER/X] Using apidojo~tweet-scraper with startUrls for tweet:', url);
      actorId = 'apidojo~tweet-scraper';
      
      input = {
        startUrls: [url],
        maxItems: 1,
        sort: 'Latest',
        onlyImage: false,
        onlyVideo: false,
        onlyQuote: false,
        onlyVerifiedUsers: false,
        onlyTwitterBlue: false,
        includeSearchTerms: false
      };
      console.log('🐦 [TWITTER/X] Input:', JSON.stringify(input, null, 2));
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    console.log(`🔄 [${platform.toUpperCase()}] Calling Apify actor: ${actorId}`);
    console.log(`📝 [${platform.toUpperCase()}] Input:`, JSON.stringify(input, null, 2));
    
    // ✅ Use runApifyActor helper (same as sync-single-account.ts)
    // This automatically converts apidojo/tiktok-scraper → apidojo~tiktok-scraper
    const result = await runApifyActor({
      actorId: actorId,
      input: input,
      token: apifyToken
    });

    const items = result.items;
    console.log(`📦 [${platform.toUpperCase()}] Apify returned ${items?.length || 0} items`);
    
    if (!items || items.length === 0) {
      console.error(`❌ [${platform.toUpperCase()}] No data returned from Apify`);
      throw new Error('No data returned from Apify');
    }
    
    console.log(`📊 [${platform.toUpperCase()}] First item keys:`, Object.keys(items[0] || {}).join(', '));
    
    // Extra logging for Instagram and Twitter to debug
    if (platform === 'instagram') {
      console.log('📸 [INSTAGRAM] Full first item:', JSON.stringify(items[0], null, 2));
    }
    
    if (platform === 'twitter') {
      console.log('🐦 [TWITTER/X] Full first item:', JSON.stringify(items[0], null, 2));
    }

    let rawData = items[0];
    
    // For Twitter, when using startUrls, we should get the exact tweet
    // But verify it matches the requested URL if we have multiple results
    if (platform === 'twitter') {
      const tweetId = url.split('/status/')[1]?.split('?')[0];
      if (tweetId && items.length > 0) {
        const specificTweet = items.find((item: any) => 
          item.id === tweetId || item.url?.includes(tweetId) || item.twitterUrl?.includes(tweetId)
        );
        if (specificTweet) {
          rawData = specificTweet;
          console.log(`🎯 [TWITTER/X] Found specific tweet: ${tweetId}`);
        } else {
          console.log(`⚠️ [TWITTER/X] Using first item, tweet ID ${tweetId} not found in results`);
        }
      }
    }
    
    console.log(`📦 [${platform.toUpperCase()}] Raw Apify data received`);
    
    // Transform data based on platform
    const videoData = transformVideoData(rawData, platform);
    console.log(`✅ [${platform.toUpperCase()}] Fetched video data for: @${videoData.username || 'unknown'}`);
    console.log(`📊 [${platform.toUpperCase()}] Transformed video data:`, {
      id: videoData.id,
      username: videoData.username,
      views: videoData.view_count,
      likes: videoData.like_count,
      hasUsername: !!videoData.username,
      hasThumbnail: !!videoData.thumbnail_url
    });
    
    // Extra logging for Instagram and Twitter
    if (platform === 'instagram') {
      console.log('📸 [INSTAGRAM] Complete transformed data:', JSON.stringify(videoData, null, 2));
    }
    
    if (platform === 'twitter') {
      console.log('🐦 [TWITTER/X] Complete transformed data:', JSON.stringify(videoData, null, 2));
    }
    
    return videoData;

  } catch (error) {
    console.error('Failed to fetch video data:', error);
    return null;
  }
}

