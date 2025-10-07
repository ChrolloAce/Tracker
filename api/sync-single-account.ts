import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { runApifyActor } from './apify-client';

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
        
        // Transform TikTok data to video format
        videos = tiktokVideos.map((item: any, index: number) => ({
          videoId: item.id || `tiktok_${Date.now()}_${index}`,
          videoTitle: item.text || 'Untitled TikTok',
          videoUrl: item.videoUrl || item.webVideoUrl || '',
          platform: 'tiktok',
          thumbnail: item.videoMeta?.coverUrl || item.covers?.default || '',
          accountUsername: account.username,
          accountDisplayName: item.authorMeta?.name || account.username,
          uploadDate: item.createTime ? Timestamp.fromMillis(item.createTime * 1000) : Timestamp.now(),
          views: item.playCount || item.viewCount || 0,
          likes: item.diggCount || item.likes || 0,
          comments: item.commentCount || item.comments || 0,
          shares: item.shareCount || item.shares || 0,
          caption: item.text || ''
        }));
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

