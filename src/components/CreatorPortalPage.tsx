import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, Payout, VideoDoc } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import PayoutsService from '../services/PayoutsService';
import { Video, DollarSign, TrendingUp, Eye, ThumbsUp, MessageCircle } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'payouts'>('dashboard');
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
      const accountIds = links.map(link => link.accountId);
      
      // Load all accounts from the project
      const allAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );
      
      // Filter to only linked accounts
      const accounts = allAccounts.filter(acc => accountIds.includes(acc.id));
      setLinkedAccounts(accounts);

      // Load all videos from project
      let linkedVideos: VideoDoc[] = [];
      try {
        const allProjectVideos = await FirestoreDataService.getVideos(
          currentOrgId,
          currentProjectId
        );
        // Filter to only videos from linked accounts
        linkedVideos = allProjectVideos.filter((v: VideoDoc) => 
          accountIds.includes(v.trackedAccountId || '')
        );
        setVideos(linkedVideos);
      } catch (err) {
        console.warn('Failed to load videos:', err);
      }

      // Calculate stats
      const totalViews = linkedVideos.reduce((sum, video) => sum + (video.views || 0), 0);

      // Get payout summary for this project
      const payoutSummary = await PayoutsService.getPayoutSummary(
        currentOrgId,
        currentProjectId,
        user.uid
      );

      // Load payouts
      const payoutsData = await PayoutsService.getCreatorPayouts(
        currentOrgId,
        currentProjectId,
        user.uid
      );
      setPayouts(payoutsData);

      setStats({
        totalAccounts: accounts.length,
        totalVideos: linkedVideos.length,
        totalViews,
        totalEarnings: payoutSummary.totalPaid,
        pendingPayouts: payoutSummary.totalPending,
      });
    } catch (error) {
      console.error('Failed to load creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Creator Dashboard</h1>
        <p className="text-gray-400 mt-1">
          View your content performance and earnings for this project
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.totalAccounts}</div>
              <div className="text-xs text-gray-400">Linked Accounts</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.totalVideos}</div>
              <div className="text-xs text-gray-400">Total Videos</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Eye className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {stats.totalViews.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Total Views</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                ${stats.totalEarnings.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Total Earned</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                ${stats.pendingPayouts.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'payouts'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Payouts
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          linkedAccounts={linkedAccounts}
          videos={videos}
        />
      )}
      {activeTab === 'payouts' && (
        <PayoutsTab payouts={payouts} />
      )}
    </div>
  );
};

// Dashboard Tab
const DashboardTab: React.FC<{ linkedAccounts: TrackedAccount[]; videos: VideoDoc[] }> = ({
  linkedAccounts,
  videos,
}) => {
  return (
    <div className="space-y-6">
      {/* Linked Accounts Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">My Linked Accounts</h2>
        {linkedAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No accounts linked yet. Contact your admin to link accounts.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {linkedAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-gray-700/50 rounded-lg border border-gray-600 p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <PlatformIcon platform={account.platform} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      @{account.username}
                    </div>
                    {account.displayName && (
                      <div className="text-xs text-gray-400 truncate">
                        {account.displayName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-400">Videos</div>
                    <div className="text-white font-medium">
                      {account.totalVideos || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Views</div>
                    <div className="text-white font-medium">
                      {(account.totalViews || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Videos Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Videos</h2>
        {videos.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No videos found for your linked accounts.
          </div>
        ) : (
          <div className="space-y-3">
            {videos.slice(0, 10).map((video) => (
              <div
                key={video.id}
                className="bg-gray-700/50 rounded-lg border border-gray-600 p-4 flex items-start gap-4"
              >
                {/* Thumbnail */}
                {video.thumbnail && (
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="w-32 h-20 object-cover rounded flex-shrink-0"
                  />
                )}
                
                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white line-clamp-2 mb-2">
                    {video.title || 'Untitled Video'}
                  </div>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {(video.views || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {(video.likes || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {(video.comments || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {video.uploadDate?.toDate().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Payout History</h2>
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
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Metrics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-800/30">
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
                    <div className="text-sm font-medium text-white">
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
