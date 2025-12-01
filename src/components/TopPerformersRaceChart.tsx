import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, ChevronRight, Play, Info } from 'lucide-react';
import { DateFilterType } from './DateRangeFilter';
import DateFilterService from '../services/DateFilterService';

interface TopPerformersRaceChartProps {
  submissions: VideoSubmission[];
  onVideoClick?: (video: VideoSubmission) => void;
  onAccountClick?: (username: string) => void;
  type?: 'videos' | 'accounts' | 'gainers' | 'both'; // Control which section to render
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'bookmarks' | 'virality' | 'followersGained';

const TopPerformersRaceChart: React.FC<TopPerformersRaceChartProps> = ({ 
  submissions, 
  onVideoClick, 
  onAccountClick, 
  type = 'both',
  dateFilter = 'all',
  customRange
}) => {
  const [topVideosCount, setTopVideosCount] = useState(5);
  const [topAccountsCount, setTopAccountsCount] = useState(5);
  const [videosMetric, setVideosMetric] = useState<MetricType>('views');
  const [accountsMetric, setAccountsMetric] = useState<MetricType>('views');
  
  // Tooltip states
  const [hoveredVideo, setHoveredVideo] = useState<{ video: VideoSubmission; x: number; y: number } | null>(null);
  const [hoveredAccount, setHoveredAccount] = useState<{ handle: string; x: number; y: number } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Info tooltip states
  const [showVideosInfo, setShowVideosInfo] = useState(false);
  const [showAccountsInfo, setShowAccountsInfo] = useState(false);

  // DEBUG: Log received props
  console.log(`🔧 [TopPerformersRaceChart] Type: ${type}, DateFilter: "${dateFilter}", CustomRange: ${customRange ? 'YES' : 'NO'}, Submissions: ${submissions.length}`);

  // Get date range for filtering
  const dateRange = useMemo(() => {
    if (dateFilter === 'all') {
      console.log('🔧 [TopPerformersRaceChart] dateFilter is "all", returning null');
      return null;
    }
    const range = DateFilterService.getDateRange(dateFilter, customRange);
    console.log('🔧 [TopPerformersRaceChart] Computed dateRange:', {
      startDate: range?.startDate?.toLocaleDateString(),
      endDate: range?.endDate?.toLocaleDateString()
    });
    return range;
  }, [dateFilter, customRange]);

  // Calculate metric value within the date range
  const getMetricValueInDateRange = (video: VideoSubmission, metric: MetricType): number => {
    // If no date range, use full video metrics
    if (!dateRange) {
      return getMetricValue(video, metric);
    }

    const uploadDate = video.uploadDate
      ? new Date(video.uploadDate)
      : video.timestamp
      ? new Date(video.timestamp)
      : video.dateSubmitted
      ? new Date(video.dateSubmitted)
      : new Date();

    // If video was uploaded within the date range, use its full metrics
    if (uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate) {
      return getMetricValue(video, metric);
    }

    // Video was uploaded BEFORE the date range - calculate delta from snapshots
    if (!video.snapshots || video.snapshots.length === 0) {
      return 0; // No snapshot data, can't calculate what happened in period
    }

    // Find snapshots at/before range start and at/before range end
    const sortedSnapshots = [...video.snapshots].sort((a, b) => 
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );

    // Find the last snapshot before or at range start
    const startSnapshot = sortedSnapshots
      .filter(s => new Date(s.capturedAt) <= dateRange.startDate)
      .pop();

    // Find the last snapshot before or at range end (within the range)
    const endSnapshot = sortedSnapshots
      .filter(s => new Date(s.capturedAt) <= dateRange.endDate)
      .pop();

    if (!startSnapshot || !endSnapshot || startSnapshot === endSnapshot) {
      return 0; // Not enough snapshot data
    }

    const getSnapshotMetric = (snapshot: any, metric: MetricType): number => {
      switch (metric) {
        case 'views':
          return snapshot.views || 0;
        case 'likes':
          return snapshot.likes || 0;
        case 'comments':
          return snapshot.comments || 0;
        case 'shares':
          return snapshot.shares || 0;
        case 'bookmarks':
          return snapshot.saves || 0;
        case 'engagement':
          const totalEng = (snapshot.likes || 0) + (snapshot.comments || 0) + (snapshot.shares || 0);
          return snapshot.views > 0 ? (totalEng / snapshot.views) * 100 : 0;
        case 'virality':
          const followerCount = video.followerCount || 1;
          const totalInteractions = (snapshot.likes || 0) + (snapshot.comments || 0) + (snapshot.shares || 0);
          return (totalInteractions / followerCount) * 1000;
        case 'followersGained':
          return 0; // Can't calculate followers gained from snapshots
        default:
          return 0;
      }
    };

    const startValue = getSnapshotMetric(startSnapshot, metric);
    const endValue = getSnapshotMetric(endSnapshot, metric);
    
    // Return the delta (growth during the period)
    return Math.max(0, endValue - startValue);
  };

  // Calculate gain from snapshots (all time)
  const calculateSnapshotGain = (video: VideoSubmission, metric: MetricType): number => {
    if (!video.snapshots || video.snapshots.length === 0) return 0;
    
    // Sort snapshots by date
    const sortedSnapshots = [...video.snapshots].sort((a, b) => 
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    
    const firstSnapshot = sortedSnapshots[0];
    const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
    
    const getSnapshotValue = (snapshot: any, metric: MetricType): number => {
      switch (metric) {
        case 'views':
          return snapshot.views || 0;
        case 'likes':
          return snapshot.likes || 0;
        case 'comments':
          return snapshot.comments || 0;
        case 'shares':
          return snapshot.shares || 0;
        case 'bookmarks':
          return snapshot.saves || 0;
        case 'engagement':
          const totalEng = (snapshot.likes || 0) + (snapshot.comments || 0) + (snapshot.shares || 0);
          return snapshot.views > 0 ? (totalEng / snapshot.views) * 100 : 0;
        default:
          return 0;
      }
    };
    
    const startValue = getSnapshotValue(firstSnapshot, metric);
    const endValue = getSnapshotValue(lastSnapshot, metric);
    
    return endValue - startValue;
  };

  // Calculate gain from snapshots ONLY within the date range
  const calculateSnapshotGainInDateRange = (video: VideoSubmission, metric: MetricType): number => {
    if (!video.snapshots || video.snapshots.length === 0) return 0;
    if (!dateRange) return calculateSnapshotGain(video, metric); // Fallback to all-time if no range
    
    const sortedSnapshots = [...video.snapshots].sort((a, b) => 
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );
    
    // Find snapshots within the date range
    const snapshotsInRange = sortedSnapshots.filter(s => {
      const capturedDate = new Date(s.capturedAt);
      return capturedDate >= dateRange.startDate && capturedDate <= dateRange.endDate;
    });
    
    // Find snapshot at or before range start (baseline)
    let startSnapshot = sortedSnapshots
      .filter(s => new Date(s.capturedAt) <= dateRange.startDate)
      .pop();
    
    // If no baseline snapshot before range, use the first snapshot IN the range as baseline
    if (!startSnapshot && snapshotsInRange.length > 0) {
      startSnapshot = snapshotsInRange[0];
    }
    
    // Find the latest snapshot in or before the range end
    const endSnapshot = sortedSnapshots
      .filter(s => new Date(s.capturedAt) <= dateRange.endDate)
      .pop();
    
    // Need at least 2 different snapshots to calculate growth
    if (!startSnapshot || !endSnapshot || startSnapshot === endSnapshot) {
      return 0; // Not enough snapshot data for this period
    }
    
    const getSnapshotValue = (snapshot: any, metric: MetricType): number => {
      switch (metric) {
        case 'views':
          return snapshot.views || 0;
        case 'likes':
          return snapshot.likes || 0;
        case 'comments':
          return snapshot.comments || 0;
        case 'shares':
          return snapshot.shares || 0;
        case 'bookmarks':
          return snapshot.saves || 0;
        case 'engagement':
          const totalEng = (snapshot.likes || 0) + (snapshot.comments || 0) + (snapshot.shares || 0);
          return snapshot.views > 0 ? (totalEng / snapshot.views) * 100 : 0;
        case 'virality':
          const followerCount = video.followerCount || 1;
          const totalInteractions = (snapshot.likes || 0) + (snapshot.comments || 0) + (snapshot.shares || 0);
          return (totalInteractions / followerCount) * 1000;
        case 'followersGained':
          return 0;
        default:
          return 0;
      }
    };
    
    const startValue = getSnapshotValue(startSnapshot, metric);
    const endValue = getSnapshotValue(endSnapshot, metric);
    
    return Math.max(0, endValue - startValue); // Only positive gains
  };

  // Calculate metric value for a video
  const getMetricValue = (video: VideoSubmission, metric: MetricType): number => {
    switch (metric) {
      case 'views':
        return video.views || 0;
      case 'likes':
        return video.likes || 0;
      case 'comments':
        return video.comments || 0;
      case 'shares':
        return video.shares || 0;
      case 'bookmarks':
        return (video as any).saves || 0;
      case 'engagement':
        const totalEngagement = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
        return video.views > 0 ? (totalEngagement / video.views) * 100 : 0;
      case 'virality':
        // Virality score: (likes + comments + shares) / followers * 1000
        const followerCount = video.followerCount || 1;
        const totalInteractions = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
        return (totalInteractions / followerCount) * 1000;
      case 'followersGained':
        return (video as any).followersGained || 0;
      default:
        return 0;
    }
  };

  // Get top videos sorted by selected metric
  const topVideos = useMemo(() => {
    // Deduplicate videos by ID first
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });
    
    const videosArray = Array.from(uniqueVideos.values());
    
    // For 'gainers' (Top Refreshed Videos): Only OLD videos with snapshot growth during period
    if (type === 'gainers') {
      console.log(`🔥 [TOP REFRESHED VIDEOS] Checking ${videosArray.length} videos for gainers`);
      console.log(`   Date Range: ${dateRange ? `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}` : 'ALL TIME'}`);
      console.log(`   Logic: Only videos uploaded BEFORE ${dateRange?.startDate.toLocaleDateString()} with positive growth during the period`);
      
      let noSnapshotsCount = 0;
      let uploadedInRangeCount = 0;
      let noGrowthCount = 0;
      let hasGrowthCount = 0;
      
      const filtered = videosArray
        .filter(video => {
          // Only videos with snapshots
          if (!video.snapshots || video.snapshots.length === 0) {
            noSnapshotsCount++;
            return false;
          }
          
          // Only videos uploaded BEFORE the date range (if date filter is active)
          if (dateRange) {
            const uploadDate = video.uploadDate
              ? new Date(video.uploadDate)
              : video.timestamp
              ? new Date(video.timestamp)
              : video.dateSubmitted
              ? new Date(video.dateSubmitted)
              : new Date();
            
            // Skip videos uploaded during the selected period (those belong to "Top New Videos")
            if (uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate) {
              uploadedInRangeCount++;
              console.log(`  ❌ Too new (uploaded ${uploadDate.toLocaleDateString()}): "${video.title?.substring(0, 30)}"`);
              return false;
            }
          }
          
          // Only show videos with actual positive growth during the period
          const gain = calculateSnapshotGainInDateRange(video, videosMetric);
          if (gain > 0) {
            hasGrowthCount++;
            console.log(`  ✅ HAS GROWTH (+${Math.round(gain).toLocaleString()}): "${video.title?.substring(0, 30)}" (${video.snapshots.length} snapshots)`);
          } else {
            noGrowthCount++;
          }
          return gain > 0;
        })
        .sort((a, b) => calculateSnapshotGainInDateRange(b, videosMetric) - calculateSnapshotGainInDateRange(a, videosMetric))
        .slice(0, topVideosCount);
      
      console.log(`🔥 [TOP REFRESHED VIDEOS] SUMMARY:`);
      console.log(`   ❌ ${noSnapshotsCount} videos excluded: No snapshots`);
      console.log(`   ❌ ${uploadedInRangeCount} videos excluded: Uploaded during period (these show in "Top New Videos")`);
      console.log(`   ❌ ${noGrowthCount} videos excluded: No positive growth during period`);
      console.log(`   ✅ ${hasGrowthCount} videos with growth found`);
      console.log(`   📊 Showing top ${filtered.length} gainers`);
      
      return filtered;
    }
    
    // For 'videos' (Top New Videos): Only videos POSTED during the date range with full metrics
    const filtered = videosArray
      .filter(video => {
        // If no date range, include all videos
        if (!dateRange) return true;
        
        // CRITICAL: MUST use video.uploadDate (actual post date on platform)
        // This is the date the video was posted on TikTok/Instagram/YouTube, NOT when added to our system
        if (!video.uploadDate) {
          console.warn(`⚠️ [TOP NEW VIDEOS] Skipping video without uploadDate: "${video.title?.substring(0, 40)}"`, {
            id: video.id,
            platform: video.platform,
            dateSubmitted: video.dateSubmitted?.toString(),
            hasSnapshots: video.snapshots?.length || 0
          });
          return false; // MUST have uploadDate to be included
        }
        
        const actualUploadDate = new Date(video.uploadDate);
        
        // STRICT: Only videos posted DURING the selected timeframe
        const isInRange = actualUploadDate >= dateRange.startDate && actualUploadDate <= dateRange.endDate;
        
        // DETAILED Debug logging
        console.log(`🔍 [TOP NEW VIDEOS] "${video.title?.substring(0, 30)}"`, {
          uploadDate: video.uploadDate,
          uploadDateParsed: actualUploadDate.toISOString(),
          uploadDateDisplay: actualUploadDate.toLocaleDateString(),
          dateSubmitted: video.dateSubmitted,
          timestamp: video.timestamp,
          rangeStart: dateRange.startDate.toLocaleDateString(),
          rangeEnd: dateRange.endDate.toLocaleDateString(),
          isInRange: isInRange ? '✅ INCLUDED' : '❌ EXCLUDED',
          platform: video.platform,
          views: video.views
        });
        
        return isInRange;
      });
    
    console.log(`📊 [TOP NEW VIDEOS] Filtered ${filtered.length} videos from ${videosArray.length} total (Date Range: ${dateRange?.startDate.toLocaleDateString()} - ${dateRange?.endDate.toLocaleDateString()})`);
    
    return filtered
      .map(video => ({
        video,
        metricValue: getMetricValue(video, videosMetric) // Use full video metrics
      }))
      .filter(item => item.metricValue > 0)
      .sort((a, b) => b.metricValue - a.metricValue)
      .slice(0, topVideosCount)
      .map(item => item.video);
  }, [submissions, videosMetric, topVideosCount, type, dateRange]);

  // Get top accounts (aggregate by uploader handle + platform)
  const topAccounts = useMemo(() => {
    // First, deduplicate submissions by video ID to prevent double counting
    const uniqueVideos = new Map<string, VideoSubmission>();
    const skippedDuplicates: string[] = [];
    
    submissions.forEach(video => {
      if (video.id) {
        if (!uniqueVideos.has(video.id)) {
          uniqueVideos.set(video.id, video);
        } else {
          skippedDuplicates.push(`${video.platform}:${video.uploaderHandle}:${video.id}`);
        }
      } else if (!video.id) {
        // If no ID, use URL as primary key if available
        const tempKey = video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
        if (!uniqueVideos.has(tempKey)) {
          uniqueVideos.set(tempKey, video);
        } else {
          skippedDuplicates.push(`${video.platform}:${video.uploaderHandle}:NO_ID`);
        }
      }
    });
    
    const accountMap = new Map<string, {
      handle: string;
      displayName: string;
      platform: VideoSubmission['platform'];
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalBookmarks: number;
      totalVirality: number;
      totalFollowersGained: number;
      videoCount: number;
      profileImage?: string;
      followerCount?: number;
    }>();

    uniqueVideos.forEach(video => {
      const handle = (video.uploaderHandle || 'unknown').trim().toLowerCase();
      const displayName = (video.uploader || handle).trim();
      // Use both platform and handle to uniquely identify accounts
      const accountKey = `${video.platform}_${handle}`;
      
      if (!accountMap.has(accountKey)) {
        accountMap.set(accountKey, {
          handle,
          displayName,
          platform: video.platform,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalBookmarks: 0,
          totalVirality: 0,
          totalFollowersGained: 0,
          videoCount: 0,
          profileImage: video.uploaderProfilePicture,
          followerCount: video.followerCount
        });
      }

      const account = accountMap.get(accountKey)!;
      // Use date-range-aware metrics for each video
      account.totalViews += getMetricValueInDateRange(video, 'views');
      account.totalLikes += getMetricValueInDateRange(video, 'likes');
      account.totalComments += getMetricValueInDateRange(video, 'comments');
      account.totalShares += getMetricValueInDateRange(video, 'shares');
      account.totalBookmarks += getMetricValueInDateRange(video, 'bookmarks');
      account.totalFollowersGained += getMetricValueInDateRange(video, 'followersGained');
      account.totalVirality += getMetricValueInDateRange(video, 'virality');
      account.videoCount += 1;
    });

    const getAccountMetric = (account: typeof accountMap extends Map<string, infer T> ? T : never): number => {
      switch (accountsMetric) {
        case 'views':
          return account.totalViews;
        case 'likes':
          return account.totalLikes;
        case 'comments':
          return account.totalComments;
        case 'shares':
          return account.totalShares;
        case 'bookmarks':
          return account.totalBookmarks;
        case 'engagement':
          const totalEng = account.totalLikes + account.totalComments + account.totalShares;
          return account.totalViews > 0 ? (totalEng / account.totalViews) * 100 : 0;
        case 'virality':
          return account.videoCount > 0 ? account.totalVirality / account.videoCount : 0; // Average virality per video
        case 'followersGained':
          return account.totalFollowersGained;
        default:
          return 0;
      }
    };

    const sortedAccounts = Array.from(accountMap.values())
      .filter(account => getAccountMetric(account) > 0) // Only show accounts with activity in the period
      .sort((a, b) => getAccountMetric(b) - getAccountMetric(a))
      .slice(0, topAccountsCount);
    
    return sortedAccounts;
  }, [submissions, accountsMetric, topAccountsCount, dateRange]);

  const maxVideoValue = topVideos.length > 0 
    ? (type === 'gainers' ? calculateSnapshotGainInDateRange(topVideos[0], videosMetric) : getMetricValue(topVideos[0], videosMetric))
    : 1;
  const maxAccountValue = topAccounts.length > 0 
    ? (accountsMetric === 'views' ? topAccounts[0].totalViews
      : accountsMetric === 'likes' ? topAccounts[0].totalLikes
      : accountsMetric === 'comments' ? topAccounts[0].totalComments
      : accountsMetric === 'shares' ? topAccounts[0].totalShares
      : (() => {
          const totalEng = topAccounts[0].totalLikes + topAccounts[0].totalComments + topAccounts[0].totalShares;
          return topAccounts[0].totalViews > 0 ? (totalEng / topAccounts[0].totalViews) * 100 : 0;
        })())
    : 1;

  // Calculate video stats for tooltip (full metrics for new videos)
  const getVideoStats = (video: VideoSubmission) => {
    const currentViews = video.views || 0;
    const totalEngagement = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
    const engagementRate = currentViews > 0 ? (totalEngagement / currentViews) * 100 : 0;
    
    // Calculate view change from snapshots
    let viewChange = 0;
    let viewChangePercentage = 0;
    let lastSnapshotDate: Date | null = null;
    
    if (video.snapshots && video.snapshots.length > 1) {
      const sortedSnapshots = [...video.snapshots].sort((a, b) => 
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      );
      const firstSnapshot = sortedSnapshots[0];
      const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
      
      viewChange = currentViews - firstSnapshot.views;
      viewChangePercentage = firstSnapshot.views > 0 
        ? ((currentViews - firstSnapshot.views) / firstSnapshot.views) * 100 
        : 0;
      lastSnapshotDate = new Date(lastSnapshot.capturedAt);
    } else if (video.snapshots && video.snapshots.length === 1) {
      lastSnapshotDate = new Date(video.snapshots[0].capturedAt);
    }
    
    const uploadDate = video.uploadDate || video.dateSubmitted;
    
    return {
      currentViews,
      viewChange,
      viewChangePercentage,
      engagementRate,
      uploadDate,
      lastSnapshotDate,
      totalEngagement
    };
  };

  // Calculate stats for refreshed videos (snapshot delta only during date range) - kept for potential future use
  // @ts-ignore - Keeping for reference
  const _getRefreshedVideoStats = (video: VideoSubmission) => {
    if (!dateRange || !video.snapshots || video.snapshots.length < 2) {
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        totalEngagement: 0,
        engagementRate: 0,
        uploadDate: video.uploadDate || video.dateSubmitted,
        lastSnapshotDate: null
      };
    }

    const sortedSnapshots = [...video.snapshots].sort((a, b) => 
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    );

    // Find snapshot at or before range start
    const startSnapshot = sortedSnapshots
      .filter(s => new Date(s.capturedAt) <= dateRange.startDate)
      .pop();

    // Find snapshot at or before range end
    const endSnapshot = sortedSnapshots
      .filter(s => new Date(s.capturedAt) <= dateRange.endDate)
      .pop();

    if (!startSnapshot || !endSnapshot || startSnapshot === endSnapshot) {
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        totalEngagement: 0,
        engagementRate: 0,
        uploadDate: video.uploadDate || video.dateSubmitted,
        lastSnapshotDate: null
      };
    }

    // Calculate deltas
    const views = Math.max(0, (endSnapshot.views || 0) - (startSnapshot.views || 0));
    const likes = Math.max(0, (endSnapshot.likes || 0) - (startSnapshot.likes || 0));
    const comments = Math.max(0, (endSnapshot.comments || 0) - (startSnapshot.comments || 0));
    const shares = Math.max(0, (endSnapshot.shares || 0) - (startSnapshot.shares || 0));
    const totalEngagement = likes + comments + shares;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

    return {
      views,
      likes,
      comments,
      shares,
      totalEngagement,
      engagementRate,
      uploadDate: video.uploadDate || video.dateSubmitted,
      lastSnapshotDate: new Date(endSnapshot.capturedAt)
    };
  };

  // Get videos for account tooltip
  const getAccountVideos = (handle: string) => {
    // Case-insensitive handle matching (handle is already lowercase from topAccounts)
    const accountVideos = submissions.filter(v => 
      (v.uploaderHandle || '').trim().toLowerCase() === handle.toLowerCase()
    );
    
    // Sort by view growth (if snapshots available) or upload date
    return accountVideos.sort((a, b) => {
      const aStats = getVideoStats(a);
      const bStats = getVideoStats(b);
      
      // If both have snapshots with view growth, sort by growth
      if (aStats.viewChange > 0 && bStats.viewChange > 0) {
        return bStats.viewChange - aStats.viewChange;
      }
      
      // Otherwise sort by upload date (newest first)
      const aDate = a.uploadDate || a.dateSubmitted;
      const bDate = b.uploadDate || b.dateSubmitted;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    }).slice(0, 5); // Show top 5 videos
  };

  const formatNumber = (num: number, metric: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (metric === 'virality') {
      return `${num.toFixed(2)}x`;
    }
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Conditionally render based on type
  const showVideos = type === 'videos' || type === 'gainers' || type === 'both';
  const showAccounts = type === 'accounts' || type === 'both';
  const showBoth = type === 'both';

  return (
    <div className={showBoth ? "grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6" : ""}>
      {/* Top Videos */}
      {showVideos && (
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
        {/* Depth Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{type === 'gainers' ? 'Top Refreshed Videos' : 'Top New Videos'}</h2>
            <div className="relative">
              <button
                onMouseEnter={() => setShowVideosInfo(true)}
                onMouseLeave={() => setShowVideosInfo(false)}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>
              
              {/* Info Tooltip */}
              {showVideosInfo && (
                <div 
                  className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.98)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {type === 'gainers' 
                      ? 'Shows old videos (uploaded before the selected period) that gained the most engagement during the selected timeframe. Only shows snapshot growth during this period.'
                      : 'Shows videos uploaded during the selected timeframe with their full performance metrics. Perfect for seeing what new content performed best.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topVideosCount}
                onChange={(e) => setTopVideosCount(Number(e.target.value))}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              >
                <option value={3} className="bg-gray-900">3</option>
                <option value={5} className="bg-gray-900">5</option>
                <option value={10} className="bg-gray-900">10</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
            {/* Metric Selector */}
            <div className="relative">
              <select
                value={videosMetric}
                onChange={(e) => setVideosMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              >
                <option value="views" className="bg-gray-900">Views</option>
                <option value="likes" className="bg-gray-900">Likes</option>
                <option value="comments" className="bg-gray-900">Comments</option>
                <option value="shares" className="bg-gray-900">Shares</option>
                <option value="bookmarks" className="bg-gray-900">Bookmarks</option>
                <option value="engagement" className="bg-gray-900">Engagement</option>
                <option value="virality" className="bg-gray-900">Virality Score</option>
                <option value="followersGained" className="bg-gray-900">Followers Gained</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        <div className="space-y-3">
          {topVideos.map((video, index) => {
            const value = type === 'gainers' 
              ? calculateSnapshotGainInDateRange(video, videosMetric)
              : getMetricValue(video, videosMetric);
            const percentage = maxVideoValue > 0 ? (value / maxVideoValue) * 100 : 0;
            
            return (
              <div 
                key={video.id || `${video.platform}_${video.uploaderHandle}_${index}`} 
                className="group relative cursor-pointer"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onClick={() => onVideoClick?.(video)}
                onMouseEnter={(e) => {
                  // Only update if not already hovering this video
                  if (hoveredVideo?.video?.id !== video.id) {
                    setHoveredVideo({
                      video,
                      x: e.clientX,
                      y: e.clientY
                    });
                  }
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #E5E7EB, #F9FAFB)';
                  }
                }}
                onMouseMove={(e) => {
                  if (hoveredVideo?.video?.id === video.id) {
                    setHoveredVideo({
                      video,
                      x: e.clientX,
                      y: e.clientY
                    });
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredVideo(null);
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #52525B, #3F3F46)';
                  }
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm relative">
                      {video.thumbnail ? (
                        <>
                          <img 
                            src={video.thumbnail} 
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {/* Platform Logo Badge */}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-tl-md flex items-center justify-center">
                            <PlatformIcon platform={video.platform} size="sm" className="w-3 h-3" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700/50 to-gray-800/50">
                          <PlatformIcon platform={video.platform} className="w-5 h-5 opacity-60" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-14 flex-1 relative flex items-center">
                    <div className="h-10 rounded-lg overflow-hidden flex-1">
                      <div 
                        className="race-bar h-full relative transition-all duration-300 ease-out rounded-lg"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '8%',
                          background: 'linear-gradient(to right, #52525B, #3F3F46)'
                        }}
                      >
                      </div>
                    </div>
                    {/* Metric Value - Always on Right */}
                    <div className="ml-4 min-w-[100px] text-right">
                      <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                        {formatNumber(value, videosMetric)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {topVideos.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="text-sm">
              {type === 'gainers' 
                ? 'No refreshed videos with growth found during this period' 
                : 'No new videos found during this period'}
            </p>
            <p className="text-xs mt-2 text-white/30">
              {type === 'gainers' 
                ? 'Refreshed videos must be uploaded before the selected period and have positive growth' 
                : 'Try selecting a different date range'}
            </p>
          </div>
        )}
        </div>
      </div>
      )}

      {/* Top Accounts */}
      {showAccounts && (
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 p-6 overflow-hidden">
        {/* Depth Gradient Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.02) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)',
          }}
        />
        
        {/* Content Layer */}
        <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Top Accounts</h2>
            <div className="relative">
              <button
                onMouseEnter={() => setShowAccountsInfo(true)}
                onMouseLeave={() => setShowAccountsInfo(false)}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>
              
              {/* Info Tooltip */}
              {showAccountsInfo && (
                <div 
                  className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.98)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Tracks your top performing accounts ranked by aggregated metrics across all their videos. Click to filter the dashboard by account.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topAccountsCount}
                onChange={(e) => setTopAccountsCount(Number(e.target.value))}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              >
                <option value={3} className="bg-gray-900">3</option>
                <option value={5} className="bg-gray-900">5</option>
                <option value={10} className="bg-gray-900">10</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
            {/* Metric Selector */}
            <div className="relative">
              <select
                value={accountsMetric}
                onChange={(e) => setAccountsMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              >
                <option value="views" className="bg-gray-900">Views</option>
                <option value="likes" className="bg-gray-900">Likes</option>
                <option value="comments" className="bg-gray-900">Comments</option>
                <option value="shares" className="bg-gray-900">Shares</option>
                <option value="bookmarks" className="bg-gray-900">Bookmarks</option>
                <option value="engagement" className="bg-gray-900">Engagement</option>
                <option value="virality" className="bg-gray-900">Virality Score</option>
                <option value="followersGained" className="bg-gray-900">Followers Gained</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        <div className="space-y-3">
          {topAccounts.map((account, index) => {
            const value = accountsMetric === 'views' ? account.totalViews
              : accountsMetric === 'likes' ? account.totalLikes
              : accountsMetric === 'comments' ? account.totalComments
              : accountsMetric === 'shares' ? account.totalShares
              : (() => {
                  const totalEng = account.totalLikes + account.totalComments + account.totalShares;
                  return account.totalViews > 0 ? (totalEng / account.totalViews) * 100 : 0;
                })();
            const percentage = maxAccountValue > 0 ? (value / maxAccountValue) * 100 : 0;
            
            return (
              <div 
                key={`${account.platform}_${account.handle}_${index}`} 
                className="group relative cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                }}
                onClick={() => {
                  onAccountClick?.(account.handle);
                }}
                onMouseEnter={(e) => {
                  // Only update if not already hovering this account
                  if (hoveredAccount?.handle !== account.handle) {
                    setHoveredAccount({
                      handle: account.handle,
                      x: e.clientX,
                      y: e.clientY
                    });
                  }
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #E5E7EB, #F9FAFB)';
                  }
                }}
                onMouseMove={(e) => {
                  if (hoveredAccount?.handle === account.handle) {
                    setHoveredAccount({
                      handle: account.handle,
                      x: e.clientX,
                      y: e.clientY
                    });
                  }
                }}
                onMouseLeave={(e) => {
                  setHoveredAccount(null);
                  const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                  if (barElement) {
                    barElement.style.background = 'linear-gradient(to right, #52525B, #3F3F46)';
                  }
                }}
              >
                {/* Bar Container */}
                <div className="relative h-10 flex items-center">
                  {/* Profile Icon (Spearhead) */}
                  <div className="absolute left-0 z-10 flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-gray-800/50 backdrop-blur-sm relative">
                      {account.profileImage ? (
                        <>
                          <img 
                            src={account.profileImage} 
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {/* Platform Logo Badge */}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-tl-md flex items-center justify-center">
                            <PlatformIcon platform={account.platform} size="sm" className="w-3 h-3" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700/50 to-gray-800/50 text-white/70 font-semibold text-sm">
                            {account.displayName.charAt(0).toUpperCase()}
                          </div>
                          {/* Platform Logo Badge */}
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/80 backdrop-blur-sm rounded-tl-md flex items-center justify-center">
                            <PlatformIcon platform={account.platform} size="sm" className="w-3 h-3" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Animated Bar */}
                  <div className="ml-14 flex-1 relative flex items-center">
                    <div className="h-10 rounded-lg overflow-hidden flex-1">
                      <div 
                        className="race-bar h-full relative transition-all duration-300 ease-out rounded-lg"
                        style={{
                          width: `${percentage}%`,
                          minWidth: '8%',
                          background: 'linear-gradient(to right, #52525B, #3F3F46)'
                        }}
                      >
                      </div>
                    </div>
                    {/* Metric Value - Always on Right */}
                    <div className="ml-4 min-w-[100px] text-right">
                      <span className="text-lg font-semibold text-white tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                        {formatNumber(value, accountsMetric)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {topAccounts.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p className="text-sm">No accounts found</p>
          </div>
        )}
        </div>
      </div>
      )}

      {/* Video Tooltip */}
      {hoveredVideo && createPortal(
        <div
          className="absolute z-[9999] pointer-events-none"
          style={{
            left: `${hoveredVideo.x}px`,
            top: `${hoveredVideo.y + 20}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 w-[320px]">
            {(() => {
              const formatNum = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
                return num.toLocaleString();
              };

              // Use the SAME value that's displayed in the bar chart
              const displayValue = type === 'gainers' 
                ? calculateSnapshotGainInDateRange(hoveredVideo.video, videosMetric)
                : getMetricValue(hoveredVideo.video, videosMetric);
              
              // Get upload date from video
              const uploadDate = hoveredVideo.video.uploadDate 
                ? new Date(hoveredVideo.video.uploadDate)
                : hoveredVideo.video.dateSubmitted
                ? new Date(hoveredVideo.video.dateSubmitted)
                : null;
              
              const dateStr = uploadDate ? uploadDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              }) : 'Unknown Date';
              
              // Get last snapshot date for refreshed videos
              let lastSnapshotDate: Date | null = null;
              if (type === 'gainers' && hoveredVideo.video.snapshots && hoveredVideo.video.snapshots.length > 0) {
                const sortedSnapshots = [...hoveredVideo.video.snapshots].sort((a, b) => 
                  new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
                );
                lastSnapshotDate = new Date(sortedSnapshots[0].capturedAt);
              }
              
              // For new videos, calculate view change stats
              const stats = getVideoStats(hoveredVideo.video);

              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      Posted: {dateStr}
                    </p>
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-white">
                          {type === 'gainers' ? '+' : ''}{formatNum(displayValue)}
                      </p>
                        {type !== 'gainers' && 'viewChange' in stats && stats.viewChange !== 0 && (
                        <span className={`text-xs font-semibold ${stats.viewChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stats.viewChange > 0 ? '↑' : '↓'} {Math.abs(stats.viewChangePercentage).toFixed(0)}%
                        </span>
                        )}
                      </div>
                      {type === 'gainers' && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          growth in period
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-white/10 mx-5"></div>
                  
                  {/* Video Info */}
                  <div className="px-5 py-3">
                    <div className="flex items-center gap-3 py-2.5">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                        {hoveredVideo.video.thumbnail ? (
                          <img 
                            src={hoveredVideo.video.thumbnail} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                          {hoveredVideo.video.title || hoveredVideo.video.caption || '(No caption)'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4">
                            <PlatformIcon platform={hoveredVideo.video.platform} size="sm" />
                          </div>
                          <span className="text-xs text-gray-400 lowercase">
                            {hoveredVideo.video.uploaderHandle || hoveredVideo.video.platform}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Last Refresh Date (for refreshed videos only) */}
                    {type === 'gainers' && lastSnapshotDate && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-400">
                          Last refresh: {lastSnapshotDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}

                    {/* Click to Expand */}
                    <div className="mt-2 pt-3 border-t border-white/10">
                      <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white transition-colors">
                        <span>Click to view details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Account Tooltip */}
      {hoveredAccount && createPortal(
        <div
          className="absolute z-[9999] pointer-events-none"
          style={{
            left: `${hoveredAccount.x}px`,
            top: `${hoveredAccount.y + 20}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 w-[380px]">
            {(() => {
              // Find the account data
              const account = topAccounts.find(acc => acc.handle === hoveredAccount.handle);
              if (!account) return null;

              const formatNum = (num: number) => {
                if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
                if (num >= 1000) return `${(num / 1000).toFixed(1)} k`;
                return num.toLocaleString();
              };

              // Calculate total views for this account
              const totalViews = account.totalViews;
              
              // Calculate PP comparison (you can add this logic based on your data)
              // For now, we'll show growth if view change data is available
              const accountVideos = getAccountVideos(hoveredAccount.handle);
              let totalGrowth = 0;
              let hasGrowthData = false;
              accountVideos.forEach(video => {
                const stats = getVideoStats(video);
                if (stats.viewChange !== 0) {
                  totalGrowth += stats.viewChangePercentage;
                  hasGrowthData = true;
                }
              });
              const avgGrowth = hasGrowthData ? totalGrowth / accountVideos.filter(v => getVideoStats(v).viewChange !== 0).length : 0;

              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      @{hoveredAccount.handle}
                    </p>
                    <div className="flex items-baseline gap-3">
                      <p className="text-2xl font-bold text-white">
                        {formatNum(totalViews)}
                      </p>
                      {hasGrowthData && avgGrowth !== 0 && (
                        <span className={`text-xs font-semibold ${avgGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {avgGrowth >= 0 ? '↑' : '↓'} {Math.abs(avgGrowth).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-white/10 mx-5"></div>
                  
                  {/* Video List */}
                  <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: '400px' }}>
                    {accountVideos.map((video, _idx) => {
                      const stats = getVideoStats(video);

                      return (
                        <div 
                          key={video.id} 
                          className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                            {video.thumbnail ? (
                              <img 
                                src={video.thumbnail} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-5 h-5 text-gray-600" />
                              </div>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate leading-tight mb-1">
                              {video.title || video.caption || '(No caption)'}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4">
                                <PlatformIcon platform={video.platform} size="sm" />
                              </div>
                              <span className="text-xs text-gray-400">
                                {stats.uploadDate ? new Date(stats.uploadDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                }) : 'Unknown'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Metric Value */}
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-white">
                              {formatNum(video.views || 0)}
                            </p>
                            <p className="text-xs text-gray-500">Views</p>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Click to Expand */}
                    <div className="mt-2 pt-3 border-t border-white/10">
                      <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white transition-colors">
                        <span>Click to view details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes raceSlideIn {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default TopPerformersRaceChart;
