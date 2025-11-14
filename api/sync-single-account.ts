import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { runApifyActor } from './apify-client.js';
import { ErrorNotificationService } from './services/ErrorNotificationService.js';
import { CleanupService } from './services/CleanupService.js';
import { authenticateAndVerifyOrg, setCorsHeaders, handleCorsPreFlight, validateRequiredFields } from './middleware/auth.js';
// @ts-ignore - heic-convert has no types
import convert from 'heic-convert';

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
    const isTikTok = imageUrl.includes('tiktokcdn');
    
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/heic,image/heif,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
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
    
    // Add Referer for TikTok
    if (isTikTok) {
      fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
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
    let buffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 Downloaded ${buffer.length} bytes`);
    
    // Validate we got actual image data
    if (buffer.length < 100) {
      throw new Error(`Downloaded data too small (${buffer.length} bytes), likely not an image`);
    }
    
    // Determine content type from response or default to jpg
    let contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`📋 Original content type: ${contentType}`);
    
    // 🔥 HEIC Detection and Conversion using heic-convert (pure JS, works in serverless)
    // Check if content-type indicates HEIC or file signature matches HEIC
    const isHEIC = contentType.includes('heic') || 
                   contentType.includes('heif') || 
                   imageUrl.toLowerCase().includes('.heic') ||
                   imageUrl.toLowerCase().includes('.heif') ||
                   // Check HEIC file signature (ftyp heic)
                   (buffer.length > 12 && 
                    buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 && 
                    buffer[8] === 0x68 && buffer[9] === 0x65 && buffer[10] === 0x69 && buffer[11] === 0x63);
    
    if (isHEIC) {
      console.log(`🔄 [HEIC] Converting HEIC image to JPG: ${imageUrl.substring(0, 100)}...`);
      try {
        // Convert HEIC to JPG using heic-convert (pure JS, serverless-friendly)
        const outputBuffer = await convert({
          buffer: buffer,
          format: 'JPEG',
          quality: 0.9
        });
        
        buffer = Buffer.from(outputBuffer);
        contentType = 'image/jpeg';
        filename = filename.replace(/\.(heic|heif)$/i, '.jpg');
        console.log(`✅ [HEIC] Successfully converted HEIC to JPG (${buffer.length} bytes)`);
      } catch (conversionError) {
        console.error(`❌ [HEIC] Conversion failed:`, conversionError);
        console.warn(`⚠️ [HEIC] Will upload as-is - may not display properly in browsers`);
        // Continue with original buffer if conversion fails
      }
    }
    
    console.log(`📋 Final content type: ${contentType}`);
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/${folder}/${filename}`;
    const file = bucket.file(storagePath);
    
    console.log(`☁️ Uploading ${buffer.length} bytes to Firebase Storage at: ${storagePath}`);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalUrl: imageUrl,
          fileFormat: contentType.split('/')[1] || 'unknown',
          convertedFromHEIC: isHEIC ? 'true' : 'false'
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
    
    // For Instagram and TikTok, DON'T return the original URL since it expires quickly
    // Better to have no thumbnail than a broken one - will retry on next sync
    if (imageUrl.includes('cdninstagram') || 
        imageUrl.includes('fbcdn') || 
        imageUrl.includes('tiktokcdn')) {
      console.log(`🚫 Instagram/TikTok CDN URL detected, returning empty string (URLs expire quickly)`);
      throw error; // Throw error so caller knows it failed
    }
    
    // For other platforms (YouTube, Twitter), return original URL as fallback
    console.log(`📷 Using original URL as fallback for non-CDN platform: ${imageUrl.substring(0, 100)}...`);
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
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle preflight requests
  if (handleCorsPreFlight(req, res)) {
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, orgId, projectId } = req.body;

  // Validate required fields
  const validation = validateRequiredFields(req.body, ['accountId', 'orgId', 'projectId']);
  if (!validation.valid) {
    return res.status(400).json({ 
      error: 'Missing required parameters', 
      missing: validation.missing 
    });
  }

  // 🔒 Authenticate - either user (manual) or cron secret (automated)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = authHeader === cronSecret;
  
  if (isCronRequest) {
    console.log(`🔒 Authenticated as CRON job for sync request`);
  } else {
    // Regular user authentication
    try {
      const { user } = await authenticateAndVerifyOrg(req, orgId);
      console.log(`🔒 Authenticated user ${user.userId} for sync request`);
    } catch (authError: any) {
      console.error('❌ Authentication failed:', authError.message);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: authError.message 
      });
    }
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
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newTikTokVideos: any[] = [];
        
        // Only fetch NEW videos for automatic accounts
        if (creatorType === 'automatic') {
          // Get existing video IDs to check for duplicates
          const existingVideosSnapshot = await db
            .collection('organizations')
            .doc(orgId)
            .collection('projects')
            .doc(projectId)
            .collection('videos')
            .where('trackedAccountId', '==', accountId)
            .where('platform', '==', 'tiktok')
            .select('videoId')
            .get();
          
          const existingVideoIds = new Set(
            existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
          );
          
          console.log(`📊 Found ${existingVideoIds.size} existing TikTok videos in database`);
          
          // Progressive fetch strategy: 5 → 10 → 15 → 20
          const batchSizes = [5, 10, 15, 20];
          let foundDuplicate = false;
          const username = account.username.replace('@', '');
          
          for (const batchSize of batchSizes) {
            if (foundDuplicate) break;
            
            console.log(`📥 [TIKTOK] Fetching ${batchSize} videos (progressive strategy)...`);
            
            try {
              const data = await runApifyActor({
                actorId: 'apidojo/tiktok-scraper',
                input: {
                  startUrls: [`https://www.tiktok.com/@${username}`],
                  maxItems: batchSize,
                  sortType: 'RELEVANCE',
                  dateRange: 'DEFAULT',
                  location: 'US',
                  includeSearchKeywords: false,
                  customMapFunction: '(object) => { return {...object} }',
                  proxy: {
                    useApifyProxy: true,
                    apifyProxyGroups: ['RESIDENTIAL']
                  }
                }
              });

              const batch = data.items || [];
              
              if (batch.length === 0) {
                console.log(`⚠️ [TIKTOK] No videos returned`);
                break;
              }
              
              // Check each video for duplicates
              for (const video of batch) {
                const videoId = video.id || video.post_id || video.video_id;
                
                if (!videoId) {
                  console.warn(`⚠️ TikTok video missing ID, skipping`);
                  continue;
                }
                
                // Check if we already have this video
                if (existingVideoIds.has(videoId)) {
                  console.log(`✓ [TIKTOK] Found duplicate: ${videoId} - stopping progressive fetch`);
                  foundDuplicate = true;
                  break;
                }
                
                // This is a new video
                newTikTokVideos.push(video);
              }
              
              // Stop if we got fewer videos than requested (end of content)
              if (batch.length < batchSize) {
                console.log(`⏹️ [TIKTOK] Got ${batch.length} < ${batchSize} (end of account's content)`);
                break;
              }
              
            } catch (fetchError: any) {
              console.error(`❌ [TIKTOK] Fetch failed at batch size ${batchSize}:`, fetchError.message);
              break;
            }
          }
          
          console.log(`✅ [TIKTOK] Progressive fetch complete: ${newTikTokVideos.length} new videos found`);
        } else {
          console.log(`🔒 [TIKTOK] Static account - skipping new video fetch`);
        }
        
        const tiktokVideos = newTikTokVideos;
        console.log(`📊 [TIKTOK] Processing ${tiktokVideos.length} new videos`);
        
        // Get profile data from first video (if available)
        if (tiktokVideos.length > 0 && tiktokVideos[0]) {
          const firstVideo = tiktokVideos[0];
          const channel = firstVideo.channel || {};
          const profilePictureUrl = channel.avatar || channel.avatar_url || '';
          const followerCount = channel.followers || 0;
          const displayName = channel.name || account.username;
          
          // Update account profile if we have new data
          if (profilePictureUrl || followerCount > 0) {
            try {
              const profileUpdates: any = {
                displayName: displayName,
                followerCount: followerCount,
                isVerified: channel.verified || false
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
        
        // Transform TikTok data to video format (apidojo/tiktok-scraper format)
        videos = tiktokVideos.map((item: any, index: number) => {
          // Handle both nested and flat key formats
          const channel = item.channel || {};
          const video = item.video || {};
          
          // THUMBNAIL EXTRACTION: Check flat keys FIRST (TikTok API returns flat keys like "video.cover")
          let thumbnail = '';
          if (item['video.cover']) { 
            // Flat key: "video.cover" (THIS IS THE PRIMARY SOURCE)
            thumbnail = item['video.cover'];
          } else if (item['video.thumbnail']) { 
            // Flat key: "video.thumbnail"
            thumbnail = item['video.thumbnail'];
          } else if (video.cover) {
            // Nested object: video.video.cover
            thumbnail = video.cover;
          } else if (video.thumbnail) {
            // Nested object: video.video.thumbnail
            thumbnail = video.thumbnail;
          } else if (item.cover) {
            thumbnail = item.cover;
          } else if (item.thumbnail) {
            thumbnail = item.thumbnail;
          } else if (item.images && item.images.length > 0) {
            thumbnail = item.images[0].url || '';
          }
          
          // Note: Keep original HEIC URLs - they will be converted server-side during download
          
          // 🔥 VIDEO URL: Always use postPage, fallback to reconstruction from video ID
          const videoId = item.id || item.post_id || '';
          let videoUrl = item.postPage || item.tiktok_url || video.url || item.videoUrl || '';
          
          // If no valid TikTok post URL (e.g., only have CDN URL) and we have a video ID, reconstruct it
          if ((!videoUrl || !videoUrl.includes('tiktok.com/@')) && videoId) {
            const username = channel.username || item['channel.username'] || account.username || 'user';
            videoUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
            console.log(`🔧 [TIKTOK] Reconstructed URL from ID: ${videoUrl}`);
          }
          
          return {
            videoId: videoId || `tiktok_${Date.now()}_${index}`,
            videoTitle: item.title || item.caption || item.subtitle || 'Untitled TikTok',
            videoUrl: videoUrl,
            platform: 'tiktok',
            thumbnail: thumbnail,
            accountUsername: account.username,
            accountDisplayName: channel.name || item['channel.name'] || account.username,
            uploadDate: item.uploadedAt ? Timestamp.fromMillis(item.uploadedAt * 1000) : 
                       item.uploaded_at ? Timestamp.fromMillis(item.uploaded_at * 1000) : 
                       Timestamp.now(),
            views: item.views || 0,
            likes: item.likes || 0,
            comments: item.comments || 0,
            shares: item.shares || 0,
            saves: item.bookmarks || 0, // ✅ ADD BOOKMARKS
            caption: item.title || item.subtitle || item.caption || '',
            duration: video.duration || 0
          };
        });
      } catch (tiktokError) {
        console.error('TikTok fetch error:', tiktokError);
        throw tiktokError;
      }
    } else if (account.platform === 'youtube') {
      console.log(`📺 Fetching YouTube Shorts for ${account.username}...`);
      
      try {
        // Use grow_media/youtube-shorts-scraper via Apify
        const channelHandle = account.username.startsWith('@') ? account.username : `@${account.username}`;
        console.log(`🔍 Scraping YouTube Shorts for: ${channelHandle}`);
        
        const data = await runApifyActor({
          actorId: 'grow_media/youtube-shorts-scraper',
          input: {
            channels: [channelHandle],
            maxResults: maxVideos,
            sortBy: 'latest',
            proxy: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL']
            }
          }
        });

        const youtubeVideos = data.items || [];
        console.log(`✅ Fetched ${youtubeVideos.length} YouTube Shorts`);
        
        // Extract profile/channel data from first video
        if (youtubeVideos.length > 0 && youtubeVideos[0]) {
          const firstVideo = youtubeVideos[0];
          const channelAvatarUrl = firstVideo.channelAvatarUrl || '';
          const followerCount = firstVideo.numberOfSubscribers || 0;
          const channelName = firstVideo.channelName || account.username;
          
          console.log(`👤 Channel: ${channelName} (${followerCount} subscribers)`);
          
          // Update profile data
          const profileUpdates: any = {
            displayName: channelName,
            followerCount: followerCount,
            isVerified: firstVideo.isChannelVerified || false
          };
          
          // Download and upload YouTube profile pic to Firebase Storage
          if (channelAvatarUrl) {
            try {
              console.log(`📸 Downloading YouTube profile pic for ${channelHandle}...`);
              const uploadedProfilePic = await downloadAndUploadImage(
                channelAvatarUrl,
                orgId,
                `youtube_profile_${account.username}.jpg`,
                'profile'
              );
              profileUpdates.profilePicture = uploadedProfilePic;
              console.log(`✅ YouTube profile picture uploaded to Firebase Storage`);
            } catch (uploadError: any) {
              console.error(`❌ Error uploading YouTube profile picture:`, uploadError);
              console.warn(`⚠️ Skipping profile picture - will retry on next sync`);
            }
          }
          
          await accountRef.update(profileUpdates);
          console.log(`✅ Updated YouTube profile: ${followerCount} subscribers`);
        }

        // Transform YouTube data to video format
        videos = youtubeVideos.map((video: any) => {
          // Parse duration (format: "PT27S" or "PT1M7S")
          let durationSeconds = 0;
          if (video.duration) {
            const durationStr = video.duration;
            const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
            if (match) {
              const minutes = parseInt(match[1] || '0', 10);
              const seconds = parseInt(match[2] || '0', 10);
              durationSeconds = minutes * 60 + seconds;
            }
          }
          
          // Get best thumbnail (maxres > standard > high > medium > default)
          let thumbnail = '';
          if (video.thumbnails?.maxres?.url) {
            thumbnail = video.thumbnails.maxres.url;
          } else if (video.thumbnails?.standard?.url) {
            thumbnail = video.thumbnails.standard.url;
          } else if (video.thumbnails?.high?.url) {
            thumbnail = video.thumbnails.high.url;
          } else if (video.thumbnails?.medium?.url) {
            thumbnail = video.thumbnails.medium.url;
          } else if (video.thumbnails?.default?.url) {
            thumbnail = video.thumbnails.default.url;
          } else if (video.thumbnailUrl) {
            thumbnail = video.thumbnailUrl;
          }
          
          return {
            videoId: video.id,
            videoTitle: video.title || 'Untitled Short',
            videoUrl: video.url || `https://youtube.com/shorts/${video.id}`,
            platform: 'youtube',
            thumbnail: thumbnail,
            accountUsername: account.username,
            accountDisplayName: video.channelName || account.username,
            uploadDate: video.date ? Timestamp.fromDate(new Date(video.date)) : Timestamp.now(),
            views: video.viewCount || 0,
            likes: video.likes || 0,
            comments: video.commentsCount || 0,
            shares: 0, // YouTube doesn't expose share count via API
            saves: video.favoriteCount || video.favorites || 0, // ✅ YouTube favoriteCount = saves/bookmarks
            caption: video.text || '',
            duration: durationSeconds
          };
        });
        
        console.log(`✅ Processed ${videos.length} YouTube Shorts`);
      } catch (youtubeError) {
        console.error('❌ YouTube fetch error:', youtubeError);
        throw youtubeError;
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
      console.log(`👤 Fetching Instagram reels for ${account.username}...`);
      
      try {
        const creatorType = account.creatorType || 'automatic';
        console.log(`🔧 Account type: ${creatorType}`);
        
        let newInstagramReels: any[] = [];
        let existingVideoIds = new Set<string>();
        
        // Get existing video IDs (used for duplicate checking)
        const existingVideosSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('videos')
          .where('trackedAccountId', '==', accountId)
          .where('platform', '==', 'instagram')
          .select('videoId')
          .get();
        
        existingVideoIds = new Set(
          existingVideosSnapshot.docs.map(doc => doc.data().videoId).filter(Boolean)
        );
        
        console.log(`📊 Found ${existingVideoIds.size} existing Instagram reels in database`);
        
        // Only fetch NEW videos for automatic accounts
        if (creatorType === 'automatic') {
          
          // Progressive fetch strategy: 5 → 10 → 15 → 20
          const batchSizes = [5, 10, 15, 20];
          let foundDuplicate = false;
          
          for (const batchSize of batchSizes) {
            if (foundDuplicate) break;
            
            console.log(`📥 [INSTAGRAM] Fetching ${batchSize} reels (progressive strategy)...`);
            
            try {
              const scraperInput: any = {
                tags: [`https://www.instagram.com/${account.username}/reels/`],
                target: 'reels_only',
                reels_count: batchSize,
                include_raw_data: true,
                // NO beginDate/endDate - date filtering doesn't work reliably
                custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
                proxy: {
                  useApifyProxy: true,
                  apifyProxyGroups: ['RESIDENTIAL'],
                  apifyProxyCountry: 'US'
                },
                maxConcurrency: 1,
                maxRequestRetries: 3,
                handlePageTimeoutSecs: 120,
                debugLog: false
              };
              
              const data = await runApifyActor({
                actorId: 'hpix~ig-reels-scraper',
                input: scraperInput
              });

              const batch = data.items || [];
              
              if (batch.length === 0) {
                console.log(`⚠️ [INSTAGRAM] No reels returned`);
                break;
              }
              
              // Check each video for duplicates
              for (const reel of batch) {
                const videoId = reel.video_id || reel.shortcode || reel.id;
                
                if (!videoId) {
                  console.warn(`⚠️ Reel missing video_id, skipping`);
                  continue;
                }
                
                // Check if we already have this video
                if (existingVideoIds.has(videoId)) {
                  console.log(`✓ [INSTAGRAM] Found duplicate: ${videoId} - stopping progressive fetch`);
                  foundDuplicate = true;
                  break;
                }
                
                // This is a new video
                newInstagramReels.push(reel);
              }
              
              // Stop if we got fewer videos than requested (end of content)
              if (batch.length < batchSize) {
                console.log(`⏹️ [INSTAGRAM] Got ${batch.length} < ${batchSize} (end of account's content)`);
                break;
              }
              
            } catch (fetchError: any) {
              console.error(`❌ [INSTAGRAM] Fetch failed at batch size ${batchSize}:`, fetchError.message);
              break;
            }
          }
          
          console.log(`✅ [INSTAGRAM] Progressive fetch complete: ${newInstagramReels.length} new reels found`);
        } else {
          console.log(`🔒 [INSTAGRAM] Static account - skipping new video fetch`);
        }
        
        const instagramItems = newInstagramReels;
        console.log(`📊 [INSTAGRAM] Processing ${instagramItems.length} new reels`);
        
        // SECOND API CALL: Refresh metrics for ALL existing reels
        // Only do this if we have existing videos
        const hasExistingVideos = creatorType === 'automatic' ? existingVideoIds.size > 0 : true;
        if (hasExistingVideos) {
          console.log(`🔄 Fetching updated metrics for existing reels...`);
          
          try {
            // Get all existing Instagram reels for this account
            const allExistingReelsSnapshot = await db
              .collection('organizations')
              .doc(orgId)
              .collection('projects')
              .doc(projectId)
              .collection('videos')
              .where('trackedAccountId', '==', accountId)
              .where('platform', '==', 'instagram')
              .get();
            
            if (!allExistingReelsSnapshot.empty) {
              // Build post URLs for existing reels
              const postUrls = allExistingReelsSnapshot.docs
                .map(doc => {
                  const videoId = doc.data().videoId;
                  if (!videoId) return null;
                  // Instagram URLs are: https://www.instagram.com/p/{videoId}/ or /reel/{videoId}/
                  return `https://www.instagram.com/p/${videoId}/`;
                })
                .filter(Boolean) as string[];
              
              if (postUrls.length > 0) {
                console.log(`📊 Refreshing metrics for ${postUrls.length} existing reels...`);
                
                // Make second API call with post_urls
                const refreshData = await runApifyActor({
          actorId: 'hpix~ig-reels-scraper',
          input: {
                    post_urls: postUrls,
            target: 'reels_only',
                    reels_count: postUrls.length,
            include_raw_data: true,
            custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
            proxy: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
            },
            maxConcurrency: 1,
            maxRequestRetries: 3,
            handlePageTimeoutSecs: 120,
            debugLog: false
          }
        });

                const refreshedReels = refreshData.items || [];
                console.log(`✅ Refreshed ${refreshedReels.length} existing reels`);
                
                // Add refreshed reels to instagramItems array (will be processed together)
                instagramItems.push(...refreshedReels);
              }
            }
          } catch (refreshError) {
            console.error('⚠️ Failed to refresh existing reels (non-fatal):', refreshError);
            // Don't fail the whole sync if refresh fails
          }
        }
        
        console.log(`📦 Total reels to process: ${instagramItems.length}`);
        
        // ALWAYS use apify/instagram-profile-scraper for profile pic + follower count
        // (hpix~ig-reels-scraper doesn't consistently include follower count)
        console.log(`👤 Fetching complete profile data via apify/instagram-profile-scraper...`);
      try {
        const profileData = await runApifyActor({
            actorId: 'apify~instagram-profile-scraper',
          input: {
              usernames: [account.username.replace('@', '')],
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL'],
              apifyProxyCountry: 'US'
              },
              includeAboutSection: false
          }
        });

        const profiles = profileData.items || [];
        if (profiles.length > 0) {
          const profile = profiles[0];
            console.log(`✅ Fetched profile: ${profile.followersCount || 0} followers`);
          
          const profileUpdates: any = {
            displayName: profile.fullName || account.username,
            followerCount: profile.followersCount || 0,
            followingCount: profile.followsCount || 0,
            isVerified: profile.verified || false
          };

            // Download and upload profile pic to Firebase Storage (same as TikTok)
            if (profile.profilePicUrl) {
            try {
                console.log(`📸 Downloading Instagram profile pic for @${account.username}...`);
              const uploadedProfilePic = await downloadAndUploadImage(
                  profile.profilePicUrl,
                orgId,
                `instagram_profile_${account.username}.jpg`,
                'profile'
              );
                profileUpdates.profilePicture = uploadedProfilePic;
                console.log(`✅ Instagram profile picture uploaded to Firebase Storage`);
              } catch (uploadError: any) {
              console.error(`❌ Error uploading Instagram profile picture:`, uploadError);
                console.warn(`⚠️ Skipping profile picture - will retry on next sync`);
            }
          }

          await accountRef.update(profileUpdates);
            console.log(`✅ Updated Instagram profile: ${profile.fullName || account.username}`);
          } else {
            console.warn(`⚠️ No profile data returned from apify/instagram-profile-scraper`);
        }
      } catch (profileError) {
          console.error(`❌ Failed to fetch profile via apify/instagram-profile-scraper:`, profileError);
        }
        
        // Transform Instagram data to video format
        for (const item of instagramItems) {
          const videoCode = item.code || item.id;
          if (!videoCode) {
            console.warn('⚠️ Skipping item - no video code found');
            continue;
          }
          
          // Profile data is at raw_data.caption.user (NOT raw_data.owner!)
          const user = item.raw_data?.caption?.user || {};
          const views = item.play_count || item.view_count || 0;
          const likes = item.like_count || 0;
          const comments = item.comment_count || 0;
          const caption = item.caption || '';
          const uploadDate = item.taken_at ? Timestamp.fromMillis(item.taken_at * 1000) : Timestamp.now();
          const thumbnailUrl = item.thumbnail_url || '';
          const duration = item.raw_data?.video_duration || item.duration || 0;
          
          videos.push({
            videoId: videoCode,
            videoTitle: caption.substring(0, 100) + (caption.length > 100 ? '...' : '') || 'Instagram Reel',
            videoUrl: `https://www.instagram.com/reel/${videoCode}/`,
            platform: 'instagram',
            thumbnail: thumbnailUrl,
            accountUsername: user.username || account.username,
            accountDisplayName: user.full_name || account.username,
            uploadDate: uploadDate,
            views: views,
            likes: likes,
            comments: comments,
            shares: 0, // Instagram API doesn't provide share count
            caption: caption,
            duration: duration,
            isVerified: user.is_verified || false
          });
        }
        
        console.log(`✅ Processed ${videos.length} Instagram reels`);
      } catch (instagramError) {
        console.error('❌ Instagram fetch error:', instagramError);
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
      // Download and upload thumbnail to Firebase Storage (REQUIRED - no fallback to direct URLs)
      let firebaseThumbnailUrl = '';
      if (video.thumbnail && video.thumbnail.startsWith('http')) {
        try {
          console.log(`    📸 [${account.platform.toUpperCase()}] Downloading thumbnail for video ${video.videoId}...`);
          console.log(`    🌐 [${account.platform.toUpperCase()}] Thumbnail URL: ${video.thumbnail.substring(0, 100)}...`);
          firebaseThumbnailUrl = await downloadAndUploadImage(
            video.thumbnail,
            orgId,
            `${account.platform}_${video.videoId}_thumb.jpg`,
            'thumbnails'
          );
          console.log(`    ✅ [${account.platform.toUpperCase()}] Thumbnail uploaded to Firebase Storage: ${firebaseThumbnailUrl}`);
        } catch (thumbError) {
          console.error(`    ❌ [${account.platform.toUpperCase()}] Thumbnail upload failed for ${video.videoId}:`, thumbError);
          // DO NOT use direct URLs as fallback (they expire)
          // Leave empty - will retry on next sync
          console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No fallback - thumbnail will retry on next sync`);
        }
      } else {
        console.warn(`    ⚠️ [${account.platform.toUpperCase()}] No valid thumbnail URL for video ${video.videoId}`);
      }

      // Check if video already exists
      const existingVideoQuery = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .where('videoId', '==', video.videoId)
        .where('platform', '==', account.platform)
        .limit(1)
        .get();

      const snapshotTime = Timestamp.now();
      const isManualTrigger = account.syncRequestedBy ? true : false;

      if (!existingVideoQuery.empty) {
        // VIDEO EXISTS - Update metrics and create refresh snapshot
        const videoRef = existingVideoQuery.docs[0].ref;
        
        // Update video with new metrics
        batch.update(videoRef, {
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          lastRefreshed: snapshotTime,
          thumbnail: firebaseThumbnailUrl || existingVideoQuery.docs[0].data().thumbnail // Update thumbnail if new one available
        });

        // Create refresh snapshot
        const snapshotRef = videoRef.collection('snapshots').doc();
        batch.set(snapshotRef, {
          id: snapshotRef.id,
          videoId: video.videoId,
          views: video.views || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: snapshotTime,
          timestamp: snapshotTime,
          capturedBy: isManualTrigger ? 'manual_refresh' : 'scheduled_refresh',
          isInitialSnapshot: false // This is a refresh snapshot, not initial
        });

        console.log(`    🔄 Updated existing video ${video.videoId} + created refresh snapshot`);
      } else {
        // NEW VIDEO - Create with initial snapshot
      const videoRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos')
        .doc();

      batch.set(videoRef, {
        ...video,
          thumbnail: firebaseThumbnailUrl, // Use Firebase Storage URL
        orgId: orgId,
        projectId: projectId,
        trackedAccountId: accountId,
        platform: account.platform,
          dateAdded: snapshotTime,
        addedBy: account.syncRequestedBy || account.addedBy || 'system',
          lastRefreshed: snapshotTime,
        status: 'active',
        isRead: false,
        isSingular: false
      });

      // Create initial snapshot for this new video
      const snapshotRef = videoRef.collection('snapshots').doc();
      batch.set(snapshotRef, {
        id: snapshotRef.id,
        videoId: video.videoId,
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
          saves: video.saves || 0,
        capturedAt: snapshotTime,
        timestamp: snapshotTime,
          capturedBy: 'initial_sync',
          isInitialSnapshot: true // Mark as initial snapshot - won't count towards graphs
      });

        console.log(`    ✅ Created new video ${video.videoId} + initial snapshot`);
      }

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
        thumbnail: firebaseThumbnailUrl, // ✅ USE FIREBASE STORAGE URL
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
        saves: video.saves || 0, // ✅ ADD BOOKMARKS
        savesCount: video.saves || 0, // ✅ ADD BOOKMARKS COUNT
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

    // NOTE: Email notifications are handled by cron-orchestrator.ts
    // which sends a single summary email per organization instead of individual emails per account.
    // This prevents email spam and provides a better user experience with aggregated stats.

    // 🧹 Auto-cleanup: Delete any invalid videos/accounts (no username, no stats, etc.)
    try {
      console.log(`🧹 Running auto-cleanup for invalid videos/accounts...`);
      const cleanupStats = await CleanupService.runFullCleanup(orgId, projectId);
      console.log(`✅ Cleanup complete: ${cleanupStats.videosDeleted} videos, ${cleanupStats.accountsDeleted} accounts deleted`);
    } catch (cleanupError) {
      console.error('❌ Cleanup failed (non-fatal):', cleanupError);
      // Don't fail the request if cleanup fails
    }

    return res.status(200).json({
      success: true,
      message: 'Account synced successfully',
      videosCount: savedCount,
      username: account.username
    });

  } catch (error: any) {
    console.error(`❌ Error in immediate sync:`, error);

    // Mark account with error status and send notifications
    try {
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);

      // Get account data for error notification
      const accountDoc = await accountRef.get();
      const account = accountDoc.data();

      await accountRef.update({
        syncStatus: 'error',
        hasError: true,
        lastSyncError: error.message || String(error),
        lastSyncErrorAt: Timestamp.now(),
        syncRetryCount: (account?.syncRetryCount || 0) + 1,
        syncProgress: {
          current: 0,
          total: 100,
          message: `Error: ${error.message || String(error)}`
        }
      });

      // Send error notification email and log to Firestore
      await ErrorNotificationService.notifyError({
        type: 'account_sync',
        platform: account?.platform || 'unknown',
        accountId: accountId,
        username: account?.username || 'unknown',
        errorMessage: error.message || String(error),
        errorStack: error.stack,
        orgId: orgId,
        projectId: projectId,
        timestamp: new Date(),
        attemptNumber: (account?.syncRetryCount || 0) + 1
      });
    } catch (updateError) {
      console.error('Failed to update account status:', updateError);
    }

    return res.status(500).json({
      success: false,
      error: error.message || String(error),
      message: 'Sync failed - admin notified'
    });
  }
}

