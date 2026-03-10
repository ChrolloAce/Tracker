import React from 'react';
import { Loader2, AlertTriangle, UserPlus } from 'lucide-react';

export const DeleteOrgConfirmModal: React.FC<{
  orgName: string;
  confirmText: string;
  loading: boolean;
  onConfirmTextChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ orgName, confirmText, loading, onConfirmTextChange, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
    <div className="bg-[#111] border border-red-500/20 rounded-xl w-full max-w-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Delete Organization</h3>
          <p className="text-xs text-white/40">This cannot be undone</p>
        </div>
      </div>

      <p className="text-xs text-white/60 mb-3">
        This will permanently delete <strong className="text-white">{orgName}</strong> and all
        its projects, accounts, videos, and members.
      </p>

      <p className="text-xs text-white/40 mb-2">
        Type <span className="text-red-400 font-mono">DELETE</span> to confirm:
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => onConfirmTextChange(e.target.value)}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500/50 mb-4"
        placeholder="DELETE"
      />

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/70 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={confirmText !== 'DELETE' || loading}
          className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete Forever'}
        </button>
      </div>
    </div>
  </div>
);

export const AssignOwnerModal: React.FC<{
  email: string;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onAssign: () => void;
  onCancel: () => void;
}> = ({ email, loading, onEmailChange, onAssign, onCancel }) => (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
    <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-white/70" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Assign Owner</h3>
          <p className="text-xs text-white/40">Link an email to this organization</p>
        </div>
      </div>

      <p className="text-xs text-white/60 mb-3">
        Enter the email of the user who should own this organization. They must have
        signed in at least once.
      </p>

      <input
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onAssign()}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 mb-4"
        placeholder="user@example.com"
        autoFocus
      />

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/70 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onAssign}
          disabled={!email.trim() || loading}
          className="flex-1 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-30"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Assign Owner'}
        </button>
      </div>
    </div>
  </div>
);
