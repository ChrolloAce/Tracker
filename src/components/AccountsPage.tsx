import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Users, 
  Eye, 
  Heart, 
  MessageCircle, 
  RefreshCw,
  Trash2,
  Play,
  ExternalLink,
  User,
  Clock,
  Filter,
  Grid,
  List,
  Search,
  MoreHorizontal,
  AlertCircle
} from 'lucide-react';
import { TrackedAccount, AccountVideo } from '../types/accounts';
import { AccountTrackingService } from '../services/AccountTrackingService';
import { PlatformIcon } from './ui/PlatformIcon';
import { clsx } from 'clsx';

const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrackedAccount | null>(null);
  const [accountVideos, setAccountVideos] = useState<AccountVideo[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState<string | null>(null);
  const [newAccountUsername, setNewAccountUsername] = useState('');
  const [newAccountPlatform, setNewAccountPlatform] = useState<'instagram' | 'tiktok'>('instagram');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load accounts on mount
  useEffect(() => {
    const loadedAccounts = AccountTrackingService.getTrackedAccounts();
    setAccounts(loadedAccounts);
  }, []);

  // Load videos when account is selected
  useEffect(() => {
    if (selectedAccount) {
      const videos = AccountTrackingService.getAccountVideos(selectedAccount.id);
      setAccountVideos(videos);
    }
  }, [selectedAccount]);

  const handleAddAccount = useCallback(async () => {
    if (!newAccountUsername.trim()) return;

    try {
      const account = await AccountTrackingService.addAccount(
        newAccountUsername.trim(),
        newAccountPlatform
      );
      
      setAccounts(prev => [...prev, account]);
      setNewAccountUsername('');
      setIsAddModalOpen(false);
      
      console.log(`✅ Added account @${account.username}`);
    } catch (error) {
      console.error('Failed to add account:', error);
      alert('Failed to add account. Please check the username and try again.');
    }
  }, [newAccountUsername, newAccountPlatform]);

  const handleSyncAccount = useCallback(async (accountId: string) => {
    setIsSyncing(accountId);
    setSyncError(null);
    try {
      console.log(`🔄 Starting sync for account ${accountId}...`);
      const videos = await AccountTrackingService.syncAccountVideos(accountId);
      
      // Update accounts list
      const updatedAccounts = AccountTrackingService.getTrackedAccounts();
      setAccounts(updatedAccounts);
      
      // Update videos if this account is selected
      if (selectedAccount?.id === accountId) {
        setAccountVideos(videos);
      }
      
      console.log(`✅ Successfully synced ${videos.length} videos`);
      
      // Show success message briefly
      if (videos.length === 0) {
        setSyncError('No videos found. This might be a private account or the username may be incorrect.');
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSyncError(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(null);
    }
  }, [selectedAccount]);

  const handleRemoveAccount = useCallback((accountId: string) => {
    if (window.confirm('Are you sure you want to remove this account?')) {
      AccountTrackingService.removeAccount(accountId);
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      
      if (selectedAccount?.id === accountId) {
        setSelectedAccount(null);
        setAccountVideos([]);
      }
    }
  }, [selectedAccount]);

  const handleRefreshProfile = useCallback(async (accountId: string) => {
    setIsRefreshingProfile(accountId);
    try {
      const updatedAccount = await AccountTrackingService.refreshAccountProfile(accountId);
      
      if (updatedAccount) {
        // Update accounts list
        setAccounts(prev => prev.map(a => a.id === accountId ? updatedAccount : a));
        
        // Update selected account if it's the one being refreshed
        if (selectedAccount?.id === accountId) {
          setSelectedAccount(updatedAccount);
        }
      }
      
      console.log(`✅ Refreshed profile for account`);
    } catch (error) {
      console.error('Profile refresh failed:', error);
      alert('Profile refresh failed. Please try again.');
    } finally {
      setIsRefreshingProfile(null);
    }
  }, [selectedAccount]);

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold mb-2">Account Tracking</h1>
            <p className="text-blue-100 text-lg">
              Monitor Instagram and TikTok accounts • Track performance • Analyze content
            </p>
            <div className="flex items-center space-x-6 mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>{accounts.length} Accounts Tracked</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>{accounts.reduce((sum, acc) => sum + acc.totalVideos, 0)} Videos</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>{formatNumber(accounts.reduce((sum, acc) => sum + acc.totalViews, 0))} Total Views</span>
              </div>
            </div>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-3 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all duration-200 border border-white/20"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Account</span>
          </button>
        </div>
      </div>

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

      {/* Controls Bar */}
      <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              viewMode === 'grid' 
                ? 'bg-blue-100 text-blue-600' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              viewMode === 'list' 
                ? 'bg-blue-100 text-blue-600' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <List className="w-4 h-4" />
        </button>
        </div>
      </div>

      {/* Accounts Grid/List */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No accounts tracked yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Start tracking Instagram or TikTok accounts to monitor their content performance and analytics
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Your First Account</span>
          </button>
            </div>
      ) : (
        <div className={clsx(
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        )}>
          {accounts
            .filter(account => 
              searchQuery === '' || 
              account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
              account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((account) => (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className={clsx(
                  'bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 group',
                    {
                    'ring-2 ring-blue-500 shadow-lg scale-105': selectedAccount?.id === account.id,
                  },
                  viewMode === 'list' ? 'flex items-center space-x-6' : ''
                  )}
                >
                <div className={clsx('relative', viewMode === 'list' ? '' : 'mb-4')}>
                      {account.profilePicture ? (
                        <img
                          src={account.profilePicture}
                          alt={`@${account.username}`}
                      className={clsx(
                        'rounded-2xl object-cover border-2 border-gray-100 group-hover:border-gray-200',
                        viewMode === 'list' ? 'w-16 h-16' : 'w-20 h-20'
                      )}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                  <div className={clsx(
                    'bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center',
                    account.profilePicture ? 'hidden' : '',
                    viewMode === 'list' ? 'w-16 h-16' : 'w-20 h-20'
                  )}>
                    <Users className={clsx('text-gray-500', viewMode === 'list' ? 'w-8 h-8' : 'w-10 h-10')} />
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                    <PlatformIcon platform={account.platform} size="md" />
                  </div>
                  {!account.isActive && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                  )}
                </div>

                <div className={clsx('flex-1', viewMode === 'list' ? '' : 'text-center')}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {account.displayName || `@${account.username}`}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">@{account.username}</p>
                  
                  <div className={clsx(
                    'space-y-2',
                    viewMode === 'list' ? 'flex space-x-6 space-y-0' : 'grid grid-cols-2 gap-2'
                  )}>
                    <div className={clsx('text-center', viewMode === 'list' ? 'text-left' : '')}>
                      <div className="text-lg font-bold text-blue-600">{formatNumber(account.totalVideos)}</div>
                      <div className="text-xs text-gray-500">Videos</div>
                      </div>
                    <div className={clsx('text-center', viewMode === 'list' ? 'text-left' : '')}>
                      <div className="text-lg font-bold text-green-600">{formatNumber(account.totalViews)}</div>
                      <div className="text-xs text-gray-500">Views</div>
                      </div>
                    <div className={clsx('text-center', viewMode === 'list' ? 'text-left' : '')}>
                      <div className="text-lg font-bold text-red-600">{formatNumber(account.totalLikes)}</div>
                      <div className="text-xs text-gray-500">Likes</div>
                    </div>
                    <div className={clsx('text-center', viewMode === 'list' ? 'text-left' : '')}>
                      <div className="text-lg font-bold text-purple-600">{formatNumber(account.totalComments)}</div>
                      <div className="text-xs text-gray-500">Comments</div>
                      </div>
                      </div>

                      {account.lastSynced && (
                    <p className="text-xs text-gray-400 mt-3">
                      <Clock className="w-3 h-3 inline mr-1" />
                          Synced {formatDate(account.lastSynced)}
                        </p>
                      )}
                    </div>

                <div className={clsx(
                  'flex items-center space-x-2',
                  viewMode === 'list' ? '' : 'mt-4 justify-center'
                )}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshProfile(account.id);
                    }}
                    disabled={isRefreshingProfile === account.id}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:animate-spin"
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
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:animate-spin"
                    title="Sync videos"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAccount(account.id);
                        }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          }
            </div>
      )}

      {/* Selected Account Details */}
      {selectedAccount && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Account Header */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {selectedAccount.profilePicture ? (
                    <img
                      src={selectedAccount.profilePicture}
                      alt={`@${selectedAccount.username}`}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                      <Users className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2">
                    <PlatformIcon platform={selectedAccount.platform} size="lg" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {selectedAccount.displayName || `@${selectedAccount.username}`}
                  </h2>
                  <p className="text-gray-600 mb-2">@{selectedAccount.username}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={clsx(
                        'w-2 h-2 rounded-full',
                        selectedAccount.isActive ? 'bg-green-500' : 'bg-red-500'
                      )}></div>
                      <span className="text-gray-600">
                        {selectedAccount.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 capitalize">{selectedAccount.platform}</span>
                    {selectedAccount.lastSynced && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">Last synced {formatDate(selectedAccount.lastSynced)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleRefreshProfile(selectedAccount.id)}
                  disabled={isRefreshingProfile === selectedAccount.id}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <User className={clsx('w-4 h-4', { 'animate-spin': isRefreshingProfile === selectedAccount.id })} />
                  <span>{isRefreshingProfile === selectedAccount.id ? 'Refreshing...' : 'Refresh Profile'}</span>
                </button>
                <button
                  onClick={() => handleSyncAccount(selectedAccount.id)}
                  disabled={isSyncing === selectedAccount.id}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                  <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-6 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <div className="text-3xl font-bold text-blue-600 mb-1">{formatNumber(selectedAccount.totalVideos)}</div>
                <div className="text-sm font-medium text-blue-700">Videos</div>
                <div className="text-xs text-blue-600 mt-1">Total content</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                <div className="text-3xl font-bold text-green-600 mb-1">{formatNumber(selectedAccount.totalViews)}</div>
                <div className="text-sm font-medium text-green-700">Views</div>
                <div className="text-xs text-green-600 mt-1">Total reach</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                <div className="text-3xl font-bold text-red-600 mb-1">{formatNumber(selectedAccount.totalLikes)}</div>
                <div className="text-sm font-medium text-red-700">Likes</div>
                <div className="text-xs text-red-600 mt-1">Engagement</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                <div className="text-3xl font-bold text-purple-600 mb-1">{formatNumber(selectedAccount.totalComments)}</div>
                <div className="text-sm font-medium text-purple-700">Comments</div>
                <div className="text-xs text-purple-600 mt-1">Interaction</div>
              </div>
            </div>
          </div>

          {/* Videos Section */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Recent Videos</h3>
                <p className="text-gray-500">{accountVideos.length} videos tracked</p>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {accountVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accountVideos.slice(0, 9).map((video) => (
                  <div key={video.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors group cursor-pointer">
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                          {video.caption || 'No caption'}
                        </p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500 mb-1">
                          <div className="flex items-center space-x-1">
                            <Eye className="w-3 h-3" />
                            <span>{formatNumber(video.views)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Heart className="w-3 h-3" />
                            <span>{formatNumber(video.likes)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="w-3 h-3" />
                            <span>{formatNumber(video.comments)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatDate(video.uploadDate)}
                        </p>
                      </div>
                      <button
                        onClick={() => window.open(video.url, '_blank')}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No videos synced</h4>
                <p className="text-gray-500 mb-6">
                  Click "Sync Videos" to fetch all videos from this account
                  </p>
                  <button
                  onClick={() => handleSyncAccount(selectedAccount.id)}
                  disabled={isSyncing === selectedAccount.id}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                  <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                  <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
                  </button>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Account to Track</h2>
              <p className="text-gray-500">Start monitoring a new Instagram or TikTok account</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Choose Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewAccountPlatform('instagram')}
                    className={clsx(
                      'flex items-center justify-center space-x-3 py-4 px-4 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'instagram'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <PlatformIcon platform="instagram" size="md" />
                    <span className="font-medium">Instagram</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('tiktok')}
                    className={clsx(
                      'flex items-center justify-center space-x-3 py-4 px-4 rounded-xl border-2 transition-all duration-200',
                      newAccountPlatform === 'tiktok'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <PlatformIcon platform="tiktok" size="md" />
                    <span className="font-medium">TikTok</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
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
    </div>
  );
};

export default AccountsPage;
