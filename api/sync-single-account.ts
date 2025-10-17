import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runApifyActor } from './apify-client.js';

// Initialize Firebase Admin (same as cron job)
if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ 
      credential: cert(serviceAccount as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app'
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();
const storage = getStorage();

/**
 * Download image from URL and upload to Firebase Storage
 */
async function downloadAndUploadImage(
  imageUrl: string, 
  orgId: string, 
  filename: string,
  folder: string = 'profile'
): Promise<string> {
  try {
    const isInstagram = imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn');
    console.log(`📥 Downloading ${isInstagram ? 'Instagram' : 'image'} from: ${imageUrl.substring(0, 150)}...`);
    
    // Download image with proper headers for Instagram
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site'
      }
    };
    
    // Add Referer for Instagram
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
    console.log(`🔧 Using headers:`, JSON.stringify(fetchOptions.headers, null, 2));
    
    const response = await fetch(imageUrl, fetchOptions);
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    if (!response.ok) {
      console.error(`❌ Image download failed with status ${response.status}`);
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 Downloaded ${buffer.length} bytes`);
    
    // Validate we got actual image data
    if (buffer.length < 100) {
      throw new Error(`Downloaded data too small (${buffer.length} bytes), likely not an image`);
    }
    
    // Determine content type from response or default to jpg
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    console.log(`📋 Content type: ${contentType}`);
    
    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const storagePath = `organizations/${orgId}/${folder}/${filename}`;
    const file = bucket.file(storagePath);
    
    console.log(`☁️ Uploading ${buffer.length} bytes to Firebase Storage at: ${storagePath}`);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: imageUrl
        }
      },
      public: true
    });
    
    // Make file public and get URL
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`✅ Uploaded image to Firebase Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to download/upload image:', error);
    console.log(`⚠️ Image download/upload failed for: ${imageUrl.substring(0, 100)}...`);
    
    // For Instagram, DON'T return the original URL since it expires quickly
    // Better to have no profile pic than a broken one
    if (imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn')) {
      console.log(`🚫 Instagram URL detected, returning empty string (URLs expire quickly)`);
      throw error; // Throw error so caller knows it failed
    }
    
    // For other platforms, return original URL as fallback
    console.log(`📷 Using original URL as fallback for non-Instagram: ${imageUrl.substring(0, 100)}...`);
    return imageUrl;
  }
}

/**
 * Sync Single Account - Immediately processes one account
 * Called right after user adds an account for instant feedback
 * No auth required - this is a public endpoint for better UX
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, orgId, projectId } = req.body;

  if (!accountId || !orgId || !projectId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  console.log(`⚡ Immediate sync started for account: ${accountId}`);

  try {
    const accountRef = db
      .collection('organizations')
      .doc(orgId)
      .collection('projects')
      .doc(projectId)
      .collection('trackedAccounts')
      .doc(accountId);

    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountDoc.data() as any;
    
    // Get maxVideos from account settings, default to 100 if not set
    const maxVideos = account.maxVideos || 100;
    console.log(`📊 Will scrape up to ${maxVideos} videos for @${account.username}`);

    // Update to syncing status
    await accountRef.update({
      syncStatus: 'syncing',
      syncProgress: {
        current: 10,
        total: 100,
        message: 'Starting sync...'
      }
    });

    // Fetch profile data if needed
    if (!account.displayName || account.displayName === account.username) {
      console.log(`👤 Fetching profile data for ${account.username}...`);
      
      await accountRef.update({
        displayName: account.username.charAt(0).toUpperCase() + account.username.slice(1)
      });
    }

    // Fetch videos based on platform
    let videos = [];

    if (account.platform === 'tiktok') {
      console.log(`🎵 Fetching TikTok videos for ${account.username}...`);
      
      try {
        // Call Apify directly (no HTTP proxy)
        const data = await runApifyActor({
          actorId: 'clockworks~tiktok-scraper',
          input: {
            profiles: [account.username],
            resultsPerPage: maxVideos, // Use user's preference
            proxy: {
              useApifyProxy: true
            }
          }
        });

        const tiktokVideos = data.items || [];
        console.log(`✅ Fetched ${tiktokVideos.length} TikTok videos`);
        
        // Get profile data from first video (if available)
        if (tiktokVideos.length > 0 && tiktokVideos[0]) {
          const firstVideo = tiktokVideos[0];
          const profilePictureUrl = firstVideo['authorMeta.avatar'] || firstVideo.authorMeta?.avatar || '';
          const followerCount = firstVideo['authorMeta.fans'] || firstVideo.authorMeta?.fans || 0;
          const displayName = firstVideo['authorMeta.nickName'] || firstVideo.authorMeta?.nickName || firstVideo['authorMeta.name'] || firstVideo.authorMeta?.name || account.username;
          
          // Update account profile if we have new data
          if (profilePictureUrl || followerCount > 0) {
            try {
              const profileUpdates: any = {
                displayName: displayName,
                followerCount: followerCount,
                isVerified: firstVideo['authorMeta.verified'] || firstVideo.authorMeta?.verified || false
              };
              
              // Download and upload TikTok profile pic to Firebase Storage
              if (profilePictureUrl) {
                console.log(`📸 Downloading TikTok profile pic for @${account.username}...`);
                const uploadedProfilePic = await downloadAndUploadImage(
                  profilePictureUrl,
                  orgId,
                  `tiktok_profile_${account.username}.jpg`,
                  'profile'
                );
                profileUpdates.profilePicture = uploadedProfilePic;
                console.log(`✅ TikTok profile picture uploaded to Firebase Storage`);
              }
              
              await accountRef.update(profileUpdates);
              console.log(`✅ Updated TikTok profile: ${followerCount} followers`);
            } catch (updateError) {
              console.warn('⚠️ Could not update profile:', updateError);
            }
          }
        }
        
        // Transform TikTok data to video format
        videos = tiktokVideos.map((item: any, index: number) => {
          // Handle both flat keys ("authorMeta.name") and nested objects (authorMeta.name)
          const getField = (flatKey: string, nestedPath: string[]) => {
            if (item[flatKey]) return item[flatKey];
            let obj = item;
            for (const key of nestedPath) {
              if (obj && obj[key]) obj = obj[key];
              else return null;
            }
            return obj;
          };
          
          return {
            videoId: item.id || `tiktok_${Date.now()}_${index}`,
            videoTitle: item.text || 'Untitled TikTok',
            videoUrl: item.videoUrl || item.webVideoUrl || '',
            platform: 'tiktok',
            thumbnail: getField('videoMeta.coverUrl', ['videoMeta', 'coverUrl']) || item.covers?.default || '',
            accountUsername: account.username,
            accountDisplayName: getField('authorMeta.nickName', ['authorMeta', 'nickName']) || 
                               getField('authorMeta.name', ['authorMeta', 'name']) || 
                               account.username,
            uploadDate: item.createTime ? Timestamp.fromMillis(item.createTime * 1000) : 
                       item.createTimeISO ? Timestamp.fromDate(new Date(item.createTimeISO)) : 
                       Timestamp.now(),
            views: item.playCount || item.viewCount || 0,
            likes: item.diggCount || item.likes || 0,
            comments: item.commentCount || item.comments || 0,
            shares: item.shareCount || item.shares || 0,
            caption: item.text || '',
            duration: getField('videoMeta.duration', ['videoMeta', 'duration']) || 0
          };
        });
      } catch (tiktokError) {
        console.error('TikTok fetch error:', tiktokError);
        throw tiktokError;
      }
    } else if (account.platform === 'youtube') {
      console.log(`📺 Fetching YouTube videos for ${account.username}...`);
      
      try {
        // Use YouTube API endpoint
        const response = await fetch(
          `${baseUrl}/api/youtube-channel?username=${encodeURIComponent(account.username)}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const youtubeVideos = data.videos || [];
          
          console.log(`✅ Fetched ${youtubeVideos.length} YouTube videos`);
          
          // Transform YouTube data to video format
          videos = youtubeVideos.map((video: any) => ({
            videoId: video.id || video.videoId,
            videoTitle: video.title || video.videoTitle || 'Untitled Video',
            videoUrl: video.url || video.videoUrl || `https://youtube.com/watch?v=${video.id}`,
            platform: 'youtube',
            thumbnail: video.thumbnail || '',
            accountUsername: account.username,
            accountDisplayName: video.channelTitle || account.username,
            uploadDate: video.uploadDate ? Timestamp.fromDate(new Date(video.uploadDate)) : Timestamp.now(),
            views: video.views || video.viewCount || 0,
            likes: video.likes || video.likeCount || 0,
            comments: video.comments || video.commentCount || 0,
            shares: 0,
            caption: video.description || '',
            duration: video.duration || 0
          }));
        } else {
          console.error(`YouTube API returned ${response.status}`);
        }
      } catch (youtubeError) {
        console.error('YouTube fetch error:', youtubeError);
      }
    } else if (account.platform === 'twitter') {
      console.log(`🐦 Fetching tweets for ${account.username}...`);
      
      // First, fetch profile data
      try {
        console.log(`👤 Fetching profile data for ${account.username}...`);
        const profileData = await runApifyActor({
          actorId: 'apidojo/tweet-scraper',
          input: {
            twitterHandles: [account.username],
            maxItems: 1,
            onlyVerifiedUsers: false,
          }
        });

        console.log(`📊 Profile data received`);
        const firstTweet = profileData.items?.[0];
        
        if (firstTweet?.author) {
          const profileUpdates: any = {
            displayName: firstTweet.author.name || account.username,
            followerCount: firstTweet.author.followers || 0,
            followingCount: firstTweet.author.following || 0,
            isVerified: firstTweet.author.isVerified || firstTweet.author.isBlueVerified || false
          };
          
          // Download and upload Twitter profile pic to Firebase Storage
          const profilePictureUrl = firstTweet.author.profilePicture || '';
          if (profilePictureUrl) {
            console.log(`📸 Downloading Twitter profile pic for @${account.username}...`);
            const uploadedProfilePic = await downloadAndUploadImage(
              profilePictureUrl,
              orgId,
              `twitter_profile_${account.username}.jpg`,
              'profile'
            );
            profileUpdates.profilePicture = uploadedProfilePic;
            console.log(`✅ Twitter profile picture uploaded to Firebase Storage`);
          }
          
          await accountRef.update(profileUpdates);
          console.log(`✅ Updated profile data for @${account.username}`);
        } else {
          console.warn(`⚠️ No author data found in first tweet for ${account.username}`);
        }
      } catch (profileError) {
        console.error('Profile fetch error:', profileError);
      }

      // Now fetch tweets
      console.log(`📥 Fetching tweets for ${account.username}...`);
      const tweetsData = await runApifyActor({
        actorId: 'apidojo/tweet-scraper',
        input: {
          twitterHandles: [account.username],
          maxItems: maxVideos, // Use user's preference
          sort: 'Latest',
          onlyImage: false,
          onlyVideo: false,
          onlyQuote: false,
          onlyVerifiedUsers: false,
          onlyTwitterBlue: false,
          includeSearchTerms: false,
        }
      });

      const allTweets = tweetsData.items || [];
      console.log(`📊 Total items received: ${allTweets.length}`);
      
      if (allTweets.length === 0) {
        console.warn(`⚠️ No tweets found for @${account.username}`);
      }
      
      // Filter out retweets
      const tweets = allTweets.filter((tweet: any) => !tweet.isRetweet);
      
      console.log(`📊 Fetched ${tweets.length} tweets (${allTweets.length} total, retweets filtered)`);
      
      // Transform tweets to video format
      videos = tweets.map((tweet: any, index: number) => {
        let thumbnail = '';
        if (tweet.media && tweet.media.length > 0) {
          thumbnail = tweet.media[0];
        } else if (tweet.extendedEntities?.media && tweet.extendedEntities.media.length > 0) {
          thumbnail = tweet.extendedEntities.media[0].media_url_https || '';
        }

        const tweetId = tweet.id || `tweet_${Date.now()}_${index}`;
        const tweetUrl = tweet.url || `https://twitter.com/i/status/${tweetId}`;
        const tweetText = tweet.fullText || tweet.text || '';

        return {
          videoId: tweetId,
          videoTitle: tweetText ? tweetText.substring(0, 100) + (tweetText.length > 100 ? '...' : '') : 'Untitled Tweet',
          videoUrl: tweetUrl,
          platform: 'twitter',
          thumbnail: thumbnail,
          accountUsername: account.username,
          accountDisplayName: tweet.author?.name || account.username,
          uploadDate: tweet.createdAt ? Timestamp.fromDate(new Date(tweet.createdAt)) : Timestamp.now(),
          views: tweet.viewCount || 0,
          likes: tweet.likeCount || 0,
          comments: tweet.replyCount || 0,
          shares: tweet.retweetCount || 0,
          caption: tweetText,
          duration: 0 // Twitter doesn't provide video duration
        };
      });
    } else if (account.platform === 'instagram') {
      console.log(`👤 Fetching profile data for ${account.username}...`);
      
      // STEP 1: Fetch Instagram Profile Data (for follower count)
      try {
        const profileData = await runApifyActor({
          actorId: 'apify/instagram-profile-scraper',
          input: {
            usernames: [account.username],
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
            }
          }
        });

        const profiles = profileData.items || [];
        if (profiles.length > 0) {
          const profile = profiles[0];
          console.log(`📊 Instagram profile fetched: ${profile.followersCount || 0} followers`);
          
          const profileUpdates: any = {
            displayName: profile.fullName || account.username,
            followerCount: profile.followersCount || 0,
            followingCount: profile.followsCount || 0,
            isVerified: profile.verified || false
          };

          // Download and upload Instagram profile pic to Firebase Storage
          if (profile.profilePicUrlHD || profile.profilePicUrl) {
            try {
              const profilePicUrl = profile.profilePicUrlHD || profile.profilePicUrl;
              console.log(`📸 Downloading Instagram profile pic (HD) for @${account.username}...`);
              const uploadedProfilePic = await downloadAndUploadImage(
                profilePicUrl,
                orgId,
                `instagram_profile_${account.username}.jpg`,
                'profile'
              );
              
              if (uploadedProfilePic && uploadedProfilePic.includes('storage.googleapis.com')) {
                profileUpdates.profilePicture = uploadedProfilePic;
                console.log(`✅ Instagram profile picture uploaded to Firebase Storage`);
              }
            } catch (uploadError) {
              console.error(`❌ Error uploading Instagram profile picture:`, uploadError);
            }
          }

          await accountRef.update(profileUpdates);
          console.log(`✅ Updated Instagram profile for @${account.username}:`, profileUpdates);
        }
      } catch (profileError) {
        console.error('❌ Instagram profile fetch error:', profileError);
      }

      // STEP 2: Fetch Instagram Reels/Videos
      console.log(`📸 Fetching Instagram content for ${account.username} using OFFICIAL Apify scraper...`);
      
      try {
        // Use OFFICIAL Apify Instagram Scraper (much more reliable than third-party)
        const data = await runApifyActor({
          actorId: 'apify/instagram-scraper',
          input: {
            directUrls: [`https://www.instagram.com/${account.username}/`],
            resultsType: 'posts', // Get posts/reels
            resultsLimit: maxVideos, // Use user's preference
            searchType: 'user',
            searchLimit: 1,
            addParentData: false,
            // Use residential proxies to avoid blocks
            proxy: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
            },
            // Anti-blocking measures
            maxRequestRetries: 5,
            requestHandlerTimeoutSecs: 300,
            maxConcurrency: 1
          }
        });

        const instagramItems = data.items || [];
        console.log(`✅ Official Apify scraper returned ${instagramItems.length} items`);
        
        // DEBUG: Log first item structure
        if (instagramItems.length > 0) {
          console.log('🔍 DEBUG Backend: First item structure:', {
            availableFields: Object.keys(instagramItems[0]),
            type: instagramItems[0].type,
            shortCode: instagramItems[0].shortCode,
            caption: instagramItems[0].caption,
            videoPlayCount: instagramItems[0].videoPlayCount,
            url: instagramItems[0].url
          });
        }
        
        // Transform Instagram data to video format (OFFICIAL APIFY FORMAT)
        for (const item of instagramItems) {
          // Filter for videos only (type must be "Video" and have videoPlayCount)
          const isVideo = item.type === 'Video' && (item.videoPlayCount || item.videoViewCount);
          if (!isVideo) {
            console.log(`⏭️ Skipping non-video item (type: ${item.type})`);
            continue;
          }

          const videoCode = item.shortCode || item.id;
          if (!videoCode) {
            console.warn('⚠️ Skipping item - no video code found');
            continue;
          }
          
          // Caption from official scraper field
          const caption = item.caption || item.text || item.title || '';
          
          // Upload date from timestamp (ISO string)
          const uploadDate = item.timestamp ? Timestamp.fromDate(new Date(item.timestamp)) : Timestamp.now();
          
          // Metrics
          const views = item.videoPlayCount || item.videoViewCount || 0;
          const likes = item.likesCount || 0;
          const comments = item.commentsCount || 0;
          const duration = item.videoDuration || 0;
          
          // Hashtags and mentions
          const hashtags = item.hashtags || [];
          const mentions = item.mentions || [];
          
          console.log(`✅ Backend parsing video ${videos.length + 1}: ${videoCode}, caption: ${caption ? caption.substring(0, 50) : 'NO CAPTION'}`);
          
          videos.push({
            videoId: videoCode,
            videoTitle: caption.substring(0, 100) + (caption.length > 100 ? '...' : '') || 'Instagram Reel',
            videoUrl: item.url || `https://www.instagram.com/p/${videoCode}/`,
            platform: 'instagram',
            thumbnail: item.displayUrl || '',
            accountUsername: account.username,
            accountDisplayName: item.ownerFullName || item.ownerUsername || account.username,
            uploadDate: uploadDate,
            views: views,
            likes: likes,
            comments: comments,
            shares: 0, // Instagram doesn't provide share count
            caption: caption,
            duration: duration,
            isVerified: false
          });
        }
        
        console.log(`✅ Backend processed ${videos.length} Instagram videos with captions`);
      } catch (instagramError) {
        console.error('Instagram fetch error:', instagramError);
        throw instagramError;
      }
    }

    console.log(`📊 Found ${videos.length} videos/posts`);

    // Update progress
    await accountRef.update({
      syncProgress: {
        current: 50,
        total: 100,
        message: `Saving ${videos.length} videos...`
      }
    });

    // Save videos to Firestore (BOTH locations for compatibility)
    const batch = db.batch();
    let savedCount = 0;

    for (const video of videos) {
      // Save to main videos collection (for dashboard)
      const videoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc();

      batch.set(videoRef, {
        ...video,
        orgId: orgId,
        projectId: projectId,
        trackedAccountId: accountId,
        platform: account.platform,
        dateAdded: Timestamp.now(),
        addedBy: account.syncRequestedBy || account.addedBy || 'system',
        lastRefreshed: Timestamp.now(),
        status: 'active',
        isSingular: false
      });

      // ALSO save to tracked account's videos subcollection (for real-time listener)
      const accountVideoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId)
        .collection('videos')
        .doc(video.videoId); // Use videoId as doc ID to avoid duplicates

      batch.set(accountVideoRef, {
        id: video.videoId,
        accountId: accountId,
        videoId: video.videoId,
        url: video.videoUrl,
        thumbnail: video.thumbnail,
        description: video.caption,
        caption: video.caption,
        title: video.videoTitle,
        uploadDate: video.uploadDate,
        views: video.views || 0,
        viewsCount: video.views || 0,
        likes: video.likes || 0,
        likesCount: video.likes || 0,
        comments: video.comments || 0,
        commentsCount: video.comments || 0,
        shares: video.shares || 0,
        sharesCount: video.shares || 0,
        duration: video.duration || 0,
        isSponsored: false,
        hashtags: [],
        mentions: []
      }, { merge: true }); // Use merge to avoid overwriting existing data

      savedCount++;

      // Commit in batches of 500 (Firestore limit)
      if (savedCount % 500 === 0) {
        await batch.commit();
      }
    }

    // Commit remaining
    if (savedCount % 500 !== 0) {
      await batch.commit();
    }

    // Mark as completed
    await accountRef.update({
      syncStatus: 'completed',
      lastSyncAt: Timestamp.now(),
      lastSynced: Timestamp.now(),
      lastSyncError: null,
      syncRetryCount: 0,
      syncProgress: {
        current: 100,
        total: 100,
        message: `Successfully synced ${savedCount} videos`
      }
    });

    console.log(`✅ Completed immediate sync: ${account.username} - ${savedCount} videos saved`);

    // Send email notification to user
    try {
      const userEmail = account.syncRequestedBy || account.addedBy;
      if (userEmail) {
        // Get user document to find email
        const userRef = db.collection('users').doc(userEmail);
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        
        if (userData?.email) {
          // Ensure URL has protocol (VERCEL_URL doesn't include https://)
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'https://tracker-red-zeta.vercel.app';
          
          await fetch(`${baseUrl}/api/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: userData.email,
              type: 'account_synced',
              data: {
                username: account.username,
                platform: account.platform,
                videosAdded: savedCount,
                dashboardUrl: baseUrl
              }
            })
          }).catch(err => console.error('Failed to send notification email:', err));
          
          console.log(`📧 Notification email sent to ${userData.email}`);
        }
      }
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      success: true,
      message: 'Account synced successfully',
      videosCount: savedCount,
      username: account.username
    });

  } catch (error: any) {
    console.error(`❌ Error in immediate sync:`, error);

    // Don't retry on immediate sync - cron will handle that
    // Just mark as pending so cron picks it up
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);

      await accountRef.update({
        syncStatus: 'pending',
        lastSyncError: error.message || String(error),
        syncProgress: {
          current: 0,
          total: 100,
          message: 'Queued for background sync...'
        }
      });
    } catch (updateError) {
      console.error('Failed to update account status:', updateError);
    }

    return res.status(500).json({
      success: false,
      error: error.message || String(error),
      message: 'Sync failed, queued for background retry'
    });
  }
}

