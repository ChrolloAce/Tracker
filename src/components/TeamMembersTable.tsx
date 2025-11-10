import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Shield, Clock, MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { OrgMember, Role } from '../types/firestore';
import { formatDistanceToNow } from 'date-fns';
import { FloatingDropdown, DropdownItem, DropdownDivider } from './ui/FloatingDropdown';

const TeamMembersTable: React.FC = () => {
  const { currentOrgId, user } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [showRoleModal, setShowRoleModal] = useState<OrgMember | null>(null);

  useEffect(() => {
    loadMembers();
  }, [currentOrgId]);

  const loadMembers = async () => {
    if (!currentOrgId || !user) return;

    try {
      setLoading(true);
      const [membersData, userRole] = await Promise.all([
        OrganizationService.getOrgMembers(currentOrgId),
        OrganizationService.getUserRole(currentOrgId, user.uid)
      ]);
      
      setMembers(membersData);
      setCurrentUserRole(userRole || '');
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member: OrgMember) => {
    if (!currentOrgId) return;
    
    // Prevent admins from removing other admins or the owner
    if (currentUserRole === 'admin' && (member.role === 'admin' || member.role === 'owner')) {
      alert('Only the organization owner can remove admins or other owners.');
      return;
    }
    
    const confirmMessage = `Are you sure you want to remove ${member.displayName || member.email} from the team?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;
    
    try {
      await OrganizationService.removeMember(currentOrgId, member.userId);
      setMembers(prev => prev.filter(m => m.userId !== member.userId));
      setOpenDropdownId(null);
      alert(`${member.displayName || member.email} has been removed from the team.`);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      alert(`Failed to remove member: ${error.message}`);
    }
  };

  const handleUpdateRole = async (member: OrgMember, newRole: Role) => {
    if (!currentOrgId) return;
    
    // Prevent admins from changing roles of other admins or the owner
    if (currentUserRole === 'admin' && (member.role === 'admin' || member.role === 'owner')) {
      alert('Only the organization owner can change admin or owner roles.');
      setShowRoleModal(null);
      return;
    }
    
    try {
      await OrganizationService.updateMemberRole(currentOrgId, member.userId, newRole);
      setMembers(prev => prev.map(m => 
        m.userId === member.userId ? { ...m, role: newRole } : m
      ));
      setShowRoleModal(null);
      alert(`Role updated successfully.`);
    } catch (error: any) {
      console.error('Failed to update role:', error);
      alert(`Failed to update role: ${error.message}`);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-white/20 text-white border border-white/30';
      case 'admin':
        return 'bg-white/15 text-white/90 border border-white/25';
      case 'member':
        return 'bg-white/10 text-white/80 border border-white/20';
      case 'creator':
        return 'bg-white/10 text-white/80 border border-white/20';
      default:
        return 'bg-white/10 text-white/80 border border-white/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
        <p className="text-white/60">Loading team members...</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No team members yet</h3>
          <p className="text-white/60 text-center max-w-md mb-6">
            Invite team members to collaborate on projects and campaigns.
          </p>
          <div className="text-center max-w-2xl space-y-2">
            <p className="text-sm text-white/50">
              Click "Invite Member" above to send an invitation email.
            </p>
            <p className="text-sm text-white/50">
              You can assign roles like Admin, Member, or Viewer to control permissions.
            </p>
          </div>
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
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {members.map((member) => (
              <tr key={member.userId} className="hover:bg-white/5 transition-colors">
                {/* Member Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      {member.photoURL && !imageErrors.has(member.userId) ? (
                        <>
                      <img
                        src={member.photoURL}
                        alt={member.displayName}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                            onError={() => {
                              setImageErrors(prev => new Set(prev).add(member.userId));
                            }}
                      />
                        </>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-sm">
                          {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {member.displayName || 'Unknown User'}
                      </div>
                      {member.userId === user?.uid && (
                        <span className="text-xs text-white/40">(You)</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Mail className="w-4 h-4 text-white/40" />
                    {member.email || '—'}
                  </div>
                </td>

                {/* Role */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                    <Shield className="w-3 h-3" />
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                </td>

                {/* Joined Date */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Clock className="w-4 h-4 text-white/40" />
                    {member.joinedAt 
                      ? formatDistanceToNow(member.joinedAt.toDate(), { addSuffix: true })
                      : '—'
                    }
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  {member.userId !== user?.uid && (
                    currentUserRole === 'owner' || 
                    (currentUserRole === 'admin' && member.role !== 'owner' && member.role !== 'admin')
                  ) && (
                    <>
                      <button
                        ref={(el) => {
                          if (el) {
                            dropdownTriggerRefs.current.set(member.userId, el);
                          } else {
                            dropdownTriggerRefs.current.delete(member.userId);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === member.userId ? null : member.userId);
                        }}
                        className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="More actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      <FloatingDropdown
                        isOpen={openDropdownId === member.userId}
                        onClose={() => setOpenDropdownId(null)}
                        triggerRef={{ current: dropdownTriggerRefs.current.get(member.userId) || null }}
                        align="right"
                      >
                        <DropdownItem
                          icon={<Edit3 className="w-4 h-4" />}
                          label="Change Role"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(null);
                            setShowRoleModal(member);
                          }}
                        />
                        <DropdownItem
                          icon={<Trash2 className="w-4 h-4" />}
                          label="Remove from Team"
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(member);
                          }}
                        />
                      </FloatingDropdown>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white/5 border-t border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="text-sm text-white/60">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/60">Page 1 of 1</span>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/20 rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Change Role</h2>
              <p className="text-sm text-white/60 mt-1">
                Update role for {showRoleModal.displayName || showRoleModal.email}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3">
              {(['admin', 'member', 'creator'] as Role[]).map((role) => (
                <button
                  key={role}
                  onClick={() => handleUpdateRole(showRoleModal, role)}
                  disabled={showRoleModal.role === role}
                  className={`w-full px-4 py-3 text-left rounded-lg border transition-all ${
                    showRoleModal.role === role
                      ? 'border-white/20 bg-white/10 cursor-not-allowed'
                      : 'border-white/10 hover:border-white/30 hover:bg-white/5 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-white/60" />
                        <span className="text-sm font-medium text-white">
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-1">
                        {role === 'admin' && 'Full access to manage team and settings'}
                        {role === 'member' && 'Can view and edit projects'}
                        {role === 'creator' && 'Limited access for content creators'}
                      </p>
                    </div>
                    {showRoleModal.role === role && (
                      <span className="text-xs text-white/40">(Current)</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowRoleModal(null)}
                className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembersTable;

