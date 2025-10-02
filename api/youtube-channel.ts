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
    const { action, channelId, channelHandle } = req.body || {};
    
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured (YOUTUBE_API_KEY)' });
    }

    // Get channel info (profile)
    if (action === 'getChannelInfo') {
      let url: string;
      
      // Support both channel ID and @handle
      if (channelHandle && channelHandle.startsWith('@')) {
        // Use forHandle to get channel by handle
        url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(channelHandle.substring(1))}&key=${apiKey}`;
      } else if (channelId) {
        url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
      } else {
        return res.status(400).json({ error: 'Missing channelId or channelHandle' });
      }

      const ytRes = await fetch(url);
      if (!ytRes.ok) {
        const text = await ytRes.text();
        return res.status(ytRes.status).json({ error: 'YouTube API error', details: text });
      }

      const data = await ytRes.json();
      if (!data.items || data.items.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      return res.status(200).json({ channel: data.items[0] });
    }

    // Get channel Shorts videos
    if (action === 'getShorts') {
      if (!channelId) {
        return res.status(400).json({ error: 'Missing channelId for getShorts' });
      }

      // Search for Shorts videos from this channel
      // We'll use search API with videoDuration=short and channelId
      const maxResults = req.body.maxResults || 50;
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&videoDuration=short&maxResults=${maxResults}&order=date&key=${apiKey}`;
      
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        const text = await searchRes.text();
        return res.status(searchRes.status).json({ error: 'YouTube search API error', details: text });
      }

      const searchData = await searchRes.json();
      const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);

      if (videoIds.length === 0) {
        return res.status(200).json({ videos: [] });
      }

      // Fetch full video details (statistics, contentDetails) for all Shorts
      const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
      const videoRes = await fetch(videoUrl);
      if (!videoRes.ok) {
        const text = await videoRes.text();
        return res.status(videoRes.status).json({ error: 'YouTube videos API error', details: text });
      }

      const videoData = await videoRes.json();
      return res.status(200).json({ videos: videoData.items || [] });
    }

    return res.status(400).json({ error: 'Invalid action. Use "getChannelInfo" or "getShorts"' });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

