import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from './apify-client';

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
          console.log(`✅ Created account: ${accountId}`);
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
            console.log(`📊 Updating follower count: ${videoData.follower_count}`);
          }
          
          // Update profile pic if available
          if (videoData.profile_pic_url) {
            updateData.profilePicture = videoData.profile_pic_url;
            console.log(`📸 Updating profile picture`);
          }
          
          // Update display name if available
          if (videoData.display_name) {
            updateData.displayName = videoData.display_name;
          }
          
          await existingAccountRef.update(updateData);
          console.log(`✅ Using existing account: ${accountId} (updated profile data)`);
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
 * Transform raw Apify data to standardized VideoData format
 */
function transformVideoData(rawData: any, platform: string): VideoData {
  if (platform === 'tiktok') {
    // TikTok uses apidojo/tiktok-scraper format (channel + video objects)
    const channel = rawData.channel || {};
    const video = rawData.video || {};
    
    // ROBUST THUMBNAIL EXTRACTION (strongest → weakest fallback)
    let thumbnailUrl = '';
    if (video.cover) {
      thumbnailUrl = video.cover;
    } else if (video.thumbnail) {
      thumbnailUrl = video.thumbnail;
    } else if (rawData.images && Array.isArray(rawData.images) && rawData.images.length > 0) {
      // Photo Mode post - use first image
      thumbnailUrl = rawData.images[0].url || '';
    }
    
    return {
      id: rawData.id || rawData.post_id || '',
      thumbnail_url: thumbnailUrl,
      caption: rawData.title || rawData.subtitle || rawData.caption || '',
      username: channel.username || '',
      like_count: rawData.likes || 0,
      comment_count: rawData.comments || 0,
      view_count: rawData.views || 0,
      share_count: rawData.shares || 0,
      timestamp: rawData.uploadedAt || rawData.uploaded_at || Math.floor(Date.now() / 1000),
      profile_pic_url: channel.avatar || channel.avatar_url || '',
      display_name: channel.name || channel.username || '',
      follower_count: channel.followers || 0
    };
  } else if (platform === 'instagram') {
    // Instagram - Handle hpix~ig-reels-scraper format - owner data is inside raw_data
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
    
    // ROBUST VIEW COUNT EXTRACTION (prefer play_count → view_count → video_view_count → video_play_count)
    const viewCount = rawData.play_count || rawData.view_count || rawData.video_view_count || rawData.video_play_count || 0;
    
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
      follower_count: owner.edge_followed_by?.count || 0
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
      actorId = 'apidojo/tiktok-scraper';
      input = {
        startUrls: [url],
        maxItems: 1,
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
    } else if (platform === 'instagram') {
      // Use hpix~ig-reels-scraper for individual Instagram posts/reels
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

