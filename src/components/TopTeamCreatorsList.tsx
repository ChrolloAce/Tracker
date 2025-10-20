import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Creator, CreatorLink } from '../types/firestore';
import { VideoSubmission } from '../types';
import { PlatformIcon } from './ui/PlatformIcon';
import { ChevronDown, Users, User, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TopTeamCreatorsListProps {
  submissions: VideoSubmission[];
  onCreatorClick?: (username: string) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'engagement' | 'videos';

const TopTeamCreatorsList: React.FC<TopTeamCreatorsListProps> = ({ submissions, onCreatorClick }) => {
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
        
        setCreators(creatorsData);
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
          stats.totalViews += video.views || 0;
          stats.totalLikes += video.likes || 0;
          stats.totalComments += video.comments || 0;
          stats.totalShares += video.shares || 0;
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
  }, [submissions, creators, creatorLinks, accounts]);

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
      <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
        </div>
      </div>
    );
  }

  return (
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
            <h2 className="text-lg font-semibold text-white">Top Creators</h2>
            <div className="relative">
              <button
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <Info className="w-4 h-4" style={{ opacity: 0.5 }} />
              </button>
              
              {/* Info Tooltip */}
              {showInfo && (
                <div 
                  className="absolute left-0 top-full mt-2 w-64 p-3 rounded-lg border shadow-xl z-50"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.98)',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <p className="text-xs text-gray-300 leading-relaxed">
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
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                className="appearance-none bg-white/10 text-white rounded-lg px-3 py-1.5 pr-8 text-sm font-medium border border-white/10 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
              >
                <option value="views" className="bg-gray-900">Views</option>
                <option value="likes" className="bg-gray-900">Likes</option>
                <option value="comments" className="bg-gray-900">Comments</option>
                <option value="shares" className="bg-gray-900">Shares</option>
                <option value="engagement" className="bg-gray-900">Engagement</option>
                <option value="videos" className="bg-gray-900">Videos Posted</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Race Bars */}
        {sortedCreators.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No team creators found</p>
            <p className="text-xs mt-1">Add creators in the Creators tab</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCreators.map((stats, index) => {
              const value = getDisplayValue(stats);
              const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
              
              return (
                <div 
                  key={stats.creator.id} 
                  className="group relative cursor-pointer"
                  style={{
                    animation: `raceSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s both`
                  }}
                  onClick={() => onCreatorClick?.(stats.creator.displayName)}
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
                      barElement.style.background = 'linear-gradient(to right, #E5E7EB, #F9FAFB)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    setHoveredCreator(null);
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
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-gray-700/50 backdrop-blur-sm relative flex items-center justify-center">
                        {stats.creator.photoURL ? (
                          <img 
                            src={stats.creator.photoURL} 
                            alt={stats.creator.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
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
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                {hoveredCreator.creator.creator.displayName}
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-bold text-white">
                  {formatNumber(getDisplayValue(hoveredCreator.creator), selectedMetric)}
                </p>
              </div>
            </div>
            
            {/* Divider */}
            <div className="border-t border-white/10 mx-5"></div>
            
            {/* Stats */}
            <div className="px-5 py-3">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Videos</span>
                  <span className="text-white font-medium">{hoveredCreator.creator.videoCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Linked Accounts</span>
                  <span className="text-white font-medium">{hoveredCreator.creator.linkedAccounts.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Views</span>
                  <span className="text-white font-medium">{formatNumber(hoveredCreator.creator.totalViews, 'views')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Engagement</span>
                  <span className="text-white font-medium">{hoveredCreator.creator.avgEngagement.toFixed(1)}%</span>
                </div>
              </div>

              {/* Click to View */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-white transition-colors">
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
