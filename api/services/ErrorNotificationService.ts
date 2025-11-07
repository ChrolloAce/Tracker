/**
 * ErrorNotificationService
 * 
 * Handles error notifications for failed account syncs and video processing
 * Sends emails to admins and logs errors to Firestore
 * Respects user notification preferences
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';

interface ErrorDetails {
  type: 'account_sync' | 'video_processing';
  platform: string;
  accountId?: string;
  videoId?: string;
  username?: string;
  videoUrl?: string;
  errorMessage: string;
  errorStack?: string;
  orgId: string;
  projectId: string;
  timestamp: Date;
  attemptNumber?: number;
}

export class ErrorNotificationService {
  /**
   * Get user notification preferences
   */
  private static async getUserPreferences(orgId: string, userId?: string): Promise<any> {
    if (!userId) return null;
    
    try {
      const db = getFirestore();
      const prefDoc = await db
        .collection('organizations')
        .doc(orgId)
        .collection('userPreferences')
        .doc(userId)
        .get();
      
      return prefDoc.exists ? prefDoc.data() : null;
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return null;
    }
  }

  /**
   * Check if user should receive email notification
   */
  private static async shouldSendEmail(details: ErrorDetails, userId?: string): Promise<{
    shouldSend: boolean;
    emailAddress: string;
  }> {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ernesto@maktubtechnologies.com';
    
    // Always send to admin by default
    let emailAddress = ADMIN_EMAIL;
    
    // If we have a userId, check their preferences
    if (userId) {
      const prefs = await this.getUserPreferences(details.orgId, userId);
      
      if (prefs) {
        // Check if error alerts are enabled
        const errorAlertsEnabled = prefs.email?.errorAlerts !== false;
        
        // Check specific error type preferences
        let specificTypeEnabled = true;
        if (details.type === 'account_sync') {
          specificTypeEnabled = prefs.email?.accountSyncIssues !== false;
        } else if (details.type === 'video_processing') {
          specificTypeEnabled = prefs.email?.videoProcessingIssues !== false;
        }
        
        if (!errorAlertsEnabled || !specificTypeEnabled) {
          console.log(`🔕 User has disabled ${details.type} notifications - skipping email`);
          return { shouldSend: false, emailAddress: ADMIN_EMAIL };
        }
        
        // Use custom email if provided
        if (prefs.delivery?.emailAddress) {
          emailAddress = prefs.delivery.emailAddress;
        }
        
        // Check quiet hours
        if (prefs.delivery?.quietHoursEnabled) {
          const timezone = prefs.delivery.timezone || 'UTC';
          const now = new Date();
          const currentTime = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: timezone
          });
          
          const start = prefs.delivery.quietHoursStart || '22:00';
          const end = prefs.delivery.quietHoursEnd || '08:00';
          
          // Check if current time is within quiet hours
          if (start > end) {
            // Quiet hours span midnight (e.g., 22:00 to 08:00)
            if (currentTime >= start || currentTime <= end) {
              console.log(`🔕 Quiet hours active (${start} - ${end}) - skipping email`);
              return { shouldSend: false, emailAddress };
            }
          } else {
            // Normal quiet hours (e.g., 01:00 to 06:00)
            if (currentTime >= start && currentTime <= end) {
              console.log(`🔕 Quiet hours active (${start} - ${end}) - skipping email`);
              return { shouldSend: false, emailAddress };
            }
          }
        }
      }
    }
    
    return { shouldSend: true, emailAddress };
  }

  /**
   * Send error notification email to admin
   */
  static async sendErrorEmail(details: ErrorDetails, userId?: string): Promise<void> {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not configured - skipping error email notification');
      return;
    }

    // Check user preferences
    const { shouldSend, emailAddress } = await this.shouldSendEmail(details, userId);
    
    if (!shouldSend) {
      console.log('⏭️ Skipping email notification due to user preferences');
      return;
    }

    try {
      console.log(`📧 Sending error notification email to ${emailAddress}...`);
      
      const subject = `❌ ${details.type === 'account_sync' ? 'Account Sync' : 'Video Processing'} Failed - ${details.platform.toUpperCase()}`;
      
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0A; color: #fff; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700;">⚠️ Error Alert</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">${details.type === 'account_sync' ? 'Account Sync Failed' : 'Video Processing Failed'}</p>
          </div>
          
          <div style="padding: 30px 20px;">
            <div style="background: #1A1A1A; border: 1px solid #333; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 15px; font-size: 16px; color: #DC2626;">Error Details</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888; width: 40%;">Type:</td>
                  <td style="padding: 10px 0; font-weight: 600;">${details.type === 'account_sync' ? 'Account Sync' : 'Video Processing'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Platform:</td>
                  <td style="padding: 10px 0; font-weight: 600; text-transform: uppercase;">${details.platform}</td>
                </tr>
                ${details.username ? `
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Username:</td>
                  <td style="padding: 10px 0; font-weight: 600;">@${details.username}</td>
                </tr>
                ` : ''}
                ${details.videoUrl ? `
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Video URL:</td>
                  <td style="padding: 10px 0; font-weight: 600; word-break: break-all;"><a href="${details.videoUrl}" style="color: #3B82F6; text-decoration: none;">${details.videoUrl}</a></td>
                </tr>
                ` : ''}
                ${details.accountId ? `
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Account ID:</td>
                  <td style="padding: 10px 0; font-family: monospace; font-size: 12px;">${details.accountId}</td>
                </tr>
                ` : ''}
                ${details.videoId ? `
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Video ID:</td>
                  <td style="padding: 10px 0; font-family: monospace; font-size: 12px;">${details.videoId}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Timestamp:</td>
                  <td style="padding: 10px 0;">${details.timestamp.toISOString()}</td>
                </tr>
                ${details.attemptNumber ? `
                <tr style="border-bottom: 1px solid #333;">
                  <td style="padding: 10px 0; color: #888;">Attempt #:</td>
                  <td style="padding: 10px 0;">${details.attemptNumber}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="background: #1A1A1A; border: 1px solid #DC2626; border-radius: 8px; padding: 20px;">
              <h3 style="margin: 0 0 10px; font-size: 14px; color: #DC2626;">Error Message:</h3>
              <p style="margin: 0; font-family: monospace; font-size: 13px; color: #FCA5A5; white-space: pre-wrap; word-break: break-word;">${details.errorMessage}</p>
              ${details.errorStack ? `
              <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #888; font-size: 12px;">View Stack Trace</summary>
                <pre style="margin: 10px 0 0; font-size: 11px; color: #666; overflow-x: auto;">${details.errorStack}</pre>
              </details>
              ` : ''}
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #1A1A1A; border: 1px solid #333; border-radius: 8px;">
              <p style="margin: 0; font-size: 13px; color: #888;">
                <strong>Organization:</strong> ${details.orgId}<br>
                <strong>Project:</strong> ${details.projectId}
              </p>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
              <a href="https://www.viewtrack.app/dashboard" style="display: inline-block; padding: 12px 24px; background: #DC2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Dashboard
              </a>
            </div>
          </div>
          
          <div style="padding: 20px; background: #0A0A0A; border-top: 1px solid #333; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              This is an automated error notification from ViewTrack
            </p>
          </div>
        </div>
      `;

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ViewTrack Errors <errors@viewtrack.app>',
          to: [emailAddress],
          subject: subject,
          html: html
        })
      });

      if (emailResponse.ok) {
        const result = await emailResponse.json();
        console.log(`✅ Error notification email sent successfully (ID: ${result.id})`);
      } else {
        const errorText = await emailResponse.text();
        console.error(`❌ Failed to send error notification email: ${emailResponse.status} ${errorText}`);
      }
    } catch (emailError) {
      console.error('❌ Error sending notification email:', emailError);
    }
  }

  /**
   * Log error to Firestore for tracking and debugging
   */
  static async logError(details: ErrorDetails): Promise<void> {
    try {
      const db = getFirestore(); // Lazy initialization
      const errorRef = db.collection('errors').doc();
      
      await errorRef.set({
        id: errorRef.id,
        type: details.type,
        platform: details.platform,
        accountId: details.accountId || null,
        videoId: details.videoId || null,
        username: details.username || null,
        videoUrl: details.videoUrl || null,
        errorMessage: details.errorMessage,
        errorStack: details.errorStack || null,
        orgId: details.orgId,
        projectId: details.projectId,
        timestamp: Timestamp.fromDate(details.timestamp),
        attemptNumber: details.attemptNumber || 1,
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
        notes: null
      });

      console.log(`📝 Error logged to Firestore: ${errorRef.id}`);
    } catch (logError) {
      console.error('❌ Failed to log error to Firestore:', logError);
    }
  }

  /**
   * Handle complete error notification flow
   * (email + Firestore logging)
   */
  static async notifyError(details: ErrorDetails, userId?: string): Promise<void> {
    console.log(`🚨 Error notification triggered: ${details.type} - ${details.platform} - ${details.username || details.videoUrl}`);
    
    // Run both in parallel
    await Promise.all([
      this.sendErrorEmail(details, userId),
      this.logError(details)
    ]);
  }

  /**
   * Mark error as resolved in Firestore
   */
  static async markErrorResolved(errorId: string, resolvedBy: string, notes?: string): Promise<void> {
    try {
      const db = getFirestore(); // Lazy initialization
      const errorRef = db.collection('errors').doc(errorId);
      
      await errorRef.update({
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy: resolvedBy,
        notes: notes || null
      });

      console.log(`✅ Error ${errorId} marked as resolved`);
    } catch (error) {
      console.error('❌ Failed to mark error as resolved:', error);
    }
  }
}

