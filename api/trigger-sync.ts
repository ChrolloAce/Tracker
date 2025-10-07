import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Trigger Sync API - Immediately processes a pending account
 * Called when user manually adds an account for faster feedback
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Missing accountId' });
  }

  try {
    console.log(`🚀 Triggering immediate sync for account: ${accountId}`);

    // Call the cron job directly (it will process this account)
    const cronUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/cron-sync-accounts`
      : 'http://localhost:3000/api/cron-sync-accounts';

    const response = await fetch(cronUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Cron job returned ${response.status}`);
    }

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Sync triggered successfully',
      result
    });

  } catch (error: any) {
    console.error('Failed to trigger sync:', error);
    return res.status(500).json({
      error: 'Failed to trigger sync',
      message: error.message
    });
  }
}

