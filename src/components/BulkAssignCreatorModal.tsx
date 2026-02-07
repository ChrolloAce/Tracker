import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Users, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CreatorLinksService from '../services/CreatorLinksService';
import OrganizationService from '../services/OrganizationService';
import { OrgMember } from '../types/firestore';
import { ProxiedImage } from './ProxiedImage';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

interface BulkAssignCreatorModalProps {
  isOpen: boolean;
  /** Account IDs to link to the selected creator */
  accountIds: string[];
  /** Video IDs to directly assign (sets assignedCreatorId on each video doc) */
  videoIds?: string[];
  /** Label shown in the header (e.g. "3 accounts" or "5 videos (2 accounts)") */
  selectionLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * BulkAssignCreatorModal
 * Allows bulk-assigning multiple accounts (and optionally videos) to a single creator.
 * Used from both the Videos table and the Accounts table.
 *
 * Shows ALL active org members so the admin can pick anyone as the creator.
 */
const BulkAssignCreatorModal: React.FC<BulkAssignCreatorModalProps> = ({
  isOpen,
  accountIds,
  videoIds,
  selectionLabel,
  onClose,
  onSuccess,
}) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
      setSelectedCreatorId(null);
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen, currentOrgId]);

  const loadMembers = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const allMembers = await OrganizationService.getOrgMembers(currentOrgId);
      // Show all active org members — any member can be assigned as a creator
      setMembers(allMembers);
    } catch (err) {
      console.error('Failed to load members:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!currentOrgId || !currentProjectId || !selectedCreatorId || !user) return;
    // Need at least some accounts or videos to assign
    if (accountIds.length === 0 && (!videoIds || videoIds.length === 0)) return;

    setSaving(true);
    setError(null);

    try {
      // 1. Link accounts to the creator (if any)
      if (accountIds.length > 0) {
        const uniqueAccountIds = [...new Set(accountIds)];

        for (const accountId of uniqueAccountIds) {
          // Unlink existing creators for this account
          const existingLinks = await CreatorLinksService.getAccountLinkedCreators(
            currentOrgId, currentProjectId, accountId
          );
          for (const link of existingLinks) {
            if (link.creatorId !== selectedCreatorId) {
              await CreatorLinksService.unlinkCreatorFromAccount(
                currentOrgId, currentProjectId, link.creatorId, accountId
              );
            }
          }

          // Link to the new creator if not already linked
          const alreadyLinked = existingLinks.some(l => l.creatorId === selectedCreatorId);
          if (!alreadyLinked) {
            await CreatorLinksService.linkCreatorToAccounts(
              currentOrgId, currentProjectId, selectedCreatorId, [accountId], user.uid
            );
          }
        }
      }

      // 2. Directly assign videos to the creator (sets assignedCreatorId on each video doc)
      if (videoIds && videoIds.length > 0) {
        const batch = writeBatch(db);
        for (const videoId of videoIds) {
          const videoRef = doc(
            db, 'organizations', currentOrgId, 'projects', currentProjectId, 'videos', videoId
          );
          batch.update(videoRef, { assignedCreatorId: selectedCreatorId });
        }
        await batch.commit();
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to assign creator:', err);
      setError(err.message || 'Failed to assign creator');
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter(member => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (member.displayName || '').toLowerCase().includes(q)
      || (member.email || '').toLowerCase().includes(q);
  });

  // Sort: creators first, then by name
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (a.role === 'creator' && b.role !== 'creator') return -1;
    if (a.role !== 'creator' && b.role === 'creator') return 1;
    return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
  });

  if (!isOpen) return null;

  const assignCount = accountIds.length > 0
    ? `${new Set(accountIds).size} Account${new Set(accountIds).size !== 1 ? 's' : ''}`
    : `${videoIds?.length || 0} Video${(videoIds?.length || 0) !== 1 ? 's' : ''}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/10 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Assign to Creator</h2>
            <p className="text-sm text-white/50 mt-0.5">
              Linking {selectionLabel}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50" />
            </div>
          ) : error && !saving ? (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">
                {searchQuery ? 'No members match your search' : 'No team members found — invite one first'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedMembers.map(member => (
                <button
                  key={member.userId}
                  onClick={() => setSelectedCreatorId(member.userId)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                    selectedCreatorId === member.userId
                      ? 'bg-white/10 border border-white/20'
                      : 'bg-white/[0.02] border border-transparent hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {member.photoURL ? (
                      <ProxiedImage
                        src={member.photoURL}
                        alt={member.displayName || 'Member'}
                        className="w-9 h-9 rounded-full object-cover"
                        fallback={
                          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-white/60">
                              {(member.displayName || member.email || 'M').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-white/60">
                          {(member.displayName || member.email || 'M').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="text-left">
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        {member.displayName || 'Unnamed'}
                        {member.role === 'creator' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full font-medium">Creator</span>
                        )}
                      </div>
                      <div className="text-xs text-white/40">{member.email}</div>
                    </div>
                  </div>
                  {selectedCreatorId === member.userId && (
                    <CheckCircle className="w-5 h-5 text-white" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error during save */}
        {error && saving && (
          <div className="px-6 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedCreatorId}
            className="px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                Assigning...
              </>
            ) : (
              `Assign ${assignCount}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkAssignCreatorModal;
