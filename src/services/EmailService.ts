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
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center;">
              <div style="background: white; width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);">
                <span style="font-size: 40px;">📊</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">You're Invited!</h1>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 50px 40px;">
              
              <!-- Personalized Greeting -->
              <div style="text-align: center; margin-bottom: 35px;">
                <h2 style="font-size: 28px; color: #1a1a1a; margin: 0 0 15px; font-weight: 600;">
                  ${params.recipientName}, you're invited to join<br>
                  <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${params.organizationName}</span>
                </h2>
                <p style="font-size: 18px; color: #666; margin: 0;">
                  by <strong style="color: #667eea;">${params.inviterName}</strong>
                </p>
              </div>
              
              <!-- Invitation Details Box -->
              <div style="background: linear-gradient(135deg, #f8f9ff 0%, #faf5ff 100%); padding: 30px; border-radius: 12px; border: 2px solid #e8e5ff; margin: 35px 0;">
                <div style="text-align: center;">
                  <p style="margin: 0 0 10px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Role</p>
                  <p style="margin: 0; font-size: 22px; color: #667eea; font-weight: 700;">
                    ${params.role.charAt(0).toUpperCase() + params.role.slice(1)}
                  </p>
                </div>
              </div>
              
              <!-- CTA Buttons -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                  Join ${params.organizationName} →
                </a>
              </div>
              
              <!-- What Happens Next -->
              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 35px 0;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #1a1a1a; font-weight: 600;">What happens next?</h3>
                <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                  <li>Click the button above to join ${params.organizationName}</li>
                  <li>Set up your password or continue with Google</li>
                  <li>You'll be automatically added to the team</li>
                  <li>Start collaborating right away!</li>
                </ol>
              </div>
              
              <!-- Direct Link -->
              <div style="margin-top: 35px; padding-top: 30px; border-top: 2px solid #f0f0f0;">
                <p style="font-size: 13px; color: #999; margin: 0 0 10px; text-align: center;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="font-size: 12px; color: #667eea; word-break: break-all; text-align: center; background: #f8f9ff; padding: 12px; border-radius: 8px; margin: 0; font-family: 'Courier New', monospace;">
                  ${params.inviteLink}
                </p>
              </div>
              
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 30px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 13px; color: #999; margin: 0 0 10px;">
                This invitation was sent by <strong>${params.inviterName}</strong>
              </p>
              <p style="font-size: 12px; color: #bbb; margin: 0;">
                Sent from <span style="color: #667eea; font-weight: 600;">ViewTrack</span> • viewtrack.app
              </p>
            </div>
            
          </div>
          
          <!-- Bottom Spacer -->
          <div style="height: 40px;"></div>
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
          <title>You're Invited as a Creator!</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 50px 40px; text-align: center;">
              <div style="background: white; width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);">
                <span style="font-size: 40px;">🎨</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome, Creator!</h1>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 50px 40px;">
              
              <!-- Personalized Greeting -->
              <div style="text-align: center; margin-bottom: 35px;">
                <h2 style="font-size: 28px; color: #1a1a1a; margin: 0 0 15px; font-weight: 600;">
                  ${params.recipientName}, you're invited to join<br>
                  <span style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${params.organizationName}</span>
                </h2>
                <p style="font-size: 18px; color: #666; margin: 0;">
                  by <strong style="color: #f5576c;">${params.inviterName}</strong>
                </p>
              </div>
              
              <!-- Invitation Details Box -->
              <div style="background: linear-gradient(135deg, #fff5f7 0%, #fff0f8 100%); padding: 30px; border-radius: 12px; border: 2px solid #ffe5ec; margin: 35px 0;">
                <div style="text-align: center;">
                  <p style="margin: 0 0 10px; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Role</p>
                  <p style="margin: 0; font-size: 22px; color: #f5576c; font-weight: 700;">Creator</p>
                  <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ffe5ec;">
                    <p style="margin: 0 0 5px; font-size: 13px; color: #999;">Project</p>
                    <p style="margin: 0; font-size: 16px; color: #333; font-weight: 600;">${params.projectName}</p>
                  </div>
                </div>
              </div>
              
              <!-- What You Can Do -->
              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 35px 0;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #1a1a1a; font-weight: 600;">As a creator, you'll be able to:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                  <li style="margin-bottom: 8px;">📊 View your performance metrics and analytics</li>
                  <li style="margin-bottom: 8px;">📈 Track your content performance in real-time</li>
                  <li style="margin-bottom: 8px;">📱 Submit new content for approval</li>
                  <li style="margin-bottom: 8px;">💰 Access your payout information</li>
                  <li style="margin-bottom: 8px;">🔗 Create and manage tracked links</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; box-shadow: 0 10px 30px rgba(245, 87, 108, 0.4); transition: transform 0.2s;">
                  Join ${params.organizationName} →
                </a>
              </div>
              
              <!-- What Happens Next -->
              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 35px 0;">
                <h3 style="margin: 0 0 15px; font-size: 16px; color: #1a1a1a; font-weight: 600;">Getting started:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
                  <li>Click the button above to join ${params.organizationName}</li>
                  <li>Set up your password or continue with Google</li>
                  <li>You'll be automatically added as a creator</li>
                  <li>Access your Creator Portal and start tracking!</li>
                </ol>
              </div>
              
              <!-- Direct Link -->
              <div style="margin-top: 35px; padding-top: 30px; border-top: 2px solid #f0f0f0;">
                <p style="font-size: 13px; color: #999; margin: 0 0 10px; text-align: center;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="font-size: 12px; color: #f5576c; word-break: break-all; text-align: center; background: #fff5f7; padding: 12px; border-radius: 8px; margin: 0; font-family: 'Courier New', monospace;">
                  ${params.inviteLink}
                </p>
              </div>
              
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 30px 40px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="font-size: 13px; color: #999; margin: 0 0 10px;">
                This invitation was sent by <strong>${params.inviterName}</strong>
              </p>
              <p style="font-size: 12px; color: #bbb; margin: 0;">
                Sent from <span style="color: #f5576c; font-weight: 600;">ViewTrack</span> • viewtrack.app
              </p>
            </div>
            
          </div>
          
          <!-- Bottom Spacer -->
          <div style="height: 40px;"></div>
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

