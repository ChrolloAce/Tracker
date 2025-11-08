import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Clock, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { OrgMember } from '../types/firestore';
import { formatDistanceToNow } from 'date-fns';

const TeamMembersTable: React.FC = () => {
  const { currentOrgId, user } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case 'admin':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'member':
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
      case 'creator':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10">
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
                  {member.userId !== user?.uid && (currentUserRole === 'owner' || currentUserRole === 'admin') && (
                    <button
                      className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="More actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
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
    </div>
  );
};

export default TeamMembersTable;

