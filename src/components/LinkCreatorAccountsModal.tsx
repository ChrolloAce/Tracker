import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, TrackedAccount } from '../types/firestore';
import { X, Link as LinkIcon, Search, Check, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';

interface LinkCreatorAccountsModalProps {
  creator: OrgMember;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * LinkCreatorAccountsModal
 * Modal for admins to link creators to organization accounts
 */
const LinkCreatorAccountsModal: React.FC<LinkCreatorAccountsModalProps> = ({
  creator,
  onClose,
  onSuccess,
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [linkedAccountIds, setLinkedAccountIds] = useState<Set<string>>(new Set());
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, creator.userId]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      // Load accounts for THIS PROJECT
      const accountsData = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(accountsData);

      // Load currently linked accounts for this creator in THIS PROJECT
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      const linkedIds = new Set(links.map(link => link.accountId));
      setLinkedAccountIds(linkedIds);
      setSelectedAccountIds(new Set(linkedIds)); // Pre-select already linked accounts
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccountIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setSaving(true);
    setError(null);

    try {
      // Determine which accounts to link and unlink
      const accountsToLink = Array.from(selectedAccountIds).filter(
        id => !linkedAccountIds.has(id)
      );
      const accountsToUnlink = Array.from(linkedAccountIds).filter(
        id => !selectedAccountIds.has(id)
      );

      // Link new accounts in THIS PROJECT
      if (accountsToLink.length > 0) {
        await CreatorLinksService.linkCreatorToAccounts(
          currentOrgId,
          currentProjectId,
          creator.userId,
          accountsToLink,
          user.uid
        );
      }

      // Unlink removed accounts from THIS PROJECT
      for (const accountId of accountsToUnlink) {
        await CreatorLinksService.unlinkCreatorFromAccount(
          currentOrgId,
          currentProjectId,
          creator.userId,
          accountId
        );
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to update account links:', error);
      setError(error.message || 'Failed to update account links');
      setSaving(false);
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const changesCount = 
    Array.from(selectedAccountIds).filter(id => !linkedAccountIds.has(id)).length +
    Array.from(linkedAccountIds).filter(id => !selectedAccountIds.has(id)).length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <LinkIcon className="w-6 h-6 text-white/70" />
            <div>
              <h2 className="text-xl font-semibold text-white">Link Tracked Accounts</h2>
              <p className="text-sm text-white/50 mt-0.5">
                Select from your project's tracked accounts to link to {creator.displayName || creator.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0D0D0D]">
          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {/* Search */}
          <div className="px-6 pt-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts by handle or name..."
                className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="text-white/50">
                {selectedAccountIds.size} of {accounts.length} tracked accounts selected
                {changesCount > 0 && (
                  <span className="ml-2 text-white font-medium">
                    • {changesCount} change{changesCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {accounts.length === 0 && (
                <div className="text-yellow-400/80">
                  No tracked accounts in this project
                </div>
              )}
            </div>
          </div>

          {/* Accounts List */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-white/50">Loading accounts...</div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-white/60 mb-2">
                    {searchQuery ? 'No accounts found' : 'No tracked accounts in this project'}
                  </div>
                  {searchQuery ? (
                    <div className="text-xs text-white/40">
                      Try a different search term
                    </div>
                  ) : (
                    <div className="text-xs text-white/40">
                      Add tracked accounts to this project first in the "Tracked Accounts" tab
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((account) => {
                  const isSelected = selectedAccountIds.has(account.id);
                  const wasLinked = linkedAccountIds.has(account.id);

                  return (
                    <button
                      key={account.id}
                      onClick={() => handleToggleAccount(account.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-white/5 border-white/20 hover:bg-white/10'
                          : 'bg-black/30 border-white/10 hover:bg-black/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-white border-white'
                            : 'border-white/30 hover:border-white/50'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-black" />}
                      </div>

                      {/* Profile Picture */}
                      {account.profilePicture ? (
                        <img
                          src={account.profilePicture}
                          alt={`@${account.username}`}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                          <PlatformIcon platform={account.platform} size="sm" />
                        </div>
                      )}

                      {/* Account Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          @{account.username}
                        </div>
                        {account.displayName && (
                          <div className="text-xs text-white/50 truncate">
                            {account.displayName}
                          </div>
                        )}
                      </div>

                      {/* Platform Badge */}
                      <div className="flex-shrink-0">
                        <PlatformIcon platform={account.platform} size="sm" />
                      </div>

                      {/* Status Badge */}
                      {wasLinked && !isSelected && (
                        <div className="text-xs px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          Will unlink
                        </div>
                      )}
                      {!wasLinked && isSelected && (
                        <div className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          Will link
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0A0A0A] flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || changesCount === 0}
            className="flex-1 bg-white hover:bg-gray-200 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : `Save Changes${changesCount > 0 ? ` (${changesCount})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LinkCreatorAccountsModal;

