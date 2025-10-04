import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, TeamInvitation, Role } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import { UserPlus, Shield, Crown, User, Mail, Clock, X } from 'lucide-react';
import { Button } from './ui/Button';
import InviteTeamMemberModal from './InviteTeamMemberModal';

const TeamManagementPage: React.FC = () => {
  const { user, currentOrgId } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, user]);

  const loadData = async () => {
    if (!currentOrgId || !user) return;

    setLoading(true);
    try {
      // Get current user role
      const role = await OrganizationService.getUserRole(currentOrgId, user.uid);
      setIsAdmin(role === 'owner' || role === 'admin');

      // Load members
      const membersData = await OrganizationService.getOrgMembers(currentOrgId);
      setMembers(membersData);

      // Load pending invitations sent from this org (only for admins)
      if (role === 'owner' || role === 'admin') {
        const invitesData = await TeamInvitationService.getOrgInvitations(currentOrgId);
        setInvitations(invitesData);
      }

      // Load invitations received by the current user
      if (user.email) {
        const receivedInvites = await TeamInvitationService.getUserInvitations(user.email);
        setReceivedInvitations(receivedInvites);
      }
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentOrgId || !user) return;
    
    if (!window.confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    setActionLoading(userId);
    try {
      await OrganizationService.removeMember(currentOrgId, userId);
      await loadData();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove team member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    if (!currentOrgId) return;

    setActionLoading(userId);
    try {
      await OrganizationService.updateMemberRole(currentOrgId, userId, newRole);
      await loadData();
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update member role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!currentOrgId) return;

    setActionLoading(invitationId);
    try {
      await TeamInvitationService.cancelInvitation(invitationId, currentOrgId);
      await loadData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptInvitation = async (invitation: TeamInvitation) => {
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

  const handleDeclineInvitation = async (invitation: TeamInvitation) => {
    if (!window.confirm(`Are you sure you want to decline the invitation to join ${invitation.organizationName}?`)) {
      return;
    }

    setActionLoading(invitation.id);
    try {
      await TeamInvitationService.declineInvitation(invitation.id, invitation.orgId);
      await loadData();
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      alert('Failed to decline invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'member':
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'member':
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Invite Button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </Button>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Team Members ({members.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Joined
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {members.map((member) => (
                <tr key={member.userId} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10">
                        {user?.photoURL && member.userId === user?.uid ? (
                          <img
                            src={user.photoURL}
                            alt={member.displayName || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const placeholder = e.currentTarget.parentElement?.querySelector('.placeholder-icon');
                              if (placeholder) {
                                (placeholder as HTMLElement).classList.remove('hidden');
                              }
                            }}
                          />
                        ) : null}
                        <div className={`placeholder-icon w-10 h-10 bg-gray-700 dark:bg-gray-800 rounded-full flex items-center justify-center ${user?.photoURL && member.userId === user?.uid ? 'hidden' : ''}`}>
                          <User className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {member.displayName || 'Unknown User'}
                          {member.userId === user?.uid && (
                            <span className="ml-2 text-xs text-gray-400">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAdmin && member.role !== 'owner' && member.userId !== user?.uid ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.userId, e.target.value as Role)}
                        disabled={actionLoading === member.userId}
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                        {getRoleIcon(member.role)}
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDate(member.joinedAt)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {member.role !== 'owner' && member.userId !== user?.uid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={actionLoading === member.userId}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Invited By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {invitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-gray-800/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-white">{invitation.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(invitation.role)}`}>
                        {getRoleIcon(invitation.role)}
                        {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {invitation.invitedByName || invitation.invitedByEmail || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-4 h-4" />
                        {formatDate(invitation.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={actionLoading === invitation.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Received Invitations Section */}
      {receivedInvitations.length > 0 && (
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg border border-purple-500/30 overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-500/30 bg-purple-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Invitations You've Received ({receivedInvitations.length})
                  </h2>
                  <p className="text-sm text-purple-300 mt-1">
                    Accept or decline invitations to join other organizations
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {receivedInvitations.map((invitation) => {
              const expiresInDays = Math.ceil((invitation.expiresAt.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div 
                  key={invitation.id}
                  className="bg-gray-900/50 rounded-lg border border-purple-500/20 p-6 hover:border-purple-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-6">
                    {/* Invitation Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-700 dark:bg-gray-800">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {invitation.organizationName}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Invited by {invitation.invitedByName || invitation.invitedByEmail}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Role:</span>
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ml-2 ${getRoleBadgeColor(invitation.role)}`}>
                            {getRoleIcon(invitation.role)}
                            {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Expires in:</span>
                          <span className={`ml-2 font-medium ${expiresInDays <= 2 ? 'text-red-400' : 'text-white'}`}>
                            {expiresInDays} {expiresInDays === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-shrink-0">
                      <Button
                        onClick={() => handleAcceptInvitation(invitation)}
                        disabled={actionLoading === invitation.id}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6"
                      >
                        {actionLoading === invitation.id ? 'Accepting...' : 'Accept'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleDeclineInvitation(invitation)}
                        disabled={actionLoading === invitation.id}
                        className="hover:bg-red-500/10 hover:text-red-400"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteTeamMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default TeamManagementPage;

