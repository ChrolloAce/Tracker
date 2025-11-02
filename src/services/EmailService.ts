/**
 * EmailService
 * Service for sending emails via Resend API
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  emailId?: string;
  error?: string;
}

class EmailService {
  /**
   * Send a test email to the specified recipient
   */
  async sendTestEmail(to: string): Promise<EmailResponse> {
    try {
      const response = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject: '🎉 Test Email from Your App',
          html: this.getTestEmailTemplate(to),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.error || 'Failed to send email',
          error: data.error,
        };
      }

      return data;
    } catch (error: any) {
      console.error('Error sending test email:', error);
      return {
        success: false,
        message: 'Failed to send email',
        error: error.message,
      };
    }
  }

  /**
   * Send a custom email
   */
  async sendEmail(params: SendEmailParams): Promise<EmailResponse> {
    try {
      const response = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.error || 'Failed to send email',
          error: data.error,
        };
      }

      return data;
    } catch (error: any) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: 'Failed to send email',
        error: error.message,
      };
    }
  }

  /**
   * Send team member invitation email
   */
  async sendTeamInvitation(params: {
    to: string;
    recipientName: string;
    inviterName: string;
    organizationName: string;
    role: string;
    inviteLink: string;
  }): Promise<EmailResponse> {
    return this.sendEmail({
      to: params.to,
      subject: `${params.recipientName}, you're invited to join ${params.organizationName}!`,
      html: this.getTeamInvitationTemplate(params),
    });
  }

  /**
   * Send creator invitation email
   */
  async sendCreatorInvitation(params: {
    to: string;
    recipientName: string;
    inviterName: string;
    organizationName: string;
    projectName: string;
    inviteLink: string;
  }): Promise<EmailResponse> {
    return this.sendEmail({
      to: params.to,
      subject: `${params.recipientName}, you're invited to join ${params.organizationName}!`,
      html: this.getCreatorInvitationTemplate(params),
    });
  }

  /**
   * Get the HTML template for team invitation
   */
  private getTeamInvitationTemplate(params: {
    recipientName: string;
    inviterName: string;
    organizationName: string;
    role: string;
    inviteLink: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You're Invited to Join ${params.organizationName}</title>
          <style>
            @media only screen and (max-width: 600px) {
              .container { padding: 10px !important; }
              .header { padding: 30px 20px !important; }
              .content { padding: 30px 20px !important; }
              .title { font-size: 24px !important; }
              .subtitle { font-size: 16px !important; }
              .cta-button { padding: 16px 40px !important; font-size: 16px !important; }
              .info-box { padding: 20px !important; margin: 25px 0 !important; }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <div class="header" style="background: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 3px solid #333;">
                <h1 class="title" style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">You're Invited</h1>
              </div>
              
              <!-- Main Content -->
              <div class="content" style="padding: 40px 30px;">
                
                <!-- Personalized Greeting -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 class="subtitle" style="font-size: 20px; color: #1a1a1a; margin: 0 0 12px; font-weight: 600;">
                    ${params.recipientName}, you're invited to join
                  </h2>
                  <p style="font-size: 22px; color: #000; margin: 0 0 8px; font-weight: 700;">
                    ${params.organizationName}
                  </p>
                  <p style="font-size: 16px; color: #666; margin: 0;">
                    by <strong style="color: #333;">${params.inviterName}</strong>
                  </p>
                </div>
                
                <!-- Invitation Details Box -->
                <div class="info-box" style="background: #f8f8f8; padding: 25px; border-radius: 6px; border: 2px solid #e0e0e0; margin: 30px 0;">
                  <div style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Role</p>
                    <p style="margin: 0; font-size: 20px; color: #1a1a1a; font-weight: 700;">
                      ${params.role.charAt(0).toUpperCase() + params.role.slice(1)}
                    </p>
                  </div>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${params.inviteLink}" class="cta-button" style="display: inline-block; background: #1a1a1a; color: white; padding: 16px 48px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                    Join ${params.organizationName}
                  </a>
                </div>
                
                <!-- What Happens Next -->
                <div style="background: #fafafa; padding: 20px; border-radius: 6px; margin: 30px 0; border-left: 3px solid #333;">
                  <h3 style="margin: 0 0 12px; font-size: 14px; color: #1a1a1a; font-weight: 600;">What happens next?</h3>
                  <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                    <li>Click the button above to join ${params.organizationName}</li>
                    <li>Set up your password or continue with Google</li>
                    <li>You'll be automatically added to the team</li>
                    <li>Start collaborating right away</li>
                  </ol>
                </div>
                
                <!-- Direct Link -->
                <div style="margin-top: 30px; padding-top: 25px; border-top: 2px solid #e0e0e0;">
                  <p style="font-size: 12px; color: #888; margin: 0 0 8px; text-align: center;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="font-size: 11px; color: #666; word-break: break-all; text-align: center; background: #f8f8f8; padding: 10px; border-radius: 4px; margin: 0; font-family: 'Courier New', monospace; border: 1px solid #e0e0e0;">
                    ${params.inviteLink}
                  </p>
                </div>
                
              </div>
              
              <!-- Footer -->
              <div style="background: #fafafa; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 13px; color: #888; margin: 0 0 8px;">
                  This invitation was sent by <strong style="color: #333;">${params.inviterName}</strong>
                </p>
                <p style="font-size: 12px; color: #aaa; margin: 0;">
                  <span style="color: #1a1a1a; font-weight: 600;">ViewTrack</span> • viewtrack.app
                </p>
              </div>
              
            </div>
            
            <!-- Bottom Spacer -->
            <div style="height: 30px;"></div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get the HTML template for creator invitation
   */
  private getCreatorInvitationTemplate(params: {
    recipientName: string;
    inviterName: string;
    organizationName: string;
    projectName: string;
    inviteLink: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You're Invited as a Creator</title>
          <style>
            @media only screen and (max-width: 600px) {
              .container { padding: 10px !important; }
              .header { padding: 30px 20px !important; }
              .content { padding: 30px 20px !important; }
              .title { font-size: 24px !important; }
              .subtitle { font-size: 16px !important; }
              .cta-button { padding: 16px 40px !important; font-size: 16px !important; }
              .info-box { padding: 20px !important; margin: 25px 0 !important; }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <div class="header" style="background: #1a1a1a; padding: 40px 30px; text-align: center; border-bottom: 3px solid #333;">
                <h1 class="title" style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Creator Invitation</h1>
              </div>
              
              <!-- Main Content -->
              <div class="content" style="padding: 40px 30px;">
                
                <!-- Personalized Greeting -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 class="subtitle" style="font-size: 20px; color: #1a1a1a; margin: 0 0 12px; font-weight: 600;">
                    ${params.recipientName}, you're invited to join
                  </h2>
                  <p style="font-size: 22px; color: #000; margin: 0 0 8px; font-weight: 700;">
                    ${params.organizationName}
                  </p>
                  <p style="font-size: 16px; color: #666; margin: 0;">
                    by <strong style="color: #333;">${params.inviterName}</strong>
                  </p>
                </div>
                
                <!-- Invitation Details Box -->
                <div class="info-box" style="background: #f8f8f8; padding: 25px; border-radius: 6px; border: 2px solid #e0e0e0; margin: 30px 0;">
                  <div style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Role</p>
                    <p style="margin: 0 0 12px; font-size: 20px; color: #1a1a1a; font-weight: 700;">Creator</p>
                    <div style="padding-top: 12px; border-top: 1px solid #e0e0e0;">
                      <p style="margin: 0 0 6px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Project</p>
                      <p style="margin: 0; font-size: 16px; color: #333; font-weight: 600;">${params.projectName}</p>
                    </div>
                  </div>
                </div>
                
                <!-- What You Can Do -->
                <div style="background: #fafafa; padding: 20px; border-radius: 6px; margin: 30px 0; border-left: 3px solid #333;">
                  <h3 style="margin: 0 0 12px; font-size: 14px; color: #1a1a1a; font-weight: 600;">As a creator, you'll be able to:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                    <li style="margin-bottom: 6px;">View your performance metrics and analytics</li>
                    <li style="margin-bottom: 6px;">Track your content performance in real-time</li>
                    <li style="margin-bottom: 6px;">Submit new content for approval</li>
                    <li style="margin-bottom: 6px;">Access your payout information</li>
                    <li style="margin-bottom: 6px;">Create and manage tracked links</li>
                  </ul>
                </div>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${params.inviteLink}" class="cta-button" style="display: inline-block; background: #1a1a1a; color: white; padding: 16px 48px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                    Join ${params.organizationName}
                  </a>
                </div>
                
                <!-- What Happens Next -->
                <div style="background: #fafafa; padding: 20px; border-radius: 6px; margin: 30px 0; border-left: 3px solid #333;">
                  <h3 style="margin: 0 0 12px; font-size: 14px; color: #1a1a1a; font-weight: 600;">Getting started:</h3>
                  <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                    <li>Click the button above to join ${params.organizationName}</li>
                    <li>Set up your password or continue with Google</li>
                    <li>You'll be automatically added as a creator</li>
                    <li>Access your Creator Portal and start tracking</li>
                  </ol>
                </div>
                
                <!-- Direct Link -->
                <div style="margin-top: 30px; padding-top: 25px; border-top: 2px solid #e0e0e0;">
                  <p style="font-size: 12px; color: #888; margin: 0 0 8px; text-align: center;">
                    Or copy and paste this link into your browser:
                  </p>
                  <p style="font-size: 11px; color: #666; word-break: break-all; text-align: center; background: #f8f8f8; padding: 10px; border-radius: 4px; margin: 0; font-family: 'Courier New', monospace; border: 1px solid #e0e0e0;">
                    ${params.inviteLink}
                  </p>
                </div>
                
              </div>
              
              <!-- Footer -->
              <div style="background: #fafafa; padding: 25px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 13px; color: #888; margin: 0 0 8px;">
                  This invitation was sent by <strong style="color: #333;">${params.inviterName}</strong>
                </p>
                <p style="font-size: 12px; color: #aaa; margin: 0;">
                  <span style="color: #1a1a1a; font-weight: 600;">ViewTrack</span> • viewtrack.app
                </p>
              </div>
              
            </div>
            
            <!-- Bottom Spacer -->
            <div style="height: 30px;"></div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get the HTML template for the test email
   */
  private getTestEmailTemplate(email: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Email Test Successful!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hey there! 👋
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              This is a test email sent to <strong>${email}</strong> from your application.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                ✅ Your email integration is working perfectly!<br>
                ✅ You can now send notifications to your users<br>
                ✅ Resend API is properly configured
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you received this email, your email service is working correctly. You can now use it to send:
            </p>
            
            <ul style="font-size: 14px; color: #666;">
              <li>Welcome emails to new users</li>
              <li>Password reset notifications</li>
              <li>Payment confirmations</li>
              <li>Project updates and alerts</li>
              <li>And much more!</li>
            </ul>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              Sent via Resend • ${new Date().toLocaleDateString('en-US', { 
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
    `;
  }
}

export default new EmailService();

