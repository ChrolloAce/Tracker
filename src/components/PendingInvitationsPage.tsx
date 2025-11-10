import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TeamInvitation } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import { Mail, X, Clock, AlertCircle, Send } from 'lucide-react';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

const PendingInvitationsPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [currentOrgId]);

  const loadInvitations = async () => {
    if (!currentOrgId) return;

    setLoading(true);
    try {
      const invites = await TeamInvitationService.getOrgInvitations(currentOrgId);
      setInvitations(invites);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (invitation: TeamInvitation) => {
    if (!window.confirm(`Are you sure you want to cancel the invitation to ${invitation.email}?`)) {
      return;
    }

    if (!currentOrgId) return;

    setActionLoading(invitation.id);
    try {
      await TeamInvitationService.declineInvitation(invitation.id, currentOrgId);
      await loadInvitations();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invitation: TeamInvitation) => {
    if (!currentOrgId) return;

    setActionLoading(invitation.id);
    try {
      // Cancel the old invitation and create a new one
      await TeamInvitationService.declineInvitation(invitation.id, currentOrgId);
      await TeamInvitationService.createInvitation(
        currentOrgId,
        invitation.email,
        invitation.role,
        invitation.invitedBy || '',
        invitation.invitedByName || '',
        invitation.invitedByEmail || '',
        invitation.organizationName || ''
      );
      alert(`Invitation resent to ${invitation.email}`);
      await loadInvitations();
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      alert('Failed to resend invitation');
    } finally {
      setActionLoading(null);
    }
  };


  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getExpiresInDays = (expiresAt: any) => {
    const expires = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
    const now = new Date();
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return <PageLoadingSkeleton type="team" />;
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Pending Invitations</h3>
          <p className="text-white/60 text-center max-w-md">
            You haven't sent any team invitations yet. Invite team members to collaborate!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {invitations.map((invitation) => {
              const expiresInDays = getExpiresInDays(invitation.expiresAt);
              const isExpiringSoon = expiresInDays <= 2;

              return (
                <tr key={invitation.id} className="hover:bg-white/5 transition-colors">
                  {/* Email */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-white/60" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {invitation.email}
                        </div>
                        <div className="text-xs text-white/50">
                          Pending acceptance
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white border border-white/20">
                      {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                    </span>
                  </td>

                  {/* Sent Date */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-white/70">
                      {formatDate(invitation.createdAt)}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {isExpiringSoon ? (
                      <div className="flex items-center gap-1.5 text-orange-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          Expires in {expiresInDays}d
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-white/50">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">
                          {expiresInDays} days left
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleResend(invitation)}
                        disabled={actionLoading === invitation.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {actionLoading === invitation.id ? 'Sending...' : 'Resend'}
                      </button>
                      <button
                        onClick={() => handleCancel(invitation)}
                        disabled={actionLoading === invitation.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white/5 border-t border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="text-sm text-white/60">
          {invitations.length} {invitations.length === 1 ? 'invitation' : 'invitations'}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/60">Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
};

export default PendingInvitationsPage;

