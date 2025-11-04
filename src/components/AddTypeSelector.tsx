import { Video, UserPlus } from 'lucide-react';
import { Modal } from './ui/Modal';

interface AddTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: 'video' | 'account') => void;
}

export function AddTypeSelector({ isOpen, onClose, onSelectType }: AddTypeSelectorProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What would you like to track?"
    >
      <div className="space-y-3">
        <button
          onClick={() => {
            onSelectType('video');
            onClose();
          }}
          className="w-full p-6 rounded-lg border-2 border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-800 hover:bg-gray-700 dark:hover:bg-gray-700 hover:border-gray-600 dark:hover:border-gray-600 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
              <Video className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-white mb-1">Track Video</h3>
              <p className="text-sm text-gray-400">
                Add individual videos from TikTok, Instagram, YouTube, or Twitter
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            onSelectType('account');
            onClose();
          }}
          className="w-full p-6 rounded-lg border-2 border-gray-700 dark:border-gray-700 bg-gray-800 dark:bg-gray-800 hover:bg-gray-700 dark:hover:bg-gray-700 hover:border-gray-600 dark:hover:border-gray-600 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
              <UserPlus className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-white mb-1">Track Account</h3>
              <p className="text-sm text-gray-400">
                Track all videos from a social media account automatically
              </p>
            </div>
          </div>
        </button>
      </div>
    </Modal>
  );
}

