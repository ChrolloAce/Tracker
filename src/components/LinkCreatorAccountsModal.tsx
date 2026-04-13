import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, TrackedAccount } from '../types/firestore';
import { X, Link as LinkIcon, Search, Check, AlertCircle, Loader2 } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { createPortal } from 'react-dom';

interface LinkCreatorAccountsModalProps {
  creator: OrgMember;
  onClose: () => void;
  onSuccess: () => void;
}

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
      const accountsData = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAccounts(accountsData);

      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId, currentProjectId, creator.userId
      );
      const linkedIds = new Set(links.map(link => link.accountId));
      setLinkedAccountIds(linkedIds);
      setSelectedAccountIds(new Set(linkedIds));
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
      if (newSet.has(accountId)) newSet.delete(accountId);
      else newSet.add(accountId);
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    setSaving(true);
    setError(null);

    try {
      const accountsToLink = Array.from(selectedAccountIds).filter(id => !linkedAccountIds.has(id));
      const accountsToUnlink = Array.from(linkedAccountIds).filter(id => !selectedAccountIds.has(id));

      if (accountsToLink.length > 0) {
        await CreatorLinksService.linkCreatorToAccounts(
          currentOrgId, currentProjectId, creator.userId, accountsToLink, user.uid
        );
      }

      for (const accountId of accountsToUnlink) {
        await CreatorLinksService.unlinkCreatorFromAccount(
          currentOrgId, currentProjectId, creator.userId, accountId
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

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-2xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-content rounded-xl flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-content-inverse" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-content">Link Tracked Accounts</h2>
              <p className="text-xs text-content-muted mt-0.5">
                Select accounts to link to {creator.displayName || creator.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {error && (
            <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {/* Search */}
          <div className="px-6 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts by handle or name..."
                className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-all"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="text-content-muted">
                {selectedAccountIds.size} of {accounts.length} accounts selected
                {changesCount > 0 && (
                  <span className="ml-2 text-content font-medium">
                    {changesCount} change{changesCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {accounts.length === 0 && !loading && (
                <div className="text-amber-400">
                  No tracked accounts in this project
                </div>
              )}
            </div>
          </div>

          {/* Accounts List */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-content-muted animate-spin" />
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-content-muted mb-2">
                    {searchQuery ? 'No accounts found' : 'No tracked accounts in this project'}
                  </div>
                  <div className="text-xs text-content-muted">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Add tracked accounts to this project first in the "Tracked Accounts" tab'}
                  </div>
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
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-surface-active border-border-strong'
                          : 'bg-surface-secondary border-border hover:bg-surface-hover'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-content border-content'
                            : 'border-border-strong'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-content-inverse" />}
                      </div>

                      {account.profilePicture ? (
                        <img
                          src={account.profilePicture}
                          alt={`@${account.username}`}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0 ring-1 ring-border">
                          <PlatformIcon platform={account.platform} size="sm" />
                        </div>
                      )}

                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-content truncate">
                          @{account.username}
                        </div>
                        {account.displayName && (
                          <div className="text-xs text-content-muted truncate">
                            {account.displayName}
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        <PlatformIcon platform={account.platform} size="sm" />
                      </div>

                      {wasLinked && !isSelected && (
                        <div className="text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          Will unlink
                        </div>
                      )}
                      {!wasLinked && isSelected && (
                        <div className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
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
        <div className="flex gap-3 px-6 py-5 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-surface-secondary text-content border border-border rounded-lg font-semibold shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || changesCount === 0}
            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Save Changes${changesCount > 0 ? ` (${changesCount})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LinkCreatorAccountsModal;
