import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Eye, Heart, MessageCircle, Video, Calendar, DollarSign, 
  ExternalLink, TrendingUp, User, Loader2 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TrackedAccount, VideoDoc } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { VideoSubmissionsTable } from './VideoSubmissionsTable';
import { VideoSubmission } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ProxiedImage } from './ProxiedImage';

interface CreatorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: OrgMember;
  profile: Creator | undefined;
  earnings: number;
  videoCount: number;
}

// Platform icons
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);
const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'instagram': return <InstagramIcon />;
    case 'tiktok': return <TikTokIcon />;
    case 'youtube': return <YouTubeIcon />;
    case 'twitter': return <XIcon />;
    default: return <User className="w-4 h-4" />;
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

const CreatorDetailModal: React.FC<CreatorDetailModalProps> = ({
  isOpen, onClose, creator, profile, earnings, videoCount
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadCreatorData();
    }
  }, [isOpen, creator.userId]);

  const loadCreatorData = async () => {
    if (!currentOrgId || !currentProjectId) return;
    setLoadingData(true);

    try {
      // Load linked accounts
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId, currentProjectId, creator.userId
      );
      const allAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId, currentProjectId
      );
      const linkedAccountIds = links.map(l => l.accountId);
      const accounts = allAccounts.filter(a => linkedAccountIds.includes(a.id));
      setLinkedAccounts(accounts);

      // Load videos: from linked accounts + directly submitted
      const allVideos = await FirestoreDataService.getVideos(
        currentOrgId, currentProjectId, { limitCount: 1000 }
      );
      const creatorVideos = allVideos.filter(v =>
        (v.trackedAccountId && linkedAccountIds.includes(v.trackedAccountId)) ||
        v.addedBy === creator.userId
      );
      setVideos(creatorVideos);
    } catch (error) {
      console.error('Failed to load creator details:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Convert to VideoSubmission[] for the table
  const videoSubmissions: VideoSubmission[] = useMemo(() => {
    const accountsMap = new Map(linkedAccounts.map(a => [a.id, a]));
    return videos.map(video => {
      const account = video.trackedAccountId ? accountsMap.get(video.trackedAccountId) : null;
      return {
        id: video.id,
        url: video.url || video.videoUrl || '',
        platform: video.platform as 'instagram' | 'tiktok' | 'youtube' | 'twitter',
        thumbnail: video.thumbnail || '',
        title: video.title || video.videoTitle || '',
        caption: video.description || video.caption || '',
        uploader: account?.displayName || account?.username || (video as any).uploaderName || creator.displayName || 'Unknown',
        uploaderHandle: account?.username || (video as any).uploaderHandle || '',
        uploaderProfilePicture: account?.profilePicture || (video as any).uploaderProfilePicture,
        followerCount: account?.followerCount,
        status: video.status === 'archived' ? 'rejected' : video.status === 'processing' ? 'pending' : 'approved',
        syncStatus: video.syncStatus === 'processing' ? 'syncing' : video.syncStatus as any,
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
  }, [videos, linkedAccounts, creator]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-12 overflow-y-auto">
      <div className="bg-[#111113] rounded-2xl border border-white/10 w-full max-w-4xl shadow-2xl mb-12">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 flex-shrink-0">
              {creator.photoURL ? (
                <ProxiedImage
                  src={creator.photoURL}
                  alt={creator.displayName || 'Creator'}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10"
                  fallback={
                    <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/10 text-white font-bold text-lg">
                      {(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                    </div>
                  }
                />
              ) : (
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/10 text-white font-bold text-lg">
                  {(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{creator.displayName || 'Unknown Creator'}</h2>
              <p className="text-sm text-gray-400">{creator.email || 'No email'}</p>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                Joined {formatDate(creator.joinedAt)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-white/10">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs">Earnings</span>
                </div>
                <div className="text-xl font-bold text-white">${earnings.toFixed(2)}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Video className="w-4 h-4" />
                  <span className="text-xs">Videos</span>
                </div>
                <div className="text-xl font-bold text-white">{videos.length}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs">Total Views</span>
                </div>
                <div className="text-xl font-bold text-white">{formatNumber(totalViews)}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">Total Likes</span>
                </div>
                <div className="text-xl font-bold text-white">{formatNumber(totalLikes)}</div>
              </div>
            </div>

            {/* Linked Accounts */}
            <div className="p-6 border-b border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Linked Accounts ({linkedAccounts.length})
              </h3>
              {linkedAccounts.length === 0 ? (
                <p className="text-sm text-gray-500">No linked accounts</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {linkedAccounts.map(account => (
                    <a
                      key={account.id}
                      href={getPlatformUrl(account.platform, account.username)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                    >
                      {account.profilePicture ? (
                        <img src={account.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-400">
                          {getPlatformIcon(account.platform)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white truncate">
                            @{account.username}
                          </span>
                          {getPlatformIcon(account.platform)}
                        </div>
                        {account.followerCount !== undefined && (
                          <span className="text-xs text-gray-500">
                            {formatNumber(account.followerCount)} followers
                          </span>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Videos */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Recent Videos ({videos.length})
              </h3>
              {videoSubmissions.length === 0 ? (
                <div className="text-center py-8">
                  <Video className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No videos yet</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto rounded-xl border border-white/5">
                  <VideoSubmissionsTable submissions={videoSubmissions.slice(0, 20)} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreatorDetailModal;
