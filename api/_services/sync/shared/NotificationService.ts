import { Timestamp } from 'firebase-admin/firestore';

/**
 * NotificationService
 * 
 * Responsibilities:
 * - Handle email notifications for sync events
 * - Generate HTML email summaries
 * - Send emails via Resend API
 */
export class NotificationService {
  /**
   * Send refresh summary email after all accounts in an organization have completed syncing
   * This implements the "last one out" pattern - only the final account to complete triggers the email
   * 
   * Shows DELTA metrics (what changed since last refresh) not absolute totals
   */
  static async sendRefreshSummaryEmail(session: any, db: FirebaseFirestore.Firestore) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not set - skipping email');
      return;
    }
    
    if (!session.ownerEmail) {
      console.warn('⚠️ No owner email found - skipping email');
      return;
    }
    
    console.log(`📧 Preparing email for: ${session.ownerEmail} (Org: ${session.orgName})`);
    console.log(`   Owner ID: ${session.ownerId || 'Not set'}`);
    console.log(`   Org ID: ${session.orgId}`);
    
    // Calculate time since last refresh (not this session duration)
    let timeSinceLastRefreshText = 'first refresh';
    let timeSinceLastRefreshMs = 0;
    
    if (session.previousRefreshTimestamp) {
      timeSinceLastRefreshMs = Date.now() - session.previousRefreshTimestamp.toMillis();
      const hours = Math.floor(timeSinceLastRefreshMs / (1000 * 60 * 60));
      const minutes = Math.floor((timeSinceLastRefreshMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        timeSinceLastRefreshText = `${days}d`;
      } else if (hours > 0) {
        timeSinceLastRefreshText = `${hours}h`;
      } else if (minutes > 0) {
        timeSinceLastRefreshText = `${minutes}m`;
      } else {
        timeSinceLastRefreshText = '<1m';
      }
    }
    
    // Calculate DELTA metrics (what changed since last refresh)
    const viewsGained = Math.max(0, (session.totalViews || 0) - (session.previousTotalViews || 0));
    const likesGained = Math.max(0, (session.totalLikes || 0) - (session.previousTotalLikes || 0));
    const commentsGained = Math.max(0, (session.totalComments || 0) - (session.previousTotalComments || 0));
    const sharesGained = Math.max(0, (session.totalShares || 0) - (session.previousTotalShares || 0));
    const linkClicksGained = Math.max(0, (session.totalLinkClicks || 0) - (session.previousTotalLinkClicks || 0));
    
    // Calculate engagement rate from deltas
    const totalEngagement = likesGained + commentsGained + sharesGained;
    const engagementRate = viewsGained > 0 
      ? ((totalEngagement / viewsGained) * 100).toFixed(2)
      : '0.00';
    
    // Get top 5 videos from THIS refresh cycle (sorted by views)
    console.log(`🔍 Fetching top videos from this refresh...`);
    const videosSnapshot = await db
      .collectionGroup('videos')
      .where('lastRefreshed', '>=', session.startedAt)
      .orderBy('lastRefreshed', 'desc')
      .orderBy('viewCount', 'desc')
      .limit(50) // Get more to filter to org
      .get();
    
    // Filter to only videos from this org
    const orgVideos = videosSnapshot.docs.filter((doc: any) => {
      const path = doc.ref.path;
      return path.includes(`organizations/${session.orgId}/`);
    });
    
    const topVideos = orgVideos.slice(0, 5);
    console.log(`   Found ${topVideos.length} top videos from this refresh`);
    
    // Sort accounts by views gained (top performers)
    const accountStats = Object.values(session.accountStats || {}) as any[];
    const topPerformers = accountStats
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
    
    // Generate top videos HTML from this refresh
    const topVideosHtml = topVideos
      .map((videoDoc: any, index: number) => {
        const video = videoDoc.data();
        const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
        const platform = video.platform || 'unknown';
        const platformEmoji = platform === 'tiktok' ? '📱' : platform === 'youtube' ? '▶️' : platform === 'instagram' ? '📷' : '🐦';
        
        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <div>
                <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${rankEmoji} ${video.title || 'Untitled'}</div>
                <div style="font-size: 12px; color: #6b7280;">${platformEmoji} ${platform.charAt(0).toUpperCase() + platform.slice(1)} • @${video.accountUsername || 'Unknown'}</div>
              </div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              <div style="font-weight: 600; color: #667eea;">${(video.viewCount || 0).toLocaleString()}</div>
              <div style="font-size: 11px; color: #6b7280;">views</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              <div style="font-weight: 600; color: #f56565;">${(video.likeCount || 0).toLocaleString()}</div>
              <div style="font-size: 11px; color: #6b7280;">likes</div>
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
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 40px; text-align: center;">
                      <img src="https://www.viewtrack.app/whitelogo.png" alt="ViewTrack" style="height: 40px; width: auto; margin-bottom: 20px;" />
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        ${session.orgName}
                      </h1>
                      <p style="margin: 12px 0 0; color: rgba(255,255,255,0.95); font-size: 18px; font-weight: 500;">
                        Data Refresh Complete
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Time Since Last Refresh Banner -->
                  <tr>
                    <td style="background: #f9fafb; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                      <p style="margin: 0; font-size: 15px; color: #6b7280;">
                        📊 In the last <strong style="color: #111827; font-weight: 700;">${timeSinceLastRefreshText}</strong>, you've gained:
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Delta Metrics -->
                  <tr>
                    <td style="padding: 40px;">
                      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px;">
                        <!-- Views Gained -->
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; text-align: center;">
                          <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Views</div>
                          <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 4px;">+${viewsGained.toLocaleString()}</div>
                          <div style="color: rgba(255,255,255,0.8); font-size: 12px;">gained</div>
                        </div>
                        
                        <!-- Link Clicks -->
                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 24px; border-radius: 12px; text-align: center;">
                          <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Link Clicks</div>
                          <div style="color: #ffffff; font-size: 36px; font-weight: 800; margin-bottom: 4px;">+${linkClicksGained.toLocaleString()}</div>
                          <div style="color: rgba(255,255,255,0.8); font-size: 12px;">gained</div>
                        </div>
                      </div>
                      
                      <!-- Engagement Rate Card -->
                      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 28px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
                        <div style="color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Engagement Rate</div>
                        <div style="color: #ffffff; font-size: 48px; font-weight: 800; margin-bottom: 4px;">${engagementRate}%</div>
                        <div style="color: rgba(255,255,255,0.8); font-size: 13px;">${totalEngagement.toLocaleString()} total engagements (likes + comments + shares)</div>
                      </div>
                      
                      <!-- Top Videos Section -->
                      ${topVideos.length > 0 ? `
                      <div style="margin: 40px 0;">
                        <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827; letter-spacing: -0.3px;">
                          🔥 Top 5 Videos from this Refresh
                        </h2>
                        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #ffffff;">
                          ${topVideosHtml}
                        </table>
                      </div>
                      ` : ''}
                      
                      <!-- CTA Button -->
                      <div style="text-align: center; margin: 48px 0 24px;">
                        <a href="https://www.viewtrack.app" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                          View Full Dashboard →
                        </a>
                      </div>
                      
                      <!-- Summary Footer -->
                      <div style="background-color: #f9fafb; padding: 20px; border-radius: 10px; text-align: center;">
                        <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                          <strong style="color: #111827;">${session.completedAccounts || 0}</strong> account${session.completedAccounts !== 1 ? 's' : ''} refreshed • 
                          <strong style="color: #111827;">${session.totalVideos || 0}</strong> new video${session.totalVideos !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #111827; padding: 28px 40px; text-align: center;">
                      <p style="margin: 0 0 8px; font-size: 15px; color: #ffffff; font-weight: 600;">
                        ViewTrack
                      </p>
                      <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                        Professional Social Media Analytics
                      </p>
                      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
                        Automated refresh • ${new Date().toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
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
          subject: `${session.orgName} - Data Refresh Complete (+${viewsGained.toLocaleString()} Views | ${engagementRate}% Engagement)`,
          html: emailHtml
        })
      });
      
      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error(`❌ Email API error (${emailResponse.status}):`, errorText);
        throw new Error(`Email API returned ${emailResponse.status}: ${errorText}`);
      }
      
      const emailResult = await emailResponse.json();
      console.log(`✅ Refresh summary email sent successfully!`);
      console.log(`   📧 Recipient: ${session.ownerEmail}`);
      console.log(`   🏢 Organization: ${session.orgName} (${session.orgId})`);
      console.log(`   👤 Owner ID: ${session.ownerId || 'Not set'}`);
      console.log(`   📊 Deltas: +${viewsGained.toLocaleString()} views, ${engagementRate}% engagement`);
      console.log(`   📨 Email ID: ${emailResult.id || 'Unknown'}`);
      
    } catch (error: any) {
      console.error('❌ Failed to send refresh summary email:', error.message);
      throw error;
    }
  }
}

