import React, { useState } from 'react';
import {
  X,
  Eye,
  Zap,
  RefreshCw,
  Loader2,
  Video,
  UserCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { ProxiedImage } from '../ProxiedImage';
import SuperAdminService, { OrganizationSummary } from '../../services/SuperAdminService';
import { DeleteOrgConfirmModal, AssignOwnerModal } from './AdminActionModals';

interface OrgDetailsModalProps {
  orgId: string;
  orgDetails: {
    organization: OrganizationSummary | null;
    trackedAccounts: any[];
    videos: any[];
    members: any[];
  } | null;
  loading: boolean;
  userEmail: string;
  actionLoading: string | null;
  onClose: () => void;
  onViewAsUser: (orgId: string) => void;
  onGrantPlan: () => void;
  onTriggerRefresh: (orgId: string) => void;
  onRestoreMember: (orgId: string, memberId: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onRefresh: () => void;
}

const OrgDetailsModal: React.FC<OrgDetailsModalProps> = ({
  orgId,
  orgDetails,
  loading,
  userEmail,
  actionLoading,
  onClose,
  onViewAsUser,
  onGrantPlan,
  onTriggerRefresh,
  onRestoreMember,
  onSuccess,
  onError,
  onRefresh,
}) => {
  const [localActionLoading, setLocalActionLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignOwner, setShowAssignOwner] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const effectiveLoading = actionLoading || localActionLoading;

  const handleDeleteOrg = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setLocalActionLoading('delete-org');
    try {
      await SuperAdminService.deleteOrganization(orgId, userEmail);
      onSuccess('Organization deleted successfully');
      onClose();
      onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to delete organization');
    } finally {
      setLocalActionLoading(null);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  const handleAssignOwner = async () => {
    if (!assignEmail.trim()) return;
    setLocalActionLoading('assign-owner');
    try {
      await SuperAdminService.assignOwner(orgId, assignEmail.trim(), userEmail);
      onSuccess(`Assigned ${assignEmail.trim()} as owner`);
      setShowAssignOwner(false);
      setAssignEmail('');
      onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to assign owner');
    } finally {
      setLocalActionLoading(null);
    }
  };

  const handleDeleteMember = async (memberId: string, memberEmail: string, hard: boolean) => {
    const action = hard ? 'permanently delete' : 'remove';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${memberEmail || memberId}?`)) return;

    setLocalActionLoading(`del-member-${memberId}`);
    try {
      await SuperAdminService.deleteMember(orgId, memberId, userEmail, hard);
      onSuccess(`Member ${memberEmail || memberId} ${hard ? 'deleted' : 'removed'}`);
      onRefresh();
    } catch (err: any) {
      onError(err.message || 'Failed to delete member');
    } finally {
      setLocalActionLoading(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <ModalHeader
            orgDetails={orgDetails}
            orgId={orgId}
            effectiveLoading={effectiveLoading}
            onViewAsUser={onViewAsUser}
            onGrantPlan={onGrantPlan}
            onTriggerRefresh={onTriggerRefresh}
            onShowAssignOwner={() => setShowAssignOwner(true)}
            onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
            onClose={onClose}
          />

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : orgDetails ? (
              <div className="space-y-4">
                <OrgStatsRow orgDetails={orgDetails} />
                <MembersSection
                  members={orgDetails.members}
                  orgId={orgId}
                  effectiveLoading={effectiveLoading}
                  onRestoreMember={onRestoreMember}
                  onDeleteMember={handleDeleteMember}
                />
                <AccountsSection accounts={orgDetails.trackedAccounts} />
                <VideosSection videos={orgDetails.videos} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteOrgConfirmModal
          orgName={orgDetails?.organization?.name || ''}
          confirmText={deleteConfirmText}
          loading={localActionLoading === 'delete-org'}
          onConfirmTextChange={setDeleteConfirmText}
          onConfirm={handleDeleteOrg}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
        />
      )}

      {showAssignOwner && (
        <AssignOwnerModal
          email={assignEmail}
          loading={localActionLoading === 'assign-owner'}
          onEmailChange={setAssignEmail}
          onAssign={handleAssignOwner}
          onCancel={() => { setShowAssignOwner(false); setAssignEmail(''); }}
        />
      )}
    </>
  );
};

/* ─── Sub-components ────────────────────────────────────────────── */

const ModalHeader: React.FC<{
  orgDetails: OrgDetailsModalProps['orgDetails'];
  orgId: string;
  effectiveLoading: string | null;
  onViewAsUser: (id: string) => void;
  onGrantPlan: () => void;
  onTriggerRefresh: (id: string) => void;
  onShowAssignOwner: () => void;
  onShowDeleteConfirm: () => void;
  onClose: () => void;
}> = ({ orgDetails, orgId, effectiveLoading, onViewAsUser, onGrantPlan, onTriggerRefresh, onShowAssignOwner, onShowDeleteConfirm, onClose }) => (
  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
    <div className="flex items-center gap-3">
      {orgDetails?.organization && (
        <>
          <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center text-white/70 font-medium">
            {orgDetails.organization.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-medium text-white text-sm">{orgDetails.organization.name}</h2>
            <p className="text-xs text-white/40">{orgDetails.organization.ownerEmail || 'No owner'}</p>
          </div>
        </>
      )}
    </div>
    <div className="flex items-center gap-1.5 flex-wrap">
      <ActionButton icon={Eye} label="View" onClick={() => onViewAsUser(orgId)} />
      <ActionButton icon={Zap} label="Plan" onClick={onGrantPlan} />
      <ActionButton
        icon={RefreshCw}
        label="Refresh"
        onClick={() => onTriggerRefresh(orgId)}
        loading={effectiveLoading === 'refresh-' + orgId}
      />
      <ActionButton icon={UserPlus} label="Assign Owner" onClick={onShowAssignOwner} />
      <button
        onClick={onShowDeleteConfirm}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </button>
      <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors ml-1">
        <X className="w-4 h-4 text-white/50" />
      </button>
    </div>
  </div>
);

const ActionButton: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading?: boolean;
}> = ({ icon: Icon, label, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
  >
    <Icon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
    {label}
  </button>
);

const OrgStatsRow: React.FC<{ orgDetails: NonNullable<OrgDetailsModalProps['orgDetails']> }> = ({ orgDetails }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {[
      { value: orgDetails.members.length, label: 'Members' },
      { value: orgDetails.organization?.projectCount || 0, label: 'Projects' },
      { value: orgDetails.trackedAccounts.length, label: 'Accounts' },
      { value: orgDetails.videos.length, label: 'Videos' },
    ].map(({ value, label }) => (
      <div key={label} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
        <div className="text-lg font-medium text-white">{value}</div>
        <div className="text-[10px] text-white/40 uppercase">{label}</div>
      </div>
    ))}
  </div>
);

const MembersSection: React.FC<{
  members: any[];
  orgId: string;
  effectiveLoading: string | null;
  onRestoreMember: (orgId: string, memberId: string) => void;
  onDeleteMember: (memberId: string, email: string, hard: boolean) => void;
}> = ({ members, orgId, effectiveLoading, onRestoreMember, onDeleteMember }) => (
  <div>
    <h3 className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">Members</h3>
    <div className="bg-white/[0.02] border border-white/5 rounded-lg divide-y divide-white/5">
      {members.map((member: any) => {
        const isRemoved = member.status === 'removed';
        return (
          <div key={member.id} className={`px-3 py-2 flex items-center gap-2 ${isRemoved ? 'opacity-50' : ''}`}>
            <div className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-white/50 text-xs font-medium">
              {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/70 truncate">
                {member.displayName || 'No name'}
                {isRemoved && <span className="ml-1.5 text-red-400/80">(removed)</span>}
              </div>
              <div className="text-[10px] text-white/40 truncate">{member.email}</div>
            </div>
            <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/50">
              {member.role || 'member'}
            </span>

            {isRemoved && (
              <button
                onClick={() => onRestoreMember(orgId, member.id)}
                disabled={effectiveLoading === 'restore-' + member.id}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-white/80 transition-colors disabled:opacity-50"
              >
                {effectiveLoading === 'restore-' + member.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <UserCheck className="w-3 h-3" />
                )}
                Restore
              </button>
            )}

            <button
              onClick={() => onDeleteMember(member.id, member.email || '', false)}
              disabled={!!effectiveLoading?.startsWith('del-member-')}
              className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded text-[10px] text-red-400 transition-colors disabled:opacity-50"
              title="Remove member"
            >
              {effectiveLoading === `del-member-${member.id}` ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </button>
          </div>
        );
      })}
      {members.length === 0 && (
        <div className="px-3 py-4 text-center text-white/30 text-xs">No members</div>
      )}
    </div>
  </div>
);

const AccountsSection: React.FC<{ accounts: any[] }> = ({ accounts }) => (
  <div>
    <h3 className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">
      Tracked Accounts ({accounts.length})
    </h3>
    {accounts.length > 0 ? (
      <div className="bg-white/[0.02] border border-white/5 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
        {accounts.map((account: any) => (
          <div key={account.id} className="px-3 py-2 flex items-center gap-2">
            {account.profilePicture ? (
              <ProxiedImage
                src={account.profilePicture}
                alt={account.username}
                className="w-8 h-8 rounded-full object-cover"
                fallback={
                  <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/50 text-xs">
                    {(account.username || 'A').charAt(0).toUpperCase()}
                  </div>
                }
              />
            ) : (
              <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/50 text-xs">
                {(account.username || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/70 truncate">
                @{account.username || account.displayName}
              </div>
              <div className="text-[10px] text-white/40 capitalize">{account.platform}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-white/70">{(account.followerCount || 0).toLocaleString()}</div>
              <div className="text-[10px] text-white/40">followers</div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-center text-white/30 text-xs">
        No tracked accounts
      </div>
    )}
  </div>
);

const VideosSection: React.FC<{ videos: any[] }> = ({ videos }) => (
  <div>
    <h3 className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">
      Videos ({videos.length})
    </h3>
    {videos.length > 0 ? (
      <div className="bg-white/[0.02] border border-white/5 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
        {videos.slice(0, 20).map((video: any) => (
          <div key={video.id} className="px-3 py-2 flex items-center gap-2">
            {video.thumbnail ? (
              <img src={video.thumbnail} alt="Video" className="w-12 h-8 rounded object-cover bg-white/5" />
            ) : (
              <div className="w-12 h-8 bg-white/5 rounded flex items-center justify-center">
                <Video className="w-3 h-3 text-white/20" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white/70 truncate">
                {video.title || video.description || 'No title'}
              </div>
              <div className="text-[10px] text-white/40 capitalize">{video.platform}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-white/70">{(video.views || 0).toLocaleString()}</div>
              <div className="text-[10px] text-white/40">views</div>
            </div>
          </div>
        ))}
        {videos.length > 20 && (
          <div className="px-3 py-2 text-center text-[10px] text-white/30">
            + {videos.length - 20} more
          </div>
        )}
      </div>
    ) : (
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-center text-white/30 text-xs">
        No videos
      </div>
    )}
  </div>
);

export default OrgDetailsModal;
