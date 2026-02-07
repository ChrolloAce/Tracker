import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, VideoDoc, Creator } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { Video, Users as UsersIcon, Eye, DollarSign, TrendingUp, Heart, ExternalLink, Link2, Plus } from 'lucide-react';
import CreatorAddAccountModal from './CreatorAddAccountModal';
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
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

  // Auto-refresh: poll every 15s when there are pending/processing videos
  const hasPendingVideos = useMemo(() => {
    return videos.some(v => 
      v.syncStatus === 'pending' || v.syncStatus === 'processing' || 
      v.status === 'pending' || v.status === 'processing'
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

      const linkedAccountIds = links.map(link => link.accountId);
      const accounts = allAccounts.filter(acc => linkedAccountIds.includes(acc.id));

      setLinkedAccounts(accounts);

      // Load all videos for this project
      const allVideos = await FirestoreDataService.getVideos(
        currentOrgId,
        currentProjectId,
        { limitCount: 1000 }
      );

      // Filter videos to show:
      // 1. Videos from linked accounts
      // 2. Videos directly submitted by this creator (addedBy === user.uid)
      const filteredVideos = allVideos.filter((video) => {
        // Video submitted directly by this creator
        if (video.addedBy === user.uid) return true;
        // Video from a linked account
        if (video.trackedAccountId && linkedAccountIds.includes(video.trackedAccountId)) return true;
        return false;
      });

      setVideos(filteredVideos);

      // Calculate stats
      const totalViews = filteredVideos.reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = filteredVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalComments = filteredVideos.reduce((sum, v) => sum + (v.comments || 0), 0);

      setStats({
        totalAccounts: links.length,
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

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
      case 'tiktok': return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      );
      case 'youtube': return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
      case 'twitter': return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
      default: return <Link2 className="w-5 h-5" />;
    }
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
          {/* Add Account Button */}
          <div className="flex justify-end">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {linkedAccounts.map(account => (
                <a
                  key={account.id}
                  href={getPlatformUrl(account.platform, account.username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl transition-all group"
                >
                  {account.profilePicture ? (
                    <img src={account.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-gray-400 ring-2 ring-white/10">
                      {getPlatformIcon(account.platform)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">@{account.username}</span>
                      <span className="text-gray-500">{getPlatformIcon(account.platform)}</span>
                    </div>
                    {account.displayName && account.displayName !== account.username && (
                      <p className="text-xs text-gray-400 truncate">{account.displayName}</p>
                    )}
                    {account.followerCount !== undefined && (
                      <p className="text-xs text-gray-500 mt-0.5">{formatNumber(account.followerCount)} followers</p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors flex-shrink-0" />
                </a>
              ))}
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

      {/* Payment Info Card - Monotone */}
      {creatorProfile?.paymentInfo && (
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

      {/* Add Account Modal */}
      <CreatorAddAccountModal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSuccess={() => {
          setShowAddAccount(false);
          loadData();
        }}
      />
    </div>
  );
};

export default CreatorPortalPage;
