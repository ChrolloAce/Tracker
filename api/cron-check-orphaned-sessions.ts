import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function initializeFirebase() {
  if (!getApps().length) {
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
  }
  return getFirestore();
}

/**
 * Cron Job: Check for Orphaned Sessions
 * Runs every hour (0 * * * *)
 * 
 * PURPOSE:
 * Fallback mechanism to recover sessions where:
 * 1. All accounts completed successfully
 * 2. But email failed to send (network issue, API error, etc.)
 * 3. Or the "last one out" logic had a race condition
 * 
 * LOGIC:
 * Find sessions where:
 * - status === 'completed'
 * - emailSent === false
 * - completedAt > 5 minutes ago
 * 
 * Retry sending the email and mark as sent.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = initializeFirebase();
    
    // Verify authorization
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ Unauthorized orphaned session check request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`\n🔍 Checking for orphaned sessions...`);
    const startTime = Date.now();
    
    // Find all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`  📊 Scanning ${orgsSnapshot.size} organizations`);
    
    let totalChecked = 0;
    let emailsSent = 0;
    let errors = 0;
    
    // Check each organization's refresh sessions
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      
      try {
        const sessionsRef = db
          .collection('organizations')
          .doc(orgId)
          .collection('refreshSessions');
        
        // Find orphaned sessions (completed but email not sent, and completed > 5 mins ago)
        const fiveMinutesAgo = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
        
        const orphanedSessions = await sessionsRef
          .where('status', '==', 'completed')
          .where('emailSent', '==', false)
          .where('completedAt', '<', fiveMinutesAgo)
          .get();
        
        totalChecked += orphanedSessions.size;
        
        if (orphanedSessions.empty) {
          continue;
        }
        
        console.log(`  🔔 Found ${orphanedSessions.size} orphaned session(s) for org ${orgId}`);
        
        // Retry sending emails
        for (const sessionDoc of orphanedSessions.docs) {
          const session = sessionDoc.data();
          const sessionId = sessionDoc.id;
          
          try {
            console.log(`  📧 Retrying email for session ${sessionId}...`);
            
            // Send summary email
            await sendRefreshSummaryEmail(session, db);
            
            // Mark as sent
            await sessionDoc.ref.update({
              emailSent: true,
              emailSentAt: Timestamp.now(),
              recoveredByOrphanCheck: true
            });
            
            emailsSent++;
            console.log(`  ✅ Successfully sent orphaned email for session ${sessionId}`);
            
          } catch (emailError: any) {
            console.error(`  ❌ Failed to send email for session ${sessionId}:`, emailError.message);
            errors++;
          }
        }
        
        // Check for sessions stuck in 'dispatching' with no remaining jobs
        const thirtyMinutesAgo = Timestamp.fromMillis(Date.now() - 30 * 60 * 1000);

        const stuckDispatchingSessions = await sessionsRef
          .where('status', '==', 'dispatching')
          .where('startedAt', '<', thirtyMinutesAgo)
          .get();

        for (const sessionDoc of stuckDispatchingSessions.docs) {
          const session = sessionDoc.data();
          const sessionId = sessionDoc.id;

          try {
            // Only force-complete if no jobs are still pending or running
            const remainingJobs = await db
              .collection('syncQueue')
              .where('sessionId', '==', sessionId)
              .where('status', 'in', ['pending', 'running'])
              .limit(1)
              .get();

            if (!remainingJobs.empty) {
              continue;
            }

            console.log(`  🔧 Force-completing stuck session ${sessionId} for org ${orgId}`);

            await sessionDoc.ref.update({
              status: 'completed',
              completedAt: Timestamp.now(),
              recoveredByStuckDispatchCheck: true
            });

            const finalSession = (await sessionDoc.ref.get()).data();

            if (finalSession && finalSession.ownerEmail) {
              try {
                await sendRefreshSummaryEmail(finalSession, db);

                await sessionDoc.ref.update({
                  emailSent: true,
                  emailSentAt: Timestamp.now()
                });

                emailsSent++;
                console.log(`  ✅ Email sent for force-completed session ${sessionId}`);
              } catch (emailError: any) {
                console.error(`  ❌ Failed to send email for stuck session ${sessionId}:`, emailError.message);
                errors++;
              }
            }
          } catch (sessionError: any) {
            console.error(`  ❌ Error recovering stuck session ${sessionId}:`, sessionError.message);
            errors++;
          }
        }

      } catch (orgError: any) {
        console.error(`  ❌ Error checking org ${orgId}:`, orgError.message);
        errors++;
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n============================================================`);
    console.log(`🔍 Orphaned Session Check Complete`);
    console.log(`============================================================`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Sessions checked: ${totalChecked}`);
    console.log(`📧 Emails sent: ${emailsSent}`);
    console.log(`❌ Errors: ${errors}\n`);
    
    return res.status(200).json({
      success: true,
      stats: {
        duration: parseFloat(duration),
        sessionsChecked: totalChecked,
        emailsSent,
        errors
      }
    });
    
  } catch (error: any) {
    console.error('❌ Orphaned session check error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Send refresh summary email (copied from sync-single-account.ts)
 */
async function sendRefreshSummaryEmail(session: any, db: any) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set - skipping email');
    return;
  }
  
  if (!session.ownerEmail) {
    console.warn('⚠️ No owner email found - skipping email');
    return;
  }
  
  const timeSinceStart = Date.now() - session.startedAt.toMillis();
  const minutesElapsed = Math.round(timeSinceStart / (1000 * 60));
  
  // Sort accounts by views (top performers first)
  const accountStats = Object.values(session.accountStats || {}) as any[];
  const topPerformers = accountStats
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);
  
  // Generate top performers HTML
  const topPerformersHtml = topPerformers
    .map((acc, index) => {
      const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const platformEmoji = acc.platform === 'tiktok' ? '📱' : acc.platform === 'youtube' ? '▶️' : acc.platform === 'instagram' ? '📷' : '🐦';
      
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${acc.profilePicture ? `<img src="${acc.profilePicture}" alt="" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : ''}
              <div>
                <div style="font-weight: 600; color: #111827;">${rankEmoji} @${acc.username}</div>
                <div style="font-size: 12px; color: #6b7280;">${platformEmoji} ${acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)}</div>
              </div>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #111827;">${(acc.views || 0).toLocaleString()}</div>
            <div style="font-size: 12px; color: #6b7280;">views</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #111827;">${(acc.likes || 0).toLocaleString()}</div>
            <div style="font-size: 12px; color: #6b7280;">likes</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <div style="font-weight: 600; color: #f5576c;">${acc.videosSynced || 0}</div>
            <div style="font-size: 12px; color: #6b7280;">new</div>
          </td>
        </tr>
      `;
    })
    .join('');
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                    <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 42px; width: auto; margin-bottom: 15px;" />
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      🎉 Refresh Complete!
                    </h1>
                    <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                      ${session.orgName || 'Your organization'}'s data has been updated
                    </p>
                  </td>
                </tr>
                
                <!-- Summary Stats -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #374151;">
                      Great news! We've successfully refreshed all your tracked accounts with the latest data.
                    </p>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 30px 0;">
                      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px;">Accounts</div>
                        <div style="color: #ffffff; font-size: 32px; font-weight: 700;">${session.completedAccounts || 0}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px;">New Videos</div>
                        <div style="color: #ffffff; font-size: 32px; font-weight: 700;">${session.totalVideos || 0}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="color: #374151; font-size: 14px; margin-bottom: 5px;">Total Views</div>
                        <div style="color: #111827; font-size: 32px; font-weight: 700;">${(session.totalViews || 0).toLocaleString()}</div>
                      </div>
                      <div style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); padding: 20px; border-radius: 10px; text-align: center;">
                        <div style="color: #374151; font-size: 14px; margin-bottom: 5px;">Total Likes</div>
                        <div style="color: #111827; font-size: 32px; font-weight: 700;">${(session.totalLikes || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <!-- Top Performers -->
                    ${topPerformers.length > 0 ? `
                    <div style="margin: 40px 0 30px;">
                      <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 700; color: #111827;">
                        🏆 Top Performers
                      </h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        ${topPerformersHtml}
                      </table>
                    </div>
                    ` : ''}
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 40px 0 20px;">
                      <a href="https://www.viewtrack.app" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                        View Full Dashboard →
                      </a>
                    </div>
                    
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin-top: 30px;">
                      <p style="margin: 0; font-size: 13px; color: #6b7280;">
                        ⏱️ Refresh completed in ${minutesElapsed} ${minutesElapsed === 1 ? 'minute' : 'minutes'}
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                      ViewTrack - Social Media Analytics
                    </p>
                    <p style="margin: 10px 0 0; font-size: 12px; color: #9ca3af;">
                      Automated refresh • ${new Date().toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  
  try {
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ViewTrack <team@viewtrack.app>',
        to: [session.ownerEmail],
        subject: `🎉 ${session.orgName || 'Your Organization'} - Refresh Complete${session.totalVideos > 0 ? ` (+${session.totalVideos} New Videos)` : ''}`,
        html: emailHtml
      })
    });
    
    if (!emailResponse.ok) {
      throw new Error(`Email API returned ${emailResponse.status}`);
    }
    
    console.log(`✅ Refresh summary email sent to ${session.ownerEmail}`);
    
  } catch (error: any) {
    console.error('❌ Failed to send refresh summary email:', error.message);
    throw error;
  }
}

