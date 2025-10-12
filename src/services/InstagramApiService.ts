import { InstagramVideoData } from '../types';
import LocalStorageService from './LocalStorageService';
import ApifyBrowserClient from './ApifyBrowserClient';

class InstagramApiService {
  private apifyClient: ApifyBrowserClient;
  private readonly APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';
  private readonly INSTAGRAM_SCRAPER_ACTOR = 'apify~instagram-scraper'; // Popular Instagram scraper actor
  
  constructor() {
    console.log('🔧 Initializing browser-compatible Apify client with token:', this.APIFY_TOKEN ? '***' + this.APIFY_TOKEN.slice(-4) : 'No token');
    this.apifyClient = new ApifyBrowserClient(this.APIFY_TOKEN);
  }
  
  async fetchVideoData(instagramUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Starting REAL Apify Instagram API fetch for URL:', instagramUrl);
    
    // Validate Instagram URL
    if (!this.isValidInstagramUrl(instagramUrl)) {
      console.error('❌ Invalid Instagram URL format:', instagramUrl);
      throw new Error('Invalid Instagram URL format. Please use a valid Instagram post, reel, or TV URL.');
    }

    console.log('✅ URL validation passed');
    console.log('📡 Calling Apify Instagram scraper...');

    try {
      // Run the Instagram scraper actor
      const run = await this.apifyClient.runActor(this.INSTAGRAM_SCRAPER_ACTOR, {
        directUrls: [instagramUrl],
        resultsType: 'posts',
        resultsLimit: 1,
        // Remove searchType as it's not needed for direct URLs
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
      console.log('🎬 Raw Instagram data:', instagramData);

      // Transform Apify data to our format
      const transformedData = await this.transformApifyData(instagramData, instagramUrl);
      
      console.log('✅ Successfully fetched REAL Instagram data:', {
        id: transformedData.id,
        username: transformedData.username,
        likes: transformedData.like_count,
        views: transformedData.view_count,
        comments: transformedData.comment_count
      });

      return transformedData;

    } catch (error) {
      console.error('❌ Apify API call failed:', error);
      console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to fetch Instagram data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidInstagramUrl(url: string): boolean {
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
    return instagramRegex.test(url);
  }

  private async transformApifyData(apifyData: any, originalUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Transforming Apify data to our format...');
    console.log('📋 Available fields:', Object.keys(apifyData));
    console.log('🔍 RAW APIFY DATA:', JSON.stringify(apifyData, null, 2).substring(0, 2000));
    
    // Handle media wrapper (some scrapers return { media: {...} })
    const media = apifyData.media || apifyData;
    console.log('📋 Media object keys:', Object.keys(media));
    
    // Extract ID from URL or use shortCode
    const urlMatch = originalUrl.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    const id = urlMatch ? urlMatch[1] : 
               media.code || media.shortCode || media.pk || media.id || 'unknown';

    // Try multiple possible field names for thumbnail
    let thumbnailUrl = '';
    if (media.image_versions2?.candidates && media.image_versions2.candidates.length > 0) {
      thumbnailUrl = media.image_versions2.candidates[0].url;
      console.log('📸 Found thumbnail from image_versions2');
    } else if (media.displayUrl) {
      thumbnailUrl = media.displayUrl;
    } else if (media.display_uri) {
      thumbnailUrl = media.display_uri;
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
      console.warn('⚠️ No thumbnail URL found in Apify data');
    }

    // Try multiple possible field names for username
    const username = media.user?.username || 
                    media.owner?.username || 
                    media.caption?.user?.username ||
                    media.ownerUsername || 
                    media.username || 
                    'unknown_user';
    
    // Extract caption text - handle both string and object formats
    let caption = 'No caption';
    if (typeof media.caption === 'string') {
      caption = media.caption;
    } else if (media.caption?.text) {
      caption = media.caption.text;
    } else if (media.text) {
      caption = media.text;
    } else if (media.description) {
      caption = media.description;
    }
    
    const likes = media.like_count || media.likesCount || media.likes || media.likeCount || 0;
    const comments = media.comment_count || media.commentsCount || media.comments || media.commentCount || 0;
    const views = media.play_count || media.ig_play_count || media.videoViewCount || media.videoPlayCount || media.viewCount || media.views || 0;
    
    // Handle timestamp - check for Unix timestamps (seconds)
    let timestamp = new Date().toISOString();
    if (media.taken_at) {
      timestamp = new Date(media.taken_at * 1000).toISOString();
    } else if (media.takenAt) {
      timestamp = new Date(media.takenAt * 1000).toISOString();
    } else if (media.createdTime) {
      timestamp = media.createdTime;
    } else if (media.timestamp) {
      timestamp = media.timestamp;
    }
    
    // Extract profile information - check all possible locations
    const profilePic = media.user?.profile_pic_url || 
                      media.owner?.profile_pic_url || 
                      media.caption?.user?.profile_pic_url ||
                      media.ownerProfilePicUrl || 
                      media.owner?.profilePicUrl || 
                      media.profilePicUrl || 
                      '';
    
    const displayName = media.user?.full_name || 
                       media.owner?.full_name || 
                       media.caption?.user?.full_name ||
                       media.ownerFullName || 
                       media.owner?.fullName || 
                       username;
    
    const followerCount = media.user?.follower_count || 
                         media.owner?.follower_count || 
                         media.ownerFollowersCount || 
                         media.owner?.followersCount || 
                         0;

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
      video_duration: media.video_duration || 0,
      is_verified: media.user?.is_verified || media.owner?.is_verified || false
    };

    console.log('✅ Data transformation completed with real values:', {
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
      followers: followerCount
    });
    
    console.log('🎯 Instagram Data Summary:');
    console.log('   📱 Username:', username, '(' + displayName + ')');
    console.log('   👁️ Views:', transformedData.view_count);
    console.log('   ❤️ Likes:', transformedData.like_count);
    console.log('   💬 Comments:', transformedData.comment_count);
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
    console.log('🧪 Testing Apify connection...');
    try {
      const testUrl = 'https://www.instagram.com/p/CyXample123/';
      console.log('🔄 Running test with URL:', testUrl);
      
      const run = await this.apifyClient.runActor(this.INSTAGRAM_SCRAPER_ACTOR, {
        directUrls: [testUrl],
        resultsType: 'posts',
        resultsLimit: 1,
        // Remove searchType for direct URL scraping
      }, { timeout: 60000 }); // 1 minute timeout

      console.log('✅ Test run completed:', run.id, 'Status:', run.status);
      return run.status === 'SUCCEEDED';
    } catch (error) {
      console.error('❌ Apify connection test failed:', error);
      return false;
    }
  }
}

export default new InstagramApiService();
