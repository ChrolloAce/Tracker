import { Video, UserPlus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { PlatformIcon } from './ui/PlatformIcon';

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
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            onSelectType('video');
          }}
          className="p-8 rounded-lg border border-border bg-surface-tertiary hover:bg-surface-hover hover:border-border-strong transition-all group"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-lg bg-surface-active text-content-muted group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-all">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-2">Track Video</h3>
              <p className="text-sm text-content-muted mb-4">
                Add individual videos from TikTok, Instagram, YouTube, or Twitter
              </p>
              <div className="flex items-center justify-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <PlatformIcon platform="instagram" size="md" />
                <PlatformIcon platform="tiktok" size="md" />
                <PlatformIcon platform="youtube" size="md" />
                <PlatformIcon platform="twitter" size="md" />
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            onSelectType('account');
          }}
          className="p-8 rounded-lg border border-border bg-surface-tertiary hover:bg-surface-hover hover:border-border-strong transition-all group"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-4 rounded-lg bg-surface-active text-content-muted group-hover:bg-orange-500/10 group-hover:text-orange-500 transition-all">
              <UserPlus className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-2">Track Account</h3>
              <p className="text-sm text-content-muted mb-4">
                Track all videos from a social media account automatically
              </p>
              <div className="flex items-center justify-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <PlatformIcon platform="instagram" size="md" />
                <PlatformIcon platform="tiktok" size="md" />
                <PlatformIcon platform="youtube" size="md" />
                <PlatformIcon platform="twitter" size="md" />
              </div>
            </div>
          </div>
        </button>
      </div>
    </Modal>
  );
}
