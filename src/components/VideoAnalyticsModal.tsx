import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { X, Eye, Heart, MessageCircle, Share2, TrendingUp, TrendingDown, Bookmark, Trash2, Link2, Copy, Check } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { VideoSubmission } from '../types';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { PlatformIcon } from './ui/PlatformIcon';
import { Button } from './ui/Button';
import { VideoHistoricalMetricsChart } from './VideoHistoricalMetricsChart';
import { VideoDeleteModal } from './video-modal/VideoDeleteModal';
import { VideoSidebar } from './video-modal/VideoSidebar';
import { VideoSnapshotsHistory } from './video-modal/VideoSnapshotsHistory';
import LandingCTABanner from './marketing/LandingCTABanner';
import { formatNumber } from '../utils/formatters';
import FirestoreDataService from '../services/FirestoreDataService';
import FirebaseService from '../services/FirebaseService';
import AuthenticatedApiService from '../services/AuthenticatedApiService';
import { db } from '../services/firebase';
import type { GeminiVideoAnalysis } from '../types/firestore';

interface VideoAnalyticsModalProps {
  video: VideoSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void; // Callback to refresh parent data after deletion
  totalCreatorVideos?: number; // Total number of videos from this creator
  orgId?: string | null; // Organization ID for deleting tracked videos
  projectId?: string | null; // Project ID for deleting tracked videos
  updateUrlOnOpen?: boolean; // If true, update URL when modal opens
  /**
   * When false, hides the Gemini AI Analysis card entirely.
   * Used by the public share page so read-only viewers don't see an
   * internal/paid feature. Defaults to true so the authenticated dashboard
   * keeps its current behaviour.
   */
  showAiAnalysis?: boolean;
  /**
   * When true, renders a subtle marketing CTA inside the modal linking
   * to the landing page. Used by public share views (/a/:token, /c/:token)
   * to convert viewers. Defaults to false.
   */
  showLandingCTA?: boolean;
}

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagementRate: number;
  timestamp: number;
  snapshotIndex: number;
}

const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({ video, isOpen, onClose, onDelete, totalCreatorVideos, orgId, projectId, updateUrlOnOpen = true, showAiAnalysis = true, showLandingCTA = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tooltip state for smooth custom tooltips
  const [tooltipData, setTooltipData] = useState<{ 
    x: number; 
    y: number; 
    dataPoint: any; 
    metricKey: string;
    metricLabel: string;
    isPercentage: boolean;
    lineX: number;
    chartRect: DOMRect;
    dataIndex: number;
  } | null>(null);

  const [imageError, setImageError] = useState(false);

  // ── Gemini video analysis state ─────────────────────────
  const [analysis, setAnalysis] = useState<GeminiVideoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  // Is this video analyzable by Gemini? All platforms supported now.
  const canAnalyze = Boolean(video);

  // When the modal opens for a video, load any previously-generated analysis
  // directly from Firestore so it persists across page loads.
  useEffect(() => {
    setAnalysis(null);
    setAnalysisError(null);
    setTranscriptExpanded(false);

    if (!isOpen || !video || !orgId || !projectId) return;

    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, 'organizations', orgId, 'projects', projectId, 'videos', video.id);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.geminiAnalysis) {
            setAnalysis(data.geminiAnalysis as GeminiVideoAnalysis);
          }
          if (data?.geminiAnalysisStatus === 'failed' && data?.geminiAnalysisError) {
            setAnalysisError(data.geminiAnalysisError);
          }
        }
      } catch (err) {
        console.warn('⚠️ [VideoAnalyticsModal] Failed to load existing Gemini analysis:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, video?.id, orgId, projectId]);

  const handleAnalyzeVideo = async () => {
    if (!video || !orgId || !projectId) {
      setAnalysisError('Missing video or workspace context.');
      return;
    }
    if (!canAnalyze) {
      setAnalysisError('No video selected.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await AuthenticatedApiService.analyzeVideo(video.id, orgId, projectId);
      if (response?.analysis) {
        setAnalysis(response.analysis as GeminiVideoAnalysis);
      } else {
        throw new Error('Analysis endpoint returned no result.');
      }
    } catch (err: any) {
      console.error('❌ [VideoAnalyticsModal] Gemini analysis failed:', err);
      setAnalysisError(err?.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update URL when modal opens (if enabled)
  useEffect(() => {
    if (isOpen && video && updateUrlOnOpen) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('modal', 'video-analytics');
      newParams.set('videoId', video.id);
      setSearchParams(newParams, { replace: false });
    }
  }, [isOpen, video, updateUrlOnOpen, searchParams, setSearchParams]);

  // Handle close - remove modal params from URL
  const handleClose = () => {
    if (updateUrlOnOpen) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('modal');
      newParams.delete('videoId');
      setSearchParams(newParams, { replace: false });
    }
    onClose();
  };

  // Quick actions state
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const copyDropdownRef = useRef<HTMLDivElement>(null);
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyDropdownRef.current && !copyDropdownRef.current.contains(event.target as Node)) {
        setShowCopyDropdown(false);
      }
    };

    if (showCopyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyDropdown]);

  // Extract title without hashtags and separate hashtags
  const { cleanTitle, hashtags } = useMemo(() => {
    if (!video) return { cleanTitle: '', hashtags: [] };
    
    const fullText = video.title || video.caption || '';
    
    // Extract hashtags
    const hashtagMatches = fullText.match(/#[\w\u00C0-\u017F]+/g) || [];
    const uniqueHashtags = [...new Set(hashtagMatches)];
    
    // Remove hashtags from title
    const cleanText = fullText.replace(/#[\w\u00C0-\u017F]+/g, '').trim();
    
    return {
      cleanTitle: cleanText || '(No caption)',
      hashtags: uniqueHashtags
    };
  }, [video?.title, video?.caption]);

  // Calculate virality factor (likes + comments + shares relative to views)
  const viralityFactor = useMemo(() => {
    if (!video || video.views === 0) return 0;
    const totalEngagement = video.likes + video.comments + (video.shares || 0);
    return (totalEngagement / video.views) * 100;
  }, [video?.views, video?.likes, video?.comments, video?.shares]);

  // Calculate performance score and ranking
  const performanceScore = useMemo(() => {
    // Default to 100 if totalCreatorVideos not provided
    const maxVideos = totalCreatorVideos || 100;
    
    if (!video) return { score: 0, rank: 0, total: maxVideos };
    
    // Calculate normalized scores (0-100) for each metric
    const engagementRate = video.views > 0 
      ? ((video.likes + video.comments + (video.shares || 0)) / video.views) * 100 
      : 0;
    
    // Normalize views (assuming 1M views = 100 points)
    const viewScore = Math.min((video.views / 1000000) * 100, 100);
    
    // Normalize likes (assuming 50K likes = 100 points)
    const likeScore = Math.min((video.likes / 50000) * 100, 100);
    
    // Engagement rate score (cap at 20% engagement = 100 points)
    const engagementScore = Math.min((engagementRate / 20) * 100, 100);
    
    // Virality score (cap at 10x = 100 points)
    const viralityScore = Math.min((viralityFactor / 10) * 100, 100);
    
    // Weighted average score
    const totalScore = (
      viewScore * 0.30 +      // 30% weight on views
      likeScore * 0.25 +      // 25% weight on likes
      engagementScore * 0.30 + // 30% weight on engagement rate
      viralityScore * 0.15    // 15% weight on virality
    );
    
    // Calculate rank based on score (higher score = lower rank number)
    // Map score (0-100) to rank (1-maxVideos), where 100 score = rank 1
    const rank = Math.max(1, Math.min(maxVideos, Math.round((101 - totalScore) * (maxVideos / 100))));
    
    return {
      score: Math.round(totalScore),
      rank,
      total: maxVideos
    };
  }, [video?.views, video?.likes, video?.comments, video?.shares, viralityFactor, totalCreatorVideos]);


  // Prepare chart data from snapshots - always showing ALL data
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!video) return [];
    
    // Helper to create a data point from absolute/cumulative stats
    const createDataPoint = (stats: any, timestamp: Date, snapshotIndex: number): ChartDataPoint => {
      const views = stats.views || 0;
      const likes = stats.likes || 0;
      const comments = stats.comments || 0;
      const shares = stats.shares || 0;
      const saves = stats.saves || 0;

      const totalEngagement = likes + comments + shares;
      const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

      const formattedDate = timestamp.toLocaleString('en-US', {
          month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      return {
        date: formattedDate,
        views,
        likes,
        comments,
        shares,
        saves,
        engagementRate,
        timestamp: timestamp.getTime(),
        snapshotIndex
      };
    };

    // If no snapshots, create data point from current video stats only
    if (!video.snapshots || video.snapshots.length === 0) {
      const baseTimestamp = new Date(video.timestamp || video.dateSubmitted);
      const dataPoint = createDataPoint(video, baseTimestamp, 0);
      // Duplicate the single point to create a flat line with unique index/timestamp
      const duplicatePoint = {
        ...dataPoint,
        snapshotIndex: 1,
        timestamp: dataPoint.timestamp + 1
      };
      return [dataPoint, duplicatePoint];
    }

    // Sort all snapshots by date (KEEP initial snapshots as they provide baseline)
    const sortedSnapshots = [...video.snapshots]
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    
    console.log('📊 Video snapshots (RAW DATA):', {
      total: video.snapshots.length,
      filtered: sortedSnapshots.length,
      videoCurrentViews: video.views,
      snapshots: sortedSnapshots.map((s, idx) => ({
        index: idx,
        date: new Date(s.capturedAt).toLocaleString(),
        views: s.views,
        likes: s.likes,
        comments: s.comments,
        isInitial: s.isInitialSnapshot,
        capturedBy: s.capturedBy
      }))
    });
    
    // Check if all snapshots have identical values (bug indicator)
    if (sortedSnapshots.length > 1) {
      const allSameViews = sortedSnapshots.every(s => s.views === sortedSnapshots[0].views);
      const allSameLikes = sortedSnapshots.every(s => s.likes === sortedSnapshots[0].likes);
      if (allSameViews || allSameLikes) {
        console.warn('⚠️ WARNING: All snapshots have identical values! This suggests a data sync issue.');
      }
    }
    
    // Append current video stats if different from last snapshot
    const allSnapshots = [...sortedSnapshots];
    const lastSnapshotData = sortedSnapshots[sortedSnapshots.length - 1];
      const hasNewData = !lastSnapshotData || 
        lastSnapshotData.views !== video.views ||
        lastSnapshotData.likes !== video.likes ||
        lastSnapshotData.comments !== video.comments ||
        (lastSnapshotData.shares || 0) !== (video.shares || 0);
      
      if (hasNewData) {
        allSnapshots.push({
          id: `current-${Date.now()}`,
          videoId: video.id,
          views: video.views,
          likes: video.likes,
          comments: video.comments,
          shares: video.shares || 0,
          saves: video.saves || 0,
          capturedAt: new Date(),
          capturedBy: 'manual_refresh'
        });
      }

    // Create data points - each point shows CUMULATIVE totals at that snapshot time
    // This ensures the chart line accurately reflects the actual metric values over time
    const data: ChartDataPoint[] = allSnapshots.map((snapshot, index) => {
      const timestamp = new Date(snapshot.capturedAt);

      const cumulativeViews = snapshot.views || 0;
      const cumulativeLikes = snapshot.likes || 0;
      const cumulativeComments = snapshot.comments || 0;
      const cumulativeShares = snapshot.shares || 0;
      const cumulativeSaves = snapshot.saves || 0;

      // Calculate engagement rate from cumulative values
      const totalEngagement = cumulativeLikes + cumulativeComments + cumulativeShares;
      const engagementRate = cumulativeViews > 0 ? (totalEngagement / cumulativeViews) * 100 : 0;

      const formattedDate = timestamp.toLocaleString('en-US', {
          month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      return {
        date: formattedDate,
        views: cumulativeViews,
        likes: cumulativeLikes,
        comments: cumulativeComments,
        shares: cumulativeShares,
        saves: cumulativeSaves,
        engagementRate,
        timestamp: timestamp.getTime(),
        snapshotIndex: index
      };
    });

    console.log('📊 Final chart data (cumulative):', data.map(d => ({ date: d.date, views: d.views, likes: d.likes })));
    
    // If only one data point, duplicate it to create a flat line
    if (data.length === 1) {
      return [data[0], { ...data[0] }];
    }
    
    return data;
  }, [video?.id, video?.views, video?.likes, video?.comments, video?.shares, video?.saves, video?.snapshots]);

  // Get the latest cumulative totals from the last chart data point (most recent snapshot)
  const cumulativeTotals = useMemo(() => {
    if (!video || chartData.length === 0) return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagementRate: 0 };

    // Since chart data now holds cumulative values, the last point has the current totals
    const lastPoint = chartData[chartData.length - 1];

    return {
      views: lastPoint.views,
      likes: lastPoint.likes,
      comments: lastPoint.comments,
      shares: lastPoint.shares,
      saves: lastPoint.saves,
      engagementRate: lastPoint.engagementRate,
    };
  }, [chartData]);

  // Calculate growth since last snapshot and time elapsed
  const metricGrowthWithTime = useMemo(() => {
    if (!video || !video.snapshots || video.snapshots.length < 2) {
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        engagementRate: 0,
        timeSinceLastSnapshot: ''
      };
    }
    
    // Get the two most recent snapshots
    const sortedSnapshots = [...video.snapshots].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
    
    const latest = sortedSnapshots[0];
    const previous = sortedSnapshots[1];
    
    // Calculate time difference
    const timeDiff = new Date(latest.capturedAt).getTime() - new Date(previous.capturedAt).getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    let timeText = '';
    if (days > 0) {
      timeText = `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      timeText = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      timeText = 'recently';
    }
    
    return {
      views: latest.views - previous.views,
      likes: latest.likes - previous.likes,
      comments: latest.comments - previous.comments,
      shares: (latest.shares || 0) - (previous.shares || 0),
      saves: (latest.saves || 0) - (previous.saves || 0),
      engagementRate: ((latest.likes + latest.comments + (latest.shares || 0)) / (latest.views || 1) * 100) - 
                      ((previous.likes + previous.comments + (previous.shares || 0)) / (previous.views || 1) * 100),
      timeSinceLastSnapshot: timeText
    };
  }, [video?.snapshots]);

  if (!isOpen || !video) return null;


  // Twitter image slideshow state

  // Convert video URL to embed URL
  const getEmbedUrl = (url: string, platform: string): string => {
    try {
      // TikTok
      if (platform === 'tiktok' || url.includes('tiktok.com')) {
        const videoIdMatch = url.match(/video\/(\d+)/);
        if (videoIdMatch) {
          return `https://www.tiktok.com/embed/v2/${videoIdMatch[1]}`;
        }
      }
      
      // Instagram
      if (platform === 'instagram' || url.includes('instagram.com')) {
        const postMatch = url.match(/instagram\.com\/(p|reel|reels)\/([^\/\?]+)/);
        if (postMatch) {
          const type = postMatch[1] === 'reels' ? 'reel' : postMatch[1];
          const code = postMatch[2];
          return `https://www.instagram.com/${type}/${code}/embed`;
        }
      }
      
      // YouTube
      if (platform === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
        const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch) {
          return `https://www.youtube.com/embed/${shortsMatch[1]}`;
        }
        
        const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (youtuMatch) {
          return `https://www.youtube.com/embed/${youtuMatch[1]}`;
        }
        
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) {
          return `https://www.youtube.com/embed/${v}`;
        }
      }
      
      return url;
    } catch (error) {
      return url;
    }
  };

  const embedUrl = getEmbedUrl(video.url, video.platform);
  
  // Get Twitter media for slideshow
  const twitterMedia = video.platform === 'twitter' 
    ? (video.media && video.media.length > 0 
        ? video.media 
        : (video.thumbnail ? [video.thumbnail] : []))
    : [];

  // Define metrics with their configurations (using cumulative totals, not deltas)
  const metrics = [
    {
      key: 'views' as const,
      label: 'Views',
      icon: Eye,
      color: '#B47CFF',
      value: cumulativeTotals.views,
      growth: metricGrowthWithTime.views,
      timeSinceLastSnapshot: metricGrowthWithTime.timeSinceLastSnapshot,
    },
    {
      key: 'likes' as const,
      label: 'Likes',
      icon: Heart,
      color: '#FF6B9D',
      value: cumulativeTotals.likes,
      growth: metricGrowthWithTime.likes,
      timeSinceLastSnapshot: metricGrowthWithTime.timeSinceLastSnapshot,
    },
    {
      key: 'comments' as const,
      label: 'Comments',
      icon: MessageCircle,
      color: '#4ECDC4',
      value: cumulativeTotals.comments,
      growth: metricGrowthWithTime.comments,
      timeSinceLastSnapshot: metricGrowthWithTime.timeSinceLastSnapshot,
    },
    {
      key: 'shares' as const,
      label: 'Shares',
      icon: Share2,
      color: '#FFE66D',
      value: cumulativeTotals.shares,
      growth: metricGrowthWithTime.shares,
      timeSinceLastSnapshot: metricGrowthWithTime.timeSinceLastSnapshot,
    },
    {
      key: 'engagementRate' as const,
      label: 'Engagement',
      icon: TrendingUp,
      color: '#00D9FF',
      value: cumulativeTotals.engagementRate,
      growth: metricGrowthWithTime.engagementRate,
      timeSinceLastSnapshot: metricGrowthWithTime.timeSinceLastSnapshot,
      isPercentage: true,
    },
    {
      key: 'saves' as const,
      label: 'Bookmarks',
      icon: Bookmark,
      color: '#FF8A5B',
      value: cumulativeTotals.saves,
      growth: metricGrowthWithTime.saves,
      timeSinceLastSnapshot: metricGrowthWithTime.timeSinceLastSnapshot,
      showNA: !cumulativeTotals.saves && cumulativeTotals.saves !== 0, // Show N/A only if undefined/null
    },
  ];

  // Quick action handlers
  const handleDeleteVideo = async () => {
    // Show confirmation modal instead of window.confirm
    setShowDeleteModal(true);
  };

  const confirmDeleteVideo = async () => {
    if (!video) return;

    const videoId = video.id;
    const videoTitle = video.title || video.caption || 'Video';
    console.log(`🗑️ [UI] Starting INSTANT video deletion: ${videoTitle}`);

    // ✅ IMMEDIATELY close both modals (optimistic update)
    setShowDeleteModal(false);
    handleClose();
    console.log(`✅ [UI] Modals closed instantly`);

    // ✅ Process deletion in background (don't await)
    (async () => {
      try {
        console.log(`🔄 [BACKGROUND] Processing video deletion...`);
        
        // If we have orgId and projectId, this is a tracked account video
        if (orgId && projectId) {
          await FirestoreDataService.deleteVideo(orgId, projectId, videoId);
          console.log('✅ [BACKGROUND] Successfully deleted tracked video');
        } else {
          // Fallback to legacy FirebaseService for user-submitted videos
          await FirebaseService.deleteVideo(videoId);
          console.log('✅ [BACKGROUND] Successfully deleted user video');
        }
        
        // ✅ Call parent refresh callback to reload data
        if (onDelete) {
          console.log('🔄 [BACKGROUND] Triggering parent data refresh...');
          onDelete();
        }
      } catch (error) {
        console.error('❌ [BACKGROUND] Failed to delete video:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Video was removed from view but background cleanup encountered an error:\n${errorMessage}\n\nThe video will not reappear.`);
        // Still trigger refresh even on error (video might be partially deleted)
        if (onDelete) {
          onDelete();
        }
      }
    })();
  };

  const handleGoToVideo = () => {
    if (video.url) {
      window.open(video.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyTranscript = async () => {
    if (!analysis) return;

    // Prefer the plain transcript field (already without timestamps). Fall
    // back to joining segment texts if transcript is empty — that way we
    // still copy plain text with no MM:SS markers even if Gemini only
    // populated the segmented form.
    const text =
      analysis.transcript && analysis.transcript.trim().length > 0
        ? analysis.transcript.trim()
        : (analysis.transcriptSegments || []).map(s => s.text).join(' ').trim();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem('transcript');
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy transcript:', err);
    }
  };

  const handleCopy = async (type: 'link' | 'videoId' | 'accountLink') => {
    let textToCopy = '';
    
    switch (type) {
      case 'link':
        textToCopy = video.url || '';
        break;
      case 'videoId':
        textToCopy = video.id || '';
        break;
      case 'accountLink':
        // Construct account/profile link based on platform
        const handle = video.uploaderHandle || video.uploader || '';
        if (video.platform === 'tiktok') {
          textToCopy = `https://www.tiktok.com/@${handle}`;
        } else if (video.platform === 'instagram') {
          textToCopy = `https://www.instagram.com/${handle}`;
        } else if (video.platform === 'youtube') {
          textToCopy = `https://www.youtube.com/@${handle}`;
        }
        break;
    }

    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedItem(type);
        setTimeout(() => setCopiedItem(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl bg-surface-secondary border border-border w-full max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 lg:overflow-hidden lg:flex lg:flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 lg:flex-shrink-0">
          {/* Left: Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Trash - Delete Video */}
            <button
              onClick={handleDeleteVideo}
              className="p-2 text-content-secondary hover:text-red-400 bg-surface-hover hover:bg-red-500/10 rounded-lg transition-all border border-border-subtle hover:border-red-500/20"
              title="Delete video"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {/* Link - Go to Video */}
            <button
              onClick={handleGoToVideo}
              className="p-2 text-content-secondary hover:text-blue-400 bg-surface-hover hover:bg-blue-500/10 rounded-lg transition-all border border-border-subtle hover:border-blue-500/20"
              title="Go to video"
            >
              <Link2 className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {/* Copy - Dropdown */}
            <div className="relative" ref={copyDropdownRef}>
              <button
                onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                className="p-2 text-content-secondary hover:text-content bg-surface-hover hover:bg-surface-active rounded-lg transition-all border border-border-subtle hover:border-border-strong"
                title="Copy options"
              >
                <Copy className="w-4 h-4" strokeWidth={1.5} />
              </button>

              {/* Dropdown Menu */}
              {showCopyDropdown && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-surface-secondary border border-border rounded-lg shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => {
                      handleCopy('link');
                      setShowCopyDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-content hover:bg-surface-hover transition-colors flex items-center justify-between gap-2"
                  >
                    <span>Copy link</span>
                    {copiedItem === 'link' && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => {
                      handleCopy('videoId');
                      setShowCopyDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-content hover:bg-surface-hover transition-colors flex items-center justify-between gap-2 border-t border-border-subtle"
                  >
                    <span>Copy video ID</span>
                    {copiedItem === 'videoId' && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => {
                      handleCopy('accountLink');
                      setShowCopyDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-content hover:bg-surface-hover transition-colors flex items-center justify-between gap-2 border-t border-border-subtle"
                  >
                    <span>Copy account link</span>
                    {copiedItem === 'accountLink' && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                </div>
              )}
            </div>
                </div>
                
          {/* Right: Close Button Only */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="p-2 text-content-secondary hover:text-content bg-surface-hover hover:bg-surface-active rounded-full transition-all"
            >
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Main Content - 2 Column Layout. On lg+, this fills the remaining
            flex height and the two columns manage their own scroll (right
            column scrolls, left sidebar stays pinned). On mobile, the whole
            modal card scrolls as one — single-column stack. */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 overflow-hidden lg:flex-1 lg:min-h-0">
          {/* Left: Video sidebar — sticky on lg+ (parent doesn't scroll) */}
          <div className="overflow-hidden lg:overflow-y-auto lg:overflow-x-hidden">
            <VideoSidebar
              video={video}
              twitterMedia={twitterMedia}
              embedUrl={embedUrl}
              viralityFactor={viralityFactor}
            />
          </div>

          {/* Right: Scrollable content (chart, AI analysis, creator cards…) */}
          <div className="space-y-4 min-w-0 overflow-hidden lg:overflow-y-auto lg:overflow-x-hidden lg:pr-2">
            {/* Historical Metrics Chart - Replace KPI Cards */}
            <VideoHistoricalMetricsChart data={chartData} cumulativeTotals={cumulativeTotals} />

            {/* Subtle marketing CTA. Only shown on public share pages where a
                viewer drilling into a single video's performance is peak intent. */}
            {showLandingCTA && (
              <LandingCTABanner
                variant="compact"
                headline="Track your own videos like this"
                buttonLabel="Try ViewTrack"
              />
            )}

            {/* ── Gemini Video Analysis ─────────────────────────── */}
            {/* Hidden on the public share page (showAiAnalysis={false}) so
                read-only viewers don't see this internal/paid feature. */}
            {showAiAnalysis && (
            <div className="rounded-xl border border-border-subtle shadow-lg bg-surface-secondary p-4 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider">
                  AI Analysis
                </h3>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAnalyzeVideo}
                  disabled={!canAnalyze || isAnalyzing}
                  title={
                    analysis
                      ? 'Re-run the Gemini analysis'
                      : 'Transcribe and analyze this video with Gemini'
                  }
                >
                  {isAnalyzing ? 'Analyzing…' : analysis ? 'Re-analyze' : 'Transcribe & analyze video'}
                </Button>
              </div>

              {/* Helper text when nothing has run yet */}
              {!analysis && !isAnalyzing && !analysisError && (
                <p className="text-sm text-content-muted">
                  Use Gemini to transcribe this video and get a breakdown of the hook, tone,
                  pacing, what&apos;s working, and suggestions for future videos. This only runs
                  when you click the button.
                </p>
              )}

              {/* Loading state */}
              {isAnalyzing && (
                <p className="text-sm text-content-muted py-4">
                  Gemini is watching the video. This usually takes 20-60 seconds depending on length…
                </p>
              )}

              {/* Error state */}
              {analysisError && !isAnalyzing && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-1">
                  <strong className="font-semibold">Analysis failed:</strong> {analysisError}
                </div>
              )}

              {/* Results */}
              {analysis && !isAnalyzing && (
                <div className="space-y-4 mt-2">
                  {/* Summary */}
                  {analysis.summary && (
                    <div>
                      <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-1">
                        Summary
                      </div>
                      <p className="text-sm text-content leading-relaxed">{analysis.summary}</p>
                    </div>
                  )}

                  {/* Hook */}
                  {analysis.hook && (
                    <div>
                      <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-1">
                        Hook
                      </div>
                      <p className="text-sm text-content leading-relaxed">{analysis.hook}</p>
                    </div>
                  )}

                  {/* Tone + Pacing */}
                  {(analysis.tone || analysis.pacing) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysis.tone && (
                        <div className="rounded-lg border border-border-subtle bg-surface-tertiary p-3">
                          <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-1">
                            Tone
                          </div>
                          <p className="text-sm text-content">{analysis.tone}</p>
                        </div>
                      )}
                      {analysis.pacing && (
                        <div className="rounded-lg border border-border-subtle bg-surface-tertiary p-3">
                          <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-1">
                            Pacing
                          </div>
                          <p className="text-sm text-content">{analysis.pacing}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Topics */}
                  {analysis.topics && analysis.topics.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                        Topics
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {analysis.topics.map((topic, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg text-xs font-medium text-content-secondary border border-border bg-surface-tertiary"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What worked + Suggestions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {analysis.whatWorked && analysis.whatWorked.length > 0 && (
                      <div className="rounded-lg border border-border-subtle bg-surface-tertiary p-3">
                        <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                          What&apos;s working
                        </div>
                        <ul className="space-y-1.5">
                          {analysis.whatWorked.map((item, idx) => (
                            <li key={idx} className="text-sm text-content flex gap-2">
                              <span className="text-emerald-400 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.suggestions && analysis.suggestions.length > 0 && (
                      <div className="rounded-lg border border-border-subtle bg-surface-tertiary p-3">
                        <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider mb-2">
                          Suggestions
                        </div>
                        <ul className="space-y-1.5">
                          {analysis.suggestions.map((item, idx) => (
                            <li key={idx} className="text-sm text-content flex gap-2">
                              <span className="text-orange-400 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Transcript (collapsible) */}
                  {analysis.transcript && (
                    <div className="rounded-lg border border-border-subtle bg-surface-tertiary overflow-hidden">
                      <div className="w-full px-3 py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider">
                            Transcript
                          </span>
                          {analysis.transcriptSegments && analysis.transcriptSegments.length > 0 && (
                            <span className="text-[11px] text-content-muted">
                              ({analysis.transcriptSegments.length} segments)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={handleCopyTranscript}
                            className="text-[11px] font-medium text-content-muted uppercase tracking-wider hover:text-content transition-colors"
                          >
                            {copiedItem === 'transcript' ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTranscriptExpanded(prev => !prev)}
                            className="text-[11px] font-medium text-content-muted uppercase tracking-wider hover:text-content transition-colors"
                          >
                            {transcriptExpanded ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                      {transcriptExpanded && (
                        <div className="px-3 pb-3 pt-1 max-h-80 overflow-y-auto text-sm text-content leading-relaxed">
                          {analysis.transcriptSegments && analysis.transcriptSegments.length > 0 ? (
                            <div className="space-y-1.5">
                              {analysis.transcriptSegments.map((seg, idx) => (
                                <div key={idx} className="flex gap-3">
                                  <span className="text-xs text-content-muted font-mono pt-0.5 flex-shrink-0">
                                    {seg.timestamp}
                                  </span>
                                  <span>{seg.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{analysis.transcript}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
            )}

            {/* OLD 6 Metric Charts in 3-Column Grid - HIDDEN */}
            <div className="grid grid-cols-3 gap-4 min-w-0" style={{ display: 'none' }}>
            {metrics.map((metric) => {
              // Determine color based on individual metric growth
              // Green for positive growth, red for negative growth
              const metricGrowth = (metric as any).growth || 0;
              const displayColor = metricGrowth >= 0 ? '#22c55e' : '#ef4444';
              
              return (
                <div 
                  key={metric.label}
                  className="group relative rounded-2xl bg-surface-secondary backdrop-blur border border-border-subtle shadow-lg hover:shadow-xl hover:ring-1 hover:ring-border transition-all duration-300 overflow-hidden"
                  style={{ minHeight: '180px' }}
                >
                  {/* Upper Solid Portion - 60% */}
                  <div className="relative px-5 pt-4 pb-2" style={{ height: '60%' }}>
                    {/* Icon (top-right) */}
                    <div className="absolute top-4 right-4">
                      <metric.icon className="w-5 h-5 text-content-muted opacity-60" />
                    </div>

                    {/* Metric Content */}
                    <div className="flex flex-col h-full justify-start pt-1">
                      {/* Label */}
                      <div className="text-xs font-medium text-content-muted tracking-wide mb-2">
                        {metric.label}
                      </div>

                      {/* Value */}
                      <div className="flex flex-col gap-1 -mt-1">
                        <span className="text-3xl lg:text-4xl font-bold tracking-tight text-content">
                          {(metric as any).showNA
                            ? 'N/A'
                            : metric.isPercentage 
                              ? `${metric.value.toFixed(1)}%` 
                              : formatNumber(metric.value)
                          }
                        </span>
                        
                        {/* Growth Indicator with Time */}
                        {!(metric as any).showNA && (metric as any).growth !== undefined && (metric as any).growth !== 0 && (metric as any).timeSinceLastSnapshot && (
                          <span className={`text-xs font-semibold ${(metric as any).growth > 0 ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-1`}>
                            {(metric as any).growth > 0 ? (
                              <>
                                <TrendingUp className="w-3 h-3" />
                                <span>
                                  +{metric.isPercentage 
                                    ? `${Math.abs((metric as any).growth).toFixed(1)}%` 
                                    : formatNumber(Math.abs((metric as any).growth))
                                  } ({(metric as any).timeSinceLastSnapshot})
                                </span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3" />
                                <span>
                                  {metric.isPercentage 
                                    ? `${Math.abs((metric as any).growth).toFixed(1)}%` 
                                    : formatNumber(Math.abs((metric as any).growth))
                                  } ({(metric as any).timeSinceLastSnapshot})
                                </span>
                              </>
                            )}
                          </span>
                        )}
              </div>
            </div>
          </div>

                  {/* Bottom Graph Layer - 40% */}
                  {chartData && chartData.length > 0 && (
                    <div 
                      className="relative w-full overflow-hidden"
                      style={{ 
                        height: '40%',
                        background: 'linear-gradient(to top, var(--color-surface-tertiary) 0%, transparent 100%)',
                        borderBottomLeftRadius: '1rem',
                        borderBottomRightRadius: '1rem'
                      }}
                    >
                      {/* Atmospheric Gradient Overlay */}
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `linear-gradient(to top, ${displayColor}15 0%, transparent 80%)`,
                          mixBlendMode: 'soft-light'
                        }}
                      />
                      
                      {/* Line Chart with Custom Tooltip */}
                      <div 
                        className="absolute inset-0" 
                        style={{ padding: '0' }}
                        onMouseMove={(e) => {
                          if (!chartData || chartData.length === 0) return;
                          
                          const chartContainer = e.currentTarget;
                          const chartRect = chartContainer.getBoundingClientRect();
                          const x = e.clientX - chartRect.left;
                          const percentage = x / chartRect.width;
                          const index = Math.min(
                            Math.max(0, Math.floor(percentage * chartData.length)),
                            chartData.length - 1
                          );
                          const dataPoint = chartData[index];
                          
                          setTooltipData({
                            x: e.clientX,
                            y: e.clientY,
                            dataPoint,
                            metricKey: metric.key,
                            metricLabel: metric.label,
                            isPercentage: metric.isPercentage || false,
                            lineX: x,
                            chartRect,
                            dataIndex: index
                          });
                        }}
                        onMouseLeave={() => setTooltipData(null)}
                      >
                        {/* Vertical cursor line */}
                        {tooltipData && tooltipData.metricKey === metric.key && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${tooltipData.lineX}px`,
                              top: 0,
                              bottom: 0,
                              width: '2px',
                              background: `linear-gradient(to bottom, ${displayColor}00 0%, ${displayColor}80 15%, ${displayColor}60 50%, ${displayColor}40 85%, ${displayColor}00 100%)`,
                              pointerEvents: 'none',
                              zIndex: 50
                            }}
                          />
                        )}
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                            <AreaChart 
                              data={chartData}
                              margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
                            >
                <defs>
                                <linearGradient id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={displayColor} stopOpacity={0.2} />
                                  <stop offset="100%" stopColor={displayColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area 
                                type="monotoneX"
                                dataKey={metric.key}
                                stroke={displayColor}
                    strokeWidth={2}
                                fill={`url(#gradient-${metric.key})`}
                                isAnimationActive={false}
                                dot={false}
                    activeDot={false}
                  />
              </AreaChart>
            </ResponsiveContainer>
            {/* Custom dot that snaps immediately to tooltip position */}
            {tooltipData && tooltipData.metricKey === metric.key && tooltipData.chartRect && (() => {
              const chartWidth = tooltipData.chartRect.width;
              const chartHeight = tooltipData.chartRect.height;
              const dataIndex = tooltipData.dataIndex;
              
              // Chart margins from AreaChart component
              const marginTop = 2;
              const marginBottom = 2;
              const availableHeight = chartHeight - marginTop - marginBottom;
              
              // X position based on data index
              const xPosition = (dataIndex / Math.max(chartData.length - 1, 1)) * chartWidth;
              
              // Calculate y position based on data value with proper scaling
              const values = chartData.map(d => d[metric.key]);
              const maxValue = Math.max(...values);
              const minValue = Math.min(...values);
              const valueRange = maxValue - minValue || 1;
              const currentValue = tooltipData.dataPoint[metric.key];
              
              // Normalize value between 0 and 1, then scale to chart height
              const normalizedValue = (currentValue - minValue) / valueRange;
              const yPosition = marginTop + availableHeight * (1 - normalizedValue);
              
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: `${xPosition}px`,
                    top: `${yPosition}px`,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: displayColor,
                    border: '2px solid var(--color-surface-secondary)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 100,
                    boxShadow: `0 0 8px ${displayColor}80`
                  }}
                />
              );
            })()}
          </div>
          </div>
              </div>
            )}
          </div>
              );
            })}
            </div>

            {/* Creator Info & Content Section */}
            <div className="space-y-3 min-w-0">
              {/* Creator Details & Performance Score Grid */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
                {/* Creator Details */}
                <div className="rounded-xl border border-border-subtle shadow-lg p-3 min-w-0 overflow-hidden bg-surface-secondary">
                  <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
                    Creator Details
                  </h3>
                  
                  <div className="flex items-center gap-3">
                    {/* Profile Picture */}
                    <div className="relative flex-shrink-0">
                      {video.uploaderProfilePicture && !imageError ? (
                        <img 
                          src={video.uploaderProfilePicture} 
                          alt={video.uploader || video.uploaderHandle}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center ring-2 ring-border">
                          <span className="text-content font-bold text-sm">
                            {(video.uploader || video.uploaderHandle || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* Platform Badge */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-surface-secondary rounded-full p-0.5 ring-1 ring-border">
                        <PlatformIcon platform={video.platform} size="sm" />
                      </div>
                    </div>
                    
                    {/* Username and Followers */}
                    <div className="flex-1">
                      <p className="text-base font-bold text-content mb-1">
                        @{video.uploaderHandle}
                      </p>
                      <p className="text-sm text-content-muted">
                        {video.followerCount ? formatNumber(video.followerCount) : 'N/A'} followers
                      </p>
                    </div>
                  </div>
                </div>

                {/* Video Performance Score */}
                <div className="rounded-xl border border-border-subtle shadow-lg p-3 min-w-0 overflow-hidden bg-surface-secondary">
                  <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
                    Performance Rank
                  </h3>
                  
                  <div className="flex items-center gap-3">
                    {/* Rank Display - Compact Layout */}
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-content">
                          #{performanceScore.rank}
                        </span>
                        <span className="text-sm text-content-muted">
                          out of {performanceScore.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption & Hashtags Grid */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
                {/* Video Caption */}
                <div className="rounded-xl border border-border-subtle shadow-lg p-3 min-w-0 overflow-hidden bg-surface-secondary">
                  <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
                    Video Caption
                  </h3>
                  <p className="text-base text-content leading-relaxed">
                    {cleanTitle}
                  </p>
                </div>

                {/* Hashtags */}
                <div className="rounded-xl border border-border-subtle shadow-lg p-3 min-w-0 overflow-hidden bg-surface-secondary">
                  <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
                    Hashtags
                  </h3>
                  {hashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-content-secondary border border-border hover:border-border-strong transition-colors bg-surface-tertiary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-content-muted">No hashtags</p>
                  )}
                </div>
              </div>

              {/* Snapshots History */}
            <VideoSnapshotsHistory snapshots={video.snapshots || []} />
                          </div>
                        </div>
        </div>
      </div>

      {/* Portal Tooltip - Rendered at document.body level for smooth movement */}
      {tooltipData && (() => {
        const tooltipWidth = 300;
        const verticalOffset = 20;
        const horizontalPadding = 20;
        const windowWidth = window.innerWidth;
        
        // Calculate horizontal position to keep tooltip on screen
        let leftPosition = tooltipData.x;
        let transformX = '-50%';
        
        // Check if tooltip would go off left edge
        if (tooltipData.x - (tooltipWidth / 2) < horizontalPadding) {
          leftPosition = horizontalPadding;
          transformX = '0';
        }
        // Check if tooltip would go off right edge
        else if (tooltipData.x + (tooltipWidth / 2) > windowWidth - horizontalPadding) {
          leftPosition = windowWidth - horizontalPadding;
          transformX = '-100%';
        }
        
        const value = tooltipData.dataPoint[tooltipData.metricKey];
        console.log('🧷 Portal Tooltip Value', {
          metricKey: tooltipData.metricKey,
          dataIndex: tooltipData.dataIndex,
          rawValue: value,
          dataPoint: tooltipData.dataPoint
        });
        
        const isBaseline = tooltipData.dataIndex === 0;
        const formattedValue = tooltipData.isPercentage
          ? (isBaseline ? `${value.toFixed(1)}%` : `+${value.toFixed(1)}%`)
          : (isBaseline ? formatNumber(value) : `+${formatNumber(value)}`);
        
        return createPortal(
          <div 
            className="bg-surface-tertiary backdrop-blur-xl text-content rounded-xl shadow-2xl border border-border" 
            style={{ 
              position: 'fixed',
              left: `${leftPosition}px`,
              top: `${tooltipData.y + verticalOffset}px`,
              transform: `translateX(${transformX})`,
              zIndex: 999999999,
              width: `${tooltipWidth}px`,
              pointerEvents: 'none'
            }}
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-border">
              <p className="text-xs text-content-muted font-medium uppercase tracking-wider">
                {tooltipData.dataPoint.date}
              </p>
            </div>

            {/* Value */}
            <div className="px-5 py-4">
              <p className="text-2xl text-content font-bold">
                {formattedValue}
              </p>
              <p className="text-sm text-content-muted mt-1">
                {tooltipData.metricLabel}
              </p>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Delete Confirmation Modal */}
      {/* Delete Confirmation Modal */}
      <VideoDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteVideo}
        videoTitle={video.title || video.caption || 'Untitled video'}
      />
    </div>
  );
};

export default VideoAnalyticsModal;
