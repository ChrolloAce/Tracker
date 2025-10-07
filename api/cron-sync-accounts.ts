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

      initializeApp({ credential: cert(serviceAccount as any) });
    }

    const db = getFirestore();

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

        // Fetch videos based on platform
        let videos = [];
        let videosFetched = 0;

        if (account.platform === 'tiktok') {
          const response = await fetch(
            `${process.env.VERCEL_URL || 'https://your-app.vercel.app'}/api/youtube-video?username=${encodeURIComponent(account.username)}&platform=tiktok`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            videos = data.videos || [];
            videosFetched = videos.length;
          } else {
            throw new Error(`API returned ${response.status}: ${await response.text()}`);
          }
        } else if (account.platform === 'youtube') {
          // YouTube logic (similar to TikTok)
          const response = await fetch(
            `${process.env.VERCEL_URL || 'https://your-app.vercel.app'}/api/youtube-video?username=${encodeURIComponent(account.username)}&platform=youtube`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            videos = data.videos || [];
            videosFetched = videos.length;
          }
        } else if (account.platform === 'instagram') {
          // Instagram logic
          console.log(`⚠️  Instagram sync not yet implemented for ${account.username}`);
        }

        // Update progress
        await accountRef.update({
          syncProgress: {
            current: 50,
            total: 100,
            message: `Saving ${videosFetched} videos...`
          }
        });

        // Save videos to Firestore
        const batch = db.batch();
        let savedCount = 0;

        for (const video of videos) {
          const videoRef = db
            .collection('organizations')
            .doc(account.orgId)
            .collection('projects')
            .doc(account.projectId || 'default')
            .collection('videos')
            .doc();

          batch.set(videoRef, {
            ...video,
            orgId: account.orgId,
            projectId: account.projectId || 'default',
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
              await fetch(
                `${process.env.VERCEL_URL || 'https://your-app.vercel.app'}/api/send-test-email`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: userEmail,
                    subject: `✅ Account synced: ${account.username}`,
                    html: `
                      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Account sync completed!</h2>
                        <p><strong>${account.username}</strong> on ${account.platform} has been successfully synced.</p>
                        <p>📊 <strong>${savedCount} videos</strong> have been added to your dashboard.</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">This sync was completed in the background by our automated system.</p>
                      </div>
                    `
                  })
                }
              );
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
              await fetch(
                `${process.env.VERCEL_URL || 'https://your-app.vercel.app'}/api/send-test-email`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: userEmail,
                    subject: `❌ Failed to sync: ${account.username}`,
                    html: `
                      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc2626;">Account sync failed</h2>
                        <p>We couldn't sync <strong>${account.username}</strong> on ${account.platform} after 3 attempts.</p>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p>Please check the account settings and try again, or contact support if the issue persists.</p>
                      </div>
                    `
                  })
                }
              );
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

