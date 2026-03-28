import { Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from '../../../apify-client.js';

/**
 * TwitterSyncService
 *
 * Purpose: Handle Twitter/X tweet discovery and refresh
 * Responsibilities:
 * - Discover new tweets (forward discovery, 10 most recent)
 * - Refresh existing tweets (batch refresh via startUrls)
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
    existingVideos: Map<string, any> | Set<string>,
    limit: number = 10
  ): Promise<Array<any>> {
    console.log(`🔍 [TWITTER] Forward discovery - fetching ${limit} most recent tweets...`);

    try {
      // Use gentle_cloud/twitter-tweets-scraper for account discovery
      // Fetches all tweets from an account URL
      const scraperInput = {
        start_urls: [{ url: `https://x.com/${account.username}` }],
        result_count: String(limit),
        since_date: '2020-01-01',
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      const data = await runApifyActor({
        actorId: 'gentle_cloud/twitter-tweets-scraper',
        input: scraperInput
      });

      const rawBatch = data.items || [];

      if (rawBatch.length === 0) {
        console.log(`    ⚠️ [TWITTER] No tweets returned`);
        return [];
      }

      // Deduplicate by tweet ID (scraper can return same tweets multiple times)
      const seenIds = new Set<string>();
      const batch = rawBatch.filter((tweet: any) => {
        const id = tweet.id_str || tweet.id;
        if (!id || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

      console.log(`    📦 [TWITTER] Fetched ${rawBatch.length} tweets, ${batch.length} unique after dedup`);

      // Filter out existing tweets
      const newTweets: any[] = [];
      let foundDuplicate = false;

      for (const tweet of batch) {
        const tweetId = tweet.id_str || tweet.id;
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
          console.error(`    ❌ [TWITTER] Failed to normalize tweet ${tweet.id_str || tweet.id}:`, err.message);
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
   * Uses startUrls with individual tweet URLs to fetch updated metrics.
   * Processes in batches of 10 to avoid overwhelming the Apify actor.
   *
   * @param account - Tracked account object
   * @param orgId - Organization ID
   * @param existingVideoIds - Array of existing tweet IDs to refresh
   * @returns Array of refreshed tweet data
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
      // The apidojo/tweet-scraper actor only supports 1 startUrl per run.
      // Process tweets one at a time, running up to 5 in parallel for speed.
      const CONCURRENCY = 5;
      const normalizedTweets: any[] = [];
      let totalRefreshed = 0;
      let failedCount = 0;

      for (let i = 0; i < existingVideoIds.length; i += CONCURRENCY) {
        const batchIds = existingVideoIds.slice(i, i + CONCURRENCY);
        console.log(`    📦 [TWITTER] Refreshing tweets ${i + 1}-${i + batchIds.length} of ${existingVideoIds.length}...`);

        const results = await Promise.allSettled(
          batchIds.map(async (id) => {
            const tweetUrl = `https://x.com/${account.username}/status/${id}`;
            const refreshData = await runApifyActor({
              actorId: 'apidojo/tweet-scraper',
              input: {
                startUrls: [tweetUrl],
                maxItems: 1,
                sort: 'Latest',
                proxy: {
                  useApifyProxy: true,
                  apifyProxyGroups: ['RESIDENTIAL']
                }
              }
            });
            return refreshData.items || [];
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            for (const tweet of result.value) {
              try {
                const normalized = this.normalizeVideoData(tweet, account);
                normalizedTweets.push(normalized);
                totalRefreshed++;
              } catch (err: any) {
                console.error(`    ❌ [TWITTER] Failed to normalize refreshed tweet:`, err.message);
              }
            }
          } else if (result.status === 'rejected') {
            failedCount++;
          }
        }
      }

      console.log(`    ✅ [TWITTER] Refreshed ${totalRefreshed}/${existingVideoIds.length} existing tweets${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
      return normalizedTweets;
    } catch (error: any) {
      console.error(`❌ [TWITTER] Refresh failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get Twitter profile data
   * Uses gentle_cloud/twitter-tweets-scraper to fetch 1 tweet and extract profile from it
   */
  static async getProfile(username: string): Promise<any> {
    console.log(`👤 [TWITTER] Fetching profile data for ${username}...`);
    try {
      const profileData = await runApifyActor({
        actorId: 'gentle_cloud/twitter-tweets-scraper',
        input: {
          start_urls: [{ url: `https://x.com/${username}` }],
          result_count: '1',
          since_date: '2020-01-01',
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        }
      });

      const firstTweet = profileData.items?.[0];

      if (!firstTweet) return null;

      // Handle new format (gentle_cloud) - user data in tweet.user
      if (firstTweet.user) {
        const legacy = firstTweet.user.legacy || {};
        return {
          displayName: legacy.name || firstTweet.user.name || username,
          followersCount: legacy.followers_count || 0,
          followingCount: legacy.following_count || legacy.friends_count || 0,
          isVerified: firstTweet.user.is_blue_verified || false,
          profilePicUrl: firstTweet.user.avatar?.image_url || legacy.profile_image_url_https || ''
        };
      }

      // Handle old format (apidojo) - author data
      if (firstTweet.author) {
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
   * Handles both old format (apidojo/tweet-scraper) and new format (gentle_cloud/twitter-tweets-scraper)
   */
  private static normalizeVideoData(
    tweet: any,
    account: { username: string; id: string }
  ): any {
    // Detect format: new format has id_str, old format has id
    const isNewFormat = !!tweet.id_str;

    // Extract tweet ID
    const tweetId = tweet.id_str || tweet.id;

    // Extract text
    const tweetText = tweet.full_text || tweet.text || '';

    // Extract ALL media URLs (images/videos)
    let mediaUrls: string[] = [];
    let thumbnail = '';

    if (isNewFormat) {
      // New format: entities.media or extended_entities.media
      const mediaArray = tweet.extended_entities?.media || tweet.entities?.media || [];
      mediaUrls = mediaArray
        .map((m: any) => m.media_url_https || m.media_url)
        .filter((url: string) => url);
      thumbnail = mediaUrls[0] || '';
    } else if (tweet.extendedEntities?.media && tweet.extendedEntities.media.length > 0) {
      // Old format: extendedEntities.media
      mediaUrls = tweet.extendedEntities.media
        .map((m: any) => m.media_url_https || m.media_url)
        .filter((url: string) => url);
      thumbnail = mediaUrls[0] || '';
    } else if (tweet.photos && tweet.photos.length > 0) {
      mediaUrls = tweet.photos.filter((url: string) => url);
      thumbnail = mediaUrls[0] || '';
    }

    // Parse upload date
    let uploadTimestamp: FirebaseFirestore.Timestamp;
    if (tweet.created_at) {
      uploadTimestamp = Timestamp.fromDate(new Date(tweet.created_at));
    } else if (tweet.createdAt) {
      uploadTimestamp = Timestamp.fromDate(new Date(tweet.createdAt));
    } else if (tweet.timestamp) {
      uploadTimestamp = Timestamp.fromDate(new Date(tweet.timestamp));
    } else {
      console.warn(`    ⚠️ [TWITTER] Tweet ${tweetId} missing date - using current time as fallback`);
      uploadTimestamp = Timestamp.now();
    }

    // Extract display name from profile data
    const displayName = tweet.user?.legacy?.name
      || tweet.user?.name
      || tweet.author?.name
      || account.username;

    // Extract profile picture URL
    const profilePicUrl = tweet.user?.avatar?.image_url
      || tweet.user?.legacy?.profile_image_url_https
      || tweet.author?.profilePicture
      || '';

    return {
      videoId: tweetId,
      videoTitle: tweetText.substring(0, 100) || 'Untitled Tweet',
      videoUrl: tweet.url || `https://twitter.com/${account.username}/status/${tweetId}`,
      platform: 'twitter',
      thumbnail: thumbnail,
      media: mediaUrls,
      accountUsername: account.username,
      accountDisplayName: displayName,
      profilePicUrl: profilePicUrl,
      uploadDate: uploadTimestamp,
      views: (isNewFormat ? parseInt(tweet.views_count, 10) || 0 : null) ?? tweet.viewCount ?? tweet.views ?? 0,
      likes: tweet.favorite_count ?? tweet.likeCount ?? tweet.favoriteCount ?? tweet.likes ?? 0,
      comments: tweet.reply_count ?? tweet.replyCount ?? tweet.replies ?? 0,
      shares: tweet.retweet_count ?? tweet.retweetCount ?? tweet.retweets ?? 0,
      saves: tweet.bookmark_count ?? tweet.bookmarkCount ?? tweet.bookmarks ?? 0,
      caption: tweetText,
      duration: 0,
      mediaUrl: (() => {
        // Extract highest quality video variant - handle both formats
        const media = isNewFormat
          ? (tweet.extended_entities?.media?.[0] || tweet.entities?.media?.[0])
          : tweet.extendedEntities?.media?.[0];
        const variants = media?.video_info?.variants?.filter((v: any) => v.content_type === 'video/mp4') || [];
        const best = variants.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        return best?.url || media?.video_url || tweet.video_url || '';
      })(),
    };
  }
}
