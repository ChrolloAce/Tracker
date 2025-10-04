import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import PayoutsService from '../services/PayoutsService';
import { Video, DollarSign, Link as LinkIcon, TrendingUp } from 'lucide-react';
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
 * CreatorPortalPage
 * Main portal view for creators showing their content and statistics
 */
const CreatorPortalPage: React.FC = () => {
  const { user, currentOrgId } = useAuth();
  const [activeTab, setActiveTab] = useState<'content' | 'accounts' | 'payouts'>('content');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CreatorStats>({
    totalAccounts: 0,
    totalVideos: 0,
    totalViews: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
  });
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);

  useEffect(() => {
    loadData();
  }, [currentOrgId, user]);

  const loadData = async () => {
    if (!currentOrgId || !user) return;

    setLoading(true);
    try {
      // Load linked accounts
      const links = await CreatorLinksService.getCreatorLinkedAccounts(currentOrgId, user.uid);
      const accountIds = links.map(link => link.accountId);
      
      // Load all accounts from the org (use currentOrgId as projectId to get org-level accounts)
      const allAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentOrgId);
      
      // Filter to only linked accounts
      const accounts = allAccounts.filter(acc => accountIds.includes(acc.id));
      setLinkedAccounts(accounts);

      // Calculate stats
      const totalViews = accounts.reduce((sum, acc) => sum + (acc.totalViews || 0), 0);
      const totalVideos = accounts.reduce((sum, acc) => sum + (acc.totalVideos || 0), 0);

      // Get payout summary
      const payoutSummary = await PayoutsService.getPayoutSummary(currentOrgId, user.uid);

      setStats({
        totalAccounts: accounts.length,
        totalVideos,
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Creator Portal</h1>
        <p className="text-gray-400 mt-1">
          View your content, linked accounts, and earnings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <LinkIcon className="w-5 h-5 text-blue-400" />
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
              <div className="text-2xl font-bold text-white">{stats.totalVideos.toLocaleString()}</div>
              <div className="text-xs text-gray-400">Total Videos</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stats.totalViews.toLocaleString()}</div>
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
              <div className="text-2xl font-bold text-white">${stats.totalEarnings.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Total Earned</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'content'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          My Content
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'accounts'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Linked Accounts
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'payouts'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Payouts
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'content' && (
          <ContentTab linkedAccounts={linkedAccounts} />
        )}
        {activeTab === 'accounts' && (
          <AccountsTab linkedAccounts={linkedAccounts} />
        )}
        {activeTab === 'payouts' && (
          <PayoutsTab orgId={currentOrgId!} creatorId={user!.uid} />
        )}
      </div>
    </div>
  );
};

// Content Tab Component
const ContentTab: React.FC<{ linkedAccounts: TrackedAccount[] }> = ({
  linkedAccounts,
}) => {
  if (linkedAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Video className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No linked accounts yet</h3>
        <p className="text-gray-400 max-w-md">
          Ask an admin to link accounts to you to start seeing your content here.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        Showing content from {linkedAccounts.length} linked account{linkedAccounts.length !== 1 ? 's' : ''}
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {linkedAccounts.map(account => (
          <div
            key={account.id}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <PlatformIcon platform={account.platform} size="lg" />
              <div className="flex-1">
                <div className="text-white font-medium">@{account.username}</div>
                {account.displayName && (
                  <div className="text-sm text-gray-400">{account.displayName}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-white font-medium">{account.totalVideos || 0}</div>
                <div className="text-xs text-gray-400">Videos</div>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">{(account.totalViews || 0).toLocaleString()}</div>
                <div className="text-xs text-gray-400">Views</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Accounts Tab Component
const AccountsTab: React.FC<{ linkedAccounts: TrackedAccount[] }> = ({ linkedAccounts }) => {
  if (linkedAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <LinkIcon className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No accounts linked</h3>
        <p className="text-gray-400 max-w-md">
          Ask an admin to link accounts to you.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {linkedAccounts.map(account => (
        <div
          key={account.id}
          className="bg-gray-800/50 rounded-lg border border-gray-700 p-5"
        >
          <div className="flex items-start gap-4">
            <PlatformIcon platform={account.platform} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-medium text-white truncate">
                @{account.username}
              </div>
              {account.displayName && (
                <div className="text-sm text-gray-400 truncate">{account.displayName}</div>
              )}
              
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-white font-medium">{account.followerCount?.toLocaleString() || '—'}</div>
                  <div className="text-xs text-gray-400">Followers</div>
                </div>
                <div>
                  <div className="text-white font-medium">{account.totalVideos?.toLocaleString() || 0}</div>
                  <div className="text-xs text-gray-400">Videos</div>
                </div>
                <div>
                  <div className="text-white font-medium">{account.totalViews?.toLocaleString() || 0}</div>
                  <div className="text-xs text-gray-400">Views</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Payouts Tab Component  
const PayoutsTab: React.FC<{ orgId: string; creatorId: string }> = ({ orgId, creatorId }) => {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayouts();
  }, [orgId, creatorId]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const data = await PayoutsService.getCreatorPayouts(orgId, creatorId);
      setPayouts(data);
    } catch (error) {
      console.error('Failed to load payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  if (payouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <DollarSign className="w-16 h-16 text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No payouts yet</h3>
        <p className="text-gray-400 max-w-md">
          Your payout history will appear here once payments are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800/50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Period</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Accounts</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Views</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Amount</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Paid On</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {payouts.map(payout => (
            <tr key={payout.id} className="hover:bg-gray-800/30">
              <td className="px-6 py-4 text-sm text-white">
                {payout.periodStart.toDate().toLocaleDateString()} - {payout.periodEnd.toDate().toLocaleDateString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-400">{payout.accountIds.length}</td>
              <td className="px-6 py-4 text-sm text-gray-400">{payout.totalViews.toLocaleString()}</td>
              <td className="px-6 py-4 text-sm font-medium text-white">
                ${payout.amount.toFixed(2)} {payout.currency}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  payout.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                  payout.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                  payout.status === 'processing' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {payout.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-400">
                {payout.paidAt ? payout.paidAt.toDate().toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CreatorPortalPage;

