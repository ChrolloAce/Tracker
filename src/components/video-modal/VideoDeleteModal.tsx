import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';

interface VideoDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with `blacklist=true` when the user opts to also blacklist the
   *  URL so the next sync run skips re-importing it. */
  onConfirm: (opts: { blacklist: boolean }) => void;
  videoTitle: string;
}

export const VideoDeleteModal: React.FC<VideoDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  videoTitle
}) => {
  const [blacklist, setBlacklist] = useState(false);

  // Reset on close so the next open starts unchecked.
  useEffect(() => {
    if (!isOpen) setBlacklist(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    // stopPropagation on the backdrop because React portals still bubble
    // synthetic events through the React tree — without this, clicks
    // inside the modal reach VideoAnalyticsModal's outer onClick={onClose}
    // and dismiss the parent (which then hides this modal too).
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-surface rounded-2xl w-full max-w-md border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-content">Delete Video</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-content-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-content-muted text-sm mb-3">
            Are you sure you want to delete this video?
          </p>
          <p className="text-content-muted text-xs mb-4">
            <span className="text-content font-medium">
              {videoTitle}
            </span>
          </p>
          <p className="text-content-muted text-xs mb-4">
            This action cannot be undone. The video will be permanently removed from your account.
          </p>

          {/* Blacklist checkbox — when ticked, the URL is added to the org's
              blacklist so the next sync run won't re-import it. */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface-secondary cursor-pointer hover:bg-surface-tertiary/40 transition-colors">
            <input
              type="checkbox"
              checked={blacklist}
              onChange={e => setBlacklist(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-500"
            />
            <span className="text-xs text-content">
              <span className="font-semibold">Also blacklist this URL</span>
              <span className="block text-content-muted mt-0.5">
                Prevents this video from being re-imported on future automatic syncs.
              </span>
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-content-muted hover:text-content hover:bg-surface-hover rounded-full transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ blacklist })}
            className="px-6 py-2.5 bg-red-500 text-white rounded-full font-semibold shadow-[0_2px_0_0_#b91c1c] hover:shadow-[0_1px_0_0_#b91c1c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
          >
            {blacklist ? 'Delete & Blacklist' : 'Delete Video'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

