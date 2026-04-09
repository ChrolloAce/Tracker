import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookMarked,
  Users,
  Calendar,
  Play,
  Tag,
  Flame,
  Copy,
  Check,
  FolderPlus,
  ChevronDown,
} from 'lucide-react';
import { ViralVideo } from '../../types/viralContent';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import SavedViralService, { SavedFolder } from '../../services/SavedViralService';

interface ViralVideoDetailPanelProps {
  video: ViralVideo;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────

function getEmbedUrl(url: string, platform: string): string | null {
  try {
    if (platform === 'tiktok' || url.includes('tiktok.com')) {
      const match = url.match(/video\/(\d+)/);
      if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`;
    }
    if (platform === 'instagram' || url.includes('instagram.com')) {
      const postMatch = url.match(/instagram\.com\/(p|reel|reels)\/([^\/\?]+)/);
      if (postMatch) {
        const type = postMatch[1] === 'reels' ? 'reel' : postMatch[1];
        return `https://www.instagram.com/${type}/${postMatch[2]}/embed`;
      }
    }
    if (platform === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
      const shortsMatch = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (youtuMatch) return `https://www.youtube.com/embed/${youtuMatch[1]}`;
      try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}`;
      } catch {}
    }
  } catch {}
  return null;
}

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(val: Timestamp | string | undefined): string {
  if (!val) return '';
  try {
    const date = val instanceof Timestamp ? val.toDate() : new Date(val as string);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function getPlatformName(platform: string): string {
  switch (platform) {
    case 'tiktok': return 'TikTok';
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    default: return platform;
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case 'tiktok': return '#ff0050';
    case 'instagram': return '#E1306C';
    case 'youtube': return '#FF0000';
    default: return '#888';
  }
}

// ─── Component ───────────────────────────────────────────

const ViralVideoDetailPanel: React.FC<ViralVideoDetailPanelProps> = ({ video, onClose }) => {
  const { currentOrgId } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const embedUrl = useMemo(() => getEmbedUrl(video.url, video.platform), [video.url, video.platform]);

  // Check if video is saved
  useEffect(() => {
    if (!currentOrgId) return;
    SavedViralService.isVideoSaved(currentOrgId, video.id).then(setIsSaved);
  }, [currentOrgId, video.id]);

  // Load folders eagerly
  useEffect(() => {
    if (!currentOrgId) return;
    SavedViralService.getFolders(currentOrgId).then(setFolders);
  }, [currentOrgId]);

  const handleToggleSave = useCallback(async () => {
    if (!currentOrgId || saving) return;
    setSaving(true);
    try {
      if (isSaved) {
        await SavedViralService.unsaveVideo(currentOrgId, video.id);
        setIsSaved(false);
        showToast('Removed from saved');
      } else {
        await SavedViralService.saveVideo(currentOrgId, video);
        setIsSaved(true);
        showToast('Saved successfully');
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
      showToast('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [currentOrgId, video, isSaved, saving, showToast]);

  const handleSaveToFolder = useCallback(async (folderId: string) => {
    if (!currentOrgId || saving) return;
    setSaving(true);
    try {
      await SavedViralService.saveVideo(currentOrgId, video, folderId);
      setIsSaved(true);
      setShowFolderPicker(false);
      const folderName = folderId === 'default' ? 'Unsorted' : folders.find((f) => f.id === folderId)?.name || 'folder';
      showToast(`Saved to ${folderName}`);
    } catch (err) {
      console.error('Failed to save to folder:', err);
      showToast('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [currentOrgId, video, saving, folders, showToast]);

  const handleCopyLink = useCallback(async () => {
    if (!video.url) return;
    try {
      await navigator.clipboard.writeText(video.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [video.url]);

  // Calculate virality factor
  const viralityFactor = useMemo(() => {
    if (!video.views || video.views === 0) return 0;
    const totalEngagement = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
    return (totalEngagement / video.views) * 100;
  }, [video.views, video.likes, video.comments, video.shares]);

  // Extract hashtags from description
  const hashtags = useMemo(() => {
    const matches = (video.description || '').match(/#[\w\u00C0-\u017F]+/g) || [];
    return [...new Set(matches)];
  }, [video.description]);

  const cleanDescription = useMemo(() => {
    return (video.description || '').replace(/#[\w\u00C0-\u017F]+/g, '').trim();
  }, [video.description]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-3"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl border border-border w-full max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden"
        style={{ backgroundColor: 'var(--surface-secondary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {/* Platform badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-content text-xs font-medium"
              style={{ backgroundColor: `${getPlatformColor(video.platform)}20`, border: `1px solid ${getPlatformColor(video.platform)}40` }}
            >
              <span style={{ color: getPlatformColor(video.platform) }}>{getPlatformName(video.platform)}</span>
            </div>
            <span className="text-sm font-semibold text-content truncate">@{video.uploaderHandle}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="p-2 text-content-secondary hover:text-content bg-surface-hover hover:bg-surface-active rounded-lg transition-all border border-border-subtle hover:border-border-strong"
              title="Copy link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Open on platform */}
            {video.url && (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-content-secondary hover:text-blue-400 bg-surface-hover hover:bg-blue-500/10 rounded-lg transition-all border border-border-subtle hover:border-blue-500/20"
                title={`Open on ${getPlatformName(video.platform)}`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Bookmark */}
            <div className="relative">
              <div className="flex items-center">
                <button
                  onClick={handleToggleSave}
                  disabled={saving}
                  className={`p-2 rounded-l-lg transition-all border border-r-0 ${
                    isSaved
                      ? 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20'
                      : 'text-content-secondary hover:text-blue-400 bg-surface-hover hover:bg-blue-500/10 border-border-subtle hover:border-blue-500/20'
                  }`}
                  title={isSaved ? 'Remove bookmark' : 'Bookmark'}
                >
                  {isSaved ? <BookMarked className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowFolderPicker(!showFolderPicker)}
                  className={`p-2 rounded-r-lg transition-all border ${
                    isSaved
                      ? 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20'
                      : 'text-content-secondary hover:text-blue-400 bg-surface-hover hover:bg-blue-500/10 border-border-subtle hover:border-blue-500/20'
                  }`}
                  title="Save to folder"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Folder picker dropdown */}
              {showFolderPicker && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface-secondary border border-border rounded-xl shadow-2xl z-[70] overflow-hidden">
                  <button
                    onClick={() => handleSaveToFolder('default')}
                    className="w-full px-4 py-2.5 text-left text-sm text-content hover:bg-surface-hover transition-colors"
                  >
                    Unsorted
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSaveToFolder(f.id)}
                      className="w-full px-4 py-2.5 text-left text-sm text-content hover:bg-surface-hover transition-colors border-t border-border-subtle"
                    >
                      {f.name}
                    </button>
                  ))}
                  <div className="border-t border-border">
                    <button
                      onClick={async () => {
                        const name = prompt('Folder name:');
                        if (!name || !currentOrgId) return;
                        const id = await SavedViralService.createFolder(currentOrgId, name);
                        await handleSaveToFolder(id);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-content-muted hover:text-content hover:bg-surface-hover transition-colors flex items-center gap-2"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      New Folder
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-content-secondary hover:text-content bg-surface-hover hover:bg-surface-active rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-0">
          {/* Left: Video Embed / Thumbnail */}
          <div className="p-4 border-r border-border-subtle">
            <div className="relative rounded-xl border border-border-subtle shadow-lg p-3 overflow-hidden" style={{ backgroundColor: 'var(--surface-tertiary)' }}>
              <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden border border-border">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <img
                      loading="lazy"
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center group/play"
                      >
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover/play:bg-white/30 transition-all group-hover/play:scale-110">
                          <Play className="w-7 h-7 text-white ml-0.5" fill="currentColor" />
                        </div>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Mini stats under embed */}
              <div className="flex items-center justify-between mt-3 px-1">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs text-content-secondary">Virality</span>
                </div>
                <span className="text-xs font-semibold text-content">{viralityFactor.toFixed(1)}%</span>
              </div>
            </div>

            {/* View on platform button */}
            {video.url && (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-surface-hover hover:bg-surface-active rounded-xl transition-all text-sm text-content-secondary hover:text-content font-medium border border-border-subtle hover:border-border"
              >
                <ExternalLink className="w-4 h-4" />
                View on {getPlatformName(video.platform)}
              </a>
            )}
          </div>

          {/* Right: Details */}
          <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
            {/* Stats Grid */}
            <div className="grid grid-cols-5 gap-3">
              <StatCard icon={<Eye className="w-5 h-5" />} label="Views" value={formatNumber(video.views)} color="#B47CFF" />
              <StatCard icon={<Heart className="w-5 h-5" />} label="Likes" value={formatNumber(video.likes)} color="#FF6B9D" />
              <StatCard icon={<MessageCircle className="w-5 h-5" />} label="Comments" value={formatNumber(video.comments)} color="#4ECDC4" />
              <StatCard icon={<Share2 className="w-5 h-5" />} label="Shares" value={formatNumber(video.shares)} color="#FFE66D" />
              <StatCard icon={<Bookmark className="w-5 h-5" />} label="Saves" value={formatNumber(video.saves)} color="#FF8A5B" />
            </div>

            {/* Creator Details */}
            <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
              <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-3">Creator Details</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-content-muted" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content truncate">@{video.uploaderHandle}</p>
                  {video.followerCount > 0 && (
                    <p className="text-xs text-content-muted">{formatNumber(video.followerCount)} followers</p>
                  )}
                </div>
              </div>
            </div>

            {/* Video Caption */}
            {(cleanDescription || video.title) && (
              <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-3">Video Caption</h3>
                <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-wrap">
                  {cleanDescription || video.title}
                </p>
              </div>
            )}

            {/* Hashtags */}
            {hashtags.length > 0 && (
              <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-3">Hashtags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-surface-hover rounded-lg text-xs text-content-secondary font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-3">
              {/* Category */}
              {video.category && (
                <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                  <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">Category</h3>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-content-muted" />
                    <span className="text-sm text-content-secondary">{video.category}</span>
                  </div>
                </div>
              )}

              {/* Posted Date */}
              {video.uploadDate && (
                <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                  <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">Posted</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-content-muted" />
                    <span className="text-sm text-content-secondary">{formatDate(video.uploadDate)}</span>
                  </div>
                </div>
              )}

              {/* Content Type */}
              <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">Content Type</h3>
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-content-muted" />
                  <span className="text-sm text-content-secondary capitalize">{video.contentType || 'Video'}</span>
                </div>
              </div>

              {/* Engagement Rate */}
              <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">Engagement Rate</h3>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400/60" />
                  <span className="text-sm text-content-secondary">{viralityFactor.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-4">
                <h3 className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {video.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-surface-hover rounded-lg text-xs text-content-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click-away for folder picker — must be below dropdown z-index */}
      {showFolderPicker && (
        <div className="fixed inset-0 z-[61]" onClick={() => setShowFolderPicker(false)} />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="px-4 py-2.5 bg-surface-hover backdrop-blur-xl border border-border-strong rounded-xl shadow-2xl">
            <span className="text-sm font-medium text-content">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Stat Card ──────────────────────────────────────────

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({
  icon,
  label,
  value,
  color,
}) => (
  <div className="rounded-xl bg-surface-tertiary border border-border-subtle p-3 flex flex-col items-center gap-1.5">
    <div style={{ color: `${color}80` }}>{icon}</div>
    <span className="text-lg font-bold text-content">{value}</span>
    <span className="text-[10px] text-content-muted uppercase tracking-wider">{label}</span>
  </div>
);

export default ViralVideoDetailPanel;
