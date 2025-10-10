import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send notification emails for account/video completion
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, type, data } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    let subject = '';
    let html = '';

    if (type === 'account_synced') {
      subject = `✅ Account @${data.username} synced successfully`;
      html = getAccountSyncedTemplate(data);
    } else if (type === 'video_processed') {
      subject = `🎬 Video processed successfully`;
      html = getVideoProcessedTemplate(data);
    } else {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const result = await resend.emails.send({
      from: 'ViewTrack <notifications@resend.dev>',
      to: [to],
      subject,
      html,
    });

    return res.status(200).json({
      success: true,
      message: 'Notification email sent',
      emailId: result.data?.id,
    });
  } catch (error: any) {
    console.error('Failed to send notification email:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send email',
    });
  }
}

function getAccountSyncedTemplate(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Synced</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      ✅ Account Synced!
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                      Great news! We've successfully synced the account <strong>@${data.username}</strong> from ${data.platform}.
                    </p>
                    
                    <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 6px;">
                      <p style="margin: 0 0 10px; font-size: 14px; color: #666666; text-transform: uppercase; font-weight: 600;">
                        Sync Summary
                      </p>
                      <table width="100%" cellpadding="5" cellspacing="0" style="font-size: 15px; color: #333333;">
                        <tr>
                          <td><strong>Account:</strong></td>
                          <td>@${data.username}</td>
                        </tr>
                        <tr>
                          <td><strong>Platform:</strong></td>
                          <td style="text-transform: capitalize;">${data.platform}</td>
                        </tr>
                        <tr>
                          <td><strong>Videos Added:</strong></td>
                          <td>${data.videosAdded || 0}</td>
                        </tr>
                        <tr>
                          <td><strong>Status:</strong></td>
                          <td style="color: #28a745; font-weight: 600;">✓ Active</td>
                        </tr>
                      </table>
                    </div>
                    
                    <p style="margin: 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                      The account is now being tracked and you can view all the videos in your dashboard.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <table cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td align="center" style="border-radius: 8px; background-color: #667eea;">
                            <a href="${data.dashboardUrl || 'https://tracker-red-zeta.vercel.app'}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                              View Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0; font-size: 14px; color: #666666;">
                      ViewTrack - Social Media Analytics
                    </p>
                    <p style="margin: 10px 0 0; font-size: 12px; color: #999999;">
                      You're receiving this because you requested account tracking
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
}

function getVideoProcessedTemplate(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video Processed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      🎬 Video Processed!
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                      Your video has been successfully processed and added to your dashboard!
                    </p>
                    
                    ${data.thumbnail ? `
                    <div style="text-align: center; margin: 20px 0;">
                      <img src="${data.thumbnail}" alt="Video thumbnail" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    </div>
                    ` : ''}
                    
                    <div style="background-color: #f8f9fa; border-left: 4px solid #f5576c; padding: 20px; margin: 20px 0; border-radius: 6px;">
                      <p style="margin: 0 0 10px; font-size: 14px; color: #666666; text-transform: uppercase; font-weight: 600;">
                        Video Details
                      </p>
                      <table width="100%" cellpadding="5" cellspacing="0" style="font-size: 15px; color: #333333;">
                        ${data.title ? `
                        <tr>
                          <td><strong>Title:</strong></td>
                          <td>${data.title}</td>
                        </tr>
                        ` : ''}
                        ${data.platform ? `
                        <tr>
                          <td><strong>Platform:</strong></td>
                          <td style="text-transform: capitalize;">${data.platform}</td>
                        </tr>
                        ` : ''}
                        ${data.uploaderHandle ? `
                        <tr>
                          <td><strong>Account:</strong></td>
                          <td>@${data.uploaderHandle}</td>
                        </tr>
                        ` : ''}
                        <tr>
                          <td><strong>Views:</strong></td>
                          <td>${(data.views || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td><strong>Likes:</strong></td>
                          <td>${(data.likes || 0).toLocaleString()}</td>
                        </tr>
                      </table>
                    </div>
                    
                    <p style="margin: 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                      The video is now available in your dashboard with full analytics tracking.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <table cellpadding="0" cellspacing="0" border="0" align="center">
                        <tr>
                          <td align="center" style="border-radius: 8px; background-color: #f5576c;">
                            <a href="${data.dashboardUrl || 'https://tracker-red-zeta.vercel.app'}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                              View Video
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0; font-size: 14px; color: #666666;">
                      ViewTrack - Social Media Analytics
                    </p>
                    <p style="margin: 10px 0 0; font-size: 12px; color: #999999;">
                      You're receiving this because you added this video for tracking
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
}

