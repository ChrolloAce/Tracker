import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Cron Job - Syncs pending accounts in the background
 * Runs every 5 minutes
 * 
 * This processes accounts that have syncStatus='pending' and fetches
 * their videos without blocking the UI
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('🚀 Cron job started: sync-accounts');

  // Verify cron secret for security
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    const { getStorage } = await import('firebase-admin/storage');

    if (getApps().length === 0) {
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
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
      });
    }

    const db = getFirestore();
    const storage = getStorage();

    // Find pending accounts (limit to 5 per run to avoid timeout)
    const accountsSnapshot = await db
      .collectionGroup('trackedAccounts')
      .where('syncStatus', '==', 'pending')
      .where('syncRetryCount', '<', 3)
      .limit(5)
      .get();

    console.log(`📋 Found ${accountsSnapshot.size} accounts to sync`);

    if (accountsSnapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No accounts to sync',
        processed: 0
      });
    }

    const results = [];

    // Process each account
    for (const doc of accountsSnapshot.docs) {
      const accountId = doc.id;
      const account = doc.data();
      const accountRef = doc.ref;

      console.log(`🔄 Processing account: ${account.username} (${account.platform})`);

      try {
        // Mark as syncing
        await accountRef.update({
          syncStatus: 'syncing',
          syncProgress: {
            current: 0,
            total: 100,
            message: 'Fetching videos...'
          }
        });

        // Step 1: Fetch and update profile data (if not already set)
        if (!account.displayName || account.displayName === account.username) {
          console.log(`👤 Fetching profile data for ${account.username}...`);
          
          // For now, just update displayName to be capitalized username
          // In the future, we could fetch full profile data via API
          await accountRef.update({
            displayName: account.username.charAt(0).toUpperCase() + account.username.slice(1)
          });
        }

        // Step 2: Fetch videos based on platform
        let videos = [];
        let videosFetched = 0;

        if (account.platform === 'tiktok') {
          const response = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app'}/api/youtube-video?username=${encodeURIComponent(account.username)}&platform=tiktok`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            
            // Check for error response in JSON
            if (data.error === true || data.noResults === true) {
              const errorMessage = data.message || 'Unknown error from TikTok scraper';
              console.error(`❌ TikTok scraper error for @${account.username}:`, errorMessage);
              
              await accountRef.update({
                syncStatus: 'failed',
                lastSyncError: errorMessage,
                syncProgress: {
                  current: 100,
                  total: 100,
                  message: `Failed: ${errorMessage}`
                }
              });
              
              results.push({
                accountId,
                username: account.username,
                status: 'failed',
                error: errorMessage,
                videosCount: 0
              });
              continue;
            }
            
            videos = data.videos || [];
            videosFetched = videos.length;
          } else {
            throw new Error(`API returned ${response.status}: ${await response.text()}`);
          }
        } else if (account.platform === 'youtube') {
          // YouTube logic (similar to TikTok)
          const response = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app'}/api/youtube-video?username=${encodeURIComponent(account.username)}&platform=youtube`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            
            // Check for error response in JSON
            if (data.error === true || data.noResults === true) {
              const errorMessage = data.message || 'Unknown error from YouTube scraper';
              console.error(`❌ YouTube scraper error for @${account.username}:`, errorMessage);
              
              await accountRef.update({
                syncStatus: 'failed',
                lastSyncError: errorMessage,
                syncProgress: {
                  current: 100,
                  total: 100,
                  message: `Failed: ${errorMessage}`
                }
              });
              
              results.push({
                accountId,
                username: account.username,
                status: 'failed',
                error: errorMessage,
                videosCount: 0
              });
              continue;
            }
            
            videos = data.videos || [];
            videosFetched = videos.length;
          }
        } else if (account.platform === 'instagram') {
          // Instagram logic
          console.log(`⚠️  Instagram sync not yet implemented for ${account.username}`);
        } else if (account.platform === 'twitter') {
          // Twitter/X logic via Apify
          console.log(`🐦 Fetching tweets for @${account.username}...`);
          
          try {
            // First, fetch profile data if needed
            if (!account.displayName || account.displayName === account.username || !account.profilePicture) {
              console.log(`👤 Fetching profile data for ${account.username}...`);
              const profileResponse = await fetch(
                `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/apify-proxy`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    actorId: 'apidojo/tweet-scraper',
                    input: {
                      twitterHandles: [account.username],
                      maxItems: 1,
                      onlyVerifiedUsers: false,
                    },
                    action: 'run'
                  })
                }
              );

              console.log(`📡 Profile response status: ${profileResponse.status}`);

              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                console.log(`📊 Profile data received:`, JSON.stringify(profileData).substring(0, 500));
                
                // Check for error in profile response
                if (profileData.error === true || profileData.noResults === true) {
                  const errorMessage = profileData.message || 'Could not fetch profile data';
                  console.error(`❌ Profile scraper error for @${account.username}:`, errorMessage);
                  
                  await accountRef.update({
                    syncStatus: 'failed',
                    lastSyncError: errorMessage,
                    syncProgress: {
                      current: 100,
                      total: 100,
                      message: `Failed: ${errorMessage}`
                    }
                  });
                  
                  results.push({
                    accountId,
                    username: account.username,
                    status: 'failed',
                    error: errorMessage,
                    videosCount: 0
                  });
                  continue;
                }
                
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
              } else {
                const errorText = await profileResponse.text();
                console.error(`❌ Profile fetch failed with status ${profileResponse.status}: ${errorText}`);
              }
            }

            // Now fetch tweets
            console.log(`📥 Fetching tweets for ${account.username}...`);
            const tweetsResponse = await fetch(
              `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/apify-proxy`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                  },
                  action: 'run'
                })
              }
            );

            console.log(`📡 Tweets response status: ${tweetsResponse.status}`);

            if (tweetsResponse.ok) {
              const tweetsData = await tweetsResponse.json();
              console.log(`📊 Raw tweets data structure:`, Object.keys(tweetsData));
              console.log(`📊 Tweets data sample:`, JSON.stringify(tweetsData).substring(0, 1000));
              
              // Check for error response in the JSON data
              if (tweetsData.error === true || tweetsData.noResults === true) {
                const errorMessage = tweetsData.message || 'Unknown error from scraper';
                const errorCode = tweetsData.code || 'UNKNOWN';
                console.error(`❌ Scraper returned error for @${account.username}:`, errorMessage, `(${errorCode})`);
                
                await accountRef.update({
                  syncStatus: 'failed',
                  lastSyncError: errorMessage,
                  syncProgress: {
                    current: 100,
                    total: 100,
                    message: `Failed: ${errorMessage}`
                  }
                });
                
                results.push({
                  accountId,
                  username: account.username,
                  status: 'failed',
                  error: errorMessage,
                  videosCount: 0
                });
                continue;
              }
              
              const allTweets = tweetsData.items || [];
              console.log(`📊 Total items received: ${allTweets.length}`);
              
              if (allTweets.length === 0) {
                console.warn(`⚠️ No tweets found for @${account.username}. This could mean:`);
                console.warn(`   - The account has no tweets`);
                console.warn(`   - The account is private`);
                console.warn(`   - The account doesn't exist`);
                console.warn(`   - The Apify actor is not working properly`);
                console.warn(`   - The username format is incorrect`);
                
                await accountRef.update({
                  syncStatus: 'failed',
                  lastSyncError: 'No tweets found - account may be private, deleted, or non-existent',
                  syncProgress: {
                    current: 100,
                    total: 100,
                    message: 'No tweets found'
                  }
                });
                
                results.push({
                  accountId,
                  username: account.username,
                  status: 'failed',
                  error: 'No tweets found',
                  videosCount: 0
                });
                continue;
              }
              
              // Filter out retweets
              const tweets = allTweets.filter((tweet: any) => !tweet.isRetweet);
              
              console.log(`📊 Fetched ${tweets.length} tweets (${allTweets.length} total, ${allTweets.length - tweets.length} retweets filtered)`);
              
              // Transform tweets to video format (thumbnails will be uploaded later)
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
                  thumbnail: thumbnail, // Will be uploaded to Firebase Storage before saving
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
              
              videosFetched = videos.length;
            } else {
              const errorText = await tweetsResponse.text();
              console.error(`❌ Tweets fetch failed with status ${tweetsResponse.status}: ${errorText}`);
              throw new Error(`Twitter API returned ${tweetsResponse.status}: ${errorText}`);
            }
          } catch (twitterError: any) {
            console.error(`❌ Twitter sync error for ${account.username}:`, twitterError);
            throw twitterError;
          }
        }

        // Update progress
        await accountRef.update({
          syncProgress: {
            current: 50,
            total: 100,
            message: `Checking video limits...`
          }
        });

        // Check if user is admin or demo account - both bypass video limits
        const userId = account.syncRequestedBy || account.addedBy;
        let shouldBypassLimits = false;
        if (userId) {
          const userDoc = await db.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            const isAdmin = userData?.isAdmin === true;
            const userEmail = userData?.email?.toLowerCase() || '';
            const isDemoAccount = userEmail === '001ernestolopez@gmail.com';
            const isSuperAdmin = userEmail === 'ernesto@maktubtechnologies.com';
            
            shouldBypassLimits = isAdmin || isDemoAccount || isSuperAdmin;
            
            if (isDemoAccount) {
              console.log(`🎭 Demo account detected (${userData?.email}) - bypassing ALL video limits for org ${account.orgId}`);
            } else if (isSuperAdmin) {
              console.log(`👑 Super admin detected (${userData?.email}) - bypassing ALL video limits for org ${account.orgId}`);
            } else if (isAdmin) {
              console.log(`🔓 Admin user ${userId} bypassing video limit check for org ${account.orgId}`);
            }
          }
        }
        
        let videosToSave = videos;
        
        if (!shouldBypassLimits) {
        // Check video limits before saving
        const usageDoc = await db
          .collection('organizations')
          .doc(account.orgId)
          .collection('billing')
          .doc('usage')
          .get();
        
        const usage = usageDoc.data();
        const currentVideos = usage?.trackedVideos || 0;
        const videoLimit = usage?.limits?.trackedVideos || 100; // Default limit
        const availableSpace = videoLimit - currentVideos;
        
        console.log(`📊 Video limits - Current: ${currentVideos}, Limit: ${videoLimit}, Available: ${availableSpace}`);
        
        if (availableSpace <= 0) {
          console.warn(`⚠️ Video limit reached for org ${account.orgId}. Skipping video sync.`);
          await accountRef.update({
            syncStatus: 'failed',
            lastSyncError: 'Video limit reached. Please upgrade your plan.',
            syncProgress: {
              current: 100,
              total: 100,
              message: 'Video limit reached'
            }
          });
          
          results.push({
            accountId,
            username: account.username,
            status: 'failed',
            error: 'Video limit reached',
            videosCount: 0
          });
          continue;
        }
        
        // Limit videos to available space
          videosToSave = videos.slice(0, availableSpace);
        if (videosToSave.length < videos.length) {
          console.warn(`⚠️ Limiting sync to ${videosToSave.length} videos (available space: ${availableSpace})`);
          }
        }

        await accountRef.update({
          syncProgress: {
            current: 50,
            total: 100,
            message: `Saving ${videosToSave.length} videos...`
          }
        });

        // Save videos to Firestore (upload thumbnails first)
        const batch = db.batch();
        let savedCount = 0;

        for (const video of videosToSave) {
          // Upload thumbnail to Firebase Storage before saving
          let uploadedThumbnail = video.thumbnail;
          if (video.thumbnail && !video.thumbnail.includes('storage.googleapis.com')) {
            try {
              const filename = `${account.platform}_${video.videoId}_thumb.jpg`;
              uploadedThumbnail = await downloadAndUploadThumbnail(
                video.thumbnail,
                account.orgId,
                filename,
                storage
              );
              console.log(`🖼️ Uploaded thumbnail for ${video.videoId}`);
            } catch (error) {
              console.warn(`⚠️ Failed to upload thumbnail for ${video.videoId}, leaving empty (CDN URLs expire)`);
              uploadedThumbnail = ''; // NEVER use CDN URL - they expire!
            }
          }
          
          const videoRef = db
            .collection('organizations')
            .doc(account.orgId)
            .collection('projects')
            .doc(account.projectId || 'default')
            .collection('videos')
            .doc();

          batch.set(videoRef, {
            ...video,
            thumbnail: uploadedThumbnail, // Use uploaded thumbnail
            orgId: account.orgId,
            projectId: account.projectId || 'default',
            trackedAccountId: accountId,
            platform: account.platform,
            dateAdded: Timestamp.now(),
            addedBy: account.syncRequestedBy || account.addedBy || 'system',
            lastRefreshed: Timestamp.now(),
            status: 'active',
            isRead: false,
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
        
        // Update usage counter
        await db
          .collection('organizations')
          .doc(account.orgId)
          .collection('billing')
          .doc('usage')
          .update({
            trackedVideos: currentVideos + savedCount,
            lastUpdated: Timestamp.now()
          });

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

        console.log(`✅ Completed: ${account.username} - ${savedCount} videos saved`);

        results.push({
          accountId,
          username: account.username,
          status: 'success',
          videosCount: savedCount
        });

        // Send success email if requested by user
        if (account.syncRequestedBy) {
          try {
            // Get user email
            const userDoc = await db.collection('users').doc(account.syncRequestedBy).get();
            const userEmail = userDoc.data()?.email;

            if (userEmail) {
              const appUrl = 'https://www.viewtrack.app';
              const apiUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.viewtrack.app';
              
              await fetch(`${apiUrl}/api/send-test-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: userEmail,
                  subject: `✅ Account Synced: @${account.username}`,
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      </head>
                      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center;">
                          <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 38px; width: auto; margin-bottom: 12px;" />
                          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Account Synced!</h1>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 30px 20px; border-radius: 0 0 10px 10px;">
                          <p style="font-size: 16px; margin-bottom: 20px;">
                            Great news! Your account has been successfully synced.
                          </p>
                          
                          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px;">
                              <strong>Account:</strong> @${account.username}<br>
                              <strong>Platform:</strong> ${account.platform.charAt(0).toUpperCase() + account.platform.slice(1)}<br>
                              <strong>Videos Added:</strong> ${savedCount}
                            </p>
                          </div>
                          
                          <p style="font-size: 14px; color: #666; margin-top: 20px;">
                            All videos from this account are now available in your dashboard. You can view analytics, track performance, and monitor engagement.
                          </p>
                          
                          <div style="text-align: center; margin-top: 30px;">
                            <a href="${appUrl}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                              View Dashboard
                            </a>
                          </div>
                          
                          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                          
                          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                            This sync was completed automatically by our background processing system<br>
                            ${new Date().toLocaleString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </body>
                    </html>
                  `
                })
              });
              
              console.log(`📧 Sent success email to ${userEmail} for account ${account.username}`);
            }
          } catch (emailError) {
            console.error('Failed to send email:', emailError);
          }
        }

      } catch (error: any) {
        console.error(`❌ Error syncing ${account.username}:`, error);

        const retryCount = (account.syncRetryCount || 0) + 1;
        const shouldRetry = retryCount < 3;

        // Update with error status
        await accountRef.update({
          syncStatus: shouldRetry ? 'pending' : 'error',
          lastSyncError: error.message || String(error),
          syncRetryCount: retryCount,
          syncProgress: {
            current: 0,
            total: 100,
            message: shouldRetry ? `Error: ${error.message}. Will retry...` : `Failed after 3 attempts: ${error.message}`
          }
        });

        results.push({
          accountId,
          username: account.username,
          status: 'error',
          error: error.message,
          willRetry: shouldRetry
        });

        // Send error email if max retries reached
        if (!shouldRetry && account.syncRequestedBy) {
          try {
            const userDoc = await db.collection('users').doc(account.syncRequestedBy).get();
            const userEmail = userDoc.data()?.email;

            if (userEmail) {
              const appUrl = 'https://www.viewtrack.app';
              const apiUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.viewtrack.app';
              
              await fetch(`${apiUrl}/api/send-test-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: userEmail,
                  subject: `❌ Sync Failed: @${account.username}`,
                  html: `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      </head>
                      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center;">
                          <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 38px; width: auto; margin-bottom: 12px;" />
                          <h1 style="color: white; margin: 0; font-size: 24px;">❌ Sync Failed</h1>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 30px 20px; border-radius: 0 0 10px 10px;">
                          <p style="font-size: 16px; margin-bottom: 20px;">
                            We were unable to sync your account after 3 attempts.
                          </p>
                          
                          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px;">
                              <strong>Account:</strong> @${account.username}<br>
                              <strong>Platform:</strong> ${account.platform.charAt(0).toUpperCase() + account.platform.slice(1)}<br>
                              <strong>Error:</strong> ${error.message}
                            </p>
                          </div>
                          
                          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px; color: #92400e;">
                              <strong>💡 What to try:</strong><br>
                              • Check that the username is correct<br>
                              • Make sure the account is public<br>
                              • Verify the platform is correct<br>
                              • Try adding the account again
                            </p>
                          </div>
                          
                          <div style="text-align: center; margin-top: 30px;">
                            <a href="${appUrl}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                              Go to Dashboard
                            </a>
                          </div>
                          
                          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                          
                          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                            If the problem persists, please contact support<br>
                            ${new Date().toLocaleString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </body>
                    </html>
                  `
                })
              });
              
              console.log(`📧 Sent failure email to ${userEmail} for account ${account.username}`);
            }
          } catch (emailError) {
            console.error('Failed to send error email:', emailError);
          }
        }
      }
    }

    console.log(`✅ Cron job completed. Processed ${results.length} accounts`);

    return res.status(200).json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error('❌ Cron job error:', error);
    return res.status(500).json({
      error: 'Cron job failed',
      message: error.message
    });
  }
}

/**
 * Download thumbnail from URL and upload to Firebase Storage
 * Returns Firebase Storage URL or falls back to original URL
 */
async function downloadAndUploadThumbnail(
  thumbnailUrl: string,
  orgId: string,
  filename: string,
  storage: any
): Promise<string> {
  try {
    if (!thumbnailUrl || thumbnailUrl.includes('storage.googleapis.com')) {
      // Already a Firebase Storage URL or empty, return as-is
      return thumbnailUrl;
    }

    console.log(`📥 Downloading thumbnail: ${filename}`);
    
    const isTwitter = thumbnailUrl.includes('twimg.com');
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*;q=0.8'
      }
    };
    
    if (isTwitter) {
      fetchOptions.headers['Referer'] = 'https://twitter.com/';
    }
    
    const response = await fetch(thumbnailUrl, fetchOptions);
    
    if (!response.ok) {
      console.warn(`⚠️ Failed to download thumbnail (${response.status}), returning empty (CDN URLs expire)`);
      return ''; // NEVER return CDN URL - they expire!
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      console.warn(`⚠️ Thumbnail too small (${buffer.length} bytes), returning empty`);
      return ''; // NEVER return CDN URL - they expire!
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/thumbnails/${filename}`;
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: thumbnailUrl
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`✅ Thumbnail uploaded successfully`);
    return publicUrl;
  } catch (error) {
    console.error(`❌ Failed to upload thumbnail:`, error);
    return ''; // NEVER return CDN URL - they expire! Will retry on next sync.
  }
}

