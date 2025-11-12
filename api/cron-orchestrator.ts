import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (with better error handling)
function initializeFirebase() {
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
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      throw new Error('Firebase initialization failed');
    }
  }
  return getFirestore();
}

// Subscription plan refresh intervals (in hours)
const PLAN_REFRESH_INTERVALS: Record<string, number> = {
  free: 0.4167,     // 25 minutes (normally 48 hours)
  basic: 0.4167,    // 25 minutes (normally 24 hours)
  pro: 0.4167,      // 25 minutes (normally 24 hours)
  ultra: 0.4167,    // 25 minutes (normally 12 hours)
  enterprise: 0.4167, // 25 minutes (normally 12 hours)
};

/**
 * Cron Orchestrator
 * Runs every 25 minutes (every 25 minutes cron expression)
 * Processes all organizations directly (no HTTP calls)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Firebase and get db instance
    const db = initializeFirebase();
    
    // Verify authorization: Vercel Cron, Cron Secret, or Firebase User Token
    let authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    
    let isAuthorized = false;
    let authMethod = '';
    
    // Check 1: Vercel Cron header
    if (isVercelCron) {
      isAuthorized = true;
      authMethod = 'Vercel Cron';
    }
    
    // Check 2: Cron Secret (strip "Bearer " prefix if present)
    if (!isAuthorized && authHeader) {
      let tokenToCheck = authHeader;
      if (authHeader.startsWith('Bearer ')) {
        tokenToCheck = authHeader.substring(7);
      }
      
      if (tokenToCheck === cronSecret) {
        isAuthorized = true;
        authMethod = 'Cron Secret';
      }
    }
    
    // Check 3: Firebase User Token (for manual testing via UI)
    if (!isAuthorized && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decodedToken = await getAuth().verifyIdToken(token);
        console.log(`🔒 Authenticated as Firebase user: ${decodedToken.uid}`);
        isAuthorized = true;
        authMethod = 'Firebase User';
      } catch (error: any) {
        console.error('❌ Firebase token verification failed:', error.message);
      }
    }
    
    if (!isAuthorized) {
      console.log('❌ Unauthorized orchestrator request');
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'This endpoint requires Vercel Cron, CRON_SECRET, or valid Firebase user token'
      });
    }

    console.log(`✅ Authorized: ${authMethod}`);

    const startTime = Date.now();
    console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s)\n`);

    let globalTotalAccounts = 0;
    let globalTotalRefreshed = 0;
    let globalTotalVideosRefreshed = 0;
    let successfulOrgs = 0;
    let failedOrgs = 0;

    // Always use production URL to avoid deployment protection issues
    const baseUrl = 'https://www.viewtrack.app';

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`📁 Processing organization: ${orgId}`);

      try {
        // Get organization's subscription
        let orgPlanTier = 'free';
      try {
        const subscriptionDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('billing')
          .doc('subscription')
          .get();
        
          if (subscriptionDoc.exists) {
          const subscriptionData = subscriptionDoc.data();
          orgPlanTier = subscriptionData?.planTier || 'free';
        }
          console.log(`  📋 Plan: ${orgPlanTier}`);
      } catch (error) {
          console.error(`  ⚠️ Failed to get subscription:`, error);
      }

      const refreshIntervalHours = PLAN_REFRESH_INTERVALS[orgPlanTier] || 24;
      const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;

        // Get all projects
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      console.log(`  📂 Found ${projectsSnapshot.size} project(s)`);

        let orgTotalAccounts = 0;
        let orgSuccessful = 0;
        let orgFailed = 0;
        let orgVideosRefreshed = 0;
        const dispatchPromises: Promise<any>[] = [];

        // Process each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
          console.log(`    📦 Project: ${projectData.name || projectId}`);

          // Get tracked accounts
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
            .where('isActive', '==', true)
          .get();

          console.log(`      👥 ${accountsSnapshot.size} account(s)`);
          orgTotalAccounts += accountsSnapshot.size;

          // Dispatch account refresh jobs
        for (const accountDoc of accountsSnapshot.docs) {
          const accountData = accountDoc.data();

          const lastRefreshed = accountData.lastRefreshed?.toMillis() || 0;
            const timeSinceRefresh = Date.now() - lastRefreshed;

            if (timeSinceRefresh < refreshIntervalMs) {
            const hoursRemaining = ((refreshIntervalMs - timeSinceRefresh) / (1000 * 60 * 60)).toFixed(1);
              console.log(`        ⏭️  Skip @${accountData.username} (${hoursRemaining}h remaining)`);
            continue;
          }

            console.log(`        ⚡ Dispatching @${accountData.username}`);

            const dispatchPromise = fetch(`${baseUrl}/api/sync-single-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
                accountId: accountDoc.id,
                orgId: orgId,
                projectId
            })
          })
            .then(async (response) => {
              if (response.ok) {
                  const result = await response.json();
                  orgSuccessful++;
                  // sync-single-account returns videosCount (total synced)
                  const videoCount = result.videosCount || 0;
                  orgVideosRefreshed += videoCount;
                  // Note: sync-single-account doesn't differentiate new vs updated
                  // For email reporting, we'll consider all as "refreshed"
                  console.log(`          ✅ @${accountData.username || result.username}: ${videoCount} videos synced`);
              } else {
                  orgFailed++;
                  console.error(`          ❌ @${accountData.username}: ${response.status}`);
              }
            })
            .catch((error) => {
                orgFailed++;
                console.error(`          ❌ @${accountData.username}: ${error.message}`);
            });

          dispatchPromises.push(dispatchPromise);
        }

          // Check for Apple revenue integration
          try {
        const revenueIntegrationsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('revenueIntegrations')
          .where('provider', '==', 'apple')
          .where('enabled', '==', true)
          .get();

        if (!revenueIntegrationsSnapshot.empty) {
              console.log(`      💰 Syncing Apple revenue...`);
          
              const dispatchPromise = fetch(`${baseUrl}/api/sync-apple-revenue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              organizationId: orgId,
                  projectId,
                  dateRange: '7',
              manual: false
            })
          })
            .then(async (response) => {
              if (response.ok) {
                    console.log(`        ✅ Apple revenue synced`);
              } else {
                    console.error(`        ❌ Revenue sync failed: ${response.status}`);
              }
            })
            .catch((error) => {
                  console.error(`        ❌ Revenue sync error: ${error.message}`);
            });

          dispatchPromises.push(dispatchPromise);
            }
          } catch (error: any) {
            console.error(`      ⚠️ Revenue integration check failed: ${error.message}`);
        }

          // Update lastGlobalRefresh
          try {
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
              .update({ lastGlobalRefresh: Timestamp.now() });
          } catch (error: any) {
            console.error(`      ⚠️ Failed to update lastGlobalRefresh: ${error.message}`);
      }
    }

        // Wait for all jobs
        if (dispatchPromises.length > 0) {
          console.log(`  ⏳ Waiting for ${dispatchPromises.length} jobs...`);
          await Promise.all(dispatchPromises);
        }

        // Send email
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (RESEND_API_KEY && (orgSuccessful > 0 || orgFailed > 0)) {
          try {
        const orgData = orgDoc.data();
        const membersSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('members')
          .where('role', '==', 'owner')
          .limit(1)
          .get();
        
        if (!membersSnapshot.empty) {
              const ownerEmail = membersSnapshot.docs[0].data().email;
              
              // Skip if no email found
              if (!ownerEmail) {
                console.log(`  ⏭️ Skipping email - no owner email found`);
              } else {
              const orgName = orgData.name || 'Your Organization';

              console.log(`  📧 Fetching email data...`);

              // Fetch all projects for this org to get comprehensive stats
              const projectsSnapshot = await db
                .collection('organizations')
                .doc(orgId)
                .collection('projects')
                .get();

              let totalViews = 0;
              let totalLikes = 0;
              let totalComments = 0;
              let totalShares = 0;
              let totalLinkClicks = 0;
              let previousTotalViews = 0;
              const accountStats: any[] = [];

              for (const projectDoc of projectsSnapshot.docs) {
                const projectId = projectDoc.id;

                // Get all videos
                const videosSnapshot = await db
                  .collection('organizations')
                  .doc(orgId)
                  .collection('projects')
                  .doc(projectId)
                  .collection('videos')
                  .where('status', '==', 'active')
                  .get();

                // Get link clicks
                const linksSnapshot = await db
                  .collection('organizations')
                  .doc(orgId)
                  .collection('projects')
                  .doc(projectId)
                  .collection('links')
                  .get();

                linksSnapshot.forEach((linkDoc) => {
                  const linkData = linkDoc.data();
                  totalLinkClicks += linkData.totalClicks || 0;
                });

                // Get accounts for this project
                const accountsSnapshot = await db
                  .collection('organizations')
                  .doc(orgId)
                  .collection('projects')
                  .doc(projectId)
                  .collection('trackedAccounts')
                  .where('isActive', '==', true)
                  .get();

                // Calculate account-level stats
                for (const accountDoc of accountsSnapshot.docs) {
                  const accountData = accountDoc.data();
                  const accountId = accountDoc.id;

                  // Get videos for this account
                  const accountVideos = videosSnapshot.docs.filter(
                    (v) => v.data().trackedAccountId === accountId
                  );

                  let accountViews = 0;
                  let accountPreviousViews = 0;
                  let accountLikes = 0;
                  let accountComments = 0;
                  let accountShares = 0;

                  for (const videoDoc of accountVideos) {
                    const videoData = videoDoc.data();
                    accountViews += videoData.views || 0;
                    accountLikes += videoData.likes || 0;
                    accountComments += videoData.comments || 0;
                    accountShares += videoData.shares || 0;

                    // Get previous snapshot to calculate growth
                    const snapshotsSnapshot = await videoDoc.ref
                      .collection('snapshots')
                      .orderBy('capturedAt', 'desc')
                      .limit(2)
                      .get();

                    if (snapshotsSnapshot.size >= 2) {
                      const previousSnapshot = snapshotsSnapshot.docs[1].data();
                      accountPreviousViews += previousSnapshot.views || 0;
                    } else {
                      accountPreviousViews += videoData.views || 0;
                    }
                  }

                  totalViews += accountViews;
                  totalLikes += accountLikes;
                  totalComments += accountComments;
                  totalShares += accountShares;
                  previousTotalViews += accountPreviousViews;

                  const viewGrowth = accountViews - accountPreviousViews;
                  const viewGrowthPercent = accountPreviousViews > 0 
                    ? ((viewGrowth / accountPreviousViews) * 100).toFixed(1)
                    : '0.0';

                  accountStats.push({
                    username: accountData.username,
                    platform: accountData.platform,
                    views: accountViews,
                    viewGrowth,
                    viewGrowthPercent,
                    likes: accountLikes,
                    comments: accountComments,
                    shares: accountShares,
                    videoCount: accountVideos.length
          });
        }
      }
      
              // Sort accounts by view growth (highest first)
              accountStats.sort((a, b) => b.viewGrowth - a.viewGrowth);

              // Calculate overall growth
              const totalViewGrowth = totalViews - previousTotalViews;
              const totalViewGrowthPercent = previousTotalViews > 0 
                ? ((totalViewGrowth / previousTotalViews) * 100).toFixed(1)
                : '0.0';

              // Calculate time since last refresh
              const now = Date.now();
              const refreshIntervalHours = (PLAN_REFRESH_INTERVALS[orgPlanTier] || 12);
              const timeSinceRefresh = refreshIntervalHours;

              // Helper function to format numbers
              const formatNumber = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                return num.toString();
              };

              // Helper function for growth emoji
              const getGrowthEmoji = (percent: string) => {
                const num = parseFloat(percent);
                if (num > 10) return '🟢';
                if (num > 0) return '🟡';
                if (num === 0) return '⚪️';
                return '🔴';
              };

              console.log(`  📧 Sending email to ${ownerEmail}...`);

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'ViewTrack <team@viewtrack.app>',
                  to: [ownerEmail],
                  subject: `📊 Your ViewTrack Report for ${orgName} (${timeSinceRefresh}h refresh)`,
              html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
                  <div style="padding: 30px 20px;">
                        <h1 style="font-size: 20px; color: #111; margin: 0 0 10px 0; font-weight: 600;">Your ViewTrack Report for ${orgName}</h1>
                        <p style="color: #666; font-size: 14px; margin: 0 0 30px 0;">(Refreshed ${timeSinceRefresh}h ago)</p>
                        
                        <!-- Key Metrics -->
                        <div style="margin-bottom: 30px;">
                          <p style="margin: 10px 0; color: #111; font-size: 15px;">
                            👁️ <strong>${formatNumber(totalViews)} views</strong> 
                            (${getGrowthEmoji(totalViewGrowthPercent)} ${totalViewGrowthPercent >= 0 ? '+' : ''}${totalViewGrowthPercent}%)
                          </p>
                          <p style="margin: 10px 0; color: #111; font-size: 15px;">
                            ❤️ <strong>${formatNumber(totalLikes)} likes</strong>
                          </p>
                          <p style="margin: 10px 0; color: #111; font-size: 15px;">
                            💬 <strong>${formatNumber(totalComments)} comments</strong>
                          </p>
                          <p style="margin: 10px 0; color: #111; font-size: 15px;">
                            🔗 <strong>${formatNumber(totalLinkClicks)} link clicks</strong>
                          </p>
                          <p style="margin: 10px 0; color: #111; font-size: 15px;">
                            🎬 <strong>${orgSuccessful} accounts refreshed</strong>
                            ${orgVideosRefreshed > 0 ? ` (${orgVideosRefreshed} videos synced)` : ''}
                          </p>
                        </div>

                        ${orgFailed > 0 ? `
                          <div style="background: #fee2e2; border-left: 3px solid #ef4444; padding: 12px 15px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0; color: #dc2626; font-size: 14px;">⚠️ ${orgFailed} account(s) failed to refresh</p>
                        </div>
                        ` : ''}
                        
                        <!-- Account Breakdown -->
                        ${accountStats.length > 0 ? `
                          <div style="margin: 30px 0;">
                            <h2 style="font-size: 16px; color: #111; margin: 0 0 15px 0; font-weight: 600;">📊 Account Performance</h2>
                            ${accountStats.slice(0, 5).map(account => `
                              <div style="border-bottom: 1px solid #eee; padding: 12px 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                                    <p style="margin: 0; color: #111; font-size: 14px; font-weight: 600;">
                                      @${account.username}
                                      <span style="color: #666; font-weight: normal; font-size: 13px;">(${account.platform})</span>
                                    </p>
                                    <p style="margin: 4px 0 0 0; color: #666; font-size: 13px;">
                                      ${formatNumber(account.views)} views · ${formatNumber(account.likes)} likes · ${account.videoCount} videos
                                    </p>
                        </div>
                                  <div style="text-align: right;">
                                    <p style="margin: 0; color: ${account.viewGrowth >= 0 ? '#22c55e' : '#ef4444'}; font-size: 14px; font-weight: 600;">
                                      ${account.viewGrowth >= 0 ? '+' : ''}${formatNumber(account.viewGrowth)}
                                    </p>
                                    <p style="margin: 4px 0 0 0; color: #666; font-size: 12px;">
                                      ${getGrowthEmoji(account.viewGrowthPercent)} ${account.viewGrowthPercent}%
                                    </p>
                        </div>
                      </div>
                    </div>
                            `).join('')}
                      </div>
                    ` : ''}
                    
                        <div style="text-align: center; margin-top: 35px;">
                          <a href="https://www.viewtrack.app/dashboard" style="display: inline-block; padding: 12px 30px; background: #111; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                            View Full Dashboard
                      </a>
                    </div>
                    
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                          <p style="margin: 0; color: #999; font-size: 12px;">
                            ViewTrack · Social Media Analytics
                          </p>
                        </div>
                  </div>
                </div>
              `,
            }),
          });

          if (emailResponse.ok) {
                console.log(`  ✅ Email sent`);
              }
              
              // Rate limit
              await new Promise(resolve => setTimeout(resolve, 600));
              }
            }
          } catch (emailError: any) {
            console.warn(`  ⚠️ Email failed: ${emailError.message}`);
          }
        }

        console.log(`  ✅ Org complete: ${orgSuccessful} successful, ${orgFailed} failed\n`);
        
        globalTotalAccounts += orgTotalAccounts;
        globalTotalRefreshed += orgSuccessful;
        globalTotalVideosRefreshed += orgVideosRefreshed;
        successfulOrgs++;

      } catch (error: any) {
        console.error(`  ❌ Org ${orgId} failed: ${error.message}\n`);
        failedOrgs++;
        }
      }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n============================================================`);
    console.log(`🎉 Orchestrator completed!`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Organizations: ${orgsSnapshot.size} total, ${successfulOrgs} successful, ${failedOrgs} failed`);
    console.log(`👥 Total accounts found: ${globalTotalAccounts}`);
    console.log(`⚡ Total accounts refreshed: ${globalTotalRefreshed}`);
    console.log(`🎬 Total videos synced: ${globalTotalVideosRefreshed}`);
    console.log(`============================================================\n`);

    return res.status(200).json({
      success: true,
      duration: parseFloat(duration),
      stats: {
        orgsTotal: orgsSnapshot.size,
        orgsSuccessful: successfulOrgs,
        orgsFailed: failedOrgs,
        accountsFound: globalTotalAccounts,
        accountsRefreshed: globalTotalRefreshed,
        videosSynced: globalTotalVideosRefreshed
      }
    });

  } catch (error: any) {
    console.error(`❌ Orchestrator error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      errorType: error.name || 'Error',
      timestamp: new Date().toISOString()
    });
  }
}
