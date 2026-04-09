import React from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { TrackedAccount } from '../../types/firestore';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  account: TrackedAccount | null;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  account
}) => {
  if (!isOpen || !account) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md border border-border shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-content">Delete Account</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-active rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-content-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-content-muted text-sm mb-3">
            Are you sure you want to delete <span className="text-content font-medium">@{account.username}</span>?
          </p>
          <p className="text-content-muted text-xs">
            This will permanently delete {account.totalVideos || 0} videos and all account data
          </p>
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
            onClick={onConfirm}
            className="px-6 py-2.5 bg-content hover:opacity-90 text-content-inverse rounded-full transition-colors font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

