import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import OrganizationService from '../services/OrganizationService';
import { X, Mail, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';

interface InviteTeamMemberModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const InviteTeamMemberModal: React.FC<InviteTeamMemberModalProps> = ({ onClose, onSuccess }) => {
  const { user, currentOrgId } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId) return;

    setError(null);
    setLoading(true);

    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Get organization details
      const org = await OrganizationService.getOrganization(currentOrgId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Send invitation
      await TeamInvitationService.createInvitation(
        currentOrgId,
        email,
        role,
        user.uid,
        user.displayName || 'Unknown',
        user.email || '',
        org.name
      );

      onSuccess();
    } catch (error: any) {
      console.error('Failed to send invitation:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold text-white">Invite Team Member</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              We'll send an invitation to this email address
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <div className="mt-3 space-y-2">
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-300">Member:</span> Can view and manage content
              </div>
              <div className="text-xs text-gray-400">
                <span className="font-medium text-gray-300">Admin:</span> Can manage content and team members
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !email}
              className="flex-1"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteTeamMemberModal;

