import React, { useState, useEffect } from 'react';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import TeamMembersTable from './TeamMembersTable';
import PendingInvitationsPage from './PendingInvitationsPage';

const TeamManagementPage: React.FC<{ onRequiresPaidPlan?: (context: string) => boolean }> = ({ onRequiresPaidPlan }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for invite modal trigger from Settings page
  useEffect(() => {
    const handleOpenInviteModal = () => {
      if (onRequiresPaidPlan?.('to invite team members')) return;
      setShowInviteModal(true);
    };
    window.addEventListener('openInviteModal', handleOpenInviteModal);
    return () => window.removeEventListener('openInviteModal', handleOpenInviteModal);
  }, [onRequiresPaidPlan]);

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex space-x-1 bg-surface-tertiary rounded-lg p-1 border border-border">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'members'
                ? 'bg-surface-secondary text-content shadow-sm'
                : 'text-content-muted hover:text-content'
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'invitations'
                ? 'bg-surface-secondary text-content shadow-sm'
                : 'text-content-muted hover:text-content'
            }`}
          >
            Invitations
          </button>
        </div>

      </div>

      {/* Content */}
      {activeTab === 'members' ? (
        <TeamMembersTable key={refreshKey} />
      ) : (
        <PendingInvitationsPage key={refreshKey} />
      )}

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <InviteTeamMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  );
};

export default TeamManagementPage;
