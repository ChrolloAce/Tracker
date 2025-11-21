import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import TwitterApiService from '../../TwitterApiService';
import FirebaseStorageService from '../../FirebaseStorageService';
import { DateFilterService } from '../shared/DateFilterService';

/**
 * TwitterDiscoveryService
 * 
 * Purpose: Fetch and process Twitter tweets
 * Responsibilities:
 * - Fetch latest tweets using Twitter API (via Apify)
 * - Separate new vs existing tweets
 * - Apply date-based filtering
 * - Upload thumbnails for new tweets only
 */
export class TwitterDiscoveryService {
  
  /**
   * Fetch tweets and separate into new vs existing
   * Twitter doesn't batch refresh - it fetches latest and updates everything
   */
  static async fetchAndProcessTweets(
    orgId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>,
    oldestVideoDate: Date | null = null,
    maxTweets: number = 10
  ): Promise<{ newVideos: AccountVideo[], updatedVideos: AccountVideo[] }> {
    const newVideos: AccountVideo[] = [];
    const updatedVideos: AccountVideo[] = [];
    
    console.log(`🔍 [Twitter] Fetching latest ${maxTweets} tweets for @${account.username}...`);
    const tweets = await TwitterApiService.fetchTweets(account.username, maxTweets);
    console.log(`📦 [Twitter] API returned ${tweets.length} tweets`);

    if (tweets.length === 0) {
      console.warn(`⚠️ [Twitter] No tweets found for @${account.username}`);
      return { newVideos, updatedVideos };
    }

    // Process tweets
    for (const tweet of tweets) {
      const videoId = tweet.videoId || '';
      const isExisting = existingVideoIds.has(videoId);
      
      // SKIP if this is a new tweet but older than our oldest video
      if (!isExisting) {
        const tweetDate = tweet.uploadDate ? new Date(tweet.uploadDate) : null;
        if (DateFilterService.shouldSkipVideo(tweetDate, oldestVideoDate)) {
          console.log(`   ⏭️  Skipping old tweet: ${videoId}`);
          continue;
        }
      }
      
      let uploadedThumbnail = tweet.thumbnail || '';
      
      // Log tweet data for debugging
      console.log(`📝 [Twitter] Processing tweet ${videoId}:`, {
        url: tweet.url,
        views: tweet.views,
        likes: tweet.likes,
        comments: tweet.comments,
        shares: tweet.shares,
        hasThumbnail: !!tweet.thumbnail,
        isExisting
      });
      
      // ONLY upload thumbnail for NEW tweets
      if (!isExisting && tweet.thumbnail) {
        try {
          console.log(`📸 Uploading thumbnail for NEW tweet: ${videoId}`);
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            tweet.thumbnail,
            `twitter_${videoId}`,
            'thumbnail'
          );
          console.log(`✅ Twitter thumbnail uploaded to Firebase Storage for tweet ${videoId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to upload Twitter thumbnail for ${videoId}, using original URL:`, error);
          uploadedThumbnail = tweet.thumbnail;
        }
      } else if (isExisting) {
        console.log(`✅ Keeping existing thumbnail for Twitter tweet: ${videoId}`);
        uploadedThumbnail = ''; // Don't overwrite existing thumbnail
      } else if (!tweet.thumbnail) {
        console.warn(`⚠️ Twitter tweet ${videoId} has no thumbnail`);
      }

      const video: AccountVideo = {
        ...tweet,
        id: `${account.id}_${videoId}`,
        accountId: account.id,
        thumbnail: uploadedThumbnail,
        platform: 'twitter'
      };

      // Separate into new vs existing
      if (isExisting) {
        console.log(`   ♻️  Tweet ${videoId} already exists - updating metrics`);
        updatedVideos.push(video);
      } else {
        console.log(`   ✨ Tweet ${videoId} is NEW - will be added`);
        newVideos.push(video);
      }
    }

    console.log(`📊 [Twitter] Processing complete: ${newVideos.length} new tweets, ${updatedVideos.length} updated tweets`);
    
    return { newVideos, updatedVideos };
  }
}

