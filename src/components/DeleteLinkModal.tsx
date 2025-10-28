import React, { useState } from 'react';
import { AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { TrackedLink } from '../types/firestore';

interface DeleteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  link: TrackedLink;
}

/**
 * Modal for confirming link deletion with a text confirmation requirement
 * Similar to account deletion modal
 */
const DeleteLinkModal: React.FC<DeleteLinkModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  link
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (confirmText !== link.shortCode) return;
    
    setIsDeleting(true);
    try {
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error('Failed to delete link:', error);
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText('');
    onClose();
  };

  const isConfirmValid = confirmText === link.shortCode;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-300 dark:border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Delete Tracked Link</h2>
          <p className="text-gray-400">
            This action cannot be undone. All analytics and click data for this link will be permanently deleted.
          </p>
        </div>

        <div className="space-y-4">
          {/* Link Info Display */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <LinkIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{link.title}</div>
                <div className="text-sm text-gray-400 font-mono">/{link.shortCode}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              <div className="truncate mb-1">
                <span className="text-gray-500">Destination:</span> {link.originalUrl}
              </div>
              <div>
                <span className="text-gray-500">Total Clicks:</span> {link.totalClicks || 0} 
                {link.totalClicks > 0 && <span className="text-red-400 ml-2">⚠️ Click data will be lost</span>}
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type <span className="font-bold text-white font-mono">{link.shortCode}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Enter short code to confirm"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
              autoFocus
              disabled={isDeleting}
            />
          </div>

          {/* Warning Message */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                This will permanently delete:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>The tracked link</li>
                  <li>All click analytics data</li>
                  <li>All associated records</li>
                </ul>
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmValid || isDeleting}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Link'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteLinkModal;

