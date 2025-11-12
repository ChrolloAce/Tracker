import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
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

// Subscription plan refresh intervals (in hours)
const PLAN_REFRESH_INTERVALS: Record<string, number> = {
  free: 0.0833,     // 5 minutes for testing (normally 48 hours)
  basic: 0.0833,    // 5 minutes for testing (normally 24 hours)
  pro: 0.0833,      // 5 minutes for testing (normally 24 hours)
  ultra: 0.0833,    // 5 minutes for testing (normally 12 hours)
  enterprise: 0.0833, // 5 minutes for testing (normally 12 hours)
};

/**
 * Cron Orchestrator
 * Runs every 5 minutes for testing
 * Processes all organizations directly (no HTTP calls)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or Vercel Cron header
  let authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  // Strip "Bearer " prefix if present
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authHeader = authHeader.substring(7);
  }
  
  console.log('🔐 Auth check:', {
    isVercelCron,
    hasAuth: !!authHeader,
    authMatches: authHeader === cronSecret,
    hasCronSecret: !!cronSecret,
    authHeaderLength: authHeader?.length || 0,
    cronSecretLength: cronSecret?.length || 0,
    authFirst10: authHeader?.substring(0, 10) || 'none',
    secretFirst10: cronSecret?.substring(0, 10) || 'none',
  });
  
  const isAuthorized = isVercelCron || authHeader === cronSecret;
  
  if (!isAuthorized) {
    console.log('❌ Unauthorized cron request');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'This endpoint is only accessible by Vercel Cron or with valid CRON_SECRET'
    });
  }
  
  console.log('✅ Authorized:', isVercelCron ? 'Vercel Cron' : 'Auth Header');

  const startTime = Date.now();
  console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s)\n`);

    let globalTotalAccounts = 0;
    let globalTotalRefreshed = 0;
    let globalTotalVideosRefreshed = 0;
    let globalTotalVideosAdded = 0;
    let successfulOrgs = 0;
    let failedOrgs = 0;

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.viewtrack.app';

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
        let orgVideosAdded = 0;
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
            .where('status', '==', 'active')
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

            const dispatchPromise = fetch(`${baseUrl}/api/refresh-account`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': cronSecret || ''
              },
              body: JSON.stringify({
                organizationId: orgId,
                projectId,
                accountId: accountDoc.id,
                platform: accountData.platform,
                username: accountData.username
              })
            })
              .then(async (response) => {
                if (response.ok) {
                  const result = await response.json();
                  orgSuccessful++;
                  orgVideosRefreshed += result.videosRefreshed || 0;
                  orgVideosAdded += result.videosAdded || 0;
                  console.log(`          ✅ @${accountData.username}: ${result.videosRefreshed || 0} refreshed, ${result.videosAdded || 0} new`);
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
              const orgName = orgData.name || 'Your Organization';

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
                  subject: `📊 ${orgName} - Video Refresh Complete${orgVideosAdded > 0 ? ` (+${orgVideosAdded} New)` : ''}`,
                  html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="text-align: center; padding: 30px 20px; background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
                        <img src="https://www.viewtrack.app/blacklogo.png" alt="ViewTrack" style="height: 40px; width: auto;" />
                      </div>
                      <div style="padding: 30px 20px;">
                        <h2 style="color: #22c55e; margin-top: 0;">✅ Refresh Complete!</h2>
                        <p style="color: #666; font-size: 16px;">
                          Your tracked accounts have been refreshed with the latest data.
                        </p>
                        
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                              <div style="color: #666; font-size: 14px;">Accounts Processed</div>
                              <div style="color: #111; font-size: 24px; font-weight: bold;">${orgSuccessful}</div>
                            </div>
                            <div>
                              <div style="color: #666; font-size: 14px;">Videos Refreshed</div>
                              <div style="color: #111; font-size: 24px; font-weight: bold;">${orgVideosRefreshed}</div>
                            </div>
                            <div>
                              <div style="color: #666; font-size: 14px;">New Videos Added</div>
                              <div style="color: #22c55e; font-size: 24px; font-weight: bold;">+${orgVideosAdded}</div>
                            </div>
                          </div>
                        </div>
                        
                        ${orgFailed > 0 ? `
                          <div style="background: #fee; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                            <strong style="color: #dc2626;">⚠️ ${orgFailed} Account(s) Failed</strong>
                          </div>
                        ` : ''}
                        
                        <div style="text-align: center; margin-top: 30px;">
                          <a href="https://www.viewtrack.app" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                            View Dashboard
                          </a>
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
          } catch (emailError: any) {
            console.warn(`  ⚠️ Email failed: ${emailError.message}`);
          }
        }

        console.log(`  ✅ Org complete: ${orgSuccessful} successful, ${orgFailed} failed\n`);
        
        globalTotalAccounts += orgTotalAccounts;
        globalTotalRefreshed += orgSuccessful;
        globalTotalVideosRefreshed += orgVideosRefreshed;
        globalTotalVideosAdded += orgVideosAdded;
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
    console.log(`🎬 Total videos refreshed: ${globalTotalVideosRefreshed}`);
    console.log(`➕ Total new videos: ${globalTotalVideosAdded}`);
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
        videosRefreshed: globalTotalVideosRefreshed,
        videosAdded: globalTotalVideosAdded
      }
    });

  } catch (error: any) {
    console.error(`❌ Orchestrator error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
