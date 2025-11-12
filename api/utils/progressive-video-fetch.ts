import { getFirestore } from 'firebase-admin/firestore';
import { runApifyActor } from '../apify-client.js';

export interface ProgressiveFetchOptions {
  db: ReturnType<typeof getFirestore>; // Pass db instance
  orgId: string;
  projectId: string;
  accountId: string;
  username: string;
  platform: 'tiktok' | 'youtube' | 'twitter';
  existingVideoIds?: Set<string>; // For optimization - pass in if already fetched
}

export interface ProgressiveFetchResult {
  newVideos: any[]; // Videos that are new (not in DB)
  duplicateCount: number; // Videos that were already in DB
  totalFetched: number; // Total videos fetched from API
  stoppedEarly: boolean; // Whether we stopped because we hit existing videos
}

/**
 * Progressive Video Fetch Utility
 * 
 * For platforms without date range APIs (TikTok, YouTube, X/Twitter),
 * this fetches videos in increasing batch sizes until hitting existing videos.
 * 
 * Strategy:
 * 1. Start with 5 videos
 * 2. If all 5 are new, fetch 25 more
 * 3. If still all new, fetch 50 more
 * 4. Stop when we hit an existing video
 * 5. Return only new videos
 */
export async function progressiveFetchVideos(
  options: ProgressiveFetchOptions
): Promise<ProgressiveFetchResult> {
  const { db, orgId, projectId, accountId, username, platform } = options;
  
  console.log(`🔄 Starting progressive fetch for @${username} (${platform})`);
  
  // Fetch existing video IDs from DB if not provided
  let existingVideoIds = options.existingVideoIds;
  if (!existingVideoIds) {
    console.log(`📊 Fetching existing video IDs from database...`);
    const videosSnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('videos')
      .where('trackedAccountId', '==', accountId)
      .select('videoId') // Only fetch videoId field for efficiency
      .get();
    
    existingVideoIds = new Set(videosSnapshot.docs.map(doc => doc.data().videoId));
    console.log(`📊 Found ${existingVideoIds.size} existing videos in database`);
  }
  
  const batchSizes = [5, 25, 50];
  let allNewVideos: any[] = [];
  let totalFetched = 0;
  let duplicateCount = 0;
  let stoppedEarly = false;
  
  for (const batchSize of batchSizes) {
    console.log(`🔄 Fetching batch of ${batchSize} videos...`);
    
    const videos = await fetchVideoBatch(username, platform, batchSize);
    totalFetched += videos.length;
    
    console.log(`📦 Received ${videos.length} videos from ${platform}`);
    
    // Check which videos are new
    const newVideosInBatch: any[] = [];
    let foundExisting = false;
    
    for (const video of videos) {
      const videoId = extractVideoId(video, platform);
      
      if (existingVideoIds.has(videoId)) {
        duplicateCount++;
        foundExisting = true;
        console.log(`✓ Found existing video: ${videoId}`);
      } else {
        newVideosInBatch.push(video);
      }
    }
    
    allNewVideos.push(...newVideosInBatch);
    console.log(`📊 Batch results: ${newVideosInBatch.length} new, ${duplicateCount} duplicates`);
    
    // Stop if we found any existing videos (we've reached the overlap)
    if (foundExisting) {
      console.log(`⏹️ Stopping early - found existing video(s) in batch`);
      stoppedEarly = true;
      break;
    }
    
    // Stop if we got fewer videos than requested (reached end of account's content)
    if (videos.length < batchSize) {
      console.log(`⏹️ Stopping early - got ${videos.length} < ${batchSize} (end of content)`);
      stoppedEarly = true;
      break;
    }
    
    // If all videos in this batch were new, continue to next larger batch
    console.log(`➡️ All videos in batch were new, fetching larger batch...`);
  }
  
  console.log(`✅ Progressive fetch complete:`);
  console.log(`   - New videos: ${allNewVideos.length}`);
  console.log(`   - Duplicates: ${duplicateCount}`);
  console.log(`   - Total fetched: ${totalFetched}`);
  
  return {
    newVideos: allNewVideos,
    duplicateCount,
    totalFetched,
    stoppedEarly
  };
}

/**
 * Fetch a batch of videos from the platform
 */
async function fetchVideoBatch(
  username: string,
  platform: 'tiktok' | 'youtube' | 'twitter',
  maxItems: number
): Promise<any[]> {
  if (platform === 'tiktok') {
    return await fetchTikTokBatch(username, maxItems);
  } else if (platform === 'youtube') {
    return await fetchYouTubeBatch(username, maxItems);
  } else if (platform === 'twitter') {
    return await fetchTwitterBatch(username, maxItems);
  }
  
  return [];
}

/**
 * Fetch TikTok videos using Apify
 */
async function fetchTikTokBatch(username: string, maxItems: number): Promise<any[]> {
  try {
    const input = {
      customMapFunction: "(object) => { return { ...object } } \n",
      dateRange: "DEFAULT",
      includeSearchKeywords: false,
      location: "US",
      maxItems: maxItems,
      sortType: "RELEVANCE",
      startUrls: [`https://www.tiktok.com/@${username}`],
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"]
      }
    };
    
    const items = await runApifyActor('apidojo/tiktok-scraper', input, false);
    return items || [];
  } catch (error) {
    console.error(`❌ Failed to fetch TikTok batch:`, error);
    return [];
  }
}

/**
 * Fetch YouTube videos using YouTube Data API v3
 */
async function fetchYouTubeBatch(username: string, maxItems: number): Promise<any[]> {
  try {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      console.error(`❌ YouTube API key not configured`);
      return [];
    }
    
    // Step 1: Search for the channel by username/handle
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(username)}&key=${YOUTUBE_API_KEY}&maxResults=1`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      console.log(`  ⚠️ No YouTube channel found for: ${username}`);
      return [];
    }
    
    const channelId = searchData.items[0].snippet.channelId || searchData.items[0].id.channelId;
    console.log(`  ✅ Found YouTube channel ID: ${channelId}`);
    
    // Step 2: Get channel's uploads playlist
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      console.log(`  ⚠️ No channel data found`);
      return [];
    }
    
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
    
    // Step 3: Get videos from uploads playlist
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxItems}&key=${YOUTUBE_API_KEY}`;
    const playlistResponse = await fetch(playlistUrl);
    const playlistData = await playlistResponse.json();
    
    if (!playlistData.items || playlistData.items.length === 0) {
      console.log(`  ⚠️ No videos found in uploads playlist`);
      return [];
    }
    
    // Step 4: Get detailed stats for these videos
    const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();
    
    if (!videosData.items) {
      return [];
    }
    
    console.log(`  ✅ Fetched ${videosData.items.length} YouTube videos`);
    return videosData.items;
  } catch (error) {
    console.error(`❌ Failed to fetch YouTube batch:`, error);
    return [];
  }
}

/**
 * Fetch Twitter/X videos using Apify
 */
async function fetchTwitterBatch(username: string, maxItems: number): Promise<any[]> {
  try {
    const input = {
      maxItems: maxItems,
      twitterHandles: [username],
      onlyVideos: true
    };
    
    const items = await runApifyActor('apidojo~tweet-scraper', input, false);
    return items || [];
  } catch (error) {
    console.error(`❌ Failed to fetch Twitter batch:`, error);
    return [];
  }
}

/**
 * Extract video ID from raw video data based on platform
 */
function extractVideoId(video: any, platform: 'tiktok' | 'youtube' | 'twitter'): string {
  if (platform === 'tiktok') {
    return video.id || video.videoId || video.aweme_id || '';
  } else if (platform === 'youtube') {
    return video.id || video.videoId || '';
  } else if (platform === 'twitter') {
    return video.id || video.tweetId || video.id_str || '';
  }
  
  return '';
}

