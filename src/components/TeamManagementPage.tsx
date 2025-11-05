import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import InviteTeamMemberModal from './InviteTeamMemberModal';
import TeamMembersTable from './TeamMembersTable';
import PendingInvitationsPage from './PendingInvitationsPage';

const TeamManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen for invite modal trigger from Settings page
  useEffect(() => {
    const handleOpenInviteModal = () => setShowInviteModal(true);
    window.addEventListener('openInviteModal', handleOpenInviteModal);
    return () => window.removeEventListener('openInviteModal', handleOpenInviteModal);
  }, []);

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Team Members</h1>
        <p className="text-white/60">Manage your team and invite new members</p>
      </div>

      {/* Tabs and Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'members'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'invitations'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Invitations
          </button>
        </div>

        <button 
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white/90 text-black rounded-lg font-medium transition-colors"
                >
          <Plus className="w-4 h-4" />
          Invite Member
        </button>
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
