import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import CreatorLinksService from '../services/CreatorLinksService';
import { X, Check, Mail, User as UserIcon, Link as LinkIcon, Search, UserPlus, AlertCircle, Phone, FileText } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import clsx from 'clsx';

interface CreateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalMode = 'add' | 'invite';

const CreateCreatorModal: React.FC<CreateCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode: "add" = add profile directly, "invite" = send invitation email
  const [mode, setMode] = useState<ModalMode>('add');

  // Shared fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Invite-specific fields
  const [creatorWorkflow, setCreatorWorkflow] = useState<'account' | 'video'>('account');
  const [availableAccounts, setAvailableAccounts] = useState<TrackedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Note: Creators do NOT count against team seats - they are separate from team members

  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      loadAvailableAccounts();
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  const loadAvailableAccounts = async () => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      setLoadingAccounts(true);
      const accounts = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      setAvailableAccounts(accounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setError('Failed to load tracked accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setMode('add');
    setCreatorWorkflow('account');
    setSelectedAccountIds([]);
    setSearchQuery('');
    setError(null);
    onClose();
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId || !currentProjectId) {
      setError('Missing required information');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Validate email if provided
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      await CreatorLinksService.addCreatorProfile(
        currentOrgId,
        currentProjectId,
        user.uid,
        {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        }
      );

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to add creator:', error);
      setError(error.message || 'Failed to add creator');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId || !currentProjectId) {
      setError('Missing required information');
      return;
    }

    if (!email.trim()) {
      setError('Email is required to send an invitation');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Get organization details
      const orgs = await OrganizationService.getUserOrganizations(user.uid);
      const currentOrg = orgs.find(o => o.id === currentOrgId);
      if (!currentOrg) {
        throw new Error('Organization not found');
      }

      // Send invitation with workflow type and selected accounts
      await TeamInvitationService.createInvitation(
        currentOrgId,
        email.trim(),
        'creator',
        user.uid,
        user.displayName || user.email || 'Team Member',
        user.email || '',
        currentOrg.name,
        currentProjectId,
        {
          creatorWorkflow,
          selectedAccountIds: creatorWorkflow === 'account' ? selectedAccountIds : undefined,
        }
      );

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to create creator:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'add') {
      handleSubmitAdd(e);
    } else {
      handleSubmitInvite(e);
    }
  };

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const filteredAccounts = availableAccounts.filter(account =>
    account.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSubmitDisabled = mode === 'add' ? !name.trim() : !email.trim();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-2xl border border-border w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-content rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-content-inverse" />
            </div>
            <h2 className="text-xl font-semibold text-content">Add Creator</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-surface-secondary rounded-xl">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={clsx(
                'py-2.5 px-4 rounded-lg text-sm font-semibold transition-all',
                mode === 'add'
                  ? 'bg-content text-content-inverse shadow-sm'
                  : 'text-content-muted hover:text-content'
              )}
            >
              Add Profile
            </button>
            <button
              type="button"
              onClick={() => setMode('invite')}
              className={clsx(
                'py-2.5 px-4 rounded-lg text-sm font-semibold transition-all',
                mode === 'invite'
                  ? 'bg-content text-content-inverse shadow-sm'
                  : 'text-content-muted hover:text-content'
              )}
            >
              Invite to Portal
            </button>
          </div>
          <p className="mt-2 text-xs text-content-muted">
            {mode === 'add'
              ? 'Add a creator profile to track and manage. No invitation email will be sent.'
              : 'Send an invitation email so the creator can access their portal.'}
          </p>
        </div>

        {/* Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-400">{error}</div>
              </div>
            </div>
          )}

          {/* === ADD MODE === */}
          {mode === 'add' && (
            <>
              {/* Name Input */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Creator's full name"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Email Input (optional) */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Email <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="creator@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Phone Input (optional) */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Phone <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Notes Input (optional) */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Notes <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this creator..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors resize-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* === INVITE MODE === */}
          {mode === 'invite' && (
            <>
              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="creator@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
                <p className="mt-2 text-xs text-content-muted">
                  We'll send an invitation link to this email address
                </p>
              </div>

              {/* Creator Workflow Type */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Creator Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreatorWorkflow('account')}
                    className={clsx(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      creatorWorkflow === 'account'
                        ? 'border-content bg-surface-active'
                        : 'border-border hover:border-border-strong'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <LinkIcon className="w-4 h-4 text-content" />
                      <span className="text-sm font-semibold text-content">Link Account</span>
                    </div>
                    <p className="text-xs text-content-muted">
                      Track all videos from their account (UGC)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorWorkflow('video')}
                    className={clsx(
                      'p-3 rounded-xl border-2 text-left transition-all',
                      creatorWorkflow === 'video'
                        ? 'border-content bg-surface-active'
                        : 'border-border hover:border-border-strong'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserIcon className="w-4 h-4 text-content" />
                      <span className="text-sm font-semibold text-content">Track Videos</span>
                    </div>
                    <p className="text-xs text-content-muted">
                      Only track specific videos they submit (Influencer)
                    </p>
                  </button>
                </div>
              </div>

              {/* Managed Accounts -- only for account workflow */}
              {creatorWorkflow === 'account' && <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Managed Accounts <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <p className="text-xs text-content-muted mb-3">
                  Select which tracked accounts this creator manages
                </p>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search accounts..."
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>

                {/* Accounts List */}
                <div className="bg-surface-tertiary border border-border rounded-xl p-3 max-h-64 overflow-y-auto">
                  {loadingAccounts ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-border-strong border-t-content"></div>
                    </div>
                  ) : filteredAccounts.length === 0 ? (
                    <div className="text-center py-8">
                      <LinkIcon className="w-12 h-12 text-content-muted mx-auto mb-2" />
                      <p className="text-sm text-content-muted">
                        {searchQuery ? 'No accounts match your search' : 'No tracked accounts found'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAccounts.map((account) => (
                        <div
                          key={account.id}
                          onClick={() => toggleAccountSelection(account.id)}
                          className={clsx(
                            'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
                            selectedAccountIds.includes(account.id)
                              ? 'bg-surface-active border border-border-strong'
                              : 'bg-surface-secondary border border-transparent hover:bg-surface-active'
                          )}
                        >
                          <div className={clsx(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                            selectedAccountIds.includes(account.id)
                              ? 'bg-content border-content'
                              : 'border-border-strong'
                          )}>
                            {selectedAccountIds.includes(account.id) && (
                              <Check className="w-3 h-3 text-content-inverse" />
                            )}
                          </div>

                          {/* Profile Picture */}
                          <div className="flex-shrink-0">
                            {account.profilePicture ? (
                              <img
                                src={account.profilePicture}
                                alt={account.username}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={clsx(
                              "w-10 h-10 rounded-full bg-surface-active flex items-center justify-center",
                              account.profilePicture ? 'hidden' : ''
                            )}>
                              <UserIcon className="w-5 h-5 text-content-muted" />
                            </div>
                          </div>

                          <PlatformIcon platform={account.platform} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-content truncate">
                              @{account.username}
                            </p>
                            {account.displayName && (
                              <p className="text-xs text-content-muted truncate">{account.displayName}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedAccountIds.length > 0 && (
                  <p className="mt-2 text-xs text-content-muted">
                    {selectedAccountIds.length} account{selectedAccountIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>}
            </>
          )}
        </form>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-surface-secondary text-content border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] font-semibold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || isSubmitDisabled}
            className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? (mode === 'add' ? 'Adding...' : 'Sending...')
              : (mode === 'add' ? 'Add Creator' : 'Send Invitation')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateCreatorModal;
