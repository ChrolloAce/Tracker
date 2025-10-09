import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationName: string;
  organizationId: string;
  onConfirmDelete: (organizationId: string) => Promise<void>;
}

/**
 * DeleteOrganizationModal - Confirmation modal for deleting an organization
 * Requires user to type "I want to delete {organization name}" to confirm
 */
const DeleteOrganizationModal: React.FC<DeleteOrganizationModalProps> = ({
  isOpen,
  onClose,
  organizationName,
  organizationId,
  onConfirmDelete
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const expectedText = `I want to delete ${organizationName}`;
  const isConfirmed = confirmationText === expectedText;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    
    setIsDeleting(true);
    try {
      await onConfirmDelete(organizationId);
      onClose();
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert('Failed to delete organization. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#151515] rounded-xl shadow-2xl w-full max-w-lg animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Delete Organization</h2>
              <p className="text-sm text-[#A1A1AA]">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            disabled={isDeleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Message */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-400">
                  This will permanently delete:
                </p>
                <ul className="text-sm text-red-300/80 space-y-1 list-disc list-inside">
                  <li>Organization "{organizationName}"</li>
                  <li>All projects within this organization</li>
                  <li>All tracked accounts and their videos</li>
                  <li>All tracked links and analytics</li>
                  <li>All team members and permissions</li>
                  <li>All snapshots and historical data</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              To confirm, type: <span className="text-red-400 font-mono">{expectedText}</span>
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={expectedText}
              className="w-full px-4 py-3 bg-[#1A1A1A] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
              disabled={isDeleting}
              autoFocus
            />
            {confirmationText && !isConfirmed && (
              <p className="text-xs text-red-400">
                Text doesn't match. Please type exactly as shown above.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-all font-medium"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              isConfirmed && !isDeleting
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-red-500/20 text-red-400/50 cursor-not-allowed'
            }`}
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Organization
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteOrganizationModal;

