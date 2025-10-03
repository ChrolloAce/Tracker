import { AccountVideo } from '../types/accounts';

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
  private static readonly ACTOR_ID = 'apidojo/tweet-scraper';

  /**
   * Call Apify actor via serverless proxy (avoids CORS)
   */
  private static async callApifyActor(input: any): Promise<ApifyDatasetResponse[]> {
    console.log('🐦 Calling Twitter scraper via Apify proxy with input:', input);
    
    try {
      // Call the Apify proxy serverless function
      const response = await fetch('/api/apify-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: this.ACTOR_ID,
          input: input,
          action: 'run'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Apify proxy error:', response.status, errorText);
        throw new Error(`Apify proxy failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Apify proxy response received, items:', data.items?.length || 0);
      
      // The proxy returns { run: {...}, items: [...] }
      return data.items || [];
      
    } catch (error) {
      console.error('❌ Twitter API error:', error);
      throw error;
    }
  }

  /**
   * Fetch tweets for a Twitter handle using Apify
   */
  static async fetchTweets(username: string, maxItems: number = 100): Promise<AccountVideo[]> {
    try {
      console.log(`🐦 Fetching tweets for @${username}...`);

      const tweets = await this.callApifyActor({
        twitterHandles: [username],
        maxItems: maxItems,
        sort: 'Latest',
        onlyImage: false,
        onlyVideo: false,
        onlyQuote: false,
        onlyVerifiedUsers: false,
        onlyTwitterBlue: false,
        includeSearchTerms: false,
      });

      console.log(`✅ Fetched ${tweets.length} tweets`);

      // Transform to AccountVideo format
      return this.transformTweetsToVideos(tweets);
    } catch (error) {
      console.error('❌ Failed to fetch tweets:', error);
      throw error;
    }
  }

  /**
   * Transform Apify tweet data to AccountVideo format
   */
  private static transformTweetsToVideos(tweets: ApifyDatasetResponse[]): AccountVideo[] {
    return tweets.map((tweet, index) => {
      // Get thumbnail from media if available
      let thumbnail = '';
      if (tweet.media && tweet.media.length > 0) {
        const mediaItem = tweet.media[0];
        thumbnail = mediaItem.thumbnailUrl || mediaItem.url || '';
      }

      // Generate a unique ID for the tweet
      const tweetId = tweet.id || `tweet_${Date.now()}_${index}`;
      const tweetUrl = tweet.url || `https://twitter.com/i/status/${tweetId}`;
      const tweetText = tweet.text || '';

      // Log for debugging
      if (index === 0) {
        console.log(`📝 Sample tweet transformation:`, {
          original: tweet,
          tweetId,
          views: tweet.views,
          likes: tweet.likes,
          replies: tweet.replies,
          retweets: tweet.retweets
        });
      }

      return {
        id: tweetId,
        videoId: tweetId,
        url: tweetUrl,
        platform: 'twitter',
        thumbnail: thumbnail,
        caption: tweetText,
        title: tweetText ? tweetText.substring(0, 100) + (tweetText.length > 100 ? '...' : '') : 'Untitled Tweet',
        uploader: tweet.author?.name || 'Unknown',
        uploaderHandle: tweet.author?.userName || '',
        uploadDate: tweet.createdAt ? new Date(tweet.createdAt) : new Date(),
        views: tweet.views || 0,
        likes: tweet.likes || 0,
        comments: tweet.replies || 0, // Twitter calls these "replies"
        shares: tweet.retweets || 0, // Twitter calls these "retweets"
        duration: 0, // Twitter doesn't have video duration in basic data
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
      console.log(`🔍 Fetching profile info for @${username}...`);
      
      const tweets = await this.callApifyActor({
        twitterHandles: [username],
        maxItems: 1,
        onlyVerifiedUsers: false,
      });
      
      if (tweets.length === 0 || !tweets[0].author) {
        throw new Error('Could not fetch profile information');
      }

      const author = tweets[0].author;

      console.log(`✅ Profile info fetched: ${author.name} (@${author.userName})`);

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
