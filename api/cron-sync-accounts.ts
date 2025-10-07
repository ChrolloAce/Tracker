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
              const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app';
              
              await fetch(`${appUrl}/api/send-test-email`, {
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
              const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-app.vercel.app';
              
              await fetch(`${appUrl}/api/send-test-email`, {
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

