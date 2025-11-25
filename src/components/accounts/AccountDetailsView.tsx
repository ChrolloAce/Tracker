import React from 'react';
import { Users, Calendar, Plus, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { TrackedAccount, TrackedLink as FirestoreTrackedLink } from '../../types/firestore';
import { AccountVideo } from '../../types/accounts';
import { VideoSubmission, VideoSnapshot } from '../../types';
import { DateFilterType } from '../DateRangeFilter';
import { LinkClick } from '../../services/LinkClicksService';
import { ProxiedImage } from '../ProxiedImage';
import { PlatformIcon } from '../ui/PlatformIcon';
import KPICards from '../KPICards';
import { VideoSubmissionsTable } from '../VideoSubmissionsTable';
import { formatNumber, formatDate } from '../../utils/formatters';

interface AccountDetailsViewProps {
  selectedAccount: TrackedAccount;
  loading: boolean;
  accountVideos: AccountVideo[]; // Filtered by date/rules
  allAccountVideos: AccountVideo[]; // All videos for this account
  accountVideosSnapshots: Map<string, VideoSnapshot[]>;
  dateFilter: DateFilterType;
  trackedLinks: FirestoreTrackedLink[];
  linkClicks: LinkClick[];
  accountCreatorNames: Map<string, string>;
  isSyncing: string | null;
  
  // Handlers
  onSyncAccount: (accountId: string) => void;
  onAttachCreator: () => void;
  onCreateLink: () => void;
  onVideoClick: (video: VideoSubmission) => void;
}

export const AccountDetailsView: React.FC<AccountDetailsViewProps> = ({
  selectedAccount,
  loading,
  accountVideos,
  allAccountVideos,
  accountVideosSnapshots,
  dateFilter,
  trackedLinks,
  linkClicks,
  accountCreatorNames,
  isSyncing,
  onSyncAccount,
  onAttachCreator,
  onCreateLink,
  onVideoClick
}) => {
  
  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Profile Card Skeleton */}
        <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-8">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-zinc-800 rounded-2xl"></div>
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
              <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
            </div>
          </div>
        </div>
        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-6">
              <div className="h-4 bg-zinc-800 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-zinc-800 rounded w-full"></div>
            </div>
          ))}
        </div>
        {/* Videos Table Skeleton */}
        <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-zinc-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Helper to transform AccountVideo to VideoSubmission
  const transformToSubmission = (video: AccountVideo): VideoSubmission => {
    const videoId = video.id || video.videoId || '';
    const snapshots = accountVideosSnapshots.get(videoId) || [];
    
    // Determine if dateAdded/lastSynced/etc should be used
    // Using 'any' cast to handle potential type mismatches safely as done in parent
    const v = video as any;

    return {
      id: videoId,
      url: v.url || '',
      platform: selectedAccount.platform,
      thumbnail: v.thumbnail || '',
      title: v.caption || v.title || 'No caption',
      caption: v.caption || v.title || '', // Include caption property
      uploader: selectedAccount.displayName || selectedAccount.username,
      uploaderHandle: selectedAccount.username,
      uploaderProfilePicture: selectedAccount.profilePicture,
      followerCount: selectedAccount.followerCount,
      status: 'approved' as const,
      views: v.viewsCount || v.views || 0,
      likes: v.likesCount || v.likes || 0,
      comments: v.commentsCount || v.comments || 0,
      shares: v.sharesCount || v.shares || 0,
      dateSubmitted: v.uploadDate ? (v.uploadDate.toDate ? v.uploadDate.toDate() : new Date(v.uploadDate)) : new Date(),
      uploadDate: v.uploadDate ? (v.uploadDate.toDate ? v.uploadDate.toDate() : new Date(v.uploadDate)) : new Date(),
      snapshots: snapshots
    };
  };

  // Prepare data for KPI Cards
  const filteredVideoSubmissions: VideoSubmission[] = accountVideos.map(transformToSubmission);
  const allVideoSubmissions: VideoSubmission[] = allAccountVideos.map(transformToSubmission);

  // Filter link clicks
  const accountLinkIds = trackedLinks
    .filter(link => link.linkedAccountId === selectedAccount.id)
    .map(link => link.id);
  
  const accountLinkClicks = linkClicks.filter(click => 
    accountLinkIds.includes(click.linkId)
  );

  // Helper for dates (handling Timestamp or Date)
  const toDate = (date: any): Date => {
    if (!date) return new Date();
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  return (
    <div className="space-y-6">
      {/* Account Profile Card */}
      <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 p-8">
        <div className="flex items-center space-x-6">
          <div className="relative">
            {selectedAccount.profilePicture ? (
              <ProxiedImage
                src={selectedAccount.profilePicture}
                alt={`@${selectedAccount.username}`}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-gray-100"
                fallback={
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border-4 border-gray-100">
                    <Users className="w-12 h-12 text-gray-500" />
                  </div>
                }
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center border-4 border-gray-100">
                <Users className="w-12 h-12 text-gray-500" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2">
              <PlatformIcon platform={selectedAccount.platform} size="lg" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedAccount.displayName || `@${selectedAccount.username}`}
              </h2>
              {(() => {
                const creatorName = accountCreatorNames.get(selectedAccount.id);
                return creatorName ? (
                  <button
                    onClick={onAttachCreator}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors border border-white/20"
                  >
                    <Users className="w-3 h-3" />
                    {creatorName}
                  </button>
                ) : (
                  <button
                    onClick={onAttachCreator}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors border border-white/20"
                  >
                    <Plus className="w-3 h-3" />
                    Attach to Creator
                  </button>
                );
              })()}
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <span className="text-gray-500 dark:text-gray-500">@{selectedAccount.username}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(toDate(selectedAccount.dateAdded))}</span>
              </div>
              {selectedAccount.followerCount && (
                <div>
                  <span className="font-semibold">{formatNumber(selectedAccount.followerCount)}</span> followers
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6">
        <KPICards 
          submissions={filteredVideoSubmissions}
          allSubmissions={allVideoSubmissions}
          linkClicks={accountLinkClicks}
          dateFilter={dateFilter}
          timePeriod="days"
          onCreateLink={onCreateLink}
          onVideoClick={onVideoClick}
          cardVisibility={{
            revenue: false,
            downloads: false
          }}
        />
      </div>

      {/* Videos Table */}
      <div className="mt-6">
        {filteredVideoSubmissions.length > 0 ? (
          <VideoSubmissionsTable 
            submissions={filteredVideoSubmissions}
            onVideoClick={onVideoClick}
          />
        ) : (
          <div className="bg-zinc-900/60 rounded-xl border border-white/10 p-12 text-center">
             <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
               <RefreshCw className="w-8 h-8 text-gray-500" />
             </div>
             <h3 className="text-white font-medium text-lg mb-2">No videos found</h3>
             <p className="text-gray-400 mb-6 max-w-md mx-auto">
               {allAccountVideos.length > 0 
                 ? "There are videos, but they don't match your current date filter or rules."
                 : "Sync this account to discover and track videos."}
             </p>
             <button
                onClick={() => onSyncAccount(selectedAccount.id)}
                disabled={isSyncing === selectedAccount.id}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-black rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 font-medium"
              >
                <RefreshCw className={clsx('w-4 h-4', { 'animate-spin': isSyncing === selectedAccount.id })} />
                <span>{isSyncing === selectedAccount.id ? 'Syncing...' : 'Sync Videos'}</span>
              </button>
          </div>
        )}
      </div>
    </div>
  );
};
