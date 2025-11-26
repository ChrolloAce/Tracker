import { Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from '../../../apify-client.js';

/**
 * TwitterSyncService
 * 
 * Purpose: Handle Twitter/X tweet discovery and refresh
 * Responsibilities:
 * - Discover new tweets (forward discovery, 10 most recent)
 * - Refresh existing tweets (batch refresh not supported - Twitter limits)
 * - Include ALL tweets (text, images, videos) - not just videos
 * - Exclude retweets AND replies using advanced search filters
 * - Normalize tweet data format
 */
export class TwitterSyncService {
  /**
   * Discover new tweets (forward discovery)
   * Fetches the 10 most recent tweets and returns only NEW ones
   * Includes ALL tweet types (text, images, videos)
   * 
   * @param account - Tracked account object
   * @param orgId - Organization ID
   * @param existingVideos - Map of existing tweet IDs
   * @returns Array of new tweet data
   */
  static async discovery(
    account: { username: string; id: string },
    orgId: string,
    existingVideos: Map<string, any>,
    limit: number = 10
  ): Promise<Array<any>> {
    console.log(`🔍 [TWITTER] Forward discovery - fetching ${limit} most recent tweets...`);
    
    try {
      // Use advanced search to exclude retweets AND replies
      // searchTerms: "from:username -filter:nativeretweets -filter:replies"
      const scraperInput = {
        searchTerms: [`from:${account.username} -filter:nativeretweets -filter:replies`],
        maxItems: limit,
        onlyVideo: false, // Include ALL tweets (text, images, videos)
        onlyVerifiedUsers: false,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };
      
      const data = await runApifyActor({
        actorId: 'apidojo/tweet-scraper',
        input: scraperInput
      });

      const batch = data.items || [];
      
      if (batch.length === 0) {
        console.log(`    ⚠️ [TWITTER] No tweets returned`);
        return [];
      }
      
      console.log(`    📦 [TWITTER] Fetched ${batch.length} tweets from Apify`);
      
      // Filter out existing tweets
      const newTweets: any[] = [];
      let foundDuplicate = false;
      
      for (const tweet of batch) {
        const tweetId = tweet.id;
        if (!tweetId) continue;
        
        if (existingVideos.has(tweetId)) {
          console.log(`    ✓ [TWITTER] Found duplicate: ${tweetId} - stopping discovery`);
          foundDuplicate = true;
          break;
        }
        
        newTweets.push(tweet);
      }
      
      console.log(`    📊 [TWITTER] Discovered ${newTweets.length} new tweets${foundDuplicate ? ' (stopped at duplicate)' : ''}`);
      
      // Normalize tweets
      const normalizedTweets: any[] = [];
      
      for (const tweet of newTweets) {
        try {
          const normalized = this.normalizeVideoData(tweet, account);
          normalizedTweets.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [TWITTER] Failed to normalize tweet ${tweet.id}:`, err.message);
        }
      }
      
      return normalizedTweets;
    } catch (error: any) {
      console.error(`❌ [TWITTER] Discovery failed:`, error.message);
      throw error;
    }
  }
  
  /**
   * Refresh existing tweets (batch refresh)
   * NOTE: Twitter API limitations make batch refresh expensive/unreliable
   * For now, we rely on discovery to update metrics
   * 
   * @param account - Tracked account object
   * @param orgId - Organization ID
   * @param existingVideoIds - Array of existing tweet IDs to refresh
   * @returns Array of refreshed tweet data (empty for now)
   */
  static async refresh(
    account: { username: string; id: string },
    orgId: string,
    existingVideoIds: string[]
  ): Promise<Array<any>> {
    if (existingVideoIds.length === 0) {
      console.log(`    ℹ️ [TWITTER] No existing tweets to refresh`);
      return [];
    }
    
    console.log(`🔄 [TWITTER] Refreshing ${existingVideoIds.length} existing tweets...`);
    
    try {
      const refreshData = await runApifyActor({
        actorId: 'apidojo/tweet-scraper',
        input: {
          tweetIds: existingVideoIds,
          sort: 'Latest'
        }
      });
      
      const refreshedTweets = refreshData.items || [];
      console.log(`    ✅ [TWITTER] Refreshed ${refreshedTweets.length} existing tweets`);
      
      // Normalize refreshed tweets
      const normalizedTweets: any[] = [];
      
      for (const tweet of refreshedTweets) {
        try {
          const normalized = this.normalizeVideoData(tweet, account);
          normalizedTweets.push(normalized);
        } catch (err: any) {
          console.error(`    ❌ [TWITTER] Failed to normalize refreshed tweet:`, err.message);
        }
      }
      
      return normalizedTweets;
    } catch (error: any) {
      console.error(`❌ [TWITTER] Refresh failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get Twitter profile data
   */
  static async getProfile(username: string): Promise<any> {
    console.log(`👤 [TWITTER] Fetching profile data for ${username}...`);
    try {
      const profileData = await runApifyActor({
        actorId: 'apidojo/tweet-scraper',
        input: {
          twitterHandles: [username],
          maxItems: 1,
          onlyVerifiedUsers: false,
        }
      });

      const firstTweet = profileData.items?.[0];
      
      if (firstTweet?.author) {
        return {
          displayName: firstTweet.author.name,
          followersCount: firstTweet.author.followers || 0,
          followingCount: firstTweet.author.following || 0,
          isVerified: firstTweet.author.isVerified || firstTweet.author.isBlueVerified || false,
          profilePicUrl: firstTweet.author.profilePicture
        };
      }
      return null;
    } catch (error: any) {
      console.error(`❌ [TWITTER] Profile fetch failed:`, error.message);
      return null;
    }
  }
  
  /**
   * Normalize Twitter tweet data to standard format
   */
  private static normalizeVideoData(
    tweet: any,
    account: { username: string; id: string }
  ): any {
    // Extract ALL media URLs (images/videos)
    let mediaUrls: string[] = [];
    let thumbnail = '';
    
    if (tweet.extendedEntities?.media && tweet.extendedEntities.media.length > 0) {
      mediaUrls = tweet.extendedEntities.media
        .map((m: any) => m.media_url_https || m.media_url)
        .filter((url: string) => url); // Get all media URLs
      thumbnail = mediaUrls[0] || ''; // First image as thumbnail
    } else if (tweet.photos && tweet.photos.length > 0) {
      mediaUrls = tweet.photos.filter((url: string) => url);
      thumbnail = mediaUrls[0] || '';
    }
    
    // Parse upload date
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (tweet.createdAt) {
      uploadTimestamp = Timestamp.fromDate(new Date(tweet.createdAt));
    } else {
      console.warn(`    ⚠️ [TWITTER] Tweet ${tweet.id} missing createdAt - using epoch`);
      uploadTimestamp = Timestamp.fromMillis(0);
    }
    
    return {
      videoId: tweet.id,
      videoTitle: (tweet.text || '').substring(0, 100) || 'Untitled Tweet',
      videoUrl: tweet.url || `https://twitter.com/${account.username}/status/${tweet.id}`,
      platform: 'twitter',
      thumbnail: thumbnail,
      media: mediaUrls, // ✅ Store ALL media URLs for slideshow
      accountUsername: account.username,
      accountDisplayName: tweet.author?.name || account.username,
      uploadDate: uploadTimestamp,
      views: tweet.viewCount || 0,
      likes: tweet.likeCount || 0,
      comments: tweet.replyCount || 0,
      shares: tweet.retweetCount || 0,
      saves: tweet.bookmarkCount || 0,
      caption: tweet.text || '',
      duration: 0 // Twitter doesn't provide video duration easily
    };
  }
}

