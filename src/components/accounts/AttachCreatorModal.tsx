import React, { useState } from 'react';
import { Users, AlertCircle } from 'lucide-react';
import { TrackedAccount, Creator } from '../../types/firestore';
import CreatorLinksService from '../../services/CreatorLinksService';

export interface AttachCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccount: TrackedAccount | null;
  creators: Creator[];
  orgId: string;
  projectId: string;
  userId: string;
  onSuccess: (creatorName: string) => void;
}

export const AttachCreatorModal: React.FC<AttachCreatorModalProps> = ({
  isOpen,
  onClose,
  selectedAccount,
  creators,
  orgId,
  projectId,
  userId,
  onSuccess
}) => {
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !selectedAccount) return null;

  const handleAttach = async () => {
    if (selectedCreatorId && userId && orgId && projectId) {
      try {
        setIsSubmitting(true);
        await CreatorLinksService.linkCreatorToAccounts(
          orgId,
          projectId,
          selectedCreatorId,
          [selectedAccount.id],
          userId
        );
        
        // Reload creator names to update UI
        const creatorName = await CreatorLinksService.getCreatorNameForAccount(
          orgId,
          projectId,
          selectedAccount.id
        );
        
        if (creatorName) {
          onSuccess(creatorName);
        }
        
        onClose();
        setSelectedCreatorId('');
      } catch (error) {
        console.error('Failed to attach account to creator:', error);
        alert('Failed to attach account. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-300 dark:border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Attach to Creator</h2>
          <p className="text-gray-400">
            Link @{selectedAccount.username} to a creator profile
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center gap-3">
              {selectedAccount.profilePicture ? (
                <img 
                  src={selectedAccount.profilePicture} 
                  alt={selectedAccount.username}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-semibold text-white">@{selectedAccount.username}</div>
                <div className="text-sm text-gray-400 capitalize">{selectedAccount.platform}</div>
              </div>
            </div>
          </div>

          {creators.length > 0 ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Creator
                </label>
                <select
                  value={selectedCreatorId}
                  onChange={(e) => setSelectedCreatorId(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Choose a creator...</option>
                  {creators.map((creator) => (
                    <option key={creator.id} value={creator.id}>
                      {creator.displayName} ({creator.email})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Link this account to a creator for better organization and tracking
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onClose();
                    setSelectedCreatorId('');
                  }}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAttach}
                  disabled={!selectedCreatorId || isSubmitting}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
                >
                  {isSubmitting ? 'Attaching...' : 'Attach Account'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-zinc-800/30 rounded-lg p-6 border border-zinc-700/50 text-center">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-gray-900 dark:text-white" />
                </div>
                <h3 className="text-white font-medium mb-2">No Creators Found</h3>
                <p className="text-sm text-gray-400 mb-4">
                  You need to create a creator profile first before linking accounts
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-sm text-white/60 border border-white/20">
                  <AlertCircle className="w-4 h-4" />
                  Go to <span className="font-semibold">Creators</span> tab to create one
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

