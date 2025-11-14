import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Trigger Deletion API - Immediately triggers deletion cron job
 * Called when user deletes a video or account for instant cleanup
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(`🗑️ Triggering immediate deletion processing`);

    // Respond immediately (don't wait for deletion to complete)
    res.status(200).json({
      success: true,
      message: 'Deletion processing triggered'
    });

    // 🔥 Fire-and-forget: Trigger cron job asynchronously (don't await)
    const cronUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/cron-process-deletions`
      : 'http://localhost:3000/api/cron-process-deletions';

    console.log(`🚀 Triggering deletion cron asynchronously: ${cronUrl}`);

    // Don't await - let it run in background
    fetch(cronUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    }).then(cronRes => {
      if (cronRes.ok) {
        console.log(`✅ Deletion cron triggered successfully`);
      } else {
        console.warn(`⚠️ Deletion cron trigger failed (${cronRes.status})`);
      }
    }).catch(err => {
      console.warn(`⚠️ Could not trigger deletion cron:`, err.message);
    });

  } catch (error: any) {
    console.error('❌ Failed to trigger deletion:', error);
    return res.status(500).json({
      error: 'Failed to trigger deletion',
      message: error.message
    });
  }
}

