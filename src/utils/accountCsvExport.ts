import { TrackedAccount } from '../types/firestore';
import { Timestamp } from 'firebase/firestore';

/**
 * Convert Firestore Timestamp to Date string
 */
function timestampToDateString(timestamp: Timestamp | Date | undefined): string {
  if (!timestamp) return '';
  
  // If it's already a Date
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }
  
  // If it's a Firestore Timestamp, convert to Date
  if (typeof timestamp === 'object' && 'toDate' in timestamp) {
    return timestamp.toDate().toLocaleString();
  }
  
  // Fallback: try to parse as Date
  try {
    return new Date(timestamp as any).toLocaleString();
  } catch {
    return '';
  }
}

/**
 * Export accounts to CSV file
 */
export function exportAccountsToCSV(accounts: TrackedAccount[], filename: string = 'accounts-export') {
  if (accounts.length === 0) {
    console.warn('No accounts to export');
    return;
  }

  // Define CSV headers
  const headers = [
    'Username',
    'Platform',
    'Creator Type',
    'Followers',
    'Total Videos',
    'Total Views',
    'Total Likes',
    'Total Comments',
    'Total Shares',
    'Engagement Rate (%)',
    'Average Views per Video',
    'Date Added',
    'Last Refreshed',
    'Profile URL',
    'Is Verified'
  ];

  // Convert accounts to CSV rows
  const rows = accounts.map(account => {
    const totalEngagements = (account.totalLikes || 0) + (account.totalComments || 0) + (account.totalShares || 0);
    const totalViews = account.totalViews || 0;
    const engagementRate = totalViews > 0 ? ((totalEngagements / totalViews) * 100).toFixed(2) : '0';
    const avgViews = account.totalVideos && account.totalVideos > 0 ? Math.round(totalViews / account.totalVideos) : 0;
    
    const dateAdded = timestampToDateString(account.dateAdded);
    const lastRefreshed = timestampToDateString(account.lastSynced);
    
    // Construct profile URL based on platform
    let profileUrl = '';
    if (account.username) {
      switch (account.platform) {
        case 'instagram':
          profileUrl = `https://www.instagram.com/${account.username}`;
          break;
        case 'tiktok':
          profileUrl = `https://www.tiktok.com/@${account.username}`;
          break;
        case 'youtube':
          profileUrl = `https://www.youtube.com/@${account.username}`;
          break;
        case 'twitter':
          profileUrl = `https://twitter.com/${account.username}`;
          break;
      }
    }
    
    return [
      escapeCSV(account.username || ''),
      account.platform || '',
      account.creatorType || 'automatic',
      account.followerCount || 0,
      account.totalVideos || 0,
      totalViews,
      account.totalLikes || 0,
      account.totalComments || 0,
      account.totalShares || 0,
      engagementRate,
      avgViews,
      dateAdded,
      lastRefreshed,
      profileUrl,
      account.isVerified ? 'Yes' : 'No'
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
  
  console.log(`✅ Exported ${accounts.length} accounts to ${filename}.csv`);
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

