import { InstagramVideoData } from '../types';
import LocalStorageService from './LocalStorageService';
import ApifyBrowserClient from './ApifyBrowserClient';

/**
 * InstagramReelsApiService
 * Specialized service for scraping Instagram Reels using Apify's scraper-engine~instagram-reels-scraper
 */
class InstagramReelsApiService {
  private apifyClient: ApifyBrowserClient;
  private readonly APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';
  private readonly INSTAGRAM_REELS_SCRAPER_ACTOR = 'scraper-engine/instagram-reels-scraper';
  
  constructor() {
    console.log('🎬 Initializing Instagram Reels API service with token:', this.APIFY_TOKEN ? '***' + this.APIFY_TOKEN.slice(-4) : 'No token');
    this.apifyClient = new ApifyBrowserClient(this.APIFY_TOKEN);
  }
  
  /**
   * Fetch data for a single Instagram Reel
   */
  async fetchReelData(instagramReelUrl: string): Promise<InstagramVideoData> {
    console.log('🎬 Starting Instagram Reels scraper for URL:', instagramReelUrl);
    
    if (!this.isValidInstagramReelUrl(instagramReelUrl)) {
      console.error('❌ Invalid Instagram Reel URL format:', instagramReelUrl);
      throw new Error('Invalid Instagram Reel URL format. Please use a valid Instagram reel URL.');
    }

    console.log('✅ Reel URL validation passed');
    console.log('📡 Calling Apify Instagram Reels scraper...');

    try {
      // Run the Instagram Reels scraper actor
      const run = await this.apifyClient.runActor(this.INSTAGRAM_REELS_SCRAPER_ACTOR, {
        directUrls: [instagramReelUrl],
        resultsLimit: 1,
      });

      console.log('🎯 Apify Reels scraper run completed:', run.id);
      console.log('📊 Run status:', run.status);

      if (run.status !== 'SUCCEEDED') {
        throw new Error(`Apify Reels scraper failed with status: ${run.status}`);
      }

      const items = (run as any).items || [];
      console.log('✅ Retrieved Reel items from proxy response:', items.length);

      if (!items || items.length === 0) {
        throw new Error('No data returned from Instagram Reels scraper');
      }

      const reelData = items[0];
      console.log('🎬 Raw Instagram Reel data:', reelData);

      // Transform Apify Reels data to our format
      const transformedData = await this.transformApifyReelsData(reelData, instagramReelUrl);
      
      console.log('✅ Successfully fetched Instagram Reel data:', {
        id: transformedData.id,
        username: transformedData.username,
        likes: transformedData.like_count,
        views: transformedData.view_count,
        comments: transformedData.comment_count
      });

      return transformedData;

    } catch (error) {
      console.error('❌ Apify Reels API call failed:', error);
      console.error('🔍 Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to fetch Instagram Reel data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch multiple reels from a user's profile
   */
  async fetchUserReels(username: string, limit: number = 10): Promise<InstagramVideoData[]> {
    console.log(`🎬 Fetching ${limit} reels from user: ${username}`);

    try {
      const run = await this.apifyClient.runActor(this.INSTAGRAM_REELS_SCRAPER_ACTOR, {
        usernames: [username],
        resultsLimit: limit,
      });

      if (run.status !== 'SUCCEEDED') {
        throw new Error(`Apify Reels scraper failed with status: ${run.status}`);
      }

      const items = (run as any).items || [];
      console.log(`✅ Retrieved ${items.length} reels for user ${username}`);

      const transformedReels = await Promise.all(
        items.map((reelData: any) => this.transformApifyReelsData(reelData, `https://www.instagram.com/reel/${reelData.code || reelData.pk}/`))
      );

      return transformedReels;
    } catch (error) {
      console.error('❌ Failed to fetch user reels:', error);
      throw new Error(`Failed to fetch reels for user ${username}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidInstagramReelUrl(url: string): boolean {
    const reelRegex = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels)\/[A-Za-z0-9_-]+/;
    return reelRegex.test(url);
  }

  private async transformApifyReelsData(reelData: any, originalUrl: string): Promise<InstagramVideoData> {
    console.log('🔄 Transforming Apify Reels data to our format...');
    
    // The scraper-engine/instagram-reels-scraper returns data in the "media" structure
    const media = reelData.media || reelData;
    
    // Extract ID from the data or URL as fallback
    let id = media.code || media.pk || media.id || media.strong_id__;
    if (!id) {
      // Try to extract from originalUrl as fallback
      const urlMatch = originalUrl.match(/instagram\.com\/(?:reel|reels)\/([A-Za-z0-9_-]+)/);
      id = urlMatch ? urlMatch[1] : 'unknown';
    }
    
    // Extract username - multiple possible paths
    const username = media.user?.username || media.owner?.username || media.caption?.user?.username || 'unknown_user';
    const displayName = media.user?.full_name || media.owner?.full_name || media.caption?.user?.full_name || username;
    
    // Extract caption text
    const caption = media.caption?.text || media.title || media.caption || 'No caption';
    
    // Extract metrics - this scraper provides very detailed metrics
    const likes = media.like_count || media.likes_count || 0;
    const comments = media.comment_count || media.comments_count || 0;
    const views = media.play_count || media.ig_play_count || media.view_count || media.video_view_count || 0;
    const shares = media.share_count || 0;
    
    // Extract timestamp
    const timestamp = media.taken_at 
      ? new Date(media.taken_at * 1000).toISOString() 
      : media.created_at 
      ? new Date(media.created_at * 1000).toISOString()
      : new Date().toISOString();
    
    // Extract thumbnail - multiple possible sources
    let thumbnailUrl = '';
    if (media.image_versions2?.candidates && media.image_versions2.candidates.length > 0) {
      // Get the best quality thumbnail (usually the first one)
      thumbnailUrl = media.image_versions2.candidates[0].url;
    } else if (media.display_uri) {
      thumbnailUrl = media.display_uri;
    } else if (media.thumbnail_url) {
      thumbnailUrl = media.thumbnail_url;
    }
    
    // Extract profile picture
    const profilePic = media.user?.profile_pic_url || media.owner?.profile_pic_url || media.caption?.user?.profile_pic_url || '';
    
    // Extract follower count
    const followerCount = media.user?.follower_count || media.owner?.follower_count || 0;
    
    // Download and save thumbnail locally
    let localThumbnailUrl = '';
    if (thumbnailUrl) {
      console.log('💾 Downloading reel thumbnail from:', thumbnailUrl.substring(0, 100) + '...');
      localThumbnailUrl = await this.downloadThumbnail(thumbnailUrl, id);
    } else {
      console.warn('⚠️ No thumbnail URL found in Reel data');
    }

    const transformedData: InstagramVideoData = {
      id: id,
      thumbnail_url: localThumbnailUrl || thumbnailUrl,
      caption: caption,
      username: username,
      like_count: likes,
      comment_count: comments,
      view_count: views,
      timestamp: timestamp
    };
    
    // Store additional metadata
    (transformedData as any).profile_pic_url = profilePic;
    (transformedData as any).display_name = displayName;
    (transformedData as any).follower_count = followerCount;
    (transformedData as any).share_count = shares;
    (transformedData as any).video_duration = media.video_duration || 0;
    (transformedData as any).is_verified = media.user?.is_verified || media.owner?.is_verified || false;
    (transformedData as any).play_count = views;
    (transformedData as any).ig_play_count = media.ig_play_count || views;

    console.log('✅ Reel data transformation completed:', {
      id: transformedData.id,
      username: transformedData.username,
      displayName: displayName,
      caption: transformedData.caption.substring(0, 50) + '...',
      likes: transformedData.like_count,
      comments: transformedData.comment_count,
      views: transformedData.view_count,
      shares: shares,
      uploadDate: new Date(transformedData.timestamp).toLocaleDateString(),
      thumbnail: transformedData.thumbnail_url ? '✓ Present' : '✗ Missing',
      profilePic: profilePic ? '✓ Present' : '✗ Missing',
      followers: followerCount,
      verified: (transformedData as any).is_verified ? '✓' : '✗'
    });

    return transformedData;
  }

  private async downloadThumbnail(imageUrl: string, videoId: string): Promise<string> {
    try {
      console.log('📥 Attempting to fetch reel thumbnail from:', imageUrl.substring(0, 100) + '...');
      
      const response = await fetch(imageUrl, {
        mode: 'no-cors',
        credentials: 'omit'
      }).catch(() => fetch(imageUrl));

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = blob.type || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      console.log('✅ Reel thumbnail downloaded and converted to base64');
      
      LocalStorageService.saveThumbnail(videoId, dataUrl);
      return dataUrl;
    } catch (error) {
      console.warn('⚠️ CORS blocked thumbnail download:', error instanceof Error ? error.message : 'Unknown error');
      console.log('📷 Using original Instagram URL directly');
      
      LocalStorageService.saveThumbnail(videoId, imageUrl);
      return imageUrl;
    }
  }

  loadThumbnailFromStorage(videoId: string): string | null {
    return LocalStorageService.loadThumbnail(videoId);
  }

  async testApifyConnection(): Promise<boolean> {
    console.log('🧪 Testing Apify Instagram Reels scraper connection...');
    try {
      const testUrl = 'https://www.instagram.com/reel/CyXample123/';
      console.log('🔄 Running test with URL:', testUrl);
      
      const run = await this.apifyClient.runActor(this.INSTAGRAM_REELS_SCRAPER_ACTOR, {
        directUrls: [testUrl],
        resultsLimit: 1,
      }, { timeout: 60000 });

      console.log('✅ Test run completed:', run.id, 'Status:', run.status);
      return run.status === 'SUCCEEDED';
    } catch (error) {
      console.error('❌ Apify Reels scraper connection test failed:', error);
      return false;
    }
  }
}

export default new InstagramReelsApiService();

