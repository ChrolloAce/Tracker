import { InstagramVideoData } from '../types';
import LocalStorageService from './LocalStorageService';
import ApifyBrowserClient from './ApifyBrowserClient';

class InstagramApiService {
  private apifyClient: ApifyBrowserClient;
  // NEW WORKING SCRAPER TOKEN
  private readonly APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';
  // NEW INSTAGRAM REELS SCRAPER - ACTUALLY WORKS!
  private readonly INSTAGRAM_SCRAPER_ACTOR = 'scraper-engine~instagram-reels-scraper';
  
  constructor() {
    console.log('🔧 Initializing NEW Instagram Reels Scraper with token:', this.APIFY_TOKEN ? '***' + this.APIFY_TOKEN.slice(-4) : 'No token');
    this.apifyClient = new ApifyBrowserClient(this.APIFY_TOKEN);
  }
  
  async fetchVideoData(instagramUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Starting NEW Instagram Reels Scraper API fetch for URL:', instagramUrl);
    
    // Validate Instagram URL
    if (!this.isValidInstagramUrl(instagramUrl)) {
      console.error('❌ Invalid Instagram URL format:', instagramUrl);
      throw new Error('Invalid Instagram URL format. Please use a valid Instagram post, reel, or TV URL.');
    }

    console.log('✅ URL validation passed');
    console.log('📡 Calling NEW Instagram Reels scraper...');

    try {
      // Run the NEW Instagram Reels scraper actor
      const run = await this.apifyClient.runActor(this.INSTAGRAM_SCRAPER_ACTOR, {
        urls: [instagramUrl],
        sortOrder: "newest",
        maxComments: 50,
        maxReels: 30,
        proxyConfiguration: {
          useApifyProxy: false
        }
      });

      console.log('🎯 Apify actor run completed:', run.id);
      console.log('📊 Run status:', run.status);

      if (run.status !== 'SUCCEEDED') {
        throw new Error(`Apify run failed with status: ${run.status}`);
      }

      // Get the dataset items (now included in proxy response)
      const items = (run as any).items || [];
      console.log('✅ Retrieved items from proxy response:', items.length);

      if (!items || items.length === 0) {
        throw new Error('No data returned from Instagram scraper');
      }

      const instagramData = items[0];
      console.log('🎬 Raw Instagram data from NEW scraper:', instagramData);

      // Transform Apify data to our format
      const transformedData = await this.transformApifyData(instagramData, instagramUrl);
      
      console.log('✅ Successfully fetched REAL Instagram data from NEW scraper:', {
        id: transformedData.id,
        username: transformedData.username,
        likes: transformedData.like_count,
        views: transformedData.view_count,
        comments: transformedData.comment_count
      });

      return transformedData;

    } catch (error) {
      console.error('❌ NEW Scraper API call failed:', error);
      console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to fetch Instagram data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidInstagramUrl(url: string): boolean {
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv|[A-Za-z0-9_.]+\/(p|reel|tv))\/[A-Za-z0-9_-]+/;
    return instagramRegex.test(url);
  }

  private async transformApifyData(apifyData: any, originalUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Transforming NEW scraper data to our format...');
    console.log('📋 Available fields:', Object.keys(apifyData));
    
    // NEW SCRAPER FORMAT: data is nested under 'media'
    const media = apifyData.media || apifyData;
    console.log('📋 Media object keys:', Object.keys(media));
    console.log('🔍 RAW MEDIA DATA:', JSON.stringify(media, null, 2).substring(0, 3000));
    
    // Extract ID - NEW scraper uses 'code' field
    const urlMatch = originalUrl.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    const id = media.code || urlMatch?.[1] || media.id || media.pk || 'unknown';

    // NEW SCRAPER: Thumbnail from image_versions2
    let thumbnailUrl = '';
    if (media.image_versions2?.candidates && media.image_versions2.candidates.length > 0) {
      thumbnailUrl = media.image_versions2.candidates[0].url;
      console.log('📸 Found thumbnail from image_versions2');
    } else if (media.display_uri) {
      thumbnailUrl = media.display_uri;
    } else if (media.displayUrl) {
      thumbnailUrl = media.displayUrl;
    } else if (media.thumbnailUrl) {
      thumbnailUrl = media.thumbnailUrl;
    } else if (media.thumbnail) {
      thumbnailUrl = media.thumbnail;
    } else if (media.imageUrl) {
      thumbnailUrl = media.imageUrl;
    }
    
    // Download and save thumbnail locally
    let localThumbnailUrl = '';
    if (thumbnailUrl) {
      console.log('💾 Downloading thumbnail from:', thumbnailUrl.substring(0, 100));
      localThumbnailUrl = await this.downloadThumbnail(thumbnailUrl, id);
    } else {
      console.warn('⚠️ No thumbnail URL found in NEW scraper data');
    }

    // NEW SCRAPER: Username from user or owner object
    const username = media.user?.username || 
                    media.owner?.username || 
                    media.caption?.user?.username ||
                    'unknown_user';
    
    // NEW SCRAPER: Caption is an object with 'text' field
    let caption = 'No caption';
    if (media.caption?.text) {
      caption = media.caption.text;
    } else if (typeof media.caption === 'string') {
      caption = media.caption;
    } else if (media.text) {
      caption = media.text;
    } else if (media.description) {
      caption = media.description;
    }
    
    // NEW SCRAPER: Metrics with correct field names
    const likes = media.like_count || 0;
    const comments = media.comment_count || 0;
    // NEW SCRAPER: Uses 'play_count' and 'ig_play_count'
    const views = media.play_count || media.ig_play_count || media.videoViewCount || 0;
    
    // NEW SCRAPER: Timestamp is Unix timestamp in seconds (taken_at)
    let timestamp = new Date().toISOString();
    if (media.taken_at) {
      timestamp = new Date(media.taken_at * 1000).toISOString();
      console.log('📅 Upload date from taken_at:', new Date(timestamp).toLocaleString());
    } else if (media.takenAt) {
      timestamp = new Date(media.takenAt * 1000).toISOString();
    } else if (media.timestamp) {
      timestamp = new Date(media.timestamp).toISOString();
    }
    
    // NEW SCRAPER: Profile information
    const profilePic = media.user?.profile_pic_url || 
                      media.owner?.profile_pic_url || 
                      media.caption?.user?.profile_pic_url ||
                      '';
    
    const displayName = media.user?.full_name || 
                       media.owner?.full_name || 
                       media.caption?.user?.full_name ||
                       username;
    
    const isVerified = media.user?.is_verified || 
                      media.owner?.is_verified || 
                      media.caption?.user?.is_verified ||
                      false;
    
    // Follower count not typically in individual post data
    const followerCount = 0;

    // NEW SCRAPER: Video duration in seconds
    const videoDuration = media.video_duration || 0;

    const transformedData: InstagramVideoData = {
      id: id,
      thumbnail_url: localThumbnailUrl || thumbnailUrl,
      caption: caption,
      username: username,
      like_count: likes,
      comment_count: comments,
      view_count: views,
      timestamp: timestamp,
      // Store profile metadata
      profile_pic_url: profilePic,
      display_name: displayName,
      follower_count: followerCount,
      video_duration: videoDuration,
      is_verified: isVerified
    };

    console.log('✅ NEW SCRAPER data transformation completed:', {
      id: transformedData.id,
      username: transformedData.username,
      displayName: displayName,
      caption: transformedData.caption.substring(0, 50) + '...',
      likes: transformedData.like_count,
      comments: transformedData.comment_count,
      views: transformedData.view_count,
      uploadDate: new Date(transformedData.timestamp).toLocaleDateString(),
      thumbnail: transformedData.thumbnail_url ? '✓ Present' : '✗ Missing',
      profilePic: profilePic ? '✓ Present' : '✗ Missing',
      duration: videoDuration + 's',
      verified: isVerified ? '✓ Verified' : '✗ Not Verified'
    });
    
    console.log('🎯 Instagram Data Summary from NEW SCRAPER:');
    console.log('   📱 Username:', username, '(' + displayName + ')', isVerified ? '✓' : '');
    console.log('   👁️ Views:', transformedData.view_count);
    console.log('   ❤️ Likes:', transformedData.like_count);
    console.log('   💬 Comments:', transformedData.comment_count);
    console.log('   ⏱️ Duration:', videoDuration + 's');
    console.log('   📅 Upload Date:', new Date(timestamp).toLocaleDateString());
    console.log('   📸 Thumbnail URL:', thumbnailUrl ? thumbnailUrl.substring(0, 80) + '...' : 'None');
    console.log('   🖼️ Profile Pic:', profilePic ? profilePic.substring(0, 80) + '...' : 'None');

    return transformedData;
  }

  private async downloadThumbnail(imageUrl: string, videoId: string): Promise<string> {
    try {
      console.log('📥 Attempting to fetch thumbnail from:', imageUrl);
      
      // Try to fetch with no-cors mode first (won't work for downloading, but let's try)
      const response = await fetch(imageUrl, {
        mode: 'no-cors',
        credentials: 'omit'
      }).catch(() => {
        // If no-cors fails, try normal fetch
        return fetch(imageUrl);
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = blob.type || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      console.log('✅ Thumbnail downloaded and converted to base64');
      
      // Store in localStorage for persistence using LocalStorageService
      LocalStorageService.saveThumbnail(videoId, dataUrl);

      return dataUrl;
    } catch (error) {
      console.warn('⚠️ CORS blocked thumbnail download (this is normal for Instagram images):', error instanceof Error ? error.message : 'Unknown error');
      console.log('📷 Using original Instagram URL directly (will work in img tags)');
      
      // Store the original URL as a fallback using LocalStorageService
      LocalStorageService.saveThumbnail(videoId, imageUrl);
      
      return imageUrl; // Return original URL - img tags can still load it
    }
  }

  // Load thumbnail from localStorage if available
  loadThumbnailFromStorage(videoId: string): string | null {
    return LocalStorageService.loadThumbnail(videoId);
  }

  // Test method to verify Apify connection
  async testApifyConnection(): Promise<boolean> {
    console.log('🧪 Testing NEW Instagram Reels Scraper connection...');
    try {
      const testUrl = 'https://www.instagram.com/reel/CyXample123/';
      console.log('🔄 Running test with URL:', testUrl);
      
      const run = await this.apifyClient.runActor(this.INSTAGRAM_SCRAPER_ACTOR, {
        urls: [testUrl],
        sortOrder: "newest",
        maxComments: 10,
        maxReels: 1,
        proxyConfiguration: {
          useApifyProxy: false
        }
      }, { timeout: 60000 }); // 1 minute timeout

      console.log('✅ Test run completed:', run.id, 'Status:', run.status);
      return run.status === 'SUCCEEDED';
    } catch (error) {
      console.error('❌ NEW Scraper connection test failed:', error);
      return false;
    }
  }
}

export default new InstagramApiService();
