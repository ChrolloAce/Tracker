import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, VideoDoc, Creator } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { Video, Users as UsersIcon, Eye, DollarSign, TrendingUp, Heart, ExternalLink, Link2, Plus } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import CreatorAddAccountModal from './CreatorAddAccountModal';
import CreatorPaymentPlanCard from './CreatorPaymentPlanCard';
import CreatorDirectVideoSubmission from './CreatorDirectVideoSubmission';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { VideoSubmission } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface CreatorStats {
  totalAccounts: number;
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
}

/**
 * CreatorPortalPage - PROJECT SCOPED
 * Simplified creator view: Dashboard with videos and payment info
 * No campaigns - payment settings are on creator profile
 */
const CreatorPortalPage: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CreatorStats>({
    totalAccounts: 0,
    totalVideos: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
  });
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts'>('dashboard');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showSubmitVideo, setShowSubmitVideo] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

  // Auto-refresh: poll every 15s when there are pending/processing videos
  const hasPendingVideos = useMemo(() => {
    return videos.some(v => 
      v.syncStatus === 'pending' || v.syncStatus === 'processing' || 
      v.status === 'processing'
    );
  }, [videos]);

  useEffect(() => {
    if (hasPendingVideos) {
      pollIntervalRef.current = setInterval(() => {
        console.log('🔄 Auto-refreshing creator dashboard (pending videos detected)');
        loadData();
      }, 15000); // 15 seconds
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [hasPendingVideos]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Load creator profile for payment info
      const creatorRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creators', user.uid);
      const creatorDoc = await getDoc(creatorRef);
      if (creatorDoc.exists()) {
        setCreatorProfile({ id: creatorDoc.id, ...creatorDoc.data() } as Creator);
      }

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

      const linkedAccountIds = new Set(links.map(link => link.accountId));

      // Load all videos for this project
      const allVideos = await FirestoreDataService.getVideos(
        currentOrgId,
        currentProjectId,
        { limitCount: 1000 }
      );

      // Filter videos to show:
      // 1. Videos from linked accounts
      // 2. Videos directly submitted by this creator (addedBy === user.uid)
      // 3. Videos explicitly assigned to this creator (assignedCreatorId)
      const filteredVideos = allVideos.filter((video) => {
        if (video.addedBy === user.uid) return true;
        if (video.assignedCreatorId === user.uid) return true;
        if (video.trackedAccountId && linkedAccountIds.has(video.trackedAccountId)) return true;
        return false;
      });

      // Also discover accounts from videos this creator submitted (auto-link discovery)
      const videoAccountIds = new Set<string>();
      filteredVideos.forEach(v => {
        if (v.trackedAccountId) videoAccountIds.add(v.trackedAccountId);
      });

      // Merge: linked accounts + accounts from creator's videos
      const allRelevantIds = new Set([...linkedAccountIds, ...videoAccountIds]);
      const accounts = allAccounts.filter(acc => allRelevantIds.has(acc.id));

      setLinkedAccounts(accounts);
      setVideos(filteredVideos);

      // Calculate stats
      const totalViews = filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = filteredVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalComments = filteredVideos.reduce((sum, v) => sum + (v.comments || 0), 0);

      setStats({
        totalAccounts: accounts.length,
        totalVideos: filteredVideos.length,
        totalViews,
        totalLikes,
        totalComments,
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
      
      // For directly submitted videos, use video metadata or "You" as uploader
      const uploaderName = account?.displayName || account?.username || (video as any).uploaderName || 'You';
      const uploaderHandle = account?.username || (video as any).uploaderHandle || '';
      
      return {
        id: video.id,
        url: video.url || video.videoUrl || '',
        platform: video.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter',
        thumbnail: video.thumbnail || '',
        title: video.title || video.videoTitle || '',
        caption: video.description || video.caption || '',
        uploader: uploaderName,
        uploaderHandle: uploaderHandle,
        uploaderProfilePicture: account?.profilePicture || (video as any).uploaderProfilePicture,
        followerCount: account?.followerCount,
        status: video.status === 'archived' ? 'rejected' : video.status === 'processing' ? 'pending' : 'approved',
        syncStatus: video.syncStatus === 'processing' ? 'syncing' : video.syncStatus as 'pending' | 'failed' | 'idle' | 'syncing' | 'completed' | undefined,
        views: video.views || 0,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        duration: video.duration || 0,
        dateSubmitted: video.dateAdded?.toDate() || new Date(),
        uploadDate: video.uploadDate?.toDate() || new Date(),
        lastRefreshed: video.lastRefreshed?.toDate(),
        snapshots: []
      };
    });
  }, [videos, linkedAccounts]);

  // Per-account stats from videos
  const accountStats = useMemo(() => {
    const statsMap = new Map<string, { views: number; likes: number; comments: number; videoCount: number }>();
    
    linkedAccounts.forEach(account => {
      const accountVideos = videos.filter(v => v.trackedAccountId === account.id);
      statsMap.set(account.id, {
        views: accountVideos.reduce((s, v) => s + (v.views || 0), 0),
        likes: accountVideos.reduce((s, v) => s + (v.likes || 0), 0),
        comments: accountVideos.reduce((s, v) => s + (v.comments || 0), 0),
        videoCount: accountVideos.length,
      });
    });
    
    return statsMap;
  }, [videos, linkedAccounts]);

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPlatformUrl = (platform: string, username: string) => {
    switch (platform) {
      case 'instagram': return `https://instagram.com/${username}`;
      case 'tiktok': return `https://tiktok.com/@${username}`;
      case 'youtube': return `https://youtube.com/@${username}`;
      case 'twitter': return `https://x.com/${username}`;
      default: return '#';
    }
  };

  if (loading) {
    return <PageLoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Track your video performance and earnings</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'accounts'
                ? 'border-white text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Linked Accounts
            {linkedAccounts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/10 rounded text-xs">{linkedAccounts.length}</span>
            )}
          </button>
        </nav>
        </div>

      {/* === LINKED ACCOUNTS TAB === */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Header row with title + button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Account stats – All Time
            </h2>
        <button
              onClick={() => setShowAddAccount(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-sm font-medium transition-all"
        >
              <Plus className="w-4 h-4" />
              Link Account
        </button>
      </div>

          {linkedAccounts.length === 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
              <Link2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No linked accounts</h3>
              <p className="text-gray-500 text-sm mb-6">
                Link your social media accounts to track your content
              </p>
      <button
                onClick={() => setShowAddAccount(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-sm font-medium transition-all"
      >
                <Plus className="w-4 h-4" />
                Link Your First Account
      </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead className="bg-zinc-900/40 border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Followers
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Total Posts
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Likes
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Comments
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {linkedAccounts.map(account => {
                      const acStats = accountStats.get(account.id);
                      return (
                        <tr
                          key={account.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          {/* Username */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="relative w-10 h-10 flex-shrink-0">
                                {account.profilePicture ? (
                                  <img
                                    src={account.profilePicture}
                                    alt={`@${account.username}`}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {(account.username || 'A').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 rounded-full p-0.5 flex items-center justify-center border border-white/20">
                                  <PlatformIcon platform={account.platform as any} size="xs" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white flex items-center gap-1.5">
                                  {account.displayName || account.username}
                                  {(account as any).isVerified && (
                                    <img src="/verified-badge.png" alt="Verified" className="w-3.5 h-3.5" />
                                  )}
                                </div>
                                <div className="text-xs text-white/40">@{account.username}</div>
                              </div>
    </div>
                          </td>

                          {/* Followers */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white font-medium">
                              {account.followerCount !== undefined ? formatNumber(account.followerCount) : '—'}
                            </span>
                          </td>

                          {/* Total Posts */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white font-medium">
                              {acStats?.videoCount || 0}
                            </span>
                          </td>

                          {/* Views */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white font-medium">
                              {formatNumber(acStats?.views || 0)}
                            </span>
                          </td>

                          {/* Likes */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white font-medium">
                              {formatNumber(acStats?.likes || 0)}
                            </span>
                          </td>

                          {/* Comments */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white font-medium">
                              {formatNumber(acStats?.comments || 0)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <a
                              href={getPlatformUrl(account.platform, account.username)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === DASHBOARD TAB === */}
      {activeTab === 'dashboard' && (
        <>
      {/* Stats Cards Grid - Monotone */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Earnings */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
            <div className="bg-white/10 rounded-lg p-2.5">
              <DollarSign className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
            ${(creatorProfile?.totalEarnings || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Total Earnings</div>
        </div>

        {/* Total Views */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
            <div className="bg-white/10 rounded-lg p-2.5">
              <Eye className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
            {formatNumber(stats.totalViews)}
          </div>
          <div className="text-xs text-gray-500">Total Views</div>
        </div>

        {/* Total Likes */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/10 rounded-lg p-2.5">
              <Heart className="w-5 h-5 text-gray-300" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-0.5">
            {formatNumber(stats.totalLikes)}
          </div>
          <div className="text-xs text-gray-500">Total Likes</div>
        </div>

        {/* Total Videos */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
            <div className="bg-white/10 rounded-lg p-2.5">
              <Video className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
            {stats.totalVideos}
          </div>
          <div className="text-xs text-gray-500">Total Videos</div>
        </div>

        {/* Linked Accounts */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
            <div className="bg-white/10 rounded-lg p-2.5">
              <UsersIcon className="w-5 h-5 text-gray-300" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">
              {linkedAccounts.length}
            </div>
          <div className="text-xs text-gray-500">Linked Accounts</div>
        </div>
      </div>

      {/* Payment Plan Card (new system) */}
      {creatorProfile?.paymentPlan && (
        <CreatorPaymentPlanCard
          plan={creatorProfile.paymentPlan}
          totalViews={stats.totalViews}
          totalVideos={stats.totalVideos}
        />
      )}

      {/* Legacy Payment Info Card (fallback for creators without new plan) */}
      {!creatorProfile?.paymentPlan && creatorProfile?.paymentInfo && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              Payment Info
            </h3>
            {creatorProfile.paymentInfo.isPaid && (
              <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-gray-300">
                Paid
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatorProfile.paymentInfo.structure && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Structure</p>
                <p className="text-sm text-gray-200">{creatorProfile.paymentInfo.structure}</p>
                    </div>
                      )}
            {creatorProfile.paymentInfo.schedule && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Schedule</p>
                <p className="text-sm text-gray-200 capitalize">{creatorProfile.paymentInfo.schedule}</p>
                    </div>
            )}
            {creatorProfile.paymentInfo.notes && (
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-200">{creatorProfile.paymentInfo.notes}</p>
                  </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Videos - Monotone */}
      {videoSubmissions.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            Your Videos
            {hasPendingVideos && (
              <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                Updating...
              </span>
            )}
          </h3>
          <VideoSubmissionsTable
            submissions={videoSubmissions}
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No videos yet</h3>
          <p className="text-gray-500">
            Videos assigned to you will appear here
          </p>
        </div>
      )}
        </>
      )}

      {/* Floating Submit Video Button - Only on Overview tab */}
      {activeTab === 'dashboard' && (
        <button
          onClick={() => setShowSubmitVideo(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-40 group"
          title="Submit Video"
        >
          <Video className="w-6 h-6 transition-transform group-hover:scale-110" />
        </button>
      )}

      {/* Add Account Modal */}
      <CreatorAddAccountModal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSuccess={() => {
          setShowAddAccount(false);
          loadData();
        }}
      />

      {/* Submit Video Modal */}
      <CreatorDirectVideoSubmission
        isOpen={showSubmitVideo}
        onClose={() => setShowSubmitVideo(false)}
        onSuccess={() => {
          setShowSubmitVideo(false);
          loadData();
        }}
      />
    </div>
  );
};

export default CreatorPortalPage;
