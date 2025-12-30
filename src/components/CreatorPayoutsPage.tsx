import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Creator, TrackedAccount } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { 
  TrendingUp, 
  DollarSign, 
  Eye, 
  Calendar, 
  Video as VideoIcon,
  User,
  ExternalLink
} from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { ProxiedImage } from './ProxiedImage';

/**
 * CreatorPayoutsPage
 * Creator's personal view showing their managed accounts, earnings, and payout info
 */
const CreatorPayoutsPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [calculatedEarnings, setCalculatedEarnings] = useState(0);
  const [viewsHistory, setViewsHistory] = useState<{ date: string; views: number }[]>([]);

  useEffect(() => {
    loadCreatorData();
  }, [currentOrgId, currentProjectId, user]);

  const loadCreatorData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Get creator profile
      const profile = await CreatorLinksService.getCreatorProfile(
        currentOrgId,
        currentProjectId,
        user.uid
      );
      setCreatorProfile(profile);

      if (!profile) {
        setLoading(false);
        return;
      }

      // Get creator's linked accounts
      const linksSnapshot = await getDocs(
        query(
          collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creatorLinks'),
          where('creatorId', '==', user.uid)
        )
      );

      const accountIds = linksSnapshot.docs.map(doc => doc.data().accountId);
      
      if (accountIds.length === 0) {
        setLinkedAccounts([]);
        setLoading(false);
        return;
      }

      // Get account details
      const allAccounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      const creatorAccounts = allAccounts.filter(acc => accountIds.includes(acc.id));
      setLinkedAccounts(creatorAccounts);

      // Calculate totals from accounts
      let totalViewsSum = 0;
      let totalVideosSum = 0;
      const viewsByDate = new Map<string, number>();

      // Load videos for each account
      for (const account of creatorAccounts) {
        const videos = await FirestoreDataService.getVideos(
          currentOrgId,
          currentProjectId,
          { trackedAccountId: account.id }
        );

        totalVideosSum += videos.length;

        videos.forEach((video: any) => {
          const views = video.views || 0;
          totalViewsSum += views;

          // Group views by date for chart
          const uploadDate = video.uploadDate?.toDate ? video.uploadDate.toDate() : new Date(video.uploadDate);
          const dateKey = uploadDate.toISOString().split('T')[0];
          viewsByDate.set(dateKey, (viewsByDate.get(dateKey) || 0) + views);
        });
      }

      setTotalViews(totalViewsSum);
      setTotalVideos(totalVideosSum);

      // Convert to array and sort by date
      const viewsHistoryArray = Array.from(viewsByDate.entries())
        .map(([date, views]) => ({ date, views }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days
      setViewsHistory(viewsHistoryArray);

      // Calculate earnings based on payment terms
      if (profile.customPaymentTerms) {
        const terms = profile.customPaymentTerms;
        let earnings = 0;

        switch (terms.type) {
          case 'flat_fee':
            earnings = (terms.baseAmount || 0) * totalVideosSum;
            break;
          case 'base_cpm':
            earnings = (terms.baseAmount || 0) * totalVideosSum + (totalViewsSum / 1000) * (terms.cpmRate || 0);
            break;
          case 'retainer':
            earnings = terms.baseAmount || 0;
            break;
          default:
            earnings = 0;
        }

        setCalculatedEarnings(earnings);
      }
    } catch (error) {
      console.error('Failed to load creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Calculate next payout date (assume monthly on the 1st)
  const getNextPayoutDate = (): string => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  if (!creatorProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <User className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Creator Profile Not Found</h2>
        <p className="text-gray-400">Your creator profile hasn't been set up yet. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Payouts</h1>
          <p className="text-gray-400 mt-1">Track your earnings and performance</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Earnings */}
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-2xl border border-green-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
              Current Period
            </span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {formatCurrency(calculatedEarnings)}
          </div>
          <div className="text-sm text-green-400/80">
            Estimated earnings
          </div>
        </div>

        {/* Total Views */}
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {formatNumber(totalViews)}
          </div>
          <div className="text-sm text-gray-400">
            Total Views
          </div>
        </div>

        {/* Total Videos */}
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <VideoIcon className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {totalVideos}
          </div>
          <div className="text-sm text-gray-400">
            Total Videos
          </div>
        </div>

        {/* Next Payout */}
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <div className="text-lg font-bold text-white mb-1">
            {getNextPayoutDate()}
          </div>
          <div className="text-sm text-gray-400">
            Next Payout Date
          </div>
        </div>
      </div>

      {/* Views Chart */}
      {viewsHistory.length > 0 && (
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Views Over Time
          </h3>
          <div className="h-48 flex items-end gap-1">
            {viewsHistory.map((item, index) => {
              const maxViews = Math.max(...viewsHistory.map(v => v.views));
              const height = maxViews > 0 ? (item.views / maxViews) * 100 : 0;
              return (
                <div
                  key={index}
                  className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer group relative"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${new Date(item.date).toLocaleDateString()}: ${formatNumber(item.views)} views`}
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {formatNumber(item.views)} views
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{viewsHistory[0]?.date ? new Date(viewsHistory[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
            <span>{viewsHistory[viewsHistory.length - 1]?.date ? new Date(viewsHistory[viewsHistory.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
          </div>
        </div>
      )}

      {/* My Accounts */}
      <div className="bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-zinc-900/40">
          <h3 className="text-lg font-semibold text-white">
            My Accounts ({linkedAccounts.length})
          </h3>
        </div>

        {linkedAccounts.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No accounts linked yet</p>
            <p className="text-sm text-gray-500 mt-1">Contact your administrator to link your social accounts.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {linkedAccounts.map((account) => (
              <div key={account.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {account.profilePicture ? (
                      <ProxiedImage
                        src={account.profilePicture}
                        alt={account.username}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                        fallback={
                          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/10 text-white font-bold">
                            {account.username.charAt(0).toUpperCase()}
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/10 text-white font-bold">
                        {account.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1">
                      <PlatformIcon platform={account.platform} size="xs" />
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-medium">@{account.username}</div>
                    {account.displayName && (
                      <div className="text-sm text-gray-400">{account.displayName}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-white font-medium">{formatNumber(account.followerCount || 0)}</div>
                    <div className="text-xs text-gray-500">Followers</div>
                  </div>
                  <a
                    href={account.profileUrl || `https://${account.platform}.com/${account.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Terms Info */}
      {creatorProfile.customPaymentTerms && (
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Payment Terms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Payment Type</div>
              <div className="text-white font-medium capitalize">
                {creatorProfile.customPaymentTerms.type?.replace(/_/g, ' ') || 'Not set'}
              </div>
            </div>
            {creatorProfile.customPaymentTerms.baseAmount !== undefined && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Base Amount</div>
                <div className="text-white font-medium">
                  {formatCurrency(creatorProfile.customPaymentTerms.baseAmount)}
                </div>
              </div>
            )}
            {creatorProfile.customPaymentTerms.cpmRate !== undefined && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">CPM Rate</div>
                <div className="text-white font-medium">
                  {formatCurrency(creatorProfile.customPaymentTerms.cpmRate)} per 1K views
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorPayoutsPage;

