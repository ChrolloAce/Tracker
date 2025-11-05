import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

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
const storage = getStorage();

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

    // Validate we have required data
    if (!videoData.username) {
      throw new Error('Video data missing username');
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
      
      const newAccountRef = accountsRef.doc();
      await newAccountRef.set({
        id: newAccountRef.id,
        username: videoData.username.toLowerCase(), // Lowercase for consistency with queries
        platform: video.platform,
        displayName: videoData.display_name || videoData.username,
        profilePicture: videoData.profile_pic_url || '',
        followerCount: videoData.follower_count || 0,
        isActive: true,
        isRead: false,
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
      console.log(`✅ [${video.platform.toUpperCase()}] Created account: ${accountId}`);
    } else if (!accountSnapshot.empty) {
      accountId = accountSnapshot.docs[0].id;
      console.log(`✅ [${video.platform.toUpperCase()}] Using existing account: ${accountId}`);
    }

    // Download and upload thumbnail to Firebase Storage for permanent URL
    let permanentThumbnail = '';
    if (videoData.thumbnail_url) {
      try {
        console.log('📥 Downloading thumbnail to Firebase Storage...');
        permanentThumbnail = await downloadAndUploadThumbnail(
          videoData.thumbnail_url,
          orgId,
          `${videoData.id}_thumb.jpg`
        );
        console.log('✅ Thumbnail uploaded to Firebase Storage');
      } catch (error) {
        console.error('Failed to upload thumbnail:', error);
        permanentThumbnail = videoData.thumbnail_url; // Fallback to original
      }
    }

    // Update video with fetched data
    await videoRef.update({
      videoId: videoData.id,
      title: videoData.caption?.split('\n')[0] || 'Untitled Video',
      description: videoData.caption || '',
      thumbnail: permanentThumbnail || videoData.thumbnail_url || '',
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
                    <div style="text-align: center; padding: 30px 20px; background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                      <img src="https://www.viewtrack.app/blacklogo.png" alt="ViewTrack" style="height: 40px; width: auto;" />
                    </div>
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
 * Transform raw Apify data to standardized VideoData format
 */
function transformVideoData(rawData: any, platform: string): VideoData {
  if (platform === 'tiktok') {
    // TikTok uses authorMeta structure
    return {
      id: rawData.id || rawData.videoId || '',
      thumbnail_url: rawData.videoMeta?.coverUrl || rawData.covers?.default || '',
      caption: rawData.text || '',
      username: rawData['authorMeta.name'] || rawData.authorMeta?.name || '',
      like_count: rawData.diggCount || rawData['videoMeta.diggCount'] || 0,
      comment_count: rawData.commentCount || rawData['videoMeta.commentCount'] || 0,
      view_count: rawData.playCount || rawData['videoMeta.playCount'] || 0,
      share_count: rawData.shareCount || rawData['videoMeta.shareCount'] || 0,
      timestamp: rawData.createTime || rawData.createTimeISO || new Date().toISOString(),
      profile_pic_url: rawData['authorMeta.avatar'] || rawData.authorMeta?.avatar || '',
      display_name: rawData['authorMeta.nickName'] || rawData.authorMeta?.nickName || '',
      follower_count: rawData['authorMeta.fans'] || rawData.authorMeta?.fans || 0
    };
  } else if (platform === 'instagram') {
    // Instagram - Handle alpha-scraper/instagram-video-scraper format
    console.log('📸 [INSTAGRAM Transform] Raw data keys:', Object.keys(rawData).join(', '));
    console.log('📸 [INSTAGRAM Transform] Raw data:', JSON.stringify(rawData, null, 2));
    
    // alpha-scraper format provides: id, ownerUsername, ownerFullName, ownerId, 
    // description, likesCount, commentsCount, videoViewCount, upload_date, thumbnail_url
    return {
      id: rawData.id || '',
      thumbnail_url: rawData.thumbnail_url || '',
      caption: rawData.description || '',
      username: rawData.ownerUsername || '',
      like_count: rawData.likesCount || 0,
      comment_count: rawData.commentsCount || 0,
      view_count: rawData.videoViewCount || 0,
      share_count: 0, // Instagram doesn't expose share count
      timestamp: rawData.upload_date || new Date().toISOString(),
      profile_pic_url: '', // Not provided by alpha-scraper
      display_name: rawData.ownerFullName || rawData.ownerUsername || '',
      follower_count: 0 // Not provided in video endpoint
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
        share_count: 0,
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
      share_count: 0,
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
    
    // Download image with proper headers
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
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
          originalUrl: thumbnailUrl
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    return publicUrl;
  } catch (error) {
    console.error(`Failed to download/upload thumbnail:`, error);
    // Return the original URL as fallback or empty for Instagram
    if (thumbnailUrl.includes('cdninstagram') || thumbnailUrl.includes('fbcdn')) {
      // Instagram URLs expire, return empty string
      console.warn(`Instagram thumbnail download failed, returning empty (URL will expire anyway)`);
      return '';
    }
    // For other platforms, return original URL as fallback
    console.warn(`Using original URL as fallback: ${thumbnailUrl.substring(0, 80)}...`);
    return thumbnailUrl;
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
      // Use alpha-scraper/instagram-video-scraper
      console.log('📸 [INSTAGRAM] Using alpha-scraper/instagram-video-scraper for video:', url);
      actorId = 'alpha-scraper/instagram-video-scraper';
      
      input = {
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        startUrls: [
          {
            url: url
          }
        ]
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
        views: rawVideoData.statistics?.viewCount,
        likes: rawVideoData.statistics?.likeCount
      });
      
      const transformedData = transformVideoData(rawVideoData, platform);
      console.log('🔄 [YOUTUBE] Transformed data:', {
        id: transformedData.id,
        username: transformedData.username,
        view_count: transformedData.view_count,
        like_count: transformedData.like_count
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
    
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${platform.toUpperCase()}] Apify API error:`, response.status, errorText);
      throw new Error(`Apify API error: ${response.status} - ${errorText}`);
    }

    const items = await response.json();
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

