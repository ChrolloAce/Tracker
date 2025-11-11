import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Trash2, RotateCcw, Calendar, AlertCircle, Eye, Heart, MessageCircle as CommentIcon, Share2, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProxiedImage } from './ProxiedImage';

interface DeletedVideo {
  id: string;
  platformVideoId: string;
  platform: string;
  deletedAt: Date;
  originalVideoId: string;
  // Enhanced metadata
  title?: string;
  thumbnail?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  url?: string;
}

const DeletedVideosManager: React.FC = () => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [deletedVideos, setDeletedVideos] = useState<DeletedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadDeletedVideos();
  }, [currentOrgId, currentProjectId]);

  const loadDeletedVideos = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setLoading(true);
      const deletedRef = collection(
        db,
        'organizations',
        currentOrgId,
        'projects',
        currentProjectId,
        'deletedVideos'
      );

      const snapshot = await getDocs(deletedRef);
      const videos: DeletedVideo[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          platformVideoId: data.platformVideoId || doc.id,
          platform: data.platform || 'unknown',
          deletedAt: data.deletedAt instanceof Timestamp 
            ? data.deletedAt.toDate() 
            : new Date(data.deletedAt),
          originalVideoId: data.originalVideoId || '',
          // Enhanced metadata
          title: data.title,
          thumbnail: data.thumbnail,
          views: data.views,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          url: data.url,
        };
      });

      // Sort by deletion date (newest first)
      videos.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
      setDeletedVideos(videos);
    } catch (error) {
      console.error('Failed to load deleted videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblacklist = async (video: DeletedVideo) => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setRestoring(video.id);

      const deletedRef = doc(
        db,
        'organizations',
        currentOrgId,
        'projects',
        currentProjectId,
        'deletedVideos',
        video.id
      );

      await deleteDoc(deletedRef);

      // Remove from local state
      setDeletedVideos(prev => prev.filter(v => v.id !== video.id));

      console.log(`✅ Unblacklisted video ${video.platformVideoId}`);
    } catch (error) {
      console.error('Failed to unblacklist video:', error);
      alert('Failed to unblacklist video. Please try again.');
    } finally {
      setRestoring(null);
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'tiktok': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'twitter': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'youtube': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const formatNumber = (num: number | undefined) => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-white/10 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-white/5 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Deleted Videos Blacklist
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Videos you deleted are blacklisted to prevent automatic re-syncing
            </p>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {deletedVideos.length} blacklisted
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <strong>How it works:</strong> Deleted videos are blacklisted to prevent the automatic sync from re-adding them. 
            Click "Restore" to unblacklist a video - it will be re-synced on the next scheduled refresh.
          </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-200 dark:divide-white/10">
        {deletedVideos.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Trash2 className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-1">
              No Blacklisted Videos
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              Videos you delete will appear here and won't be re-synced automatically
            </p>
          </div>
        ) : (
          deletedVideos.map(video => (
            <div
              key={video.id}
              className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  {video.thumbnail ? (
                    <ProxiedImage
                      src={video.thumbnail}
                      alt={video.title || 'Video thumbnail'}
                      className="w-32 h-20 object-cover rounded-lg border border-white/10"
                    />
                  ) : (
                    <div className="w-32 h-20 bg-gray-800 rounded-lg border border-white/10 flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h4 className="text-white font-medium mb-2 line-clamp-2">
                    {video.title || 'Untitled Video'}
                  </h4>

                  {/* Platform and Video ID */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase border ${getPlatformColor(video.platform)}`}>
                      {video.platform}
                    </span>
                    <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {video.platformVideoId}
                    </code>
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </a>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4" />
                      <span>{formatNumber(video.views)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4" />
                      <span>{formatNumber(video.likes)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CommentIcon className="w-4 h-4" />
                      <span>{formatNumber(video.comments)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Share2 className="w-4 h-4" />
                      <span>{formatNumber(video.shares)}</span>
                    </div>
                  </div>

                  {/* Deletion Date */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Deleted {formatDate(video.deletedAt)}</span>
                    <span className="text-gray-600">•</span>
                    <span>
                      {video.deletedAt.toLocaleDateString()} at {video.deletedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Restore Button */}
                <button
                  onClick={() => handleUnblacklist(video)}
                  disabled={restoring === video.id}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove from blacklist and allow re-syncing"
                >
                  {restoring === video.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Restore</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {deletedVideos.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Tip:</strong> Restored videos will be re-synced from the platform during the next scheduled refresh (every 12-48 hours depending on your plan)
          </p>
        </div>
      )}
    </div>
  );
};

export default DeletedVideosManager;

