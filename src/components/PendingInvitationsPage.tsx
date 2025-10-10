import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TeamInvitation } from '../types/firestore';
import TeamInvitationService from '../services/TeamInvitationService';
import { Mail, Check, X, Building2, Clock, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

const PendingInvitationsPage: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [user]);

  const loadInvitations = async () => {
    if (!user?.email) return;

    setLoading(true);
    try {
      console.log('🔍 Loading invitations for email:', user.email);
      const invites = await TeamInvitationService.getUserInvitations(user.email);
      console.log('📨 Found invitations:', invites.length, invites);
      setInvitations(invites);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation: TeamInvitation) => {
    if (!user) return;

    setActionLoading(invitation.id);
    try {
      await TeamInvitationService.acceptInvitation(
        invitation.id, 
        invitation.orgId, 
        user.uid,
        user.email || invitation.email,
        user.displayName || undefined
      );
      
      alert(`Successfully joined ${invitation.organizationName}!`);
      
      // Wait a moment for Firestore to propagate the member document
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reload the page to refresh organizations
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      alert(error.message || 'Failed to accept invitation');
      setActionLoading(null);
    }
  };

  const handleDecline = async (invitation: TeamInvitation) => {
    if (!window.confirm(`Are you sure you want to decline the invitation to join ${invitation.organizationName}?`)) {
      return;
    }

    setActionLoading(invitation.id);
    try {
      await TeamInvitationService.declineInvitation(invitation.id, invitation.orgId);
      await loadInvitations();
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      alert('Failed to decline invitation');
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
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-12 text-center">
            <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No Pending Invitations
            </h3>
            <p className="text-gray-400">
              You don't have any pending team invitations at the moment.
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
          <h1 className="text-3xl font-bold text-white">Pending Invitations</h1>
          <p className="text-gray-400 mt-1">
            You've been invited to join {invitations.length} {invitations.length === 1 ? 'organization' : 'organizations'}
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
              className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              <div className="p-6">
                {/* Organization Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {invitation.organizationName}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>Invited by {invitation.invitedByName || invitation.invitedByEmail}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(invitation.role)}`}>
                    {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                  </div>
                </div>

                {/* Invitation Details */}
                <div className="flex items-center gap-6 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-400">
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
                <div className="bg-gray-700/30 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-300">
                    {invitation.role === 'admin' 
                      ? 'As an admin, you\'ll be able to manage content, team members, and organization settings.'
                      : 'As a member, you\'ll be able to view and manage content within this organization.'
                    }
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAccept(invitation)}
                    disabled={actionLoading === invitation.id}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {actionLoading === invitation.id ? 'Accepting...' : 'Accept Invitation'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDecline(invitation)}
                    disabled={actionLoading === invitation.id}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Decline
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

