import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Creator, CreatorLink } from '../types/firestore';
import { VideoSubmission } from '../types';
import { ChevronDown, Users, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DateFilterType } from './DateRangeFilter';
import DateFilterService from '../services/DateFilterService';
import { computePerVideoMetricInRange } from './kpi/kpiDataProcessing';

interface TopTeamCreatorsListProps {
  submissions: VideoSubmission[];
  onCreatorClick?: (username: string) => void;
  /** Fired when a creator row is clicked. Receives every linked tracked-account
   *  username for that creator so the day/period modal can filter videos across
   *  all platforms (Instagram + TikTok + YouTube + X) at once. When omitted,
   *  falls back to onCreatorClick(displayName) — which is what the legacy code
   *  did and is why nothing showed up: displayName rarely matches a uploaderHandle. */
  onCreatorRowClick?: (info: { creatorId: string; displayName: string; usernames: string[] }) => void;
  /** Optional explicit date range. Takes precedence over dateFilter/customRange. */
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date;
  /** Falls back to deriving the range from these when explicit dates aren't supplied. */
  dateFilter?: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';

const TopTeamCreatorsList: React.FC<TopTeamCreatorsListProps> = ({
  submissions,
  onCreatorClick,
  onCreatorRowClick,
  dateRangeStart,
  dateRangeEnd,
  dateFilter,
  customRange,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [topCount, setTopCount] = useState(5);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('views');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [creatorLinks, setCreatorLinks] = useState<CreatorLink[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCreator, setHoveredCreator] = useState<{
    creator: any;
    x: number;
    y: number;
  } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Fetch creators and their linked accounts
  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrgId || !currentProjectId) return;
      
      try {
        setLoading(true);
        
        // Fetch creators
        const creatorsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creators');
        const creatorsSnapshot = await getDocs(creatorsRef);
        const creatorsData = creatorsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Creator));
        
        // Fetch creator links
        const linksRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creatorLinks');
        const linksSnapshot = await getDocs(linksRef);
        const linksData = linksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CreatorLink));
        
        // Fetch tracked accounts
        const accountsRef = collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'trackedAccounts');
        const accountsSnapshot = await getDocs(accountsRef);
        const accountsData = accountsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        // Slow path only — async users/{id} lookup for any creator missing a
        // photoURL. Result is cached on the creator object; in-memory
        // fallbacks (linked-account picture, video uploader picture) run in a
        // separate useMemo below so they react to fresh submissions without
        // re-firing Firestore reads.
        const enrichedCreators = await Promise.all(
          creatorsData.map(async (creator) => {
            if (creator.photoURL) return creator;
            try {
              const userAccountRef = doc(db, 'users', creator.id);
              const userAccountDoc = await getDoc(userAccountRef);
              if (userAccountDoc.exists() && userAccountDoc.data()?.photoURL) {
                return { ...creator, photoURL: userAccountDoc.data()!.photoURL };
              }
            } catch {
              // Ignore - photoURL is optional
            }
            return creator;
          })
        );

        setCreators(enrichedCreators);
        setCreatorLinks(linksData);
        setAccounts(accountsData);
      } catch (error) {
        console.error('Error fetching creators:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentOrgId, currentProjectId]);

  // creatorId → { photoFallback, usernames[] }. Pure in-memory derivation so
  // it reacts to submissions/accounts/links changes without re-firing the
  // Firestore reads above.
  const creatorAuxiliary = useMemo(() => {
    const accountById = new Map(accounts.map((a: any) => [a.id, a]));
    const handleToVideoPic = new Map<string, string>();
    submissions.forEach(v => {
      const h = (v.uploaderHandle || '').toLowerCase();
      const pic = (v as any).uploaderProfilePicture;
      if (h && pic && !handleToVideoPic.has(h)) handleToVideoPic.set(h, pic);
    });
    const aux = new Map<string, { photoFallback?: string; usernames: string[] }>();
    creatorLinks.forEach(link => {
      if (!link.creatorId || !link.accountId) return;
      const acct: any = accountById.get(link.accountId);
      const entry = aux.get(link.creatorId) || { usernames: [] };
      const handle: string | undefined = acct?.username;
      if (handle && !entry.usernames.includes(handle)) entry.usernames.push(handle);
      if (!entry.photoFallback) {
        entry.photoFallback = acct?.profilePicture
          || (handle && handleToVideoPic.get(handle.toLowerCase()))
          || undefined;
      }
      aux.set(link.creatorId, entry);
    });
    return aux;
  }, [accounts, creatorLinks, submissions]);

  // Resolve the effective date range. Explicit dateRangeStart/dateRangeEnd
  // win; otherwise derive from dateFilter/customRange via DateFilterService.
  // When no range info is provided we fall back to lifetime sums.
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (dateRangeEnd !== undefined) {
      return { rangeStart: dateRangeStart ?? null, rangeEnd: dateRangeEnd };
    }
    if (dateFilter && dateFilter !== 'all') {
      const r = DateFilterService.getDateRange(dateFilter, customRange);
      return { rangeStart: r.startDate, rangeEnd: r.endDate };
    }
    return { rangeStart: null, rangeEnd: new Date() };
  }, [dateRangeStart, dateRangeEnd, dateFilter, customRange]);

  // Calculate aggregated creator stats
  const creatorStats = useMemo(() => {
    if (creators.length === 0 || accounts.length === 0) return [];

    // First, deduplicate videos by ID
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });

    // Build a map of username -> accountId
    const usernameToAccountId = new Map<string, string>();
    accounts.forEach(account => {
      const key = `${account.platform}_${account.username.toLowerCase()}`;
      usernameToAccountId.set(key, account.id);
    });

    // Build a map of accountId -> creatorId
    const accountToCreator = new Map<string, string>();
    creatorLinks.forEach(link => {
      accountToCreator.set(link.accountId, link.creatorId);
    });

    // Aggregate by creator
    const creatorMap = new Map<string, {
      creator: Creator;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      videoCount: number;
      linkedAccounts: Set<string>;
      avgViews: number;
      avgLikes: number;
      avgEngagement: number;
    }>();

    // Initialize all creators
    creators.forEach(creator => {
      creatorMap.set(creator.id, {
        creator,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        videoCount: 0,
        linkedAccounts: new Set<string>(),
        avgViews: 0,
        avgLikes: 0,
        avgEngagement: 0
      });
    });

    // Aggregate video stats for each creator
    uniqueVideos.forEach(video => {
      // Match video to account by username + platform
      const videoKey = `${video.platform}_${video.uploaderHandle.toLowerCase()}`;
      const accountId = usernameToAccountId.get(videoKey);
      
      if (accountId) {
        const creatorId = accountToCreator.get(accountId);

        if (creatorId && creatorMap.has(creatorId)) {
          const stats = creatorMap.get(creatorId)!;
          // Snapshot-aware, date-range-clamped sums. Only `views` carries
          // spark (paid-ad) attribution.
          stats.totalViews += computePerVideoMetricInRange(video, 'views', rangeStart, rangeEnd, { excludeSparked: true });
          stats.totalLikes += computePerVideoMetricInRange(video, 'likes', rangeStart, rangeEnd, { excludeSparked: false });
          stats.totalComments += computePerVideoMetricInRange(video, 'comments', rangeStart, rangeEnd, { excludeSparked: false });
          stats.totalShares += computePerVideoMetricInRange(video, 'shares', rangeStart, rangeEnd, { excludeSparked: false });
          stats.videoCount += 1;
          stats.linkedAccounts.add(accountId);
        }
      }
    });

    // Calculate averages
    creatorMap.forEach(stats => {
      stats.avgViews = stats.videoCount > 0 ? stats.totalViews / stats.videoCount : 0;
      stats.avgLikes = stats.videoCount > 0 ? stats.totalLikes / stats.videoCount : 0;
      const totalEngagement = stats.totalLikes + stats.totalComments + stats.totalShares;
      stats.avgEngagement = stats.totalViews > 0 ? (totalEngagement / stats.totalViews) * 100 : 0;
    });

    return Array.from(creatorMap.values()).filter(stats => stats.videoCount > 0);
  }, [submissions, creators, creatorLinks, accounts, rangeStart, rangeEnd]);

  // Sort creators by selected metric
  const sortedCreators = useMemo(() => {
    const getMetricValue = (stats: typeof creatorStats[0]): number => {
      switch (selectedMetric) {
        case 'views':
          return stats.totalViews;
        case 'likes':
          return stats.totalLikes;
        case 'comments':
          return stats.totalComments;
        case 'shares':
          return stats.totalShares;
        case 'engagement':
          return stats.avgEngagement;
        case 'videos':
          return stats.videoCount;
        default:
          return 0;
      }
    };

    return [...creatorStats]
      .sort((a, b) => getMetricValue(b) - getMetricValue(a))
      .slice(0, topCount);
  }, [creatorStats, selectedMetric, topCount]);

  // Get max value for percentage calculation
  const maxValue = useMemo(() => {
    if (sortedCreators.length === 0) return 0;
    const getMetricValue = (stats: typeof creatorStats[0]): number => {
      switch (selectedMetric) {
        case 'views':
          return stats.totalViews;
        case 'likes':
          return stats.totalLikes;
        case 'comments':
          return stats.totalComments;
        case 'shares':
          return stats.totalShares;
        case 'engagement':
          return stats.avgEngagement;
        case 'videos':
          return stats.videoCount;
        default:
          return 0;
      }
    };
    return getMetricValue(sortedCreators[0]);
  }, [sortedCreators, selectedMetric]);

  // Format numbers
  const formatNumber = (num: number, metric: MetricType): string => {
    if (metric === 'engagement') {
      return `${num.toFixed(1)}%`;
    }
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Get metric value for display
  const getDisplayValue = (stats: typeof creatorStats[0]): number => {
    switch (selectedMetric) {
      case 'views':
        return stats.totalViews;
      case 'likes':
        return stats.totalLikes;
      case 'comments':
        return stats.totalComments;
      case 'shares':
        return stats.totalShares;
      case 'engagement':
        return stats.avgEngagement;
      case 'videos':
        return stats.videoCount;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="relative rounded-2xl bg-surface-secondary backdrop-blur border border-border shadow-theme p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl bg-surface-secondary backdrop-blur border border-border shadow-theme transition-all duration-300 p-6 overflow-hidden">

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-content">Top Creators</h2>
            <div className="relative">
              <button
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
                className="text-content-muted hover:text-content-secondary transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>

              {/* Info Tooltip */}
              {showInfo && (
                <div
                  className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border border-border shadow-xl z-50 bg-surface-tertiary"
                >
                  <p className="text-xs text-content-muted leading-relaxed">
                    Rankings of your team members based on the combined performance of all their assigned accounts. Perfect for tracking creator productivity.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Count Selector */}
            <div className="relative">
              <select
                value={topCount}
                onChange={(e) => setTopCount(Number(e.target.value))}
                className="appearance-none bg-surface-hover text-content rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-border hover:bg-surface-active focus:outline-none focus:ring-1 focus:ring-border-strong transition-all cursor-pointer"
              >
                <option value={3} className="bg-surface-secondary">3</option>
                <option value={5} className="bg-surface-secondary">5</option>
                <option value={10} className="bg-surface-secondary">10</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
            </div>

            {/* Metric Selector */}
            <div className="relative">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                className="appearance-none bg-surface-hover text-content rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-border hover:bg-surface-active focus:outline-none focus:ring-1 focus:ring-border-strong transition-all cursor-pointer"
              >
                <option value="views" className="bg-surface-secondary">Views</option>
                <option value="likes" className="bg-surface-secondary">Likes</option>
                <option value="comments" className="bg-surface-secondary">Comments</option>
                <option value="shares" className="bg-surface-secondary">Shares</option>
                <option value="engagement" className="bg-surface-secondary">Engagement</option>
                <option value="videos" className="bg-surface-secondary">Videos Posted</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        {sortedCreators.length === 0 ? (
          <div className="text-center py-8 text-content-muted">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No team creators found</p>
            <p className="text-xs mt-1">Add creators in the Creators tab</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCreators.map((stats, index) => {
              const value = getDisplayValue(stats);
              const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
              const aux = creatorAuxiliary.get(stats.creator.id);
              const effectivePhotoURL = stats.creator.photoURL || aux?.photoFallback;
              const linkedUsernames = aux?.usernames || [];

              return (
                <div
                  key={stats.creator.id}
                  className={`group relative cursor-pointer py-2 ${index > 0 ? 'border-t border-border-subtle' : ''}`}
                  style={{
                    animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                  }}
                  onClick={() => {
                    // Prefer the rich callback (passes all linked usernames so
                    // the modal filters across every platform). Fall back to
                    // legacy onCreatorClick(displayName) only when the parent
                    // didn't wire onCreatorRowClick.
                    if (onCreatorRowClick) {
                      onCreatorRowClick({
                        creatorId: stats.creator.id,
                        displayName: stats.creator.displayName || '',
                        usernames: linkedUsernames,
                      });
                    } else {
                      onCreatorClick?.(stats.creator.displayName);
                    }
                  }}
                  onMouseEnter={(e) => {
                    // Only update if not already hovering this creator
                    if (hoveredCreator?.creator?.creator?.id !== stats.creator.id) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredCreator({
                        creator: stats,
                        x: rect.left + rect.width / 2,
                        y: rect.top
                      });
                    }
                    const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                    if (barElement) {
                      barElement.style.background = 'linear-gradient(to right, #f97316, #ea580c)';
                      barElement.style.opacity = '0.85';
                    }
                  }}
                  onMouseLeave={(e) => {
                    setHoveredCreator(null);
                    const barElement = e.currentTarget.querySelector('.race-bar') as HTMLElement;
                    if (barElement) {
                      barElement.style.background = 'linear-gradient(to right, #f97316, #ea580c)';
                      barElement.style.opacity = '1';
                    }
                  }}
                >
                  {/* Bar Container */}
                  <div className="relative h-10 flex items-center">
                    {/* Profile Icon (Spearhead) */}
                    <div className="absolute left-0 z-10 flex-shrink-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-surface-hover backdrop-blur-sm relative flex items-center justify-center">
                        {effectivePhotoURL && !imageErrors.has(stats.creator.id) ? (
                          <img
                            src={effectivePhotoURL}
                            alt={stats.creator.displayName}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setImageErrors(prev => new Set(prev).add(stats.creator.id));
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-content-inverse font-bold text-sm">
                            {(stats.creator.displayName || stats.creator.email || 'C').charAt(0).toUpperCase()}
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
                            background: 'linear-gradient(to right, #f97316, #ea580c)'
                          }}
                        >
                        </div>
                      </div>
                      {/* Metric Value - Always on Right */}
                      <div className="ml-4 min-w-[100px] text-right">
                        <span className="text-lg font-semibold text-content tabular-nums tracking-tight" style={{ fontFamily: 'Inter, SF Pro Display, system-ui, sans-serif' }}>
                          {formatNumber(value, selectedMetric)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hoveredCreator && createPortal(
        <div
          className="fixed z-[999999] pointer-events-none"
          style={{
            left: `${hoveredCreator.x}px`,
            top: `${hoveredCreator.y - 10}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-surface-tertiary backdrop-blur-xl text-content rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-border w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-xs text-content-muted font-medium uppercase tracking-wider">
                {hoveredCreator.creator.creator.displayName}
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-bold text-content">
                  {formatNumber(getDisplayValue(hoveredCreator.creator), selectedMetric)}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border mx-5"></div>

            {/* Stats */}
            <div className="px-5 py-3">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-content-muted">Videos</span>
                  <span className="text-content font-medium">{hoveredCreator.creator.videoCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-muted">Linked Accounts</span>
                  <span className="text-content font-medium">{hoveredCreator.creator.linkedAccounts.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-muted">Total Views</span>
                  <span className="text-content font-medium">{formatNumber(hoveredCreator.creator.totalViews, 'views')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-content-muted">Avg Engagement</span>
                  <span className="text-content font-medium">{hoveredCreator.creator.avgEngagement.toFixed(1)}%</span>
                </div>
              </div>

              {/* Click to View */}
              <div className="mt-3 pt-3 border-t border-border">
                <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-content-muted hover:text-content transition-colors">
                  <span>Click to view creator</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes raceSlideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default TopTeamCreatorsList;
