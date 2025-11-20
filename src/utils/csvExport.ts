import { VideoSubmission } from '../types';

/**
 * Export videos to CSV file
 */
export function exportVideosToCSV(videos: VideoSubmission[], filename: string = 'video-export') {
  if (videos.length === 0) {
    console.warn('No videos to export');
    return;
  }

  // Define CSV headers
  const headers = [
    'Title',
    'Caption',
    'Creator',
    'Handle',
    'Platform',
    'Views',
    'Likes',
    'Comments',
    'Shares',
    'Bookmarks',
    'Engagement Rate (%)',
    'Duration (seconds)',
    'Upload Date',
    'Date Added',
    'Last Refreshed',
    'Video URL',
    'Follower Count'
  ];

  // Convert videos to CSV rows
  const rows = videos.map(video => {
    const totalEngagements = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
    const engagementRate = video.views > 0 ? ((totalEngagements / video.views) * 100).toFixed(2) : '0';
    
    const uploadDate = video.uploadDate ? new Date(video.uploadDate).toLocaleString() : '';
    const dateAdded = video.dateSubmitted ? new Date(video.dateSubmitted).toLocaleString() : '';
    const lastRefreshed = video.lastRefreshed ? new Date(video.lastRefreshed).toLocaleString() : '';
    
    return [
      escapeCSV(video.title || ''),
      escapeCSV(video.caption || ''),
      escapeCSV(video.uploader || ''),
      escapeCSV(video.uploaderHandle || ''),
      video.platform || '',
      video.views || 0,
      video.likes || 0,
      video.comments || 0,
      video.shares || 0,
      video.bookmarks || 0,
      engagementRate,
      video.duration || 0,
      uploadDate,
      dateAdded,
      lastRefreshed,
      video.url || '',
      video.followerCount || 0
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log(`✅ Exported ${videos.length} videos to ${filename}.csv`);
}

/**
 * Escape CSV values to handle commas, quotes, and newlines
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  
  // Convert to string if not already
  const str = String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

