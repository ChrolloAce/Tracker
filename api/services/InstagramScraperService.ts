/**
 * InstagramScraperService
 * 
 * Centralized service for managing all Instagram scraping operations.
 * Handles 3 types of Instagram scrapers:
 * 1. Profile Scraper - Gets account profile data
 * 2. Reels Scraper - Fetches multiple reels from a profile
 * 3. Post Scraper - Fetches individual reel/post data
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
  private static readonly PROFILE_SCRAPER = 'apify/instagram-profile-scraper';
  private static readonly REELS_SCRAPER = 'scraper-engine~instagram-reels-scraper';
  private static readonly POST_SCRAPER = 'hpix~ig-reels-scraper';

  private static readonly DEFAULT_PROXY: ProxyConfig = {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    apifyProxyCountry: 'US'
  };

  /**
   * Get Instagram session ID from environment
   */
  private static getSessionId(): string {
    return process.env.INSTAGRAM_SESSION_ID || '';
  }

  /**
   * Build session cookies for authenticated requests
   */
  private static buildSessionCookies(sessionId: string) {
    if (!sessionId) return {};
    
    return {
      sessionCookie: sessionId,
      additionalCookies: [
        {
          name: 'sessionid',
          value: sessionId,
          domain: '.instagram.com'
        }
      ]
    };
  }

  // ==================== 1. PROFILE SCRAPER ====================

  /**
   * Fetch Instagram profile data
   * Uses: apify/instagram-profile-scraper
   */
  static async fetchProfile(username: string): Promise<InstagramProfileData | null> {
    console.log(`👤 [Instagram Profile] Fetching profile for @${username}...`);
    
    try {
      const result = await runApifyActor({
        actorId: this.PROFILE_SCRAPER,
        input: {
          usernames: [username],
          proxyConfiguration: this.DEFAULT_PROXY
        }
      });

      const profiles = result.items || [];
      
      if (profiles.length === 0) {
        console.warn(`⚠️ [Instagram Profile] No profile found for @${username}`);
        return null;
      }

      const profile = profiles[0];
      console.log(`✅ [Instagram Profile] Fetched @${username}: ${profile.followersCount || 0} followers`);

      return {
        username: profile.username || username,
        fullName: profile.fullName || username,
        followersCount: profile.followersCount || 0,
        followsCount: profile.followsCount || 0,
        postsCount: profile.postsCount || 0,
        biography: profile.biography || '',
        verified: profile.verified || false,
        profilePicUrl: profile.profilePicUrl || '',
        isPrivate: profile.private || false
      };
    } catch (error) {
      console.error(`❌ [Instagram Profile] Error fetching @${username}:`, error);
      return null;
    }
  }

  // ==================== 2. REELS SCRAPER ====================

  /**
   * Fetch multiple reels from an Instagram profile
   * Uses: scraper-engine~instagram-reels-scraper
   */
  static async fetchProfileReels(
    username: string, 
    maxReels: number = 30
  ): Promise<InstagramReelData[]> {
    console.log(`📸 [Instagram Reels] Fetching ${maxReels} reels for @${username}...`);
    
    const sessionId = this.getSessionId();
    
    try {
      const result = await runApifyActor({
        actorId: this.REELS_SCRAPER,
        input: {
          urls: [`https://www.instagram.com/${username}/`],
          sortOrder: 'newest',
          maxComments: 10,
          maxReels: maxReels,
          ...this.buildSessionCookies(sessionId),
          proxyConfiguration: this.DEFAULT_PROXY,
          maxRequestRetries: 5,
          requestHandlerTimeoutSecs: 300,
          maxConcurrency: 1
        }
      });

      const items = result.items || [];
      console.log(`✅ [Instagram Reels] Fetched ${items.length} reels for @${username}`);

      return items.map((item: any) => ({
        id: item.id || '',
        shortCode: item.shortCode || '',
        url: item.url || `https://www.instagram.com/reel/${item.shortCode}/`,
        caption: item.caption || '',
        timestamp: item.timestamp || item.takenAt || '',
        videoViewCount: item.videoViewCount || item.playCount || 0,
        likeCount: item.likesCount || item.likeCount || 0,
        commentCount: item.commentsCount || item.commentCount || 0,
        playCount: item.videoViewCount || item.playCount || 0,
        thumbnailUrl: item.displayUrl || item.thumbnailUrl || '',
        videoUrl: item.videoUrl || '',
        ownerUsername: item.ownerUsername || username,
        ownerFullName: item.ownerFullName || username,
        ownerId: item.ownerId || '',
        width: item.width || 0,
        height: item.height || 0,
        duration: item.videoDuration || 0
      }));
    } catch (error) {
      console.error(`❌ [Instagram Reels] Error fetching reels for @${username}:`, error);
      return [];
    }
  }

  // ==================== 3. POST SCRAPER ====================

  /**
   * Fetch individual Instagram reel/post data
   * Uses: hpix~ig-reels-scraper
   */
  static async fetchPost(postUrl: string): Promise<InstagramPostData | null> {
    console.log(`📥 [Instagram Post] Fetching post: ${postUrl}`);
    
    try {
      const result = await runApifyActor({
        actorId: this.POST_SCRAPER,
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
      console.log(`✅ [Instagram Post] Fetched post: ${post.play_count || 0} views`);

      return {
        id: post.id || '',
        shortCode: post.shortcode || this.extractShortCodeFromUrl(postUrl),
        url: postUrl,
        caption: post.caption?.text || post.caption || '',
        timestamp: post.taken_at_timestamp ? new Date(post.taken_at_timestamp * 1000).toISOString() : '',
        likes: post.like_count || 0,
        comments: post.comment_count || 0,
        shares: post.share_count || 0,
        plays: post.play_count || post.video_view_count || 0,
        thumbnailUrl: post.thumbnail_url || post.display_url || '',
        videoUrl: post.video_url || '',
        ownerUsername: post.owner?.username || '',
        ownerFullName: post.owner?.full_name || '',
        ownerProfilePicUrl: post.owner?.profile_pic_url || '',
        width: post.dimensions?.width || 0,
        height: post.dimensions?.height || 0,
        duration: post.video_duration || 0
      };
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
   */
  static async fetchProfileWithReels(
    username: string,
    maxReels: number = 30
  ): Promise<{
    profile: InstagramProfileData | null;
    reels: InstagramReelData[];
  }> {
    console.log(`🎯 [Instagram Full] Fetching profile + reels for @${username}...`);
    
    const [profile, reels] = await Promise.all([
      this.fetchProfile(username),
      this.fetchProfileReels(username, maxReels)
    ]);
    
    console.log(`✅ [Instagram Full] Complete for @${username}: ${reels.length} reels`);
    
    return { profile, reels };
  }
}

