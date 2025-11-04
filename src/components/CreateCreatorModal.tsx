import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { X, Check, Mail, User as UserIcon, Link as LinkIcon, Search } from 'lucide-react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import { Modal } from './ui/Modal';
import clsx from 'clsx';

interface CreateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCreatorModal: React.FC<CreateCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Email (Required - we get display name from email)
  const [email, setEmail] = useState('');

  // Step 2: Linked Accounts (Optional)
  const [availableAccounts, setAvailableAccounts] = useState<TrackedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const totalSteps = 2;

  useEffect(() => {
    if (isOpen && step === 2 && currentOrgId && currentProjectId) {
      loadAvailableAccounts();
    }
  }, [isOpen, step, currentOrgId, currentProjectId]);

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
    setStep(1);
    setEmail('');
    setSelectedAccountIds([]);
    setSearchQuery('');
    setError(null);
    onClose();
  };

  const handleNext = () => {
    if (step === 1) {
      // Email is required
      if (!email.trim()) {
        setError('Please enter an email address');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
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

      handleClose();
      onSuccess();
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

  const canProceed = () => {
    if (step === 1) {
      // Email is required and must be valid
      return email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    if (step === 2) {
      // Accounts are optional
      return true;
    }
    return true;
  };

  // Step 1: Email
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Creator Email Address *
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="creator@example.com"
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-gray-600 transition-colors"
            autoFocus
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          An invitation will be sent to this email. Their display name will be set automatically from their email.
        </p>
      </div>
    </div>
  );

  // Step 2: Link Accounts (Optional)
  const renderStep2 = () => (
    <div className="space-y-5 flex flex-col h-full">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Link Tracked Accounts <span className="text-gray-500 font-normal">(Optional)</span>
        </label>
        <p className="text-sm text-gray-500 mb-4">
          Select which accounts this creator manages. You can also do this later.
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-gray-600 transition-colors"
          />
        </div>
      </div>

      {/* Accounts List - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {loadingAccounts ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-gray-500"></div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <LinkIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? 'No accounts match your search' : 'No tracked accounts found'}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-2 bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                onClick={() => toggleAccountSelection(account.id)}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
                  selectedAccountIds.includes(account.id)
                    ? 'bg-gray-700 border-2 border-gray-600'
                    : 'bg-gray-800/50 border-2 border-transparent hover:bg-gray-700/50'
                )}
              >
                <div className={clsx(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                  selectedAccountIds.includes(account.id)
                    ? 'bg-gray-600 border-gray-600'
                    : 'border-gray-600'
                )}>
                  {selectedAccountIds.includes(account.id) && (
                    <Check className="w-3 h-3 text-white" />
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
                    "w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center",
                    account.profilePicture ? 'hidden' : ''
                  )}>
                    <UserIcon className="w-5 h-5 text-gray-500" />
                  </div>
                </div>
                
                <PlatformIcon platform={account.platform} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    @{account.username}
                  </p>
                  {account.displayName && (
                    <p className="text-xs text-gray-500 truncate">{account.displayName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {selectedAccountIds.length > 0 && (
        <p className="text-sm text-gray-500">
          {selectedAccountIds.length} account{selectedAccountIds.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Creator Email';
      case 2:
        return 'Link Accounts';
      default:
        return '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="flex flex-col h-[600px]">
        {/* Custom Header with Step Indicator */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-700/50">
          <h2 className="text-xl font-semibold text-gray-200">Invite Creator</h2>
          <div className="flex items-center gap-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-1">
              {[1, 2].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                      stepNum === step
                        ? 'bg-gray-600 text-white'
                        : stepNum < step
                        ? 'bg-gray-700 text-gray-400'
                        : 'bg-gray-800 text-gray-600'
                    )}
                  >
                    {stepNum < step ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  {stepNum < totalSteps && (
                    <div
                      className={clsx(
                        "w-6 h-0.5 mx-0.5",
                        stepNum < step ? 'bg-gray-700' : 'bg-gray-800'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="py-4">
          <h3 className="text-lg font-medium text-gray-200 mb-1">
            {getStepTitle()}
          </h3>
          <p className="text-sm text-gray-500">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Step Content - Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        {/* Navigation Buttons - Fixed at Bottom */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-700/50">
          <button
            onClick={step === 1 ? handleClose : handleBack}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="px-5 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-600"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CreateCreatorModal;
