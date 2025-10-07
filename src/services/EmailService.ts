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

