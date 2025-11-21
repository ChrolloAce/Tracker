import YoutubeAccountService from '../../YoutubeAccountService';
import TwitterApiService from '../../TwitterApiService';
import FirebaseStorageService from '../../FirebaseStorageService';

/**
 * ProfileFetcher
 * 
 * Purpose: Fetch profile data from social media platforms
 * Responsibilities:
 * - Fetch Instagram, TikTok, YouTube, and Twitter profiles
 * - Download and upload profile pictures to Firebase Storage
 * - Return normalized profile data
 */
export class ProfileFetcher {
  
  /**
   * Fetch YouTube profile data
   */
  static async fetchYoutubeProfile(orgId: string, usernameOrHandle: string) {
    try {
      console.log(`🔄 Fetching YouTube channel for @${usernameOrHandle}...`);
      
      const profile = await YoutubeAccountService.fetchChannelProfile(usernameOrHandle);
      
      // Download and upload avatar to Firebase Storage if present
      let profilePicture = '';
      if (profile.profilePicture) {
        profilePicture = await FirebaseStorageService.downloadAndUpload(
          orgId,
          profile.profilePicture,
          `youtube_${usernameOrHandle}`,
          'profile'
        );
      }
      
      return {
        displayName: profile.displayName,
        profilePicture,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: profile.postCount,
        bio: profile.bio,
        isVerified: profile.isVerified,
        channelId: profile.channelId,
      };
    } catch (error) {
      console.error('❌ Failed to fetch YouTube channel:', error);
      return {
        displayName: usernameOrHandle,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
        channelId: undefined,
      };
    }
  }

  /**
   * Fetch Twitter profile data
   */
  static async fetchTwitterProfile(orgId: string, username: string) {
    try {
      console.log(`🐦 Fetching Twitter profile for @${username}...`);
      
      const profile = await TwitterApiService.getProfileInfo(username);
      console.log(`📊 Twitter profile data:`, profile);
      
      // Download and upload avatar to Firebase Storage if present
      let profilePicture = '';
      if (profile.profilePicture) {
        try {
          console.log(`🖼️ Uploading profile picture for @${username}...`);
          profilePicture = await FirebaseStorageService.downloadAndUpload(
            orgId,
            profile.profilePicture,
            `twitter_${username}`,
            'profile'
          );
          console.log(`✅ Profile picture uploaded successfully`);
        } catch (uploadError) {
          console.warn(`⚠️ Failed to upload profile picture, using original URL:`, uploadError);
          profilePicture = profile.profilePicture;
        }
      }
      
      return {
        displayName: profile.displayName,
        profilePicture,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: 0,
        bio: '',
        isVerified: profile.isVerified,
      };
    } catch (error) {
      console.error('❌ Failed to fetch Twitter profile:', error);
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    }
  }

  /**
   * Fetch Instagram profile data
   */
  static async fetchInstagramProfile(orgId: string, username: string) {
    try {
      console.log(`🔄 Fetching Instagram profile for @${username} using NEW scraper...`);
      
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      // Get Instagram session cookie from environment variable
      const sessionId = import.meta.env.VITE_INSTAGRAM_SESSION_ID || '';
      console.log('🔐 Instagram auth:', sessionId ? 'Using session cookies ✓' : '⚠️ No session cookies (may fail with 401)');
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'scraper-engine~instagram-reels-scraper',
          input: {
            urls: [`https://www.instagram.com/${username}/`],
            sortOrder: "newest",
            maxComments: 10,
            maxReels: 10,
            ...(sessionId && {
              sessionCookie: sessionId,
              additionalCookies: [
                {
                  name: 'sessionid',
                  value: sessionId,
                  domain: '.instagram.com'
                }
              ]
            }),
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
            },
            maxRequestRetries: 5,
            requestHandlerTimeoutSecs: 300,
            maxConcurrency: 1
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 NEW scraper profile API response: ${result.items?.length || 0} items`);

      if (!result.items || result.items.length === 0) {
        return {
          displayName: username,
          profilePicture: '',
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          bio: '',
          isVerified: false,
        };
      }

      const firstItem = result.items[0];
      const media = firstItem.reel_data?.media || firstItem.media || firstItem;
      
      console.log(`📊 Found ${result.items.length} videos/posts`);
      
      let profilePictureUrl = media.user?.hd_profile_pic_url_info?.url ||
                              media.owner?.hd_profile_pic_url_info?.url ||
                              media.user?.profile_pic_url ||
                              media.owner?.profile_pic_url ||
                              '';
      
      console.log(`📸 Found Instagram profile picture URL from NEW scraper (HD):`, profilePictureUrl ? 'Yes' : 'No');
      
      let profilePicture = '';
      
      if (profilePictureUrl) {
        try {
          console.log(`📥 Downloading Instagram profile picture for @${username}...`);
          profilePicture = await FirebaseStorageService.downloadAndUpload(
            orgId,
            profilePictureUrl,
            `instagram_${username}`,
            'profile'
          );
          console.log(`✅ Successfully uploaded Instagram profile picture to Firebase Storage for @${username}`);
        } catch (error) {
          console.error(`❌ Failed to upload Instagram profile picture for @${username}:`, error);
          profilePicture = profilePictureUrl;
        }
      } else {
        console.warn(`⚠️ No profile picture URL found for @${username} - will use placeholder`);
      }

      return {
        displayName: media.user?.full_name || media.owner?.full_name || username,
        profilePicture,
        followerCount: 0,
        followingCount: 0,
        postCount: result.items.length,
        bio: '',
        isVerified: media.user?.is_verified || media.owner?.is_verified || false,
      };
    } catch (error) {
      console.error('❌ Failed to fetch Instagram profile:', error);
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    }
  }

  /**
   * Fetch TikTok profile data
   */
  static async fetchTikTokProfile(orgId: string, username: string) {
    try {
      console.log(`🔄 Fetching TikTok profile for @${username}...`);
      
      const proxyUrl = `${window.location.origin}/api/apify-proxy`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: 'clockworks~tiktok-scraper',
          input: {
            profiles: [username],
            resultsPerPage: 30,
            shouldDownloadCovers: false,
            shouldDownloadVideos: false,
            shouldDownloadSubtitles: false
          },
          action: 'run'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📊 TikTok profile API response:`, result);

      if (!result.items || result.items.length === 0) {
        return {
          displayName: username,
          profilePicture: '',
          followerCount: 0,
          followingCount: 0,
          postCount: 0,
          bio: '',
          isVerified: false,
        };
      }

      let profileInfo = null;
      let videoCount = 0;
      let profilePicture = '';

      for (const item of result.items) {
        if (item.webVideoUrl || item.id) videoCount++;
        
        if (item.authorMeta || item.author) {
          const author = item.authorMeta || item.author;
          if (!profileInfo && author.name === username) {
            profileInfo = author;
            profilePicture = author.avatar || author.profilePicture || '';
            break;
          }
        }
      }

      if (profilePicture) {
        profilePicture = await FirebaseStorageService.downloadAndUpload(
          orgId,
          profilePicture,
          `tiktok_${username}`,
          'profile'
        );
      }

      return {
        displayName: profileInfo?.displayName || profileInfo?.nickname || username,
        profilePicture,
        followerCount: profileInfo?.fans || 0,
        followingCount: profileInfo?.following || 0,
        postCount: videoCount,
        bio: profileInfo?.signature || '',
        isVerified: profileInfo?.verified || false,
      };
    } catch (error) {
      console.error('❌ Failed to fetch TikTok profile:', error);
      return {
        displayName: username,
        profilePicture: '',
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        bio: '',
        isVerified: false,
      };
    }
  }

  /**
   * Main entry point - routes to platform-specific fetcher
   */
  static async fetchProfile(
    orgId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter'
  ) {
    switch (platform) {
      case 'instagram':
        return this.fetchInstagramProfile(orgId, username);
      case 'tiktok':
        return this.fetchTikTokProfile(orgId, username);
      case 'youtube':
        return this.fetchYoutubeProfile(orgId, username);
      case 'twitter':
        return this.fetchTwitterProfile(orgId, username);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

