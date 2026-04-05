import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bookmark,
  FolderPlus,
  Folder,
  Trash2,
  Pencil,
  Loader2,
  Eye,
  Heart,
  MessageCircle,
  Play,
  MoreVertical,
  ArrowLeft,
  ArrowRight,
  Plus,
  Share2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SavedViralService, { SavedFolder, SavedViralVideo } from '../services/SavedViralService';
import { ViralVideo } from '../types/viralContent';
import ViralVideoDetailPanel from '../components/viral/ViralVideoDetailPanel';

// ─── Helpers ─────────────────────────────────────────────

function formatNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// ─── Main Page ───────────────────────────────────────────

const SavedViralPage: React.FC = () => {
  const { currentOrgId } = useAuth();

  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedViralVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<ViralVideo | null>(null);

  // Navigation: null = folder grid view, string = inside a folder
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  // Folder management
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [contextMenuVideoId, setContextMenuVideoId] = useState<string | null>(null);
  const [contextMenuFolderId, setContextMenuFolderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [f, v] = await Promise.all([
        SavedViralService.getFolders(currentOrgId),
        SavedViralService.getSavedVideos(currentOrgId),
      ]);
      setFolders(f);
      setSavedVideos(v);
    } catch (err) {
      console.error('Failed to load saved content:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group videos by folder
  const videosByFolder = useMemo(() => {
    const map: Record<string, SavedViralVideo[]> = { default: [] };
    folders.forEach((f) => { map[f.id] = []; });
    savedVideos.forEach((v) => {
      const fid = v.folderId || 'default';
      if (!map[fid]) map[fid] = [];
      map[fid].push(v);
    });
    return map;
  }, [savedVideos, folders]);

  // Get thumbnails for a folder (up to 4)
  const getFolderThumbnails = (folderId: string): string[] => {
    const vids = videosByFolder[folderId] || [];
    return vids
      .slice(0, 4)
      .map((v) => v.video?.thumbnail)
      .filter(Boolean) as string[];
  };

  // Videos in the currently open folder
  const currentFolderVideos = useMemo(() => {
    if (openFolderId === null) return [];
    return videosByFolder[openFolderId] || [];
  }, [openFolderId, videosByFolder]);

  const currentFolderName = useMemo(() => {
    if (openFolderId === 'default') return 'Unsorted';
    return folders.find((f) => f.id === openFolderId)?.name || '';
  }, [openFolderId, folders]);

  // ── Folder actions ────────────────────────────────────

  const handleCreateFolder = async (name?: string) => {
    const folderName = (name || newFolderName).trim();
    if (!currentOrgId || !folderName) {
      setCreatingFolder(false);
      setNewFolderName('');
      return;
    }
    try {
      await SavedViralService.createFolder(currentOrgId, folderName);
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
    setNewFolderName('');
    setCreatingFolder(false);
    loadData();
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!currentOrgId || !editFolderName.trim()) return;
    await SavedViralService.renameFolder(currentOrgId, folderId, editFolderName.trim());
    setEditingFolderId(null);
    setEditFolderName('');
    loadData();
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!currentOrgId) return;
    if (!confirm('Delete this folder? Videos will be moved to Unsorted.')) return;
    await SavedViralService.deleteFolder(currentOrgId, folderId);
    setContextMenuFolderId(null);
    if (openFolderId === folderId) setOpenFolderId(null);
    loadData();
  };

  const handleUnsaveVideo = async (videoId: string) => {
    if (!currentOrgId) return;
    await SavedViralService.unsaveVideo(currentOrgId, videoId);
    setContextMenuVideoId(null);
    loadData();
  };

  const handleMoveToFolder = async (videoId: string, folderId: string) => {
    if (!currentOrgId) return;
    await SavedViralService.moveToFolder(currentOrgId, videoId, folderId);
    setContextMenuVideoId(null);
    loadData();
  };

  const handleShareFolder = async (folderId: string, folderName: string) => {
    if (!currentOrgId) return;
    setContextMenuFolderId(null);
    try {
      // In dev, API runs on 3001
      const apiBase = window.location.port === '3000' ? 'http://localhost:3001' : '';
      const resp = await fetch(`${apiBase}/api/create-folder-share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await (await import('firebase/auth')).getAuth().currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({ orgId: currentOrgId, folderId, folderName }),
      });
      const data = await resp.json();
      if (data.token) {
        // Build share URL using current frontend origin
        const shareUrl = `${window.location.origin}/shared/${data.token}`;
        await navigator.clipboard.writeText(shareUrl);
        showToast('Share link copied to clipboard');
      }
    } catch (err) {
      console.error('Failed to share folder:', err);
      showToast('Failed to create share link');
    }
  };

  // ── Loading ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  // ── Inside a folder ───────────────────────────────────

  if (openFolderId !== null) {
    return (
      <div className="space-y-5">
        {/* Breadcrumb / Back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpenFolderId(null)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Folder className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <h2 className="text-lg font-semibold text-white truncate">{currentFolderName}</h2>
            <span className="text-xs text-gray-500">{currentFolderVideos.length} video{currentFolderVideos.length !== 1 ? 's' : ''}</span>
          </div>
          {openFolderId !== 'default' && (
            <button
              onClick={() => handleShareFolder(openFolderId!, currentFolderName)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          )}
        </div>

        {currentFolderVideos.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-16 text-center">
            <Bookmark className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h3 className="text-base font-medium text-white mb-1">No videos yet</h3>
            <p className="text-gray-500 text-sm">Bookmark viral videos and save them to this folder.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {currentFolderVideos.map((saved) => (
              <VideoCard
                key={saved.id}
                saved={saved}
                folders={folders}
                currentFolderId={openFolderId}
                showContextMenu={contextMenuVideoId === saved.id}
                onToggleContextMenu={() =>
                  setContextMenuVideoId(contextMenuVideoId === saved.id ? null : saved.id)
                }
                onOpenDetail={() => setSelectedVideo(saved.video)}
                onUnsave={() => handleUnsaveVideo(saved.id)}
                onMoveToFolder={(fid) => handleMoveToFolder(saved.id, fid)}
              />
            ))}
          </div>
        )}

        {selectedVideo && (
          <ViralVideoDetailPanel video={selectedVideo} onClose={() => setSelectedVideo(null)} />
        )}

        {contextMenuVideoId && (
          <div className="fixed inset-0 z-40" onClick={() => setContextMenuVideoId(null)} />
        )}

        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
            <div className="px-4 py-2.5 bg-white/10 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl">
              <span className="text-sm font-medium text-white">{toast}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Folder grid view ──────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Folder Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* Unsorted folder (always first) */}
        <FolderCard
          id="default"
          name="Unsorted"
          thumbnails={getFolderThumbnails('default')}
          count={videosByFolder.default?.length || 0}
          onOpen={() => setOpenFolderId('default')}
          showContextMenu={contextMenuFolderId === 'default'}
          onContextMenu={() =>
            setContextMenuFolderId(contextMenuFolderId === 'default' ? null : 'default')
          }
          onShare={() => handleShareFolder('default', 'Unsorted')}
        />

        {/* Custom folders */}
        {folders.map((f) =>
          editingFolderId === f.id ? (
            <div
              key={f.id}
              className="rounded-2xl bg-white/[0.03] border border-white/20 p-4 flex flex-col items-center justify-center"
            >
              <input
                autoFocus
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleRenameFolder(f.id); }
                  if (e.key === 'Escape') setEditingFolderId(null);
                }}
                onBlur={() => { if (editFolderName.trim()) handleRenameFolder(f.id); else setEditingFolderId(null); }}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white text-center placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          ) : (
            <FolderCard
              key={f.id}
              id={f.id}
              name={f.name}
              thumbnails={getFolderThumbnails(f.id)}
              count={videosByFolder[f.id]?.length || 0}
              onOpen={() => setOpenFolderId(f.id)}
              showContextMenu={contextMenuFolderId === f.id}
              onContextMenu={() =>
                setContextMenuFolderId(contextMenuFolderId === f.id ? null : f.id)
              }
              onRename={() => { setEditingFolderId(f.id); setEditFolderName(f.name); setContextMenuFolderId(null); }}
              onShare={() => handleShareFolder(f.id, f.name)}
              onDelete={() => handleDeleteFolder(f.id)}
            />
          )
        )}

        {/* New Folder Card */}
        {creatingFolder ? (
          <div className="rounded-2xl bg-white/[0.03] border border-dashed border-blue-500/30 p-4 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FolderPlus className="w-6 h-6 text-blue-400" />
            </div>
            <input
              ref={newFolderRef}
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateFolder(newFolderName);
                }
                if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) handleCreateFolder(val);
                else { setCreatingFolder(false); setNewFolderName(''); }
              }}
              placeholder="Folder name..."
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white text-center placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        ) : (
          <button
            onClick={() => setCreatingFolder(true)}
            className="group rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-white/25 p-4 flex flex-col items-center justify-center gap-3 transition-all hover:bg-white/[0.04] min-h-[200px]"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-all">
              <Plus className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm text-gray-500 group-hover:text-gray-300 font-medium transition-colors">New Folder</span>
          </button>
        )}
      </div>

      {contextMenuFolderId && (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenuFolderId(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="px-4 py-2.5 bg-white/10 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl">
            <span className="text-sm font-medium text-white">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Folder Card (Windows-style with 4-thumbnail grid) ──

const FolderCard: React.FC<{
  id: string;
  name: string;
  thumbnails: string[];
  count: number;
  onOpen: () => void;
  showContextMenu: boolean;
  onContextMenu: (() => void) | null;
  onRename?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
}> = ({ name, thumbnails, count, onOpen, showContextMenu, onContextMenu, onRename, onShare, onDelete }) => (
  <div className="group relative">
    <button
      onClick={onOpen}
      className="w-full rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 overflow-hidden transition-all hover:bg-white/[0.05] text-left"
    >
      {/* Thumbnail grid */}
      <div className="aspect-square p-2">
        {thumbnails.length > 0 ? (
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 overflow-hidden">
                {thumbnails[i] ? (
                  <img
                    src={thumbnails[i]}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-white/[0.03]" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full rounded-xl bg-white/[0.03] flex items-center justify-center">
            <Folder className="w-12 h-12 text-gray-700" />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="px-3 pb-3">
        <p className="text-sm font-medium text-white truncate">{name}</p>
        <p className="text-xs text-gray-500">{count} video{count !== 1 ? 's' : ''}</p>
      </div>
    </button>

    {/* Context menu trigger — always visible on hover */}
    {onContextMenu && (
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onContextMenu(); }}
        className="absolute top-4 right-4 p-2 rounded-lg bg-black/70 backdrop-blur-sm text-white hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-all z-20"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    )}

    {/* Context menu */}
    {showContextMenu && (
      <div className="absolute top-12 right-3 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
        {onRename && (
          <button
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Pencil className="w-3.5 h-3.5" /> Rename
          </button>
        )}
        {onShare && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="w-full px-4 py-2.5 text-left text-sm text-blue-400 hover:bg-blue-500/10 transition-colors flex items-center gap-2 border-t border-white/5"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-t border-white/5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>
    )}
  </div>
);

// ─── Video Card (inside folder view) ────────────────────

const VideoCard: React.FC<{
  saved: SavedViralVideo;
  folders: SavedFolder[];
  currentFolderId: string;
  showContextMenu: boolean;
  onToggleContextMenu: () => void;
  onOpenDetail: () => void;
  onUnsave: () => void;
  onMoveToFolder: (folderId: string) => void;
}> = ({ saved, folders, currentFolderId, showContextMenu, onToggleContextMenu, onOpenDetail, onUnsave, onMoveToFolder }) => {
  const video = saved.video;
  if (!video) return null;

  // Build move-to options excluding the current folder
  const moveOptions = [
    { id: 'default', name: 'Unsorted' },
    ...folders.map((f) => ({ id: f.id, name: f.name })),
  ].filter((o) => o.id !== currentFolderId);

  return (
    <div className="group relative bg-black rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 transition-all">
      <div className="cursor-pointer" onClick={onOpenDetail}>
        <div className="relative aspect-[9/16]">
          <img loading="lazy" src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 pointer-events-none" />

          <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-1.5">
            <Play className="w-3 h-3 text-white" fill="currentColor" />
            <span className="text-[11px] text-white font-medium">{video.contentType === 'slideshow' ? 'Slideshow' : 'Video'}</span>
          </div>

          <div className="absolute right-1.5 bottom-24 flex flex-col items-center gap-2.5">
            <MiniStat icon={<Eye className="w-3.5 h-3.5" />} value={formatNumber(video.views)} />
            <MiniStat icon={<Heart className="w-3.5 h-3.5" />} value={formatNumber(video.likes)} />
            <MiniStat icon={<MessageCircle className="w-3.5 h-3.5" />} value={formatNumber(video.comments)} />
          </div>

          <div className="absolute bottom-0 left-0 right-10 p-3">
            <span className="text-[13px] font-semibold text-white drop-shadow-lg truncate block">@{video.uploaderHandle}</span>
            {video.description && (
              <p className="text-[12px] text-white/80 line-clamp-2 drop-shadow-lg leading-relaxed mt-1">{video.description}</p>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleContextMenu(); }}
        className="absolute top-3 right-3 p-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {showContextMenu && (
        <div className="absolute top-10 right-3 w-44 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <button
            onClick={(e) => { e.stopPropagation(); onUnsave(); }}
            className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
          {moveOptions.length > 0 && (
            <>
              <div className="border-t border-white/5 px-4 py-1.5">
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Move to</span>
              </div>
              {moveOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={(e) => { e.stopPropagation(); onMoveToFolder(o.id); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <ArrowRight className="w-3 h-3" /> {o.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex flex-col items-center gap-0">
    <div className="text-white drop-shadow-lg">{icon}</div>
    <span className="text-[9px] font-semibold text-white drop-shadow-lg">{value}</span>
  </div>
);

export default SavedViralPage;
