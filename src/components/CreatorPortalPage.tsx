import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount, VideoDoc, Creator } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { Video, Users as UsersIcon, Plus, Link as LinkIcon, Eye, DollarSign, TrendingUp, Heart } from 'lucide-react';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { VideoSubmission } from '../types';
import CreatorAccountLinkingModal from './CreatorAccountLinkingModal';
import CreatorDirectVideoSubmission from './CreatorDirectVideoSubmission';
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
  const [showAccountLinkingModal, setShowAccountLinkingModal] = useState(false);
  const [showDirectSubmission, setShowDirectSubmission] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

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

        {/* Manage Accounts Button */}
        <button
          onClick={() => setShowAccountLinkingModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/80 hover:text-white transition-all"
        >
          <LinkIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Manage Accounts</span>
        </button>
      </div>

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
          </h3>
          <VideoSubmissionsTable
            submissions={videoSubmissions}
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No videos yet</h3>
          <p className="text-gray-500 mb-6">
            Submit your first video to start tracking performance
          </p>
          <button
            onClick={() => setShowDirectSubmission(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            Submit Videos
          </button>
        </div>
      )}
      
      {/* Floating Action Button - Monotone */}
      <button
        onClick={() => setShowDirectSubmission(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-40 group"
        title="Submit Videos"
      >
        <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
      </button>

      {/* Account Linking Modal */}
      <CreatorAccountLinkingModal
        isOpen={showAccountLinkingModal}
        onClose={() => setShowAccountLinkingModal(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Direct Video Submission Modal */}
      <CreatorDirectVideoSubmission
        isOpen={showDirectSubmission}
        onClose={() => setShowDirectSubmission(false)}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};

export default CreatorPortalPage;
