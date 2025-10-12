import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

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

  // Define base URL for API calls
  const baseUrl = process.env.VERCEL_URL 
    ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`)
    : 'https://tracker-red-zeta.vercel.app';

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
            resultsPerPage: 100,
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
          const profilePicture = firstVideo['authorMeta.avatar'] || firstVideo.authorMeta?.avatar || '';
          const followerCount = firstVideo['authorMeta.fans'] || firstVideo.authorMeta?.fans || 0;
          const displayName = firstVideo['authorMeta.nickName'] || firstVideo.authorMeta?.nickName || firstVideo['authorMeta.name'] || firstVideo.authorMeta?.name || account.username;
          
          // Update account profile if we have new data
          if (profilePicture || followerCount > 0) {
            try {
              await accountRef.update({
                displayName: displayName,
                profilePicture: profilePicture,
                followerCount: followerCount,
                isVerified: firstVideo['authorMeta.verified'] || firstVideo.authorMeta?.verified || false
              });
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
            caption: item.text || ''
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
            caption: video.description || ''
          }));
        } else {
          console.error(`YouTube API returned ${response.status}`);
        }
      } catch (youtubeError) {
        console.error('YouTube fetch error:', youtubeError);
      }
    } else if (account.platform === 'instagram') {
      console.log(`🎬 Fetching Instagram reels for ${account.username}...`);
      
      try {
        // Use Instagram Reels scraper
        const instagramData = await runApifyActor({
          actorId: 'scraper-engine/instagram-reels-scraper',
          input: {
            usernames: [account.username],
            resultsLimit: 20, // Get last 20 reels
          }
        });

        const reels = instagramData.items || [];
        console.log(`✅ Fetched ${reels.length} Instagram reels`);

        // Update profile with first reel data
        if (reels.length > 0) {
          const firstReel = reels[0];
          const media = firstReel.media || firstReel;
          
          try {
            await accountRef.update({
              displayName: media.user?.full_name || media.owner?.full_name || media.caption?.user?.full_name || account.username,
              profilePicture: media.user?.profile_pic_url || media.owner?.profile_pic_url || media.caption?.user?.profile_pic_url || '',
              followerCount: media.user?.follower_count || media.owner?.follower_count || 0,
              isVerified: media.user?.is_verified || media.owner?.is_verified || false,
              lastSyncedAt: Timestamp.now()
            });
            console.log(`✅ Updated Instagram profile for @${account.username}`);
          } catch (updateError) {
            console.warn('⚠️ Could not update profile:', updateError);
          }
        }

        // Transform Instagram reels to video format
        videos = reels.map((reelData: any, index: number) => {
          const media = reelData.media || reelData;
          
          // Extract reel ID
          const reelId = media.code || media.pk || media.id || media.strong_id__ || `instagram_${Date.now()}_${index}`;
          
          // Extract metrics
          const views = media.play_count || media.ig_play_count || 0;
          const likes = media.like_count || 0;
          const comments = media.comment_count || 0;
          const shares = media.share_count || 0;
          
          // Extract caption
          const caption = media.caption?.text || media.title || '';
          
          // Extract timestamp
          const uploadDate = media.taken_at 
            ? Timestamp.fromMillis(media.taken_at * 1000)
            : Timestamp.now();
          
          // Extract thumbnail
          let thumbnail = '';
          if (media.image_versions2?.candidates && media.image_versions2.candidates.length > 0) {
            thumbnail = media.image_versions2.candidates[0].url;
          } else if (media.display_uri) {
            thumbnail = media.display_uri;
          }

          return {
            videoId: reelId,
            videoTitle: caption.substring(0, 100) || 'Instagram Reel',
            videoUrl: `https://www.instagram.com/reel/${reelId}/`,
            platform: 'instagram',
            thumbnail: thumbnail,
            accountUsername: account.username,
            accountDisplayName: media.user?.full_name || media.owner?.full_name || account.username,
            uploadDate: uploadDate,
            views: views,
            likes: likes,
            comments: comments,
            shares: shares,
            caption: caption,
            videoDuration: media.video_duration || 0,
            isVerified: media.user?.is_verified || media.owner?.is_verified || false
          };
        });
      } catch (instagramError) {
        console.error('Instagram fetch error:', instagramError);
        throw instagramError;
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
          await accountRef.update({
            displayName: firstTweet.author.name || account.username,
            profilePicture: firstTweet.author.profilePicture || '',
            followerCount: firstTweet.author.followers || 0,
            followingCount: firstTweet.author.following || 0,
            isVerified: firstTweet.author.isVerified || firstTweet.author.isBlueVerified || false
          });
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
          maxItems: 100,
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
          caption: tweetText
        };
      });
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

    // Save videos to Firestore
    const batch = db.batch();
    let savedCount = 0;

    for (const video of videos) {
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
          // Ensure URL has https:// protocol
          const vercelUrl = process.env.VERCEL_URL 
            ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`)
            : 'https://tracker-red-zeta.vercel.app';
          
          await fetch(`${vercelUrl}/api/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: userData.email,
              type: 'account_synced',
              data: {
                username: account.username,
                platform: account.platform,
                videosAdded: savedCount,
                dashboardUrl: 'https://tracker-red-zeta.vercel.app'
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

