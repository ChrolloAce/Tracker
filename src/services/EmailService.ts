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
    inviterName: string;
    organizationName: string;
    role: string;
    inviteLink: string;
  }): Promise<EmailResponse> {
    return this.sendEmail({
      to: params.to,
      subject: `${params.inviterName} invited you to join ${params.organizationName}`,
      html: this.getTeamInvitationTemplate(params),
    });
  }

  /**
   * Send creator invitation email
   */
  async sendCreatorInvitation(params: {
    to: string;
    inviterName: string;
    organizationName: string;
    projectName: string;
    inviteLink: string;
  }): Promise<EmailResponse> {
    return this.sendEmail({
      to: params.to,
      subject: `You've been added as a creator to ${params.projectName}`,
      html: this.getCreatorInvitationTemplate(params),
    });
  }

  /**
   * Get the HTML template for team invitation
   */
  private getTeamInvitationTemplate(params: {
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
          <title>Team Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">👋 You're Invited!</h1>
            </div>
            
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; margin-bottom: 20px; color: #1a1a1a;">
                Hi there! 
              </p>
              
              <p style="font-size: 16px; margin-bottom: 25px; color: #4a4a4a;">
                <strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> on ViewTrack.
              </p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <strong>Your Role:</strong> ${params.role.charAt(0).toUpperCase() + params.role.slice(1)}
                </p>
              </div>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                  Accept Invitation
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #999; word-break: break-all; text-align: center; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                ${params.inviteLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                This invitation expires in 7 days.<br>
                Sent from ViewTrack
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get the HTML template for creator invitation
   */
  private getCreatorInvitationTemplate(params: {
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
          <title>Creator Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎨 Welcome Creator!</h1>
            </div>
            
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; margin-bottom: 20px; color: #1a1a1a;">
                Exciting news! 🎉
              </p>
              
              <p style="font-size: 16px; margin-bottom: 25px; color: #4a4a4a;">
                <strong>${params.inviterName}</strong> has added you as a creator to <strong>${params.projectName}</strong> in <strong>${params.organizationName}</strong>.
              </p>
              
              <div style="background: #fff3f4; padding: 20px; border-radius: 8px; border-left: 4px solid #f5576c; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <strong>Project:</strong> ${params.projectName}<br>
                  <strong>Organization:</strong> ${params.organizationName}<br>
                  <strong>Role:</strong> Creator
                </p>
              </div>
              
              <p style="font-size: 15px; color: #4a4a4a; margin: 25px 0;">
                As a creator, you'll be able to:
              </p>
              
              <ul style="font-size: 14px; color: #666; padding-left: 20px;">
                <li style="margin-bottom: 10px;">View your performance metrics and analytics</li>
                <li style="margin-bottom: 10px;">Track your content performance</li>
                <li style="margin-bottom: 10px;">Submit new content for approval</li>
                <li style="margin-bottom: 10px;">Access your payout information</li>
              </ul>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(245, 87, 108, 0.4);">
                  Access Creator Portal
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size: 12px; color: #999; word-break: break-all; text-align: center; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                ${params.inviteLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                This invitation expires in 7 days.<br>
                Sent from ViewTrack
              </p>
            </div>
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

