import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import UsageTrackingService from '../services/UsageTrackingService';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { X, Check, Mail, User as UserIcon, Link as LinkIcon, Search, UserPlus, AlertCircle, Crown } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import clsx from 'clsx';

interface CreateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCreatorModal: React.FC<CreateCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single step: Email + Linked Accounts
  const [email, setEmail] = useState('');
  const [availableAccounts, setAvailableAccounts] = useState<TrackedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // Team limit check
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ current: number; limit: number; active: number; pending: number } | null>(null);
  const [checkingLimit, setCheckingLimit] = useState(true);

  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      loadAvailableAccounts();
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  // Check team seat limit when modal opens
  useEffect(() => {
    const checkLimit = async () => {
      if (!currentOrgId || !user || !isOpen) {
        console.log('❌ [Creator Modal] Missing orgId, user, or modal closed');
        return;
      }

      try {
        setCheckingLimit(true);
        console.log('🔍 [CLIENT] [Creator Modal] Checking team seat limit for org:', currentOrgId);
        
        // Get organization's plan limits
        const limits = await UsageTrackingService.getLimits(currentOrgId);
        const seatLimit = limits.teamSeats;
        
        // Count active members
        const membersRef = collection(db, 'organizations', currentOrgId, 'members');
        const activeMembersQuery = query(membersRef, where('status', '==', 'active'));
        const activeMembersSnap = await getDocs(activeMembersQuery);
        const activeMembersCount = activeMembersSnap.size;
        
        // Count pending invitations
        const invitationsRef = collection(db, 'organizations', currentOrgId, 'teamInvitations');
        const pendingInvitesQuery = query(invitationsRef, where('status', '==', 'pending'));
        const pendingInvitesSnap = await getDocs(pendingInvitesQuery);
        const pendingInvitesCount = pendingInvitesSnap.size;
        
        const currentSeatsUsed = activeMembersCount + pendingInvitesCount;
        const isAtLimitValue = seatLimit !== -1 && currentSeatsUsed >= seatLimit;
        
        setLimitInfo({
          current: currentSeatsUsed,
          limit: seatLimit,
          active: activeMembersCount,
          pending: pendingInvitesCount
        });
        
        console.log(`👥 [CLIENT] [Creator Modal] Team seats: ${currentSeatsUsed}/${seatLimit} (${activeMembersCount} active + ${pendingInvitesCount} pending)`);
        console.log(`🚦 [CLIENT] [Creator Modal] At limit? ${isAtLimitValue}`);
        
        setIsAtLimit(isAtLimitValue);
      } catch (error) {
        console.error('❌ [CLIENT] [Creator Modal] Failed to check team limit:', error);
      } finally {
        setCheckingLimit(false);
        console.log('✅ [CLIENT] [Creator Modal] Limit check complete');
      }
    };

    checkLimit();
  }, [currentOrgId, user, isOpen]);

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
    setEmail('');
    setSelectedAccountIds([]);
    setSearchQuery('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId || !currentProjectId) {
      setError('Missing required information');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
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

      // Check if at limit (should be disabled, but as a fallback)
      if (isAtLimit && limitInfo) {
        throw new Error(
          `You've reached your team member limit (${limitInfo.limit} seats). You currently have ${limitInfo.active} active members and ${limitInfo.pending} pending invitations. Upgrade your plan to invite more creators.`
        );
      }

      // Get organization details
      const orgs = await OrganizationService.getUserOrganizations(user.uid);
      const currentOrg = orgs.find(o => o.id === currentOrgId);
      if (!currentOrg) {
        throw new Error('Organization not found');
      }

      // Send invitation (display name will be set from email automatically)
      await TeamInvitationService.createInvitation(
        currentOrgId,
        email.trim(),
        'creator',
        user.uid,
        user.displayName || user.email || 'Team Member',
        user.email || '',
        currentOrg.name,
        currentProjectId
      );

      // TODO: Link selected accounts to the creator after they accept
      // This would require storing selectedAccountIds and linking them after invitation acceptance

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to create creator:', error);
      setError(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white dark:text-black" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Invite Creator</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Team Limit Warning */}
          {!checkingLimit && isAtLimit && limitInfo && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">
                    Team Member Limit Reached
                  </div>
                  <div className="text-xs text-red-600/80 dark:text-red-400/80">
                    You're using {limitInfo.current}/{limitInfo.limit} seats 
                    ({limitInfo.active} active {limitInfo.active === 1 ? 'member' : 'members'} + {limitInfo.pending} pending {limitInfo.pending === 1 ? 'invitation' : 'invitations'})
                  </div>
                </div>
              </div>
              <a
                href="/settings?tab=billing"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-white text-black hover:bg-gray-100 dark:hover:bg-gray-100 text-sm font-semibold rounded-lg transition-all"
              >
                <Crown className="w-4 h-4" />
                Upgrade Plan
              </a>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent transition-colors"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              We'll send an invitation link to this email address
            </p>
          </div>

          {/* Managed Accounts */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Managed Accounts <span className="text-gray-500 dark:text-gray-400 font-normal">(Optional)</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Select which tracked accounts this creator manages
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent transition-colors"
              />
            </div>

            {/* Accounts List */}
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3 max-h-64 overflow-y-auto">
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 dark:border-white/20 border-t-gray-900 dark:border-t-white"></div>
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <LinkIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
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
                          ? 'bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-white/20'
                          : 'bg-white dark:bg-white/5 border border-transparent hover:bg-gray-100 dark:hover:bg-white/10'
                      )}
                    >
                      <div className={clsx(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                        selectedAccountIds.includes(account.id)
                          ? 'bg-black dark:bg-white border-black dark:border-white'
                          : 'border-gray-300 dark:border-white/20'
                      )}>
                        {selectedAccountIds.includes(account.id) && (
                          <Check className="w-3 h-3 text-white dark:text-black" />
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
                          "w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center",
                          account.profilePicture ? 'hidden' : ''
                        )}>
                          <UserIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                      
                      <PlatformIcon platform={account.platform} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          @{account.username}
                        </p>
                        {account.displayName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{account.displayName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {selectedAccountIds.length > 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedAccountIds.length} account{selectedAccountIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
        </form>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !email.trim() || isAtLimit || checkingLimit}
            className={`flex-1 px-4 py-3 font-semibold rounded-xl transition-colors disabled:cursor-not-allowed ${
              isAtLimit 
                ? 'bg-red-500 dark:bg-red-500 text-white opacity-75 cursor-not-allowed' 
                : 'bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-black disabled:opacity-50'
            }`}
          >
            {checkingLimit ? 'Checking...' : loading ? 'Sending...' : isAtLimit ? 'Limit Reached' : 'Send Invitation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCreatorModal;
