import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { TrackedLink } from '../types/firestore';

interface DeleteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  link: TrackedLink;
}

/**
 * Simple confirmation modal for link deletion
 */
const DeleteLinkModal: React.FC<DeleteLinkModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  link
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Failed to delete link:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Delete Link</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-400 text-sm mb-3">
            Are you sure you want to delete <span className="text-white font-medium">{link.title}</span>?
          </p>
          <p className="text-gray-500 text-xs">
            This will permanently delete all click data ({link.totalClicks || 0} clicks)
            </p>
          </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
            onClick={onClose}
              disabled={isDeleting}
            className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
            disabled={isDeleting}
            className="px-6 py-2.5 bg-white hover:bg-gray-100 text-black rounded-full transition-colors font-medium disabled:opacity-50"
            >
            {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteLinkModal;

