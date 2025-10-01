import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  Plus, 
  Users, 
  RefreshCw,
  Trash2,
  User,
  Filter,
  Search,
  MoreHorizontal,
  AlertCircle,
  Play,
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  Calendar,
  Share2,
  Activity,
  Video,
  TrendingUp,
  TrendingDown
  } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { TrackedAccount, AccountVideo } from '../types/accounts';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import { PlatformIcon } from './ui/PlatformIcon';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { MiniTrendChart } from './ui/MiniTrendChart';
import { TrendCalculationService } from '../services/TrendCalculationService';
import { VideoSubmission } from '../types';
import VideoPlayerModal from './VideoPlayerModal';
import { DateFilterType } from './DateRangeFilter';

interface AccountsPageProps {
  dateFilter: DateFilterType;
  onViewModeChange: (mode: 'table' | 'details') => void;
}

export interface AccountsPageRef {
  handleBackToTable: () => void;
}

// Map dateFilter to timePeriod for calculations
const mapDateFilterToTimePeriod = (filter: DateFilterType): 'all' | 'weekly' | 'monthly' | 'daily' => {
  switch (filter) {
    case 'today': return 'daily';
    case 'last7': return 'weekly';
    case 'last30': return 'monthly';
    default: return 'all';
  }
};

const AccountsPage = forwardRef<AccountsPageRef, AccountsPageProps>(({ dateFilter, onViewModeChange }, ref) => {
  // Convert dateFilter to timePeriod for existing calculation functions
  const timePeriod = mapDateFilterToTimePeriod(dateFilter);
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrackedAccount | null>(null);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<{url: string; title: string; platform: 'instagram' | 'tiktok' | 'youtube' } | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState<string | null>(null);
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPlatform, setNewAccountPlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('instagram');
  const [newAccountType, setNewAccountType] = useState<'my' | 'competitor'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<'my' | 'competitor'>('my');
  const [loading, setLoading] = useState(true);

  // Handle back to table navigation
  const handleBackToTable = useCallback(() => {
    setSelectedAccount(null);
    setAccountVideos([]);
    setViewMode('table');
    onViewModeChange('table');
  }, [onViewModeChange]);

  // Expose handleBackToTable to parent component
  useImperativeHandle(ref, () => ({
    handleBackToTable
  }), [handleBackToTable]);

  // Load accounts on mount and restore selected account
  useEffect(() => {
    const loadAccounts = async () => {
      if (!currentOrgId || !currentProjectId) {
        setLoading(false);
        return;
      }

      try {
        console.log('📥 Loading accounts from Firestore...');
        const loadedAccounts = await AccountTrackingServiceFirebase.getTrackedAccounts(currentOrgId, currentProjectId);
        setAccounts(loadedAccounts);

        // Restore selected account from localStorage
        const savedSelectedAccountId = localStorage.getItem('selectedAccountId');
        if (savedSelectedAccountId && loadedAccounts.length > 0) {
          const savedAccount = loadedAccounts.find(a => a.id === savedSelectedAccountId);
          if (savedAccount) {
            console.log('🔄 Restoring selected account:', savedAccount.username);
            setSelectedAccount(savedAccount);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, [currentOrgId, currentProjectId]);

  // Load videos when account is selected
  useEffect(() => {
    const loadVideos = async () => {
      if (selectedAccount && currentOrgId && currentProjectId) {
        console.log('📱 Loading videos for account:', selectedAccount.username);
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, selectedAccount.id);
        console.log('📹 Loaded videos from Firestore:', videos.length);
        setAccountVideos(videos);
        setViewMode('details');
        onViewModeChange('details');
        
        // Save selected account ID to localStorage for persistence
        localStorage.setItem('selectedAccountId', selectedAccount.id);
      } else {
        setViewMode('table');
        onViewModeChange('table');
        setAccountVideos([]);
        
        // Clear selected account ID from localStorage
        localStorage.removeItem('selectedAccountId');
      }
    };

    loadVideos();
  }, [selectedAccount, currentOrgId, currentProjectId, onViewModeChange]);

  const handleSyncAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setIsSyncing(accountId);
    setSyncError(null);
    try {
      console.log(`🔄 Starting sync for account ${accountId}...`);
      const videoCount = await AccountTrackingServiceFirebase.syncAccountVideos(currentOrgId, currentProjectId, user.uid, accountId);
      
      // Update accounts list
      const updatedAccounts = await AccountTrackingServiceFirebase.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      // Update videos if this account is selected
      if (selectedAccount?.id === accountId) {
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, accountId);
        console.log('🔄 Updating displayed videos after sync:', videos.length);
        setAccountVideos(videos);
      }
      
      console.log(`✅ Successfully synced ${videoCount} videos to Firestore`);
      
      // Show success message briefly
      if (videoCount === 0) {
        setSyncError('No videos found. This might be a private account or the username may be incorrect.');
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSyncError(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(null);
    }
  }, [selectedAccount, currentOrgId, user]);

  const handleAddAccount = useCallback(async () => {
    if (!newAccountUsername.trim() || !currentOrgId || !currentProjectId || !user) return;

    try {
      const accountId = await AccountTrackingServiceFirebase.addAccount(
        currentOrgId,
        currentProjectId,
        user.uid,
        newAccountUsername.trim(),
        newAccountPlatform,
        newAccountType
      );
      
      // Reload accounts
      const updatedAccounts = await AccountTrackingServiceFirebase.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      setNewAccountUsername('');
      setNewAccountType('my');
      setIsAddModalOpen(false);
      
      console.log(`✅ Added ${newAccountType} account @${newAccountUsername}`);
      
      // Automatically sync videos for the newly added account
      console.log(`🔄 Auto-syncing videos...`);
      handleSyncAccount(accountId);
    } catch (error) {
      console.error('Failed to add account:', error);
      alert('Failed to add account. Please check the username and try again.');
    }
  }, [newAccountUsername, newAccountPlatform, newAccountType, currentOrgId, user, handleSyncAccount]);

  const handleRemoveAccount = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !window.confirm('Are you sure you want to remove this account?')) return;

    try {
      await AccountTrackingServiceFirebase.removeAccount(currentOrgId, currentProjectId, accountId);
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(null);
        setAccountVideos([]);
      }
    } catch (error) {
      console.error('Failed to remove account:', error);
      alert('Failed to remove account. Please try again.');
    }
  }, [selectedAccount, currentOrgId]);

  const handleRefreshProfile = useCallback(async (accountId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setIsRefreshingProfile(accountId);
    try {
      await AccountTrackingServiceFirebase.refreshAccountProfile(currentOrgId, currentProjectId, user.uid, accountId);
      
      // Update accounts list
      const updatedAccounts = await AccountTrackingServiceFirebase.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(updatedAccounts);
      
      // Update selected account if it's the one being refreshed
      if (selectedAccount?.id === accountId) {
        const updatedAccount = updatedAccounts.find(a => a.id === accountId);
        if (updatedAccount) {
          setSelectedAccount(updatedAccount);
        }
        // Also refresh videos from Firestore
        const videos = await AccountTrackingServiceFirebase.getAccountVideos(currentOrgId, currentProjectId, accountId);
        console.log('🔄 Refreshed videos after profile update:', videos.length);
        setAccountVideos(videos);
      }
      
      console.log(`✅ Refreshed profile for account`);
    } catch (error) {
      console.error('Profile refresh failed:', error);
      alert('Profile refresh failed. Please try again.');
    } finally {
      setIsRefreshingProfile(null);
    }
  }, [selectedAccount, currentOrgId, user]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  // Show loading state
  if (loading) {
    return <PageLoadingSkeleton type="accounts" />;
  }

  // Show auth required state
  if (!user || !currentOrgId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <p className="text-gray-600 dark:text-gray-400">Please sign in to manage accounts</p>
        </div>
      </div>
    );
  }

  // Generate chart data based on time period and historical tracking
  const generateChartData = (videos: AccountVideo[], period: 'all' | 'weekly' | 'monthly' | 'daily') => {
    if (videos.length === 0) {
      // Return sample data points for empty state
      const now = new Date();
      const points = period === 'daily' ? 7 : period === 'weekly' ? 4 : 12;
      const interval = period === 'daily' ? 24 * 60 * 60 * 1000 : 
                     period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 
                     30 * 24 * 60 * 60 * 1000;
      
      return Array.from({ length: points }, (_, i) => ({
        date: new Date(now.getTime() - (points - 1 - i) * interval).toLocaleDateString('en-US', { 
          month: 'short', 
          day: period === 'monthly' ? undefined : 'numeric',
          year: period === 'monthly' ? 'numeric' : undefined
        }),
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0
      }));
    }

    // Get time range based on period
    const now = new Date();
    let startDate: Date;
    let interval: number;
    let points: number;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 24 * 60 * 60 * 1000;
        points = 7;
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
        interval = 7 * 24 * 60 * 60 * 1000;
        points = 4;
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
        interval = 30 * 24 * 60 * 60 * 1000;
        points = 12;
        break;
      default: // 'all'
        if (videos.length === 0) {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          interval = 7 * 24 * 60 * 60 * 1000;
          points = 5;
        } else {
          // Filter out videos without uploadDate and find oldest
          const videosWithDates = videos.filter(v => v.uploadDate || v.timestamp);
          if (videosWithDates.length === 0) {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            interval = 7 * 24 * 60 * 60 * 1000;
            points = 5;
          } else {
            const oldestVideo = videosWithDates.reduce((oldest, video) => {
              const oldestDate = oldest.uploadDate || (oldest.timestamp ? new Date(oldest.timestamp) : new Date());
              const videoDate = video.uploadDate || (video.timestamp ? new Date(video.timestamp) : new Date());
              return videoDate < oldestDate ? video : oldest;
            });
            startDate = oldestVideo.uploadDate || (oldestVideo.timestamp ? new Date(oldestVideo.timestamp) : new Date());
            const totalTime = now.getTime() - startDate.getTime();
            points = Math.min(10, Math.max(5, Math.ceil(totalTime / (7 * 24 * 60 * 60 * 1000))));
            interval = totalTime / (points - 1);
          }
        }
    }

    // Create time buckets
    const buckets = Array.from({ length: points }, (_, i) => {
      const bucketDate = new Date(startDate.getTime() + i * interval);
      return {
        date: bucketDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: period === 'monthly' ? undefined : 'numeric',
          year: period === 'monthly' ? 'numeric' : undefined
        }),
        timestamp: bucketDate.getTime(),
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0
      };
    });

    // Fill buckets with video data
    // For each video, add its metrics to all buckets after its upload date
    videos.forEach(video => {
      // Get video date (uploadDate or timestamp)
      const videoDate = video.uploadDate || (video.timestamp ? new Date(video.timestamp) : null);
      if (!videoDate) return; // Skip videos without dates
      
      const videoTime = videoDate.getTime();
      buckets.forEach(bucket => {
        if (bucket.timestamp >= videoTime) {
          bucket.views += video.viewsCount || video.views || 0;
          bucket.likes += video.likesCount || video.likes || 0;
          bucket.comments += video.commentsCount || video.comments || 0;
          bucket.shares += video.sharesCount || video.shares || 0;
        }
      });
    });

    return buckets.map(({ timestamp, ...bucket }) => bucket);
  };

  // Calculate percentage change from previous period
  const calculatePercentageChange = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? '↗ +∞%' : '0.0%';
    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? '↗' : change < 0 ? '↘' : '';
    return `${sign} ${Math.abs(change).toFixed(1)}%`;
  };

  // Get period label for percentage display
  const getPeriodLabel = (period: 'all' | 'weekly' | 'monthly' | 'daily'): string => {
    switch (period) {
      case 'daily': return 'from yesterday';
      case 'weekly': return 'from last week';
      case 'monthly': return 'from last month';
      default: return 'from last period';
    }
  };

  // Calculate metrics for current and previous periods
  const getMetricsComparison = (videos: AccountVideo[], period: 'all' | 'weekly' | 'monthly' | 'daily') => {
    if (videos.length === 0) {
      return {
        current: { views: 0, likes: 0, comments: 0 },
        previous: { views: 0, likes: 0, comments: 0 },
        periodLabel: getPeriodLabel(period)
      };
    }

    const now = new Date();
    let currentStart: Date, previousStart: Date, previousEnd: Date;

    switch (period) {
      case 'daily':
        currentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      case 'weekly':
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      case 'monthly':
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      default: // 'all'
        // For "all time", compare current total vs total from 30 days ago
        currentStart = new Date(0); // Beginning of time
        previousStart = new Date(0);
        previousEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const currentVideos = videos.filter(v => {
      const videoDate = v.uploadDate || (v.timestamp ? new Date(v.timestamp) : null);
      return videoDate && videoDate >= currentStart;
    });
    const previousVideos = videos.filter(v => {
      const videoDate = v.uploadDate || (v.timestamp ? new Date(v.timestamp) : null);
      return videoDate && videoDate >= previousStart && videoDate < previousEnd;
    });

    const current = {
      views: currentVideos.reduce((sum, v) => sum + (v.viewsCount || v.views || 0), 0),
      likes: currentVideos.reduce((sum, v) => sum + (v.likesCount || v.likes || 0), 0),
      comments: currentVideos.reduce((sum, v) => sum + (v.commentsCount || v.comments || 0), 0)
    };

    const previous = {
      views: previousVideos.reduce((sum, v) => sum + (v.viewsCount || v.views || 0), 0),
      likes: previousVideos.reduce((sum, v) => sum + (v.likesCount || v.likes || 0), 0),
      comments: previousVideos.reduce((sum, v) => sum + (v.commentsCount || v.comments || 0), 0)
    };

    return {
      current,
      previous,
      periodLabel: getPeriodLabel(period)
    };
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{syncError}</p>
          <button 
            onClick={() => setSyncError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Controls Bar - Only show in table mode */}
      {viewMode === 'table' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Account Type Toggle */}
            <div className="flex items-center bg-zinc-900/60 backdrop-blur border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setAccountType('my')}
                className={clsx(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  accountType === 'my'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                My Accounts
              </button>
              <button
                onClick={() => setAccountType('competitor')}
                className={clsx(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  accountType === 'competitor'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                Competitors
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
              />
            </div>
            <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Filter className="w-4 h-4" />
              <span className="text-sm">Select projects</span>
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'table' ? (
        <div className="space-y-6">
          {/* Add Account Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Track Account</span>
            </button>
          </div>
          
          {/* Accounts Table */}
          <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
          {accounts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white dark:text-white mb-2">No accounts tracked yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Start tracking Instagram or TikTok accounts to monitor their content performance
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Track Account</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last post
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Followers
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posts
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Likes
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comments
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900/60 divide-y divide-gray-200 dark:divide-white/5">
                  {accounts
                    .filter(account => 
                      searchQuery === '' || 
                      account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((account) => (
                      <tr 
                        key={account.id}
                        className={clsx(
                          'hover:bg-white/5 dark:hover:bg-white/5 transition-colors cursor-pointer',
                          {
                            'bg-blue-900/20 dark:bg-blue-900/20': selectedAccount?.id === account.id,
                          }
                        )}
                        onClick={() => setSelectedAccount(account)}
                      >
                        {/* Username Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              {account.profilePicture ? (
                                <img
                                  src={account.profilePicture}
                                  alt={`@${account.username}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center ${account.profilePicture ? 'hidden' : ''}`}>
                                <Users className="w-5 h-5 text-gray-500" />
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {account.displayName || account.username}
                              </div>
                              <div className="text-sm text-gray-500">@{account.username}</div>
                            </div>
                          </div>
                        </td>

                        {/* Platform Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <PlatformIcon platform={account.platform} size="sm" />
                            <span className="text-sm text-gray-900 dark:text-white capitalize">{account.platform}</span>
                          </div>
                        </td>

                        {/* Last Post Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.lastSynced ? formatDate(account.lastSynced) : 'Never'}
                        </td>

                        {/* Followers Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {account.followerCount ? formatNumber(account.followerCount) : 'N/A'}
                        </td>

                        {/* Posts Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber(account.totalVideos)}
                        </td>

                        {/* Views Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white dark:text-white">
                          {formatNumber(account.totalViews)}
                        </td>

                        {/* Likes Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber(account.totalLikes)}
                        </td>

                        {/* Comments Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatNumber(account.totalComments)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefreshProfile(account.id);
                              }}
                              disabled={isRefreshingProfile === account.id}
                              className="text-gray-400 hover:text-green-600 transition-colors disabled:animate-spin"
                              title="Refresh profile"
                            >
                              <User className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSyncAccount(account.id);
                              }}
                              disabled={isSyncing === account.id}
                              className="text-gray-400 hover:text-blue-600 transition-colors disabled:animate-spin"
                              title="Sync videos"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAccount(account.id);
                              }}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Remove account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button className="text-gray-400 hover:text-gray-600 transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      ) : (
        /* Account Details View */
        selectedAccount && (
          <div className="space-y-6">
            {/* Account Profile Card */}
            <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-8">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {selectedAccount.profilePicture ? (
                    <img
                      src={selectedAccount.profilePicture}
                      alt={`@${selectedAccount.username}`}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-gray-100"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border-4 border-gray-100">
                      <Users className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2">
                    <PlatformIcon platform={selectedAccount.platform} size="lg" />
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedAccount.displayName || `@${selectedAccount.username}`}
                  </h2>
                  <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500 dark:text-gray-500">@{selectedAccount.username}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Joined {formatDate(selectedAccount.dateAdded)}</span>
                    </div>
                    {selectedAccount.followerCount && (
                      <div>
                        <span className="font-semibold">{formatNumber(selectedAccount.followerCount)}</span> followers
                      </div>
                    )}
                  </div>
                </div>
              </div>

             </div>

            {/* KPI Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(() => {
                // Calculate engagement rate
                const totalEngagement = selectedAccount.totalLikes + selectedAccount.totalComments;
                const engagementRate = selectedAccount.totalViews > 0 
                  ? (totalEngagement / selectedAccount.totalViews) * 100 
                  : 0;

                const kpiCards = [
                  {
                    id: 'views',
                    label: 'Views',
                    value: formatNumber(selectedAccount.totalViews),
                    icon: Eye,
                    accent: 'emerald',
                    period: 'Last 7 days',
                    subtext: '0.0%'
                  },
                  {
                    id: 'likes',
                    label: 'Likes',
                    value: formatNumber(selectedAccount.totalLikes),
                    icon: Heart,
                    accent: 'pink',
                    period: `${((selectedAccount.totalLikes / (selectedAccount.totalViews || 1)) * 100).toFixed(1)}% of views`
                  },
                  {
                    id: 'comments',
                    label: 'Comments',
                    value: formatNumber(selectedAccount.totalComments),
                    icon: MessageCircle,
                    accent: 'blue',
                    period: 'Total engagement'
                  },
                  {
                    id: 'shares',
                    label: 'Shares',
                    value: formatNumber(selectedAccount.totalShares || 0),
                    icon: Share2,
                    accent: 'orange',
                    period: 'Total shares'
                  },
                  {
                    id: 'videos',
                    label: 'Published Videos',
                    value: selectedAccount.totalVideos,
                    icon: Video,
                    accent: 'violet',
                    period: 'All time'
                  },
                  {
                    id: 'followers',
                    label: 'Active Accounts',
                    value: '1',
                    icon: Users,
                    accent: 'teal',
                    period: 'Total tracked'
                  },
                  {
                    id: 'engagement',
                    label: 'Engagement Rate',
                    value: `${engagementRate.toFixed(1)}%`,
                    icon: Activity,
                    accent: 'slate',
                    period: 'Last 28 days'
                  },
                  {
                    id: 'clicks',
                    label: 'Link Clicks',
                    value: '0',
                    icon: ExternalLink,
                    accent: 'blue',
                    period: 'No clicks yet'
                  }
                ];

                const accentColors = {
                  emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  pink: 'bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400',
                  blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
                  orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
                  teal: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400',
                  slate: 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400'
                };

                return (
                  <>
                    {kpiCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.id} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                          <div className="flex items-center justify-between mb-4">
                            <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', accentColors[card.accent])}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{card.label}</p>
                            <div className="flex items-end justify-between">
                              <div>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{card.value}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{card.period}</p>
                              </div>
                              {card.subtext && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">{card.subtext}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* Analytics Charts Section */}
            <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-8">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reporting Overview</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Track and analyze your video performance</p>
              </div>

              {(() => {
                const chartData = generateChartData(accountVideos, timePeriod);
                const metricsComparison = getMetricsComparison(accountVideos, timePeriod);
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Views Chart */}
                    <div className="bg-zinc-900/60 dark:bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-blue-500/10 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <Eye className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">TOTAL VIEWS</p>
                          </div>
                        </div>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                          {formatNumber(selectedAccount.totalViews)}
                        </div>
                        <div className={clsx(
                          'flex items-center text-sm',
                          selectedAccount.totalViews >= metricsComparison.previous.views 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        )}>
                          <span>
                            {calculatePercentageChange(
                              selectedAccount.totalViews, 
                              metricsComparison.previous.views
                            )} {metricsComparison.periodLabel}
                          </span>
                        </div>
                      </div>

                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Area
                              type="monotone"
                              dataKey="views"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              fill="url(#viewsGradient)"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Total Likes Chart */}
                    <div className="bg-zinc-900/60 dark:bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-green-500/10 dark:bg-green-500/10 rounded-xl flex items-center justify-center">
                            <Heart className="w-6 h-6 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">TOTAL LIKES</p>
                          </div>
                        </div>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                          {formatNumber(selectedAccount.totalLikes)}
                        </div>
                        <div className={clsx(
                          'flex items-center text-sm',
                          selectedAccount.totalLikes >= metricsComparison.previous.likes 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        )}>
                          <span>
                            {calculatePercentageChange(
                              selectedAccount.totalLikes, 
                              metricsComparison.previous.likes
                            )} {metricsComparison.periodLabel}
                          </span>
                        </div>
                      </div>

                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Area
                              type="monotone"
                              dataKey="likes"
                              stroke="#10B981"
                              strokeWidth={2}
                              fill="url(#likesGradient)"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Total Comments Chart */}
                    <div className="bg-zinc-900/60 dark:bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-purple-500/10 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">TOTAL COMMENTS</p>
                          </div>
                        </div>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                          {formatNumber(selectedAccount.totalComments)}
                        </div>
                        <div className={clsx(
                          'flex items-center text-sm',
                          selectedAccount.totalComments >= metricsComparison.previous.comments 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        )}>
                          <span>
                            {calculatePercentageChange(
                              selectedAccount.totalComments, 
                              metricsComparison.previous.comments
                            )} {metricsComparison.periodLabel}
                          </span>
                        </div>
                      </div>

                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm">
                                      <p className="font-semibold">Comments: {payload[0].value?.toLocaleString()}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                              cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '3 3' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="comments"
                              stroke="#8B5CF6"
                              strokeWidth={2}
                              fill="url(#commentsGradient)"
                              dot={false}
                              activeDot={{ r: 4, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Total Shares Chart */}
                    <div className="bg-zinc-900/60 dark:bg-zinc-900/60 border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-500/10 rounded-xl flex items-center justify-center">
                            <Share2 className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">TOTAL SHARES</p>
                          </div>
                        </div>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                          {formatNumber(selectedAccount.totalShares || 0)}
                        </div>
                        <div className="text-sm text-gray-500">
                          <span>Total shares</span>
                        </div>
                      </div>

                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="sharesGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#F97316" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Area
                              type="monotone"
                              dataKey="shares"
                              stroke="#F97316"
                              strokeWidth={2}
                              fill="url(#sharesGradient)"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Videos Table */}
            <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
              <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Recent Videos</h2>
                  <p className="text-sm text-gray-400">{accountVideos.length} videos</p>
                </div>
              </div>
              
              {accountVideos.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900/60 backdrop-blur z-10 min-w-[280px]">
                          Video
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[100px]">
                          Preview
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">
                          Trend
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                          Views
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                          Likes
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                          Comments
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                          Shares
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[140px]">
                          Engagement
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider min-w-[120px]">
                          Upload Date
                        </th>
                        <th className="w-12 px-6 py-4 text-left"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-zinc-900/60 divide-y divide-white/5">
                      {accountVideos.map((video) => {
                        const views = video.viewsCount || video.views || 0;
                        const likes = video.likesCount || video.likes || 0;
                        const comments = video.commentsCount || video.comments || 0;
                        const shares = video.sharesCount || video.shares || 0;
                        const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
                        
                        // Convert AccountVideo to VideoSubmission for TrendCalculationService
                        const videoSubmission: VideoSubmission = {
                          id: video.id || video.videoId || '',
                          url: video.url || '',
                          platform: selectedAccount.platform,
                          thumbnail: video.thumbnail || '',
                          title: video.caption || 'No caption',
                          uploader: selectedAccount.displayName || selectedAccount.username,
                          uploaderHandle: selectedAccount.username,
                          status: 'approved' as const,
                          views: views,
                          likes: likes,
                          comments: comments,
                          shares: shares,
                          dateSubmitted: new Date(),
                          uploadDate: video.uploadDate || new Date(),
                          snapshots: []
                        };

                        return (
                          <tr 
                            key={video.id}
                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-5 sticky left-0 bg-zinc-900/60 backdrop-blur z-10 group-hover:bg-white/5">
                              <div className="flex items-center space-x-4">
                                <div className="relative">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2 ring-white shadow-sm">
                                    {video.thumbnail ? (
                                      <img 
                                        src={video.thumbnail} 
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                        <Play className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute -bottom-1 -right-1">
                                    <PlatformIcon platform={selectedAccount.platform} size="sm" />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1 max-w-[200px]">
                                  <p className="text-sm font-medium text-white truncate" title={video.caption || 'No caption'}>
                                    {video.caption || 'No caption'}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1 truncate">
                                    @{selectedAccount.username}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedVideoForPlayer({
                                    url: video.url || '',
                                    title: video.caption || 'No caption',
                                    platform: selectedAccount.platform
                                  });
                                  setVideoPlayerOpen(true);
                                }}
                                className="block hover:opacity-80 transition-opacity group/video cursor-pointer"
                              >
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all relative">
                                  {video.thumbnail ? (
                                    <img 
                                      src={video.thumbnail} 
                                      alt="Thumbnail"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-700">
                                      <Play className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/0 group-hover/video:bg-black/40 transition-colors flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white opacity-0 group-hover/video:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                    </svg>
                                  </div>
                                </div>
                              </button>
                            </td>
                            <td className="px-6 py-5">
                              <MiniTrendChart 
                                data={TrendCalculationService.getViewsTrend(videoSubmission)}
                                className="flex items-center justify-center"
                              />
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Eye className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(views)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Heart className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(likes)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <MessageCircle className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(comments)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Share2 className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(shares)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center space-x-2">
                                <Activity className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-medium text-white">
                                  {engagementRate.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="text-sm text-zinc-300">
                                {video.uploadDate ? 
                                  new Date(video.uploadDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : 
                                  (video.timestamp ? 
                                    new Date(video.timestamp).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : 
                                    'Unknown'
                                  )
                                }
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(video.url, '_blank');
                                }}
                                className="text-gray-400 hover:text-blue-400 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-white mb-2">No videos synced</h4>
                  <p className="text-gray-400 mb-6">
                    Click "Sync Videos" to fetch all videos from this account
                  </p>
                  <button
                    onClick={() => handleSyncAccount(selectedAccount.id)}
                    disabled={isSyncing === selectedAccount.id}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                    <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}


      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Add Account to Track</h2>
              <p className="text-gray-500 dark:text-gray-400">Start monitoring a new Instagram, TikTok, or YouTube account</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Choose Platform
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setNewAccountPlatform('instagram')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'instagram'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <PlatformIcon platform="instagram" size="md" />
                    <span className="font-medium text-xs">Instagram</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('tiktok')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'tiktok'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <PlatformIcon platform="tiktok" size="md" />
                    <span className="font-medium text-xs">TikTok</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('youtube')}
                    className={clsx(
                      'flex flex-col items-center justify-center space-y-2 py-4 px-3 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'youtube'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <Play className="w-6 h-6" />
                    <span className="font-medium text-xs">YouTube</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewAccountType('my')}
                    className={clsx(
                      'flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border-2 transition-all duration-200',
                      newAccountType === 'my'
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <User className="w-4 h-4" />
                    <span className="font-medium">My Account</span>
                  </button>
                  <button
                    onClick={() => setNewAccountType('competitor')}
                    className={clsx(
                      'flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border-2 transition-all duration-200',
                      newAccountType === 'competitor'
                        ? 'border-purple-500 bg-purple-600 text-white shadow-md'
                        : 'border-gray-700 dark:border-gray-700 hover:border-gray-600 dark:hover:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-800 text-gray-300'
                    )}
                  >
                    <Users className="w-4 h-4" />
                    <span className="font-medium">Competitor</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">@</span>
                <input
                  type="text"
                  value={newAccountUsername}
                  onChange={(e) => setNewAccountUsername(e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Enter the username without the @ symbol
                </p>
              </div>
            </div>

            <div className="flex space-x-4 mt-8">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!newAccountUsername.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideoForPlayer && (
        <VideoPlayerModal
          isOpen={videoPlayerOpen}
          onClose={() => {
            setVideoPlayerOpen(false);
            setSelectedVideoForPlayer(null);
          }}
          videoUrl={selectedVideoForPlayer.url}
          title={selectedVideoForPlayer.title}
          platform={selectedVideoForPlayer.platform}
        />
      )}
    </div>
  );
});

AccountsPage.displayName = 'AccountsPage';

export default AccountsPage;
