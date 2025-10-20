import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, Payout, VideoDoc } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import PayoutsService from '../services/PayoutsService';
import { Video, DollarSign, TrendingUp, Users as UsersIcon } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { VideoSubmission } from '../types';

interface CreatorStats {
  totalAccounts: number;
  totalVideos: number;
  totalViews: number;
  totalEarnings: number;
  pendingPayouts: number;
}

/**
 * CreatorPortalPage - PROJECT SCOPED
 * Creator's view of their project data: Dashboard and Payouts
 */
const CreatorPortalPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'payouts'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CreatorStats>({
    totalAccounts: 0,
    totalVideos: 0,
    totalViews: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
  });
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Load linked accounts for this project
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        user.uid
      );

      // Load all accounts and filter to linked ones
      const allAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );

      const linkedAccountIds = links.map(link => link.accountId);
      const accounts = allAccounts.filter(acc => linkedAccountIds.includes(acc.id));

      setLinkedAccounts(accounts);

      // Load videos from linked accounts
      const allVideos = await FirestoreDataService.getVideos(
        currentOrgId,
        currentProjectId,
        { limitCount: 1000 }
      );

      // Filter videos to only those from linked accounts
      const filteredVideos = allVideos.filter((video) =>
        video.trackedAccountId && linkedAccountIds.includes(video.trackedAccountId)
      );

      setVideos(filteredVideos);

      // Load payouts for this project
      const creatorPayouts = await PayoutsService.getCreatorPayouts(
        currentOrgId,
        currentProjectId,
        user.uid
      );

      setPayouts(creatorPayouts);

      // Calculate stats
      const totalEarnings = creatorPayouts
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);

      const pendingPayouts = creatorPayouts
        .filter((p) => p.status === 'pending' || p.status === 'processing')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalViews = filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0);

      setStats({
        totalAccounts: links.length,
        totalVideos: filteredVideos.length,
        totalViews,
        totalEarnings,
        pendingPayouts,
      });
    } catch (error) {
      console.error('Failed to load creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert VideoDoc[] to VideoSubmission[] for the VideoSubmissionsTable
  const videoSubmissions: VideoSubmission[] = useMemo(() => {
    const accountsMap = new Map(linkedAccounts.map(acc => [acc.id, acc]));
    
    return videos.map(video => {
      const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
      
      return {
        id: video.id,
        url: video.url || '',
        platform: video.platform as 'instagram' | 'tiktok' | 'youtube',
        thumbnail: video.thumbnail || '',
        title: video.title || '',
        caption: video.description || '',
        uploader: account?.displayName || account?.username || '',
        uploaderHandle: account?.username || '',
        uploaderProfilePicture: account?.profilePicture,
        followerCount: account?.followerCount,
        status: video.status === 'archived' ? 'rejected' : 'approved',
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        dateSubmitted: video.dateAdded.toDate(),
        uploadDate: video.uploadDate.toDate(),
        lastRefreshed: video.lastRefreshed?.toDate(),
        snapshots: []
      };
    });
  }, [videos, linkedAccounts]);

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="space-y-6">
      {/* Modern Tab Switcher */}
      <div className="inline-flex items-center gap-1 bg-zinc-900/60 backdrop-blur border border-white/10 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'accounts'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          My Accounts
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'payouts'
              ? 'bg-white/10 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Payouts
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          linkedAccounts={linkedAccounts}
          totalEarnings={stats.totalEarnings}
          pendingPayouts={stats.pendingPayouts}
          totalVideos={stats.totalVideos}
          videoSubmissions={videoSubmissions}
        />
      )}

      {activeTab === 'accounts' && <AccountsTab linkedAccounts={linkedAccounts} />}

      {activeTab === 'payouts' && <PayoutsTab payouts={payouts} />}
    </div>
  );
};

// Dashboard Tab
const DashboardTab: React.FC<{
  linkedAccounts: TrackedAccount[];
  totalEarnings: number;
  pendingPayouts: number;
  totalVideos: number;
  videoSubmissions: VideoSubmission[];
}> = ({ linkedAccounts, totalEarnings, pendingPayouts, totalVideos, videoSubmissions }) => {
  return (
    <div className="space-y-6">
      {/* Stats Cards with Gradient Backgrounds like Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Linked Accounts */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-transparent rounded-xl border border-gray-300 dark:border-gray-700 p-6 hover:border-purple-500/40 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-200 dark:bg-gray-800 rounded-full blur-3xl group-hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-gray-200 dark:bg-gray-800 rounded-lg p-3 group-hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                <UsersIcon className="w-6 h-6 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {linkedAccounts.length}
            </div>
            <div className="text-sm text-gray-400">Linked Accounts</div>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-green-600/5 to-transparent rounded-xl border border-green-500/20 p-6 hover:border-green-500/40 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-500/10 rounded-lg p-3 group-hover:bg-green-500/20 transition-colors">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${totalEarnings.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">Total Earned</div>
          </div>
        </div>

        {/* Pending Payouts */}
        <div className="relative overflow-hidden bg-gradient-to-br from-yellow-500/10 via-yellow-600/5 to-transparent rounded-xl border border-yellow-500/20 p-6 hover:border-yellow-500/40 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/20 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-yellow-500/10 rounded-lg p-3 group-hover:bg-yellow-500/20 transition-colors">
                <TrendingUp className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${pendingPayouts.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">Pending Payouts</div>
          </div>
        </div>

        {/* Total Videos */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-transparent rounded-xl border border-gray-300 dark:border-gray-700 p-6 hover:border-blue-500/40 transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-200 dark:bg-gray-800 rounded-full blur-3xl group-hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-300" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-gray-200 dark:bg-gray-800 rounded-lg p-3 group-hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                <Video className="w-6 h-6 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {totalVideos}
            </div>
            <div className="text-sm text-gray-400">Total Videos</div>
          </div>
        </div>
      </div>

      {/* Recent Videos - Using Dashboard Table */}
      {videoSubmissions.length > 0 && (
        <VideoSubmissionsTable
          submissions={videoSubmissions}
        />
      )}

      {videoSubmissions.length === 0 && (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-12 text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No videos yet</h3>
          <p className="text-gray-400">
            Videos from your linked accounts will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

// Accounts Tab
const AccountsTab: React.FC<{ linkedAccounts: TrackedAccount[] }> = ({ linkedAccounts }) => {
  return (
    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
        <h2 className="text-lg font-semibold text-white">My Linked Accounts</h2>
        <p className="text-sm text-gray-400 mt-1">Accounts assigned to you by your team</p>
      </div>
      
      {linkedAccounts.length === 0 ? (
        <div className="p-12 text-center">
          <UsersIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No accounts linked yet</h3>
          <p className="text-gray-400">
            Contact your admin to link social media accounts to your profile.
          </p>
        </div>
      ) : (
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Videos
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Total Views
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Followers
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {linkedAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {account.profilePicture && (
                          <img
                            src={account.profilePicture}
                            alt={account.username}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                          />
                        )}
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {account.displayName || `@${account.username}`}
                          </div>
                          <div className="text-xs text-gray-400">
                            @{account.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <PlatformIcon platform={account.platform} size="md" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-white">
                        {(account.totalVideos || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-white">
                        {(account.totalViews || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-white">
                        {(account.followerCount || 0).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Payouts Tab
const PayoutsTab: React.FC<{ payouts: Payout[] }> = ({ payouts }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'processing':
        return 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
        <h2 className="text-lg font-semibold text-white">Payout History</h2>
        <p className="text-sm text-gray-400 mt-1">Track your earnings and payment history</p>
      </div>

      {payouts.length === 0 ? (
        <div className="p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No payouts yet</h3>
          <p className="text-gray-400">
            Your payout history will appear here once payouts are processed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Metrics
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {payout.periodStart.toDate().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' - '}
                    {payout.periodEnd.toDate().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-white">
                      ${payout.amount.toFixed(2)}
                    </div>
                    {payout.rateDescription && (
                      <div className="text-xs text-gray-400">
                        {payout.rateDescription}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {payout.totalViews.toLocaleString()} views
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        payout.status
                      )}`}
                    >
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {payout.paidAt
                      ? payout.paidAt.toDate().toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : payout.createdAt.toDate().toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CreatorPortalPage;
