import React from 'react';
import { LogOut, X } from 'lucide-react';

interface SignOutModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SignOutModal: React.FC<SignOutModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Sign Out</h2>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-400 text-sm">
            Are you sure you want to sign out?
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignOutModal;

