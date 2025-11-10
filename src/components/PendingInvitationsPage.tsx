import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TeamInvitation } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import { Mail, X, Clock, AlertCircle, Send } from 'lucide-react';
import { Button } from './ui/Button';
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
        invitation.invitedBy || ''
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'member':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/5 rounded-lg border border-white/10 p-12 text-center">
            <Mail className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Pending Invitations
            </h3>
            <p className="text-white/60">
              You haven't sent any team invitations yet. Invite team members to collaborate!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Mail className="w-8 h-8 text-purple-500" />
        <div>
          <h1 className="text-3xl font-bold text-white">Sent Invitations</h1>
          <p className="text-white/60 mt-1">
            {invitations.length} pending {invitations.length === 1 ? 'invitation' : 'invitations'}
          </p>
        </div>
      </div>

      {/* Invitations List */}
      <div className="space-y-4 max-w-4xl">
        {invitations.map((invitation) => {
          const expiresInDays = getExpiresInDays(invitation.expiresAt);
          const isExpiringSoon = expiresInDays <= 2;

          return (
            <div 
              key={invitation.id}
              className="bg-white/5 rounded-lg border border-white/10 overflow-hidden hover:border-white/20 transition-colors"
            >
              <div className="p-6">
                {/* Invitation Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {invitation.email}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <span>Pending acceptance</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30`}>
                    {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                  </div>
                </div>

                {/* Invitation Details */}
                <div className="flex items-center gap-6 text-sm mb-4">
                  <div className="flex items-center gap-2 text-white/60">
                    <Clock className="w-4 h-4" />
                    <span>Sent {formatDate(invitation.createdAt)}</span>
                  </div>
                  {isExpiringSoon && (
                    <div className="flex items-center gap-2 text-orange-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>Expires in {expiresInDays} {expiresInDays === 1 ? 'day' : 'days'}</span>
                    </div>
                  )}
                </div>

                {/* Role Description */}
                <div className="bg-white/5 rounded-lg p-3 mb-4">
                  <p className="text-sm text-white/70">
                    {invitation.role === 'admin' 
                      ? 'This person will have full access to manage content, team members, and organization settings.'
                      : invitation.role === 'member'
                      ? 'This person will be able to view and edit projects.'
                      : 'This person will have limited access for content creation.'
                    }
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleResend(invitation)}
                    disabled={actionLoading === invitation.id}
                    className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <Send className="w-4 h-4" />
                    {actionLoading === invitation.id ? 'Resending...' : 'Resend Invitation'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleCancel(invitation)}
                    disabled={actionLoading === invitation.id}
                    className="flex items-center gap-2 border-red-500/30 text-red-400 hover:bg-red-900/20"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PendingInvitationsPage;

