/**
 * InstagramScraperService
 * 
 * Centralized service for managing all Instagram scraping operations.
 * Uses ONLY hpix~ig-reels-scraper for everything:
 * - Individual posts (post_urls)
 * - Profile data (extracted from first post)
 * - Account reels (tags with /reels/ URL)
 * 
 * This single scraper provides:
 * - Video metrics (play_count, like_count, comment_count)
 * - Profile data (username, full_name, profile_pic_url, is_verified, follower_count)
 * - Post data (id, code, caption, thumbnail_url, video_url, duration)
 */

import { runApifyActor } from '../apify-client';

// ==================== TYPES ====================

export interface InstagramProfileData {
  username: string;
  fullName: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  biography: string;
  verified: boolean;
  profilePicUrl: string;
  isPrivate: boolean;
  id: string;
}

export interface InstagramReelData {
  id: string;
  shortCode: string;
  url: string;
  caption: string;
  timestamp: string;
  videoViewCount: number;
  likeCount: number;
  commentCount: number;
  playCount: number;
  thumbnailUrl: string;
  videoUrl: string;
  ownerUsername: string;
  ownerFullName: string;
  ownerId: string;
  ownerProfilePicUrl: string;
  ownerVerified: boolean;
  ownerFollowerCount: number;
  width: number;
  height: number;
  duration: number;
}

export interface InstagramPostData {
  id: string;
  shortCode: string;
  url: string;
  caption: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  plays: number;
  thumbnailUrl: string;
  videoUrl: string;
  ownerUsername: string;
  ownerFullName: string;
  ownerProfilePicUrl: string;
  ownerVerified: boolean;
  ownerFollowerCount: number;
  ownerId: string;
  width: number;
  height: number;
  duration: number;
}

interface ProxyConfig {
  useApifyProxy: boolean;
  apifyProxyGroups: string[];
  apifyProxyCountry: string;
}

// ==================== SERVICE CLASS ====================

export class InstagramScraperService {
  private static readonly SCRAPER = 'hpix~ig-reels-scraper';

  private static readonly DEFAULT_PROXY: ProxyConfig = {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    apifyProxyCountry: 'US'
  };

  /**
   * Extract profile data from a post's raw_data.owner object
   */
  private static extractProfileFromPost(post: any): InstagramProfileData | null {
    const owner = post.raw_data?.owner;
    if (!owner) {
      console.warn('⚠️ [Instagram] No owner data in post');
      return null;
    }

    const caption = post.caption || '';
    const profilePicUrl = this.extractProfilePicUrl(owner, caption);

    return {
      username: owner.username || '',
      fullName: owner.full_name || owner.username || '',
      followersCount: owner.edge_followed_by?.count || 0,
      followsCount: owner.edge_follow?.count || 0,
      postsCount: owner.edge_owner_to_timeline_media?.count || 0,
      biography: owner.biography || '',
      verified: owner.is_verified || false,
      profilePicUrl: profilePicUrl,
      isPrivate: owner.is_private || false,
      id: owner.id || ''
    };
  }

  /**
   * Extract best video URL from video_versions array
   */
  private static extractVideoUrl(videoVersions: any[]): string {
    if (!Array.isArray(videoVersions) || videoVersions.length === 0) {
      return '';
    }
    return videoVersions[0] || '';
  }

  /**
   * Extract thumbnail URL with robust fallback chain
   */
  private static extractThumbnailUrl(item: any): string {
    const caption = item.caption || '';
    
    // 1. Top-level thumbnail_url
    if (item.thumbnail_url) return item.thumbnail_url;
    
    // 2. raw_data.thumbnail_src
    if (item.raw_data?.thumbnail_src) return item.raw_data.thumbnail_src;
    
    // 3. raw_data.display_url
    if (item.raw_data?.display_url) return item.raw_data.display_url;
    
    // 4. raw_data.display_resources (pick largest or last)
    if (item.raw_data?.display_resources && Array.isArray(item.raw_data.display_resources)) {
      const resources = item.raw_data.display_resources;
      const largest = resources.reduce((best: any, current: any) => {
        if (!best) return current;
        return (current.config_width || 0) > (best.config_width || 0) ? current : best;
      }, null);
      if (largest?.src) return largest.src;
      if (resources[resources.length - 1]?.src) return resources[resources.length - 1].src;
    }
    
    // 5. Last resort: scan caption for HTTPS image URL
    const urlMatch = caption.match(/https:\/\/[^\s]+\.(jpg|jpeg|png|webp)/i);
    return urlMatch ? urlMatch[0] : '';
  }

  /**
   * Extract profile pic URL with robust fallback chain
   */
  private static extractProfilePicUrl(owner: any, caption: string = ''): string {
    // 1. HD profile pic
    if (owner.profile_pic_url_hd) return owner.profile_pic_url_hd;
    
    // 2. Standard profile pic
    if (owner.profile_pic_url) return owner.profile_pic_url;
    
    // 3. Last resort: scan caption for profile image URL
    const profileUrlMatch = caption.match(/https:\/\/[^\s]+profile[^\s]+\.(jpg|jpeg|png)/i);
    return profileUrlMatch ? profileUrlMatch[0] : '';
  }

  /**
   * Extract view count with robust fallback chain
   */
  private static extractViewCount(item: any): number {
    return item.play_count || item.view_count || item.video_view_count || item.video_play_count || 0;
  }

  /**
   * Transform raw scraper output to InstagramReelData
   */
  private static transformToReelData(item: any): InstagramReelData {
    const owner = item.raw_data?.owner || {};
    const caption = item.caption || '';
    const videoUrl = this.extractVideoUrl(item.video_versions || []);
    const thumbnailUrl = this.extractThumbnailUrl(item);
    const profilePicUrl = this.extractProfilePicUrl(owner, caption);
    const viewCount = this.extractViewCount(item);

    return {
      id: item.id || '',
      shortCode: item.code || '',
      url: item.input || `https://www.instagram.com/reel/${item.code}/`,
      caption: caption,
      timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : '',
      videoViewCount: viewCount,
      likeCount: item.like_count || 0,
      commentCount: item.comment_count || 0,
      playCount: viewCount,
      thumbnailUrl: thumbnailUrl,
      videoUrl: videoUrl,
      ownerUsername: owner.username || '',
      ownerFullName: owner.full_name || owner.username || '',
      ownerId: owner.id || item.owner_id || '',
      ownerProfilePicUrl: profilePicUrl,
      ownerVerified: owner.is_verified || false,
      ownerFollowerCount: owner.edge_followed_by?.count || 0,
      width: item.raw_data?.dimensions?.width || 0,
      height: item.raw_data?.dimensions?.height || 0,
      duration: item.raw_data?.video_duration || item.duration || 0
    };
  }

  /**
   * Transform raw scraper output to InstagramPostData
   */
  private static transformToPostData(item: any, postUrl: string): InstagramPostData {
    const owner = item.raw_data?.owner || {};
    const caption = item.caption || '';
    const videoUrl = this.extractVideoUrl(item.video_versions || []);
    const thumbnailUrl = this.extractThumbnailUrl(item);
    const profilePicUrl = this.extractProfilePicUrl(owner, caption);
    const viewCount = this.extractViewCount(item);

    return {
      id: item.id || '',
      shortCode: item.code || this.extractShortCodeFromUrl(postUrl),
      url: postUrl,
      caption: caption,
      timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : '',
      likes: item.like_count || 0,
      comments: item.comment_count || 0,
      shares: 0, // Not provided by scraper
      plays: viewCount,
      thumbnailUrl: thumbnailUrl,
      videoUrl: videoUrl,
      ownerUsername: owner.username || '',
      ownerFullName: owner.full_name || owner.username || '',
      ownerProfilePicUrl: profilePicUrl,
      ownerVerified: owner.is_verified || false,
      ownerFollowerCount: owner.edge_followed_by?.count || 0,
      ownerId: owner.id || item.owner_id || '',
      width: item.raw_data?.dimensions?.width || 0,
      height: item.raw_data?.dimensions?.height || 0,
      duration: item.raw_data?.video_duration || item.duration || 0
    };
  }

  // ==================== 1. PROFILE DATA ====================

  /**
   * Fetch Instagram profile data by fetching one reel and extracting owner info
   * Uses: hpix~ig-reels-scraper with tags pointing to /reels/
   */
  static async fetchProfile(username: string): Promise<InstagramProfileData | null> {
    console.log(`👤 [Instagram Profile] Fetching profile for @${username}...`);
    
    try {
      const result = await runApifyActor({
        actorId: this.SCRAPER,
        input: {
          tags: [`https://www.instagram.com/${username}/reels/`],
          target: 'reels_only',
          reels_count: 1, // Only need 1 post to extract profile
          include_raw_data: true,
          custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
          proxy: this.DEFAULT_PROXY,
          maxConcurrency: 1,
          maxRequestRetries: 3,
          handlePageTimeoutSecs: 120,
          debugLog: false
        }
      });

      const items = result.items || [];
      
      if (items.length === 0) {
        console.warn(`⚠️ [Instagram Profile] No posts found for @${username} (account may be private or have no reels)`);
        return null;
      }

      const profile = this.extractProfileFromPost(items[0]);
      
      if (!profile) {
        console.warn(`⚠️ [Instagram Profile] Failed to extract profile data for @${username}`);
        return null;
      }

      console.log(`✅ [Instagram Profile] Fetched @${username}: ${profile.followersCount} followers`);
      return profile;
    } catch (error) {
      console.error(`❌ [Instagram Profile] Error fetching @${username}:`, error);
      return null;
    }
  }

  // ==================== 2. REELS SCRAPER ====================

  /**
   * Fetch multiple reels from an Instagram profile
   * Uses: hpix~ig-reels-scraper with tags pointing to /reels/
   */
  static async fetchProfileReels(
    username: string, 
    maxReels: number = 30
  ): Promise<InstagramReelData[]> {
    console.log(`📸 [Instagram Reels] Fetching ${maxReels} reels for @${username}...`);
    
    try {
      const result = await runApifyActor({
        actorId: this.SCRAPER,
        input: {
          tags: [`https://www.instagram.com/${username}/reels/`],
          target: 'reels_only',
          reels_count: maxReels,
          include_raw_data: true,
          custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
          proxy: this.DEFAULT_PROXY,
          maxConcurrency: 1,
          maxRequestRetries: 3,
          handlePageTimeoutSecs: 120,
          debugLog: false
        }
      });

      const items = result.items || [];
      console.log(`✅ [Instagram Reels] Fetched ${items.length} reels for @${username}`);

      return items.map((item: any) => this.transformToReelData(item));
    } catch (error) {
      console.error(`❌ [Instagram Reels] Error fetching reels for @${username}:`, error);
      return [];
    }
  }

  // ==================== 3. POST SCRAPER ====================

  /**
   * Fetch individual Instagram reel/post data
   * Uses: hpix~ig-reels-scraper with post_urls
   */
  static async fetchPost(postUrl: string): Promise<InstagramPostData | null> {
    console.log(`📥 [Instagram Post] Fetching post: ${postUrl}`);
    
    try {
      const result = await runApifyActor({
        actorId: this.SCRAPER,
        input: {
          post_urls: [postUrl],
          target: 'reels_only',
          reels_count: 12,
          include_raw_data: true,
          custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
          proxy: this.DEFAULT_PROXY,
          maxConcurrency: 1,
          maxRequestRetries: 3,
          handlePageTimeoutSecs: 120,
          debugLog: false
        }
      });

      const items = result.items || [];
      
      if (items.length === 0) {
        console.warn(`⚠️ [Instagram Post] No data returned for ${postUrl}`);
        return null;
      }

      const post = items[0];
      const postData = this.transformToPostData(post, postUrl);
      
      console.log(`✅ [Instagram Post] Fetched post: @${postData.ownerUsername} - ${postData.plays} views`);
      return postData;
    } catch (error) {
      console.error(`❌ [Instagram Post] Error fetching ${postUrl}:`, error);
      return null;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Extract shortcode from Instagram URL
   */
  private static extractShortCodeFromUrl(url: string): string {
    const match = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : '';
  }

  /**
   * Validate Instagram URL format
   */
  static isValidInstagramUrl(url: string): boolean {
    const instagramUrlPattern = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/;
    return instagramUrlPattern.test(url);
  }

  /**
   * Validate Instagram username format
   */
  static isValidUsername(username: string): boolean {
    const usernamePattern = /^[a-zA-Z0-9._]{1,30}$/;
    return usernamePattern.test(username);
  }

  /**
   * Build Instagram profile URL
   */
  static buildProfileUrl(username: string): string {
    return `https://www.instagram.com/${username}/`;
  }

  /**
   * Build Instagram post URL from shortcode
   */
  static buildPostUrl(shortCode: string, type: 'p' | 'reel' | 'tv' = 'reel'): string {
    return `https://www.instagram.com/${type}/${shortCode}/`;
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Fetch multiple posts in sequence (to avoid rate limits)
   */
  static async fetchPostsBatch(
    postUrls: string[],
    delayMs: number = 2000
  ): Promise<(InstagramPostData | null)[]> {
    console.log(`📦 [Instagram Batch] Fetching ${postUrls.length} posts with ${delayMs}ms delay...`);
    
    const results: (InstagramPostData | null)[] = [];
    
    for (let i = 0; i < postUrls.length; i++) {
      const url = postUrls[i];
      
      console.log(`  📥 [${i + 1}/${postUrls.length}] Fetching: ${url}`);
      
      const postData = await this.fetchPost(url);
      results.push(postData);
      
      // Delay between requests (except for last one)
      if (i < postUrls.length - 1) {
        console.log(`  ⏳ Waiting ${delayMs}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    const successCount = results.filter(r => r !== null).length;
    console.log(`✅ [Instagram Batch] Complete: ${successCount}/${postUrls.length} successful`);
    
    return results;
  }

  /**
   * Fetch profile data AND reels in one call
   * Optimized: Uses single scraper call, extracts profile from first reel
   */
  static async fetchProfileWithReels(
    username: string,
    maxReels: number = 30
  ): Promise<{
    profile: InstagramProfileData | null;
    reels: InstagramReelData[];
  }> {
    console.log(`🎯 [Instagram Full] Fetching profile + reels for @${username}...`);
    
    try {
      const result = await runApifyActor({
        actorId: this.SCRAPER,
        input: {
          tags: [`https://www.instagram.com/${username}/reels/`],
          target: 'reels_only',
          reels_count: maxReels,
          include_raw_data: true,
          custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
          proxy: this.DEFAULT_PROXY,
          maxConcurrency: 1,
          maxRequestRetries: 3,
          handlePageTimeoutSecs: 120,
          debugLog: false
        }
      });

      const items = result.items || [];
      
      if (items.length === 0) {
        console.warn(`⚠️ [Instagram Full] No posts found for @${username}`);
        return { profile: null, reels: [] };
      }

      // Extract profile from first post
      const profile = this.extractProfileFromPost(items[0]);
      
      // Transform all reels
      const reels = items.map((item: any) => this.transformToReelData(item));
      
      console.log(`✅ [Instagram Full] Complete for @${username}: ${reels.length} reels, ${profile?.followersCount || 0} followers`);
      
      return { profile, reels };
    } catch (error) {
      console.error(`❌ [Instagram Full] Error fetching profile + reels for @${username}:`, error);
      return { profile: null, reels: [] };
    }
  }
}
