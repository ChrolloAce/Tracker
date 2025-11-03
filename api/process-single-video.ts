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

    // Create account if it doesn't exist
    if (accountSnapshot.empty && !accountId) {
      console.log(`✨ Creating account for @${videoData.username}`);
      
      const newAccountRef = accountsRef.doc();
      await newAccountRef.set({
        id: newAccountRef.id,
        username: videoData.username.toLowerCase(), // Lowercase for consistency with queries
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
          await fetch(`${process.env.VERCEL_URL || 'https://tracker-red-zeta.vercel.app'}/api/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: userData.email,
              type: 'video_processed',
              data: {
                title: videoData.caption?.substring(0, 100) || 'Video',
                platform: video.platform,
                uploaderHandle: videoData.username,
                views: videoData.view_count || 0,
                likes: videoData.like_count || 0,
                thumbnail: videoData.thumbnail_url,
                dashboardUrl: 'https://tracker-red-zeta.vercel.app'
              }
            })
          }).catch(err => console.error('Failed to send notification email:', err));
          
          console.log(`📧 Notification email sent to ${userData.email}`);
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
    // Instagram - Handle pratikdani/instagram-reels-scraper format
    // video_play_count is the accurate view count, not just "views"
    return {
      id: rawData.post_id || rawData.content_id || rawData.shortcode || rawData.id || '',
      thumbnail_url: rawData.thumbnail || rawData.thumbnail_url || rawData.displayUrl || rawData.thumbnailUrl || '',
      caption: rawData.description || rawData.caption || rawData.text || '',
      username: rawData.user_posted || rawData.username || rawData.ownerUsername || '',
      like_count: rawData.likes || rawData.like_count || rawData.likesCount || 0,
      comment_count: rawData.num_comments || rawData.comment_count || rawData.commentsCount || 0,
      view_count: rawData.video_play_count || rawData.view_count || rawData.videoViewCount || rawData.views || 0,
      share_count: 0, // Instagram doesn't expose share count
      timestamp: rawData.date_posted || rawData.timestamp || rawData.taken_at_timestamp || new Date().toISOString(),
      profile_pic_url: rawData.profile_pic_url || rawData.ownerProfilePicUrl || '',
      display_name: rawData.user_posted || rawData.display_name || rawData.ownerFullName || '',
      follower_count: rawData.followers || rawData.follower_count || rawData.ownerFollowersCount || 0
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
    // Twitter/X structure
    return {
      id: rawData.id || '',
      thumbnail_url: rawData.media?.[0] || rawData.extendedEntities?.media?.[0]?.media_url_https || '',
      caption: rawData.fullText || rawData.text || '',
      username: rawData.author?.userName || '',
      like_count: rawData.likeCount || 0,
      comment_count: rawData.replyCount || 0,
      view_count: rawData.viewCount || 0,
      share_count: rawData.retweetCount || 0,
      timestamp: rawData.createdAt || new Date().toISOString(),
      profile_pic_url: rawData.author?.profilePicture || '',
      display_name: rawData.author?.name || '',
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
      // Use pratikdani/instagram-reels-scraper (same pattern as TikTok)
      actorId = 'pratikdani/instagram-reels-scraper';
      input = {
        urls: [url]
      };
    } else if (platform === 'youtube') {
      // Use YouTube API directly instead of Apify for better reliability
      console.log('🎥 Using YouTube Data API v3 for video:', url);
      
      // Extract video ID from URL
      let videoId = '';
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
          if (urlObj.pathname.includes('/shorts/')) {
            videoId = urlObj.pathname.split('/shorts/')[1]?.split('/')[0] || '';
          } else {
            videoId = urlObj.searchParams.get('v') || '';
          }
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.substring(1).split('/')[0];
        }
      } catch (e) {
        throw new Error('Could not parse YouTube video ID from URL');
      }
      
      if (!videoId) {
        throw new Error('Could not extract video ID from YouTube URL');
      }
      
      const youtubeApiKey = process.env.YOUTUBE_API_KEY;
      if (!youtubeApiKey) {
        throw new Error('YOUTUBE_API_KEY not configured');
      }
      
      const ytUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${youtubeApiKey}`;
      const ytResponse = await fetch(ytUrl);
      
      if (!ytResponse.ok) {
        throw new Error(`YouTube API error: ${ytResponse.status}`);
      }
      
      const ytData = await ytResponse.json();
      if (!ytData.items || ytData.items.length === 0) {
        throw new Error('Video not found on YouTube');
      }
      
      console.log('✅ YouTube API returned data:', ytData.items[0].snippet?.title);
      const rawVideoData = ytData.items[0];
      const transformedData = transformVideoData(rawVideoData, platform);
      console.log('🔄 Transformed YouTube data:', transformedData);
      return transformedData;
    } else if (platform === 'twitter') {
      // Extract username from Twitter URL
      // e.g., https://x.com/username/status/123 or https://twitter.com/username/status/123
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      const username = pathParts[0]; // First part is username
      
      actorId = 'apidojo~tweet-scraper';
      input = {
        twitterHandles: [username],
        maxItems: 10, // Get recent tweets to find the specific one
        sort: 'Latest',
        onlyImage: false,
        onlyVideo: false,
        onlyQuote: false,
        onlyVerifiedUsers: false,
        onlyTwitterBlue: false,
        includeSearchTerms: false
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

    let rawData = items[0];
    
    // For Twitter, try to find the specific tweet by URL
    if (platform === 'twitter' && items.length > 1) {
      const tweetId = url.split('/status/')[1]?.split('?')[0];
      if (tweetId) {
        const specificTweet = items.find((item: any) => 
          item.id === tweetId || item.url?.includes(tweetId)
        );
        if (specificTweet) {
          rawData = specificTweet;
          console.log(`🎯 Found specific tweet: ${tweetId}`);
        }
      }
    }
    
    console.log('📦 Raw Apify data received');
    
    // Transform data based on platform
    const videoData = transformVideoData(rawData, platform);
    console.log(`✅ Fetched video data for: ${videoData.username || 'unknown'}`);
    
    return videoData;

  } catch (error) {
    console.error('Failed to fetch video data:', error);
    return null;
  }
}

