import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Send Test Email via Resend
 * Endpoint: /api/send-test-email
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ 
      error: 'Missing required fields: to, subject, html' 
    });
  }

  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_QdN3ugAr_NsKxb9N9tyfsj1pukCN3eUcT';

    console.log(`📧 Sending email to: ${to}`);
    console.log(`📝 Subject: ${subject}`);
    console.log(`🔑 API Key configured: ${RESEND_API_KEY ? 'Yes' : 'No'}`);

    const payload = {
      from: 'ViewTrack <noreply@viewtrack.app>',
      to: [to],
      subject: subject,
      html: html,
    };

    console.log(`📤 Calling Resend API...`);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log(`📬 Resend API response status: ${response.status}`);
    console.log(`📬 Resend API response data:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Resend API error:', data);
      
      // Check for common errors
      if (data.message?.includes('not verified')) {
        console.error('⚠️ Domain viewtrack.app is not verified yet. Please wait for DNS propagation.');
      }
      
      return res.status(response.status).json({ 
        error: data.message || 'Failed to send email',
        details: data,
        hint: data.message?.includes('not verified') 
          ? 'Domain verification is still pending. Check Resend dashboard.' 
          : undefined
      });
    }

    console.log(`✅ Email sent successfully! ID: ${data.id}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully!',
      emailId: data.id 
    });

  } catch (error: any) {
    console.error('🚨 Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      message: error.message 
    });
  }
}

