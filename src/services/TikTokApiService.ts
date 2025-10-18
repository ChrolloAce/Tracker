import { InstagramVideoData } from '../types';
import LocalStorageService from './LocalStorageService';
import ApifyBrowserClient from './ApifyBrowserClient';

// TikTokVideoData interface removed as it's not used

class TikTokApiService {
  private apifyClient: ApifyBrowserClient;
  private readonly APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';
  private readonly TIKTOK_SCRAPER_ACTOR = 'clockworks~tiktok-scraper'; // User's TikTok scraper
  
  constructor() {
    // console.log('🔧 Initializing browser-compatible TikTok client with token:', this.APIFY_TOKEN ? '***' + this.APIFY_TOKEN.slice(-4) : 'No token');
    this.apifyClient = new ApifyBrowserClient(this.APIFY_TOKEN);
  }
  
  async fetchVideoData(tiktokUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Starting REAL TikTok Apify API fetch for URL:', tiktokUrl);
    
    // Validate TikTok URL
    if (!this.isValidTikTokUrl(tiktokUrl)) {
      console.error('❌ Invalid TikTok URL format:', tiktokUrl);
      throw new Error('Invalid TikTok URL format. Please use a valid TikTok video URL.');
    }

    console.log('✅ TikTok URL validation passed');
    console.log('📡 Calling TikTok Apify scraper...');

    try {
      // Run the TikTok scraper actor with direct URL
      console.log('🔧 Using input parameters:', {
        postURLs: [tiktokUrl],
        maxItems: 1,
      });
      
      const run = await this.apifyClient.runActor(this.TIKTOK_SCRAPER_ACTOR, {
        postURLs: [tiktokUrl], // FIXED: postURLs with capital URL
        maxItems: 1,
        // Try additional parameters that might be required
        proxy: {
          useApifyProxy: true,
        },
      });

      console.log('🎯 TikTok Apify actor run completed:', run.id);
      console.log('📊 Run status:', run.status);
      console.log('📋 Full run details:', run);

      if (run.status !== 'SUCCEEDED') {
        // Get more details about the failure
        try {
          // Try to get the log for more info
          const logResponse = await fetch(`https://api.apify.com/v2/logs/${run.id}?token=${this.APIFY_TOKEN}`);
          if (logResponse.ok) {
            const logText = await logResponse.text();
            console.error('📋 Run logs:', logText);
          }
        } catch (logError) {
          console.warn('⚠️ Could not fetch run details:', logError);
        }
        
        throw new Error(`TikTok Apify run failed with status: ${run.status}. Check console for detailed logs.`);
      }

      // Get the dataset items (now included in proxy response)
      const items = (run as any).items || [];
      console.log('✅ Retrieved TikTok items from proxy response:', items.length);

      if (!items || items.length === 0) {
        throw new Error('No TikTok data returned from scraper');
      }

      const tiktokData = items[0];
      console.log('🎬 Raw TikTok data:', tiktokData);

      // Transform TikTok data to Instagram format for compatibility
      const transformedData = await this.transformTikTokData(tiktokData, tiktokUrl);
      
      console.log('✅ Successfully fetched REAL TikTok data:', {
        id: transformedData.id,
        username: transformedData.username,
        likes: transformedData.like_count,
        views: transformedData.view_count,
        comments: transformedData.comment_count,
        uploadDate: new Date(transformedData.timestamp).toLocaleDateString()
      });

      return transformedData;

    } catch (error) {
      console.error('❌ TikTok Apify API call failed:', error);
      console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to fetch TikTok data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidTikTokUrl(url: string): boolean {
    const tiktokRegex = /^https?:\/\/(www\.|vm\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/;
    const shortTikTokRegex = /^https?:\/\/vm\.tiktok\.com\/[A-Za-z0-9]+/;
    return tiktokRegex.test(url) || shortTikTokRegex.test(url);
  }

  private async transformTikTokData(tiktokData: any, originalUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Transforming TikTok data to dashboard format...');
    console.log('📋 Available TikTok fields:', Object.keys(tiktokData));
    console.log('🔍 Full TikTok data structure:', tiktokData);
    
    // Extract video ID from URL or use from data
    const urlMatch = originalUrl.match(/video\/(\d+)/);
    const id = urlMatch ? urlMatch[1] : tiktokData.id || 'unknown';

    // Try multiple possible thumbnail field names
    const thumbnailUrl = tiktokData['videoMeta.coverUrl'] || 
                         tiktokData.videoMeta?.coverUrl || 
                         tiktokData.coverUrl || 
                         tiktokData.thumbnail || 
                         tiktokData.cover || 
                         '';
    
    console.log('🖼️ TikTok thumbnail URL found:', thumbnailUrl);
    console.log('🔍 Checking thumbnail fields:', {
      'videoMeta.coverUrl': tiktokData['videoMeta.coverUrl'],
      'videoMeta': tiktokData.videoMeta,
      'coverUrl': tiktokData.coverUrl,
      'thumbnail': tiktokData.thumbnail,
      'cover': tiktokData.cover
    });

    // Download and save thumbnail locally
    let localThumbnailUrl = '';
    if (thumbnailUrl) {
      console.log('💾 Downloading TikTok thumbnail locally...');
      localThumbnailUrl = await this.downloadThumbnail(thumbnailUrl, id);
    }

    // Try multiple possible username field names
    const username = tiktokData['authorMeta.name'] || 
                    tiktokData.authorMeta?.name || 
                    tiktokData.author?.name || 
                    tiktokData.username || 
                    tiktokData.authorName || 
                    'unknown_user';

    console.log('👤 TikTok username found:', username);
    console.log('🔍 Checking username fields:', {
      'authorMeta.name': tiktokData['authorMeta.name'],
      'authorMeta': tiktokData.authorMeta,
      'author': tiktokData.author,
      'username': tiktokData.username,
      'authorName': tiktokData.authorName
    });

    const transformedData: InstagramVideoData = {
      id: id,
      thumbnail_url: localThumbnailUrl || thumbnailUrl || '',
      caption: tiktokData.text || 'No caption available',
      username: username,
      like_count: tiktokData.diggCount || 0,
      comment_count: tiktokData.commentCount || 0,
      view_count: tiktokData.playCount || 0,
      timestamp: tiktokData.createTimeISO || new Date().toISOString()
    };

    // Store share count separately for TikTok videos
    (transformedData as any).share_count = tiktokData.shareCount || 0;
    
    // Store author metadata for profile information
    (transformedData as any).profile_pic_url = tiktokData['authorMeta.avatar'] || '';
    (transformedData as any).display_name = tiktokData['authorMeta.nickName'] || username;
    (transformedData as any).follower_count = tiktokData['authorMeta.fans'] || 0;

    console.log('✅ TikTok data transformation completed with real values:', {
      id: transformedData.id,
      username: transformedData.username,
      displayName: (transformedData as any).display_name,
      likes: transformedData.like_count,
      comments: transformedData.comment_count,
      views: transformedData.view_count,
      shares: tiktokData.shareCount || 0,
      duration: tiktokData['videoMeta.duration'] || 0,
      uploadDate: new Date(transformedData.timestamp).toLocaleDateString(),
      thumbnail: transformedData.thumbnail_url ? 'Downloaded locally' : 'Using original URL',
      profilePic: (transformedData as any).profile_pic_url ? '✓ Present' : '✗ Missing',
      followers: (transformedData as any).follower_count
    });

    return transformedData;
  }

  private async downloadThumbnail(imageUrl: string, videoId: string): Promise<string> {
    try {
      console.log('📥 Attempting to fetch TikTok thumbnail from:', imageUrl);
      
      // Try to fetch with no-cors mode first
      const response = await fetch(imageUrl, {
        mode: 'no-cors',
        credentials: 'omit'
      }).catch(() => {
        // If no-cors fails, try normal fetch
        return fetch(imageUrl);
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch TikTok image: ${response.status}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = blob.type || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      console.log('✅ TikTok thumbnail downloaded and converted to base64');
      
      // Store in localStorage for persistence using LocalStorageService
      LocalStorageService.saveThumbnail(videoId, dataUrl);

      return dataUrl;
    } catch (error) {
      console.warn('⚠️ CORS blocked TikTok thumbnail download (this is normal):', error instanceof Error ? error.message : 'Unknown error');
      console.log('📷 Using original TikTok URL directly (will work in img tags)');
      
      // Store the original URL as a fallback using LocalStorageService
      LocalStorageService.saveThumbnail(videoId, imageUrl);
      
      return imageUrl; // Return original URL - img tags can still load it
    }
  }

  // Load thumbnail from localStorage if available
  loadThumbnailFromStorage(videoId: string): string | null {
    return LocalStorageService.loadThumbnail(videoId);
  }

  // Search for TikTok videos by keyword/query
  async searchVideos(searchQuery: string, maxVideos: number = 10): Promise<InstagramVideoData[]> {
    console.log('🔍 Starting TikTok search for query:', searchQuery);
    console.log('📊 Max videos to fetch:', maxVideos);

    try {
      // Run the TikTok scraper actor with search query
      const run = await this.apifyClient.runActor(this.TIKTOK_SCRAPER_ACTOR, {
        searchQueries: [searchQuery], // FIXED: searchQueries for keyword search
        maxItems: maxVideos,
      });

      console.log('🎯 TikTok search run completed:', run.id);
      console.log('📊 Run status:', run.status);

      if (run.status !== 'SUCCEEDED') {
        throw new Error(`TikTok search run failed with status: ${run.status}`);
      }

      // Get the dataset items
      console.log('📥 Fetching TikTok search results...');
      const { items } = await this.apifyClient.getDatasetItems(run.defaultDatasetId);
      
      console.log('✅ Retrieved TikTok search results:', items.length);

      if (!items || items.length === 0) {
        console.warn('⚠️ No TikTok videos found for search query:', searchQuery);
        return [];
      }

      // Transform all found videos
      const transformedVideos: InstagramVideoData[] = [];
      
      for (let i = 0; i < Math.min(items.length, maxVideos); i++) {
        const tiktokData = items[i];
        console.log(`🎬 Processing TikTok search result ${i + 1}:`, tiktokData.webVideoUrl || tiktokData.id);
        
        try {
          const transformedData = await this.transformTikTokData(tiktokData, String(tiktokData.webVideoUrl || `https://www.tiktok.com/video/${tiktokData.id || i}`));
          transformedVideos.push(transformedData);
        } catch (error) {
          console.warn(`⚠️ Failed to transform TikTok video ${i + 1}:`, error);
          continue; // Skip this video and continue with others
        }
      }

      console.log('✅ Successfully processed TikTok search results:', transformedVideos.length);
      return transformedVideos;

    } catch (error) {
      console.error('❌ TikTok search API call failed:', error);
      console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to search TikTok videos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Search for videos by hashtag
  async searchByHashtag(hashtag: string, maxVideos: number = 10): Promise<InstagramVideoData[]> {
    console.log('🏷️ Starting TikTok hashtag search for:', hashtag);
    
    // Remove # if present and add it back
    const cleanHashtag = hashtag.replace('#', '');
    const hashtagWithSymbol = `#${cleanHashtag}`;

    try {
      // Run the TikTok scraper actor with hashtag
      const run = await this.apifyClient.runActor(this.TIKTOK_SCRAPER_ACTOR, {
        hashtags: [cleanHashtag], // FIXED: hashtags array for hashtag search
        maxItems: maxVideos,
      });

      console.log('🎯 TikTok hashtag search run completed:', run.id);
      console.log('📊 Run status:', run.status);

      if (run.status !== 'SUCCEEDED') {
        throw new Error(`TikTok hashtag search run failed with status: ${run.status}`);
      }

      // Get the dataset items
      console.log('📥 Fetching TikTok hashtag results...');
      const { items } = await this.apifyClient.getDatasetItems(run.defaultDatasetId);
      
      console.log('✅ Retrieved TikTok hashtag results:', items.length);

      if (!items || items.length === 0) {
        console.warn('⚠️ No TikTok videos found for hashtag:', hashtagWithSymbol);
        return [];
      }

      // Transform all found videos
      const transformedVideos: InstagramVideoData[] = [];
      
      for (let i = 0; i < Math.min(items.length, maxVideos); i++) {
        const tiktokData = items[i];
        console.log(`🎬 Processing TikTok hashtag result ${i + 1}:`, tiktokData.webVideoUrl || tiktokData.id);
        
        try {
          const transformedData = await this.transformTikTokData(tiktokData, String(tiktokData.webVideoUrl || `https://www.tiktok.com/hashtag/${tiktokData.id || i}`));
          transformedVideos.push(transformedData);
        } catch (error) {
          console.warn(`⚠️ Failed to transform TikTok video ${i + 1}:`, error);
          continue;
        }
      }

      console.log('✅ Successfully processed TikTok hashtag results:', transformedVideos.length);
      return transformedVideos;

    } catch (error) {
      console.error('❌ TikTok hashtag search API call failed:', error);
      throw new Error(`Failed to search TikTok hashtag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test method to verify TikTok Apify connection
  async testTikTokConnection(): Promise<boolean> {
    console.log('🧪 Testing TikTok Apify connection...');
    try {
      const testUrl = 'https://www.tiktok.com/@test/video/1234567890';
      console.log('🔄 Running TikTok test with URL:', testUrl);
      
      const run = await this.apifyClient.runActor(this.TIKTOK_SCRAPER_ACTOR, {
        postURLs: [testUrl], // FIXED: postURLs with capital URL
        maxItems: 1,
      }, { timeout: 60000 }); // 1 minute timeout

      console.log('✅ TikTok test run completed:', run.id, 'Status:', run.status);
      return run.status === 'SUCCEEDED';
    } catch (error) {
      console.error('❌ TikTok Apify connection test failed:', error);
      return false;
    }
  }
}

export default new TikTokApiService();
