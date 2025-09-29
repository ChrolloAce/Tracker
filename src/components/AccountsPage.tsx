import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Users, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  RefreshCw,
  Trash2,
  Play,
  ExternalLink,
  User
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
    try {
      const videos = await AccountTrackingService.syncAccountVideos(accountId);
      
      // Update accounts list
      const updatedAccounts = AccountTrackingService.getTrackedAccounts();
      setAccounts(updatedAccounts);
      
      // Update videos if this account is selected
      if (selectedAccount?.id === accountId) {
        setAccountVideos(videos);
      }
      
      console.log(`✅ Synced ${videos.length} videos`);
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Tracking</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track entire Instagram and TikTok accounts and monitor all their content
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Tracked Accounts</h2>
              <p className="text-sm text-gray-500">{accounts.length} accounts</p>
            </div>
            
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className={clsx(
                    'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                    {
                      'bg-blue-50 border-r-2 border-blue-600': selectedAccount?.id === account.id,
                    }
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {account.profilePicture ? (
                        <img
                          src={account.profilePicture}
                          alt={`@${account.username}`}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          onError={(e) => {
                            // Fallback to default avatar if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                          onLoad={(e) => {
                            // Hide fallback when image loads successfully
                            const target = e.target as HTMLImageElement;
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.add('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center ${account.profilePicture ? 'hidden' : ''}`}>
                        <Users className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="absolute -bottom-1 -right-1">
                        <PlatformIcon platform={account.platform} size="sm" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {account.displayName || `@${account.username}`}
                        </p>
                        {!account.isActive && (
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">@{account.username}</p>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span>{formatNumber(account.totalVideos)} videos</span>
                        <span>{formatNumber(account.totalViews)} views</span>
                      </div>
                      {account.lastSynced && (
                        <p className="text-xs text-gray-400">
                          Synced {formatDate(account.lastSynced)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshProfile(account.id);
                        }}
                        disabled={isRefreshingProfile === account.id}
                        className="p-1 text-gray-400 hover:text-green-600 disabled:animate-spin"
                        title="Refresh profile picture and info"
                      >
                        <User className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncAccount(account.id);
                        }}
                        disabled={isSyncing === account.id}
                        className="p-1 text-gray-400 hover:text-blue-600 disabled:animate-spin"
                        title="Sync videos"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveAccount(account.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Remove account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {accounts.length === 0 && (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-medium text-gray-900 mb-2">No accounts tracked</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Add Instagram or TikTok accounts to start tracking their content
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Add your first account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account Details & Videos */}
        <div className="lg:col-span-2">
          {selectedAccount ? (
            <div className="space-y-6">
              {/* Account Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      {selectedAccount.profilePicture ? (
                        <img
                          src={selectedAccount.profilePicture}
                          alt={`@${selectedAccount.username}`}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => {
                            // Fallback to default avatar if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                          onLoad={(e) => {
                            // Hide fallback when image loads successfully
                            const target = e.target as HTMLImageElement;
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.classList.add('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center ${selectedAccount.profilePicture ? 'hidden' : ''}`}>
                        <Users className="w-8 h-8 text-gray-500" />
                      </div>
                      <div className="absolute -bottom-1 -right-1">
                        <PlatformIcon platform={selectedAccount.platform} size="md" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">@{selectedAccount.username}</h2>
                      <p className="text-sm text-gray-500 capitalize">{selectedAccount.platform} Account</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className={clsx(
                          'w-2 h-2 rounded-full',
                          selectedAccount.isActive ? 'bg-green-400' : 'bg-red-400'
                        )}></div>
                        <span className="text-xs text-gray-500">
                          {selectedAccount.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleRefreshProfile(selectedAccount.id)}
                      disabled={isRefreshingProfile === selectedAccount.id}
                      className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <User className={clsx('w-4 h-4', { 'animate-spin': isRefreshingProfile === selectedAccount.id })} />
                      <span>{isRefreshingProfile === selectedAccount.id ? 'Refreshing...' : 'Refresh Profile'}</span>
                    </button>
                    <button
                      onClick={() => handleSyncAccount(selectedAccount.id)}
                      disabled={isSyncing === selectedAccount.id}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                      <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(selectedAccount.totalVideos)}</div>
                    <div className="text-sm text-gray-500">Videos</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{formatNumber(selectedAccount.totalViews)}</div>
                    <div className="text-sm text-gray-500">Total Views</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{formatNumber(selectedAccount.totalLikes)}</div>
                    <div className="text-sm text-gray-500">Total Likes</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{formatNumber(selectedAccount.totalComments)}</div>
                    <div className="text-sm text-gray-500">Total Comments</div>
                  </div>
                </div>
              </div>

              {/* Videos List */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Videos</h3>
                  <p className="text-sm text-gray-500">{accountVideos.length} videos tracked</p>
                </div>
                
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {accountVideos.length > 0 ? (
                    accountVideos.map((video) => (
                      <div key={video.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                            {video.thumbnail ? (
                              <img src={video.thumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {video.caption || 'No caption'}
                            </p>
                            <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
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
                              {video.shares && (
                                <div className="flex items-center space-x-1">
                                  <Share2 className="w-3 h-3" />
                                  <span>{formatNumber(video.shares)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(video.uploadDate)}
                            </p>
                          </div>
                          <button
                            onClick={() => window.open(video.url, '_blank')}
                            className="p-2 text-gray-400 hover:text-blue-600"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Play className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-sm font-medium text-gray-900 mb-2">No videos synced</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Click "Sync Videos" to fetch all videos from this account
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Account</h3>
              <p className="text-gray-500">
                Choose an account from the list to view its details and videos
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Account to Track</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setNewAccountPlatform('instagram')}
                    className={clsx(
                      'flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg border transition-colors',
                      newAccountPlatform === 'instagram'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <PlatformIcon platform="instagram" size="sm" />
                    <span>Instagram</span>
                  </button>
                  <button
                    onClick={() => setNewAccountPlatform('tiktok')}
                    className={clsx(
                      'flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg border transition-colors',
                      newAccountPlatform === 'tiktok'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <PlatformIcon platform="tiktok" size="sm" />
                    <span>TikTok</span>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={newAccountUsername}
                  onChange={(e) => setNewAccountUsername(e.target.value)}
                  placeholder={newAccountPlatform === 'instagram' ? 'username' : 'username'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the username without @ symbol
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!newAccountUsername.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
