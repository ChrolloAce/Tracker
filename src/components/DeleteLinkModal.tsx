import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import FirestoreDataService from '../services/FirestoreDataService';
import { useAuth } from '../contexts/AuthContext';

interface DeleteLinkModalProps {
  isOpen: boolean;
  link: any;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}

const DeleteLinkModal: React.FC<DeleteLinkModalProps> = ({ isOpen, link, onClose, onDeleted }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !link) return null;

  const handleConfirm = async () => {
    if (!currentOrgId || !currentProjectId) {
      setError('Missing organization or project context. Try refreshing the page.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    // Step 1: delete. If this fails, show the error and keep the modal open
    // so the user can see what went wrong and retry.
    try {
      await FirestoreDataService.deleteLink(currentOrgId, currentProjectId, link.id);
    } catch (err) {
      console.error('Failed to delete link:', err);
      const raw = (err as Error)?.message || 'Failed to delete link';
      const isPermissionError = /permission|insufficient|PERMISSION_DENIED/i.test(raw);
      setError(
        isPermissionError
          ? "You don't have permission to delete this link. Ask an org admin, or have them change your role."
          : raw
      );
      setIsDeleting(false);
      return;
    }

    // Step 2: delete succeeded — refresh parent list, then close.
    // If the refresh fails we don't want to show it as a delete error
    // (the delete actually worked), so we swallow it with a console.warn.
    try {
      await onDeleted();
    } catch (refreshErr) {
      console.warn('Post-delete refresh failed (delete itself succeeded):', refreshErr);
    }

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-2xl w-full max-w-md border border-border shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-content">Delete Link</h2>
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
          <p className="text-content-secondary text-sm mb-3">
            Are you sure you want to delete <span className="text-content font-medium">{link.title}</span>?
          </p>
          <p className="text-content-muted text-xs">
            This will permanently delete all click data ({link.totalClicks || 0} clicks)
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 bg-surface-secondary text-content border border-border rounded-lg font-semibold shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 bg-red-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#b91c1c] hover:shadow-[0_1px_0_0_#b91c1c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteLinkModal;
