import { AccountVideo } from '../types/accounts';

interface ApifyTweetData {
  id?: string;
  url?: string;
  text?: string;
  author?: {
    userName?: string;
    name?: string;
    profilePicUrl?: string;
    followers?: number;
    following?: number;
    isVerified?: boolean;
  };
  createdAt?: string;
  retweets?: number;
  likes?: number;
  replies?: number;
  views?: number;
  media?: Array<{
    type?: string;
    url?: string;
    thumbnailUrl?: string;
  }>;
  hashtags?: string[];
  mentions?: string[];
}

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ApifyDatasetResponse {
  id?: string;
  url?: string;
  text?: string;
  author?: {
    userName?: string;
    name?: string;
    profilePicUrl?: string;
    followers?: number;
    following?: number;
    isVerified?: boolean;
  };
  createdAt?: string;
  retweets?: number;
  likes?: number;
  replies?: number;
  views?: number;
  media?: Array<{
    type?: string;
    url?: string;
    thumbnailUrl?: string;
  }>;
  hashtags?: string[];
  mentions?: string[];
}

class TwitterApiService {
  private static readonly APIFY_TOKEN = 'apify_api_7wvIrJjtEH6dTZktJZAtcIGAylH7cX2jRweu';
  private static readonly ACTOR_ID = 'apidojo/tweet-scraper';
  private static readonly API_BASE = 'https://api.apify.com/v2';

  /**
   * Fetch tweets for a Twitter handle using Apify
   */
  static async fetchTweets(username: string, maxItems: number = 100): Promise<AccountVideo[]> {
    try {
      console.log(`🐦 Fetching tweets for @${username}...`);

      // Start the Apify actor run
      const runResponse = await fetch(
        `${this.API_BASE}/acts/${this.ACTOR_ID}/runs?token=${this.APIFY_TOKEN}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            twitterHandles: [username],
            maxItems: maxItems,
            sort: 'Latest',
            onlyImage: false,
            onlyVideo: false,
            onlyQuote: false,
            onlyVerifiedUsers: false,
            onlyTwitterBlue: false,
            includeSearchTerms: false,
          }),
        }
      );

      if (!runResponse.ok) {
        throw new Error(`Apify run failed: ${runResponse.statusText}`);
      }

      const runData: ApifyRunResponse = await runResponse.json();
      const runId = runData.data.id;
      const datasetId = runData.data.defaultDatasetId;

      console.log(`⏳ Waiting for Apify run ${runId} to complete...`);

      // Wait for the run to complete (poll status)
      await this.waitForRunCompletion(runId);

      // Fetch the dataset items
      console.log(`📊 Fetching dataset items from ${datasetId}...`);
      const datasetResponse = await fetch(
        `${this.API_BASE}/datasets/${datasetId}/items?token=${this.APIFY_TOKEN}`
      );

      if (!datasetResponse.ok) {
        throw new Error(`Failed to fetch dataset: ${datasetResponse.statusText}`);
      }

      const tweets: ApifyDatasetResponse[] = await datasetResponse.json();
      console.log(`✅ Fetched ${tweets.length} tweets`);

      // Transform to AccountVideo format
      return this.transformTweetsToVideos(tweets);
    } catch (error) {
      console.error('❌ Twitter API error:', error);
      throw error;
    }
  }

  /**
   * Wait for Apify run to complete
   */
  private static async waitForRunCompletion(runId: string, maxAttempts: number = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const statusResponse = await fetch(
        `${this.API_BASE}/actor-runs/${runId}?token=${this.APIFY_TOKEN}`
      );

      if (!statusResponse.ok) {
        throw new Error(`Failed to check run status: ${statusResponse.statusText}`);
      }

      const statusData: any = await statusResponse.json();
      const status = statusData.data.status;

      if (status === 'SUCCEEDED') {
        console.log('✅ Apify run completed successfully');
        return;
      }

      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Apify run ${status.toLowerCase()}`);
      }

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Apify run timeout - took too long to complete');
  }

  /**
   * Transform Apify tweet data to AccountVideo format
   */
  private static transformTweetsToVideos(tweets: ApifyDatasetResponse[]): AccountVideo[] {
    return tweets.map(tweet => {
      // Get thumbnail from media if available
      let thumbnail = '';
      if (tweet.media && tweet.media.length > 0) {
        const mediaItem = tweet.media[0];
        thumbnail = mediaItem.thumbnailUrl || mediaItem.url || '';
      }

      return {
        id: tweet.id || `tweet_${Date.now()}_${Math.random()}`,
        videoId: tweet.id,
        url: tweet.url || '',
        thumbnail: thumbnail,
        caption: tweet.text || '',
        uploadDate: tweet.createdAt ? new Date(tweet.createdAt) : new Date(),
        timestamp: tweet.createdAt,
        viewsCount: tweet.views || 0,
        likesCount: tweet.likes || 0,
        commentsCount: tweet.replies || 0,
        sharesCount: tweet.retweets || 0,
        hashtags: tweet.hashtags || [],
        mentions: tweet.mentions || [],
        rawData: tweet,
      };
    });
  }

  /**
   * Get Twitter profile information
   */
  static async getProfileInfo(username: string): Promise<{
    displayName: string;
    profilePicture: string;
    followerCount: number;
    followingCount: number;
    isVerified: boolean;
  }> {
    try {
      // Fetch a few tweets to get author info
      const tweets = await this.fetchTweets(username, 1);
      
      if (tweets.length === 0 || !tweets[0].rawData || !tweets[0].rawData.author) {
        throw new Error('Could not fetch profile information');
      }

      const author = tweets[0].rawData.author;

      return {
        displayName: author.name || username,
        profilePicture: author.profilePicUrl || '',
        followerCount: author.followers || 0,
        followingCount: author.following || 0,
        isVerified: author.isVerified || false,
      };
    } catch (error) {
      console.error('❌ Failed to fetch Twitter profile:', error);
      // Return defaults if profile fetch fails
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        isVerified: false,
      };
    }
  }
}

export default TwitterApiService;

