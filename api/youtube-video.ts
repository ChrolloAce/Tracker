import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId } = req.body || {};
    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'Missing videoId' });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured (YOUTUBE_API_KEY)' });
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
    const ytRes = await fetch(url);
    if (!ytRes.ok) {
      const text = await ytRes.text();
      return res.status(ytRes.status).json({ error: 'YouTube API error', details: text });
    }

    const data = await ytRes.json();
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const item = data.items[0];
    return res.status(200).json({ item });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}


