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
    return tweets.map(tweet => {
      // Get thumbnail from media if available
      let thumbnail = '';
      if (tweet.media && tweet.media.length > 0) {
        const mediaItem = tweet.media[0];
        thumbnail = mediaItem.thumbnailUrl || mediaItem.url || '';
      }

      return {
        id: tweet.id || `tweet_${Date.now()}_${Math.random()}`,
        videoId: tweet.id || '',
        url: tweet.url || '',
        platform: 'twitter',
        thumbnail: thumbnail,
        caption: tweet.text || '',
        title: tweet.text ? tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : '') : 'Untitled Tweet',
        uploader: tweet.author?.name || '',
        uploaderHandle: tweet.author?.userName || '',
        uploadDate: tweet.createdAt ? new Date(tweet.createdAt) : new Date(),
        views: tweet.views || 0,
        likes: tweet.likes || 0,
        comments: tweet.replies || 0,
        shares: tweet.retweets || 0,
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
