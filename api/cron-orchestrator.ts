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
// NOTE: Set to 5 minutes (0.0833 hours) for testing - change back to proper intervals in production
const PLAN_REFRESH_INTERVALS: Record<string, number> = {
  free: 0.0833,     // 5 minutes for testing (normally 48 hours)
  basic: 0.0833,    // 5 minutes for testing (normally 24 hours)
  pro: 0.0833,      // 5 minutes for testing (normally 24 hours)
  ultra: 0.0833,    // 5 minutes for testing (normally 12 hours)
  enterprise: 0.0833, // 5 minutes for testing (normally 12 hours)
};

/**
 * Cron Orchestrator
 * Runs every 5 minutes (*/5 * * * *) for testing
 * Refreshes accounts based on their organization's subscription plan:
 * - ALL PLANS: every 5 minutes for testing (normally 12-48 hours based on plan)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or Vercel Cron header
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  // Allow if:
  // 1. Authorization header matches CRON_SECRET
  // 2. Request is from Vercel Cron (x-vercel-cron header)
  if (!isVercelCron && authHeader !== cronSecret) {
    console.log('❌ Unauthorized cron request:', { 
      hasAuth: !!authHeader, 
      hasVercelCron: isVercelCron,
      headers: Object.keys(req.headers)
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log(`🚀 Cron Orchestrator started at ${new Date().toISOString()}`);

  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organization(s)`);

    let totalAccounts = 0;
    let dispatchedJobs = 0;
    let failedDispatches = 0;
    let skippedAccounts = 0;
    const dispatchPromises: Promise<any>[] = [];

    // For each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      console.log(`📁 Processing organization: ${orgId}`);

      // Get organization's subscription to determine refresh interval
      let orgPlanTier = 'free'; // Default to free
      try {
        const subscriptionDoc = await db
          .collection('organizations')
          .doc(orgId)
          .collection('billing')
          .doc('subscription')
          .get();
        
        if (subscriptionDoc.exists()) {
          const subscriptionData = subscriptionDoc.data();
          orgPlanTier = subscriptionData?.planTier || 'free';
        }
        console.log(`  📋 Organization plan: ${orgPlanTier}`);
      } catch (error) {
        console.error(`  ⚠️ Failed to get subscription, defaulting to free plan:`, error);
      }

      const refreshIntervalHours = PLAN_REFRESH_INTERVALS[orgPlanTier] || 24;
      const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;
      console.log(`  ⏱️  Refresh interval: ${refreshIntervalHours} hours`);

      // Get all projects in this org
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      console.log(`  📂 Found ${projectsSnapshot.size} project(s)`);

      // For each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        console.log(`  📦 Processing project: ${projectData?.name || projectId}`);

        // Refresh accounts based on plan's refresh interval
        console.log(`    🚀 Checking accounts for refresh (${refreshIntervalHours}h interval)...`);

        // Get all active tracked accounts
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('status', '==', 'active')
          .get();

        totalAccounts += accountsSnapshot.size;
        console.log(`    👥 Found ${accountsSnapshot.size} active account(s)`);

        // Dispatch refresh jobs for accounts that need refreshing
        const now = Date.now();
        for (const accountDoc of accountsSnapshot.docs) {
          const accountId = accountDoc.id;
          const accountData = accountDoc.data();

          // Check if enough time has passed since last refresh
          const lastRefreshed = accountData.lastRefreshed?.toMillis() || 0;
          const timeSinceRefresh = now - lastRefreshed;
          const needsRefresh = timeSinceRefresh >= refreshIntervalMs;

          if (!needsRefresh) {
            const hoursRemaining = ((refreshIntervalMs - timeSinceRefresh) / (1000 * 60 * 60)).toFixed(1);
            console.log(`      ⏭️  Skipping @${accountData.username} (refreshed ${(timeSinceRefresh / (1000 * 60 * 60)).toFixed(1)}h ago, ${hoursRemaining}h remaining)`);
            skippedAccounts++;
            continue;
          }

          console.log(`      ⚡ Dispatching @${accountData.username} (${accountData.platform}), last refresh: ${lastRefreshed ? new Date(lastRefreshed).toISOString() : 'never'}`);

          // Dispatch async refresh job
          const dispatchPromise = fetch(`${process.env.VERCEL_URL || 'https://www.viewtrack.app'}/api/refresh-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              orgId,
              projectId,
              accountId
            })
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                console.log(`        ✅ @${accountData.username}: ${data.videosUpdated} updated, ${data.videosAdded} added`);
                dispatchedJobs++;
                return { success: true, account: accountData.username };
              } else {
                const errorText = await response.text();
                console.error(`        ❌ @${accountData.username} failed: ${errorText}`);
                failedDispatches++;
                return { success: false, account: accountData.username, error: errorText };
              }
            })
            .catch((error) => {
              console.error(`        ❌ @${accountData.username} dispatch error:`, error.message);
              failedDispatches++;
              return { success: false, account: accountData.username, error: error.message };
            });

          dispatchPromises.push(dispatchPromise);

          // Small stagger to avoid overwhelming (50ms between dispatches)
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Check if project has Apple revenue integration and sync if enabled
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
          console.log(`    💰 Found Apple revenue integration, syncing...`);
          
          // Sync last 7 days to catch any new data (incremental sync)
          const dispatchPromise = fetch(`${process.env.VERCEL_URL || 'https://www.viewtrack.app'}/api/sync-apple-revenue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': cronSecret || ''
            },
            body: JSON.stringify({
              organizationId: orgId,
              projectId: projectId,
              dateRange: '7', // Last 7 days for incremental sync
              manual: false
            })
          })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                console.log(`      ✅ Revenue synced: $${data.data?.totalRevenue || 0}, ${data.data?.totalDownloads || 0} downloads`);
                return { success: true, type: 'revenue' };
              } else {
                const errorText = await response.text();
                console.error(`      ❌ Revenue sync failed: ${errorText}`);
                return { success: false, type: 'revenue', error: errorText };
              }
            })
            .catch((error) => {
              console.error(`      ❌ Revenue sync dispatch error:`, error.message);
              return { success: false, type: 'revenue', error: error.message };
            });

          dispatchPromises.push(dispatchPromise);
        }

        // Update project's lastGlobalRefresh timestamp
        await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .update({
            lastGlobalRefresh: Timestamp.now()
          });
        
        console.log(`    ✅ Updated lastGlobalRefresh for project`);
      }
    }

    // Wait for all dispatched jobs to complete
    console.log(`\n⏳ Waiting for ${dispatchPromises.length} dispatched jobs to complete...`);
    const results = await Promise.allSettled(dispatchPromises);

    // Aggregate stats from all results
    let totalVideosRefreshed = 0;
    let totalVideosAdded = 0;
    const failedAccounts: Array<{ account: string; reason: string }> = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        // Account refresh job succeeded
        if (result.value.type !== 'revenue') {
          totalVideosRefreshed += result.value.videosUpdated || 0;
          totalVideosAdded += result.value.videosAdded || 0;
        }
      } else if (result.status === 'fulfilled' && !result.value.success) {
        // Account refresh job failed
        failedAccounts.push({
          account: result.value.account || 'Unknown',
          reason: result.value.error || 'Unknown error'
        });
      } else if (result.status === 'rejected') {
        // Promise rejected
        failedAccounts.push({
          account: 'Unknown',
          reason: (result.reason as any)?.message || 'Promise rejected'
        });
      }
    }

    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)).length;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n============================================================`);
    console.log(`🎉 Orchestrator completed!`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Accounts found: ${totalAccounts}`);
    console.log(`⏭️  Skipped (not due yet): ${skippedAccounts}`);
    console.log(`🚀 Jobs dispatched: ${dispatchPromises.length}`);
    console.log(`✅ Jobs successful: ${successful}`);
    console.log(`❌ Jobs failed: ${failed}`);
    console.log(`🎬 Videos refreshed: ${totalVideosRefreshed}`);
    console.log(`➕ New videos added: ${totalVideosAdded}`);
    console.log(`============================================================\n`);

    // Send email summary for each organization
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY && (successful > 0 || failed > 0)) {
      console.log(`📧 Sending refresh summary emails...`);
      
      // Get unique organizations from the dispatched jobs
      const orgEmailMap = new Map<string, { email: string; orgName: string; accountsProcessed: number; videosRefreshed: number; videosAdded: number; failedAccounts: Array<{ account: string; reason: string }> }>();
      
      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();
        
        // Get organization owner's email
        const membersSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('members')
          .where('role', '==', 'owner')
          .limit(1)
          .get();
        
        if (!membersSnapshot.empty) {
          const ownerData = membersSnapshot.docs[0].data();
          orgEmailMap.set(orgId, {
            email: ownerData.email,
            orgName: orgData.name || 'Your Organization',
            accountsProcessed: 0,
            videosRefreshed: 0,
            videosAdded: 0,
            failedAccounts: []
          });
        }
      }
      
      // Aggregate stats by organization (simplified - using totals for now)
      // In a more sophisticated version, we'd track which account belongs to which org
      for (const [orgId, orgInfo] of orgEmailMap.entries()) {
        orgInfo.accountsProcessed = successful;
        orgInfo.videosRefreshed = totalVideosRefreshed;
        orgInfo.videosAdded = totalVideosAdded;
        orgInfo.failedAccounts = failedAccounts;
      }
      
      // Send emails
      for (const [orgId, orgInfo] of orgEmailMap.entries()) {
        if (orgInfo.accountsProcessed === 0 && orgInfo.failedAccounts.length === 0) {
          continue; // Skip if no activity
        }
        
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'ViewTrack <team@viewtrack.app>',
              to: [orgInfo.email],
              subject: `📊 ${orgInfo.orgName} - Video Refresh Complete${orgInfo.videosAdded > 0 ? ` (+${orgInfo.videosAdded} New)` : ''}`,
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
                          <div style="color: #111; font-size: 24px; font-weight: bold;">${orgInfo.accountsProcessed}</div>
                        </div>
                        <div>
                          <div style="color: #666; font-size: 14px;">Videos Refreshed</div>
                          <div style="color: #111; font-size: 24px; font-weight: bold;">${orgInfo.videosRefreshed}</div>
                        </div>
                        <div>
                          <div style="color: #666; font-size: 14px;">New Videos Added</div>
                          <div style="color: #22c55e; font-size: 24px; font-weight: bold;">+${orgInfo.videosAdded}</div>
                        </div>
                        <div>
                          <div style="color: #666; font-size: 14px;">Duration</div>
                          <div style="color: #111; font-size: 24px; font-weight: bold;">${duration}s</div>
                        </div>
                      </div>
                    </div>
                    
                    ${orgInfo.failedAccounts.length > 0 ? `
                      <div style="background: #fee; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                        <strong style="color: #dc2626;">⚠️ Failed Accounts (${orgInfo.failedAccounts.length})</strong>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #666;">
                          ${orgInfo.failedAccounts.map(f => `<li><strong>${f.account}</strong>: ${f.reason}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="https://www.viewtrack.app" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        View Dashboard
                      </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                      Automated refresh completed at<br>
                      ${new Date().toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              `,
            }),
          });

          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            console.log(`✅ Refresh summary email sent to ${orgInfo.email} (ID: ${emailData.id})`);
          } else {
            const errorData = await emailResponse.json();
            console.warn(`⚠️ [EMAIL] Failed to send refresh summary email for ${orgId}: ${JSON.stringify(errorData)}`);
          }
        } catch (emailError) {
          console.warn(`⚠️ [EMAIL] Failed to send refresh summary email for ${orgId}:`, emailError);
        }
      }
    } else if (!RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping email notifications');
    } else {
      console.log('ℹ️ No jobs processed - skipping email notifications');
    }

    // Final summary log after email attempt
    console.log(`\n📋 Final Summary:`);
    console.log(`   - Email notifications: ${RESEND_API_KEY ? 'Sent' : 'Skipped (no API key)'}`);
    console.log(`   - Total duration: ${duration}s`);
    console.log(`   - Status: Complete\n`);

    return res.status(200).json({
      success: true,
      message: 'Orchestrator completed',
      stats: {
        totalAccounts,
        accountsSkipped: skippedAccounts,
        jobsDispatched: dispatchPromises.length,
        jobsSuccessful: successful,
        jobsFailed: failed,
        videosRefreshed: totalVideosRefreshed,
        videosAdded: totalVideosAdded,
        duration: parseFloat(duration)
      },
      failedAccounts,
      results: results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return { success: false, error: r.reason };
        }
      })
    });

  } catch (error: any) {
    console.error(`❌ Orchestrator error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Orchestrator failed'
    });
  }
}

