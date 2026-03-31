import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, Heart, MessageCircle, Share2, Users, Video, ExternalLink } from 'lucide-react';
import { PlatformIcon } from '../components/ui/PlatformIcon';
import { formatNumber } from '../utils/formatters';

interface ShareData {
  project: {
    name: string;
    description: string;
    color: string;
    icon: string;
  };
  summary: {
    totalAccounts: number;
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  };
  platformBreakdown: Record<string, { videos: number; views: number; likes: number }>;
  accounts: Array<{
    id: string;
    username: string;
    displayName: string;
    platform: string;
    profilePicture: string;
    followerCount: number;
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
  }>;
  videos: Array<{
    id: string;
    platform: string;
    videoUrl: string;
    title: string;
    caption: string;
    thumbnail: string;
    uploaderHandle: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    uploadDate: string | null;
  }>;
  generatedAt: string;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur rounded-2xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">{label}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white">{formatNumber(value)}</div>
    </div>
  );
}

export default function PublicSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/public-share?token=${token}`)
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Share link not found');
        }
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading project data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-white mb-2">Link not found</p>
          <p className="text-zinc-400">{error || 'This share link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const { project, summary, accounts, videos } = data;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-900/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {project.icon && <span className="text-2xl">{project.icon}</span>}
            <div>
              <h1 className="text-xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-zinc-400">{project.description}</p>
              )}
            </div>
          </div>
          <a
            href="https://viewtrack.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            Powered by ViewTrack
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Eye} label="Total Views" value={summary.totalViews} color="text-blue-400" />
          <StatCard icon={Heart} label="Total Likes" value={summary.totalLikes} color="text-pink-400" />
          <StatCard icon={MessageCircle} label="Comments" value={summary.totalComments} color="text-green-400" />
          <StatCard icon={Share2} label="Shares" value={summary.totalShares} color="text-purple-400" />
          <StatCard icon={Video} label="Videos" value={summary.totalVideos} color="text-orange-400" />
          <StatCard icon={Users} label="Accounts" value={summary.totalAccounts} color="text-cyan-400" />
        </div>

        {/* Accounts Section */}
        {accounts.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-zinc-200">Tracked Accounts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts
                .sort((a, b) => b.totalViews - a.totalViews)
                .map(account => (
                <div
                  key={account.id}
                  className="bg-zinc-900/60 backdrop-blur rounded-xl border border-white/5 p-4 flex items-center gap-4"
                >
                  {account.profilePicture ? (
                    <img
                      src={account.profilePicture}
                      alt={account.username}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-zinc-400">
                        {account.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PlatformIcon platform={account.platform as any} size="xs" />
                      <span className="font-medium text-white truncate">@{account.username}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatNumber(account.totalViews)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {formatNumber(account.totalLikes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {account.totalVideos}
                      </span>
                      {account.followerCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {formatNumber(account.followerCount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Videos Section */}
        {videos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-zinc-200">
              All Videos <span className="text-zinc-500 font-normal text-sm">({videos.length})</span>
            </h2>
            <div className="bg-zinc-900/60 backdrop-blur rounded-xl border border-white/5 overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr,100px,100px,100px,100px] gap-2 px-4 py-3 border-b border-white/5 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                <span>Video</span>
                <span className="text-right">Views</span>
                <span className="text-right">Likes</span>
                <span className="text-right">Comments</span>
                <span className="text-right">Shares</span>
              </div>

              {videos.map((video, i) => (
                <div
                  key={video.id}
                  className={`grid grid-cols-1 sm:grid-cols-[1fr,100px,100px,100px,100px] gap-2 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors ${
                    i < videos.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  {/* Video info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="w-16 h-10 rounded object-cover flex-shrink-0 bg-zinc-800"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-10 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <Video className="w-4 h-4 text-zinc-600" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={video.platform as any} size="xs" />
                        <span className="text-sm font-medium text-white truncate">
                          {video.title || video.caption?.slice(0, 60) || video.uploaderHandle || 'Untitled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {video.uploaderHandle && (
                          <span className="text-xs text-zinc-500">@{video.uploaderHandle}</span>
                        )}
                        {video.videoUrl && (
                          <a
                            href={video.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats - mobile layout */}
                  <div className="flex sm:hidden gap-4 text-xs text-zinc-400 mt-1 ml-[76px]">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(video.views)}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(video.likes)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatNumber(video.comments)}</span>
                    <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{formatNumber(video.shares)}</span>
                  </div>

                  {/* Stats - desktop layout */}
                  <span className="hidden sm:block text-sm text-right text-zinc-300">{formatNumber(video.views)}</span>
                  <span className="hidden sm:block text-sm text-right text-zinc-400">{formatNumber(video.likes)}</span>
                  <span className="hidden sm:block text-sm text-right text-zinc-400">{formatNumber(video.comments)}</span>
                  <span className="hidden sm:block text-sm text-right text-zinc-400">{formatNumber(video.shares)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-zinc-600 pt-8 pb-4">
          Data generated {new Date(data.generatedAt).toLocaleString()} &middot;{' '}
          <a
            href="https://viewtrack.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ViewTrack
          </a>
        </footer>
      </main>
    </div>
  );
}
