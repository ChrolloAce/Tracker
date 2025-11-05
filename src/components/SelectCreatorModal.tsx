import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CreatorLinksService from '../services/CreatorLinksService';
import OrganizationService from '../services/OrganizationService';
import { OrgMember } from '../types/firestore';

interface SelectCreatorModalProps {
  accountId: string;
  accountName: string;
  currentCreatorId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * SelectCreatorModal
 * Modal for selecting a creator to link to an account
 */
const SelectCreatorModal: React.FC<SelectCreatorModalProps> = ({
  accountId,
  accountName,
  currentCreatorId,
  onClose,
  onSuccess,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(currentCreatorId || null);
  const [initialCreatorId, setInitialCreatorId] = useState<string | null>(currentCreatorId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, accountId]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      // Load all creators for this organization
      const allMembers = await OrganizationService.getOrgMembers(currentOrgId);
      const creatorMembers = allMembers.filter((member: OrgMember) => member.role === 'creator');
      setCreators(creatorMembers);

      // Load current creator link for this account
      const links = await CreatorLinksService.getAccountLinkedCreators(
        currentOrgId,
        currentProjectId,
        accountId
      );
      
      if (links.length > 0) {
        const currentId = links[0].creatorId;
        setInitialCreatorId(currentId);
        setSelectedCreatorId(currentId);
      } else {
        setInitialCreatorId(null);
        setSelectedCreatorId(null);
      }
    } catch (error) {
      console.error('Failed to load creators:', error);
      setError('Failed to load creators');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setSaving(true);
    setError(null);

    try {
      // First, unlink from current creator if exists
      if (initialCreatorId && initialCreatorId !== selectedCreatorId) {
        await CreatorLinksService.unlinkCreatorFromAccount(
          currentOrgId,
          currentProjectId,
          initialCreatorId,
          accountId
        );
      }

      // Then link to new creator if selected
      if (selectedCreatorId && selectedCreatorId !== initialCreatorId) {
        await CreatorLinksService.linkCreatorToAccounts(
          currentOrgId,
          currentProjectId,
          selectedCreatorId,
          [accountId],
          'admin' // linkedBy - we can enhance this later
        );
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to update creator link:', error);
      setError('Failed to update creator link');
    } finally {
      setSaving(false);
    }
  };

  const filteredCreators = creators.filter(creator => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = (creator.displayName || '').toLowerCase();
    const email = (creator.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const hasChanges = selectedCreatorId !== initialCreatorId;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Select Creator</h2>
            <p className="text-sm text-white/50 mt-1">
              Choose a creator to link to <span className="font-medium text-white/70">{accountName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-white/10">
          <input
            type="text"
            placeholder="Search creators by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
          />
        </div>

        {/* Creators List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">
                {searchQuery ? 'No creators found matching your search' : 'No creators in this organization'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* None Option */}
              <button
                onClick={() => setSelectedCreatorId(null)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                  selectedCreatorId === null
                    ? 'bg-purple-500/20 border-2 border-purple-500/50'
                    : 'bg-white/5 border-2 border-transparent hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <X className="w-5 h-5 text-white/40" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">No Creator</div>
                    <div className="text-xs text-white/40">Unlink from any creator</div>
                  </div>
                </div>
                {selectedCreatorId === null && (
                  <CheckCircle className="w-5 h-5 text-purple-500 fill-purple-500" />
                )}
              </button>

              {/* Creator Options */}
              {filteredCreators.map((creator) => (
                <button
                  key={creator.userId}
                  onClick={() => setSelectedCreatorId(creator.userId)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                    selectedCreatorId === creator.userId
                      ? 'bg-purple-500/20 border-2 border-purple-500/50'
                      : 'bg-white/5 border-2 border-transparent hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">
                        {creator.displayName || 'Unnamed Creator'}
                      </div>
                      <div className="text-xs text-white/40">{creator.email}</div>
                    </div>
                  </div>
                  {selectedCreatorId === creator.userId && (
                    <CheckCircle className="w-5 h-5 text-purple-500 fill-purple-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
          <div className="text-sm text-white/50">
            {hasChanges && (
              <span className="text-purple-400">
                {selectedCreatorId ? 'Will link to creator' : 'Will unlink from current creator'}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectCreatorModal;

