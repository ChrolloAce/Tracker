import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Shield, Clock, MoreVertical, Trash2, Edit3, FolderOpen, Check } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';
import { OrgMember, Role } from '../types/firestore';
import { Project } from '../types/projects';
import { formatDistanceToNow } from 'date-fns';
import { FloatingDropdown, DropdownItem } from './ui/FloatingDropdown';

const TeamMembersTable: React.FC = () => {
  const { currentOrgId, user } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [showRoleModal, setShowRoleModal] = useState<OrgMember | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState<OrgMember | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [savingProjects, setSavingProjects] = useState(false);

  useEffect(() => {
    if (!currentOrgId || !user) return;

    loadProjects();

    const membersQuery = query(
      collection(db, 'organizations', currentOrgId, 'members'),
      where('status', '==', 'active')
    );
    const unsubscribe = onSnapshot(membersQuery, () => {
      loadMembers();
    });

    return () => unsubscribe();
  }, [currentOrgId, user]);

  const loadMembers = async () => {
    if (!currentOrgId || !user) return;

    try {
      setLoading(true);
      const [membersData, userRole] = await Promise.all([
        OrganizationService.getOrgMembers(currentOrgId),
        OrganizationService.getUserRole(currentOrgId, user.uid)
      ]);
      
      setMembers(membersData.filter(m => m.role !== 'creator'));
      setCurrentUserRole(userRole || '');
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    if (!currentOrgId) return;
    try {
      const projectsList = await ProjectService.getProjects(currentOrgId);
      setProjects(projectsList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const openProjectsModal = (member: OrgMember) => {
    setSelectedProjectIds(member.assignedProjects || []);
    setShowProjectsModal(member);
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSaveProjects = async () => {
    if (!currentOrgId || !showProjectsModal) return;
    setSavingProjects(true);
    try {
      await OrganizationService.updateMemberProjects(
        currentOrgId,
        showProjectsModal.userId,
        selectedProjectIds
      );
      setMembers(prev =>
        prev.map(m =>
          m.userId === showProjectsModal.userId
            ? { ...m, assignedProjects: selectedProjectIds }
            : m
        )
      );
      setShowProjectsModal(null);
    } catch (error: any) {
      console.error('Failed to update project assignments:', error);
      alert(`Failed to update project assignments: ${error.message}`);
    } finally {
      setSavingProjects(false);
    }
  };

  const getProjectName = (projectId: string): string => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || projectId;
  };

  const getProject = (projectId: string): Project | undefined => {
    return projects.find(p => p.id === projectId);
  };

  const ProjectAvatar: React.FC<{ project: Project | undefined; size?: 'sm' | 'md' }> = ({ project, size = 'sm' }) => {
    const dims = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
    const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

    if (project?.imageUrl) {
      return (
        <img
          src={project.imageUrl}
          alt={project.name}
          className={`${dims} rounded-full object-cover flex-shrink-0`}
        />
      );
    }

    if (project?.icon) {
      return (
        <span className={`flex-shrink-0 ${size === 'sm' ? 'text-xs' : 'text-sm'} leading-none`}>{project.icon}</span>
      );
    }

    const bgColor = project?.color || '#6B7280';
    const letter = (project?.name || '?').charAt(0).toUpperCase();

    return (
      <div
        className={`${dims} rounded-full flex items-center justify-center flex-shrink-0 ${textSize} font-bold text-white`}
        style={{ backgroundColor: bgColor }}
      >
        {letter}
      </div>
    );
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
        return 'bg-surface-active text-content border border-border-strong';
      case 'admin':
        return 'bg-surface-active text-content border border-border-strong';
      case 'member':
        return 'bg-surface-hover text-content-secondary border border-border';
      case 'creator':
        return 'bg-surface-hover text-content-secondary border border-border';
      default:
        return 'bg-surface-hover text-content-secondary border border-border';
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-secondary rounded-xl border border-border p-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-border-strong border-t-content rounded-full mx-auto mb-4"></div>
        <p className="text-content-muted">Loading team members...</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="bg-surface-secondary rounded-xl border border-border overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 bg-surface-active rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-content-muted" />
          </div>
          <h3 className="text-lg font-semibold text-content mb-2">No team members yet</h3>
          <p className="text-content-muted text-center max-w-md mb-6">
            Invite team members to collaborate on projects and campaigns.
          </p>
          <div className="text-center max-w-2xl space-y-2">
            <p className="text-sm text-content-muted">
              Click "Invite Member" above to send an invitation email.
            </p>
            <p className="text-sm text-content-muted">
              You can assign roles like Admin, Member, or Viewer to control permissions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary rounded-xl border border-border overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-secondary border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
                Projects
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-muted uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-content-muted uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.userId} className="hover:bg-surface-hover transition-colors">
                {/* Member Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      {member.photoURL && !imageErrors.has(member.userId) ? (
                        <>
                      <img
                        src={member.photoURL}
                        alt={member.displayName}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                            onError={() => {
                              setImageErrors(prev => new Set(prev).add(member.userId));
                            }}
                      />
                        </>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-active border border-border-strong flex items-center justify-center text-content font-bold text-sm">
                          {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-content">
                        {member.displayName || 'Unknown User'}
                      </div>
                      {member.userId === user?.uid && (
                        <span className="text-xs text-content-muted">(You)</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-content-secondary">
                    <Mail className="w-4 h-4 text-content-muted" />
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

                {/* Assigned Projects */}
                <td className="px-6 py-4">
                  {member.role === 'owner' || member.role === 'admin' ? (
                    <span className="text-xs text-content-muted italic">All Projects</span>
                  ) : !member.assignedProjects || member.assignedProjects.length === 0 ? (
                    <span className="text-xs text-content-muted italic">All Projects</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                      {member.assignedProjects.slice(0, 3).map(pId => {
                        const proj = getProject(pId);
                        return (
                          <span
                            key={pId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-surface-active text-content border border-border max-w-[140px]"
                            title={getProjectName(pId)}
                          >
                            <ProjectAvatar project={proj} size="sm" />
                            <span className="truncate">{getProjectName(pId)}</span>
                          </span>
                        );
                      })}
                      {member.assignedProjects.length > 3 && (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-surface-hover text-content-muted border border-border">
                          +{member.assignedProjects.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Joined Date */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-content-secondary">
                    <Clock className="w-4 h-4 text-content-muted" />
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
                      className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
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
                        {member.role === 'member' && (
                          <DropdownItem
                            icon={<FolderOpen className="w-4 h-4" />}
                            label="Assign Projects"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(null);
                              openProjectsModal(member);
                            }}
                          />
                        )}
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
      <div className="bg-surface-secondary border-t border-border px-6 py-3 flex items-center justify-between">
        <div className="text-sm text-content-muted">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-content-muted">Page 1 of 1</span>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-secondary border border-border-strong rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-content">Change Role</h2>
              <p className="text-sm text-content-muted mt-1">
                Update role for {showRoleModal.displayName || showRoleModal.email}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3">
              {(['admin', 'member'] as Role[]).map((role) => (
                <button
                  key={role}
                  onClick={() => handleUpdateRole(showRoleModal, role)}
                  disabled={showRoleModal.role === role}
                  className={`w-full px-4 py-3 text-left rounded-lg border transition-all ${
                    showRoleModal.role === role
                      ? 'border-border-strong bg-surface-active cursor-not-allowed'
                      : 'border-border hover:border-border-strong hover:bg-surface-hover cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-content-muted" />
                        <span className="text-sm font-medium text-content">
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-content-muted mt-1">
                        {role === 'admin' && 'Full access to manage team and settings'}
                        {role === 'member' && 'Can view and edit projects'}
                      </p>
                    </div>
                    {showRoleModal.role === role && (
                      <span className="text-xs text-content-muted">(Current)</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button
                onClick={() => setShowRoleModal(null)}
                className="px-4 py-2 text-sm font-medium bg-surface-secondary text-content border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Projects Modal */}
      {showProjectsModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-secondary border border-border-strong rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-content">Assign Projects</h2>
              <p className="text-sm text-content-muted mt-1">
                Select which projects {showProjectsModal.displayName || showProjectsModal.email} can access.
                Leave all unchecked for access to all projects.
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-80 overflow-y-auto space-y-2">
              {projects.length === 0 ? (
                <p className="text-sm text-content-muted text-center py-4">No projects found.</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => toggleProjectSelection(project.id)}
                    className={`w-full px-4 py-3 text-left rounded-lg border transition-all flex items-center gap-3 ${
                      selectedProjectIds.includes(project.id)
                        ? 'border-border-strong bg-surface-active'
                        : 'border-border hover:border-border-strong hover:bg-surface-hover'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedProjectIds.includes(project.id)
                          ? 'bg-content border-content'
                          : 'border-border-strong bg-transparent'
                      }`}
                    >
                      {selectedProjectIds.includes(project.id) && (
                        <Check className="w-3.5 h-3.5 text-content-inverse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <ProjectAvatar project={project} size="md" />
                      <span className="text-sm font-medium text-content truncate">{project.name}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-content-muted">
                {selectedProjectIds.length === 0
                  ? 'Access to all projects'
                  : `${selectedProjectIds.length} project${selectedProjectIds.length === 1 ? '' : 's'} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProjectsModal(null)}
                  className="px-4 py-2 text-sm font-medium bg-surface-secondary text-content border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProjects}
                  disabled={savingProjects}
                  className="px-4 py-2 text-sm font-medium bg-content text-content-inverse rounded-lg shadow-[0_2px_0_0_var(--border-strong)] hover:shadow-[0_1px_0_0_var(--border-strong)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50"
                >
                  {savingProjects ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembersTable;

