import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { X, Check, Mail, User as UserIcon, Link as LinkIcon, DollarSign, Search, Copy, Lightbulb } from 'lucide-react';
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

const PAYMENT_TEMPLATES = [
  {
    title: 'Upfront + Milestone',
    example: '$500 upfront for 10 videos, then $50 per video after that'
  },
  {
    title: 'Tiered Views',
    example: '$30 per video under 10k views, $50 per video for 10k-100k views, $100 per video over 100k views'
  },
  {
    title: 'Hybrid Performance',
    example: '$200 base per video + $10 CPM for views over 50k'
  },
  {
    title: 'Revenue Share',
    example: '20% of ad revenue + $5 per tracked link click'
  },
  {
    title: 'Multi-Stage Bonus',
    example: '$300 upfront for 10 videos, bonus $500 when reaching 100k total views, additional $1k at 1M views'
  },
  {
    title: 'Custom Schedule',
    example: '$1000/month retainer for 8 videos minimum, plus $75 for each additional video'
  }
];

const CreateCreatorModal: React.FC<CreateCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Step 2: Linked Accounts
  const [availableAccounts, setAvailableAccounts] = useState<TrackedAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Step 3: Payment Settings
  const [isPaid, setIsPaid] = useState(true);
  const [paymentStructure, setPaymentStructure] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const totalSteps = 3;

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
    setDisplayName('');
    setSelectedAccountIds([]);
    setSearchQuery('');
    setIsPaid(true);
    setPaymentStructure('');
    setShowTemplates(false);
    setError(null);
    onClose();
  };

  const handleNext = () => {
    if (step === 1) {
      if (!displayName.trim()) {
        setError('Please enter a display name');
        return;
      }
      // Email is optional, but if provided, must be valid
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

    try {
      setLoading(true);
      setError(null);

      // Get organization details
      const orgs = await OrganizationService.getUserOrganizations(user.uid);
      const currentOrg = orgs.find(o => o.id === currentOrgId);
      if (!currentOrg) {
        throw new Error('Organization not found');
      }

      if (email.trim()) {
        // If email is provided, send invitation as before
        await TeamInvitationService.createInvitation(
          currentOrgId,
          email,
          'creator',
          user.uid,
          user.displayName || user.email || 'Team Member',
          user.email || '',
          currentOrg.name,
          currentProjectId
        );
      } else {
        // If no email, create creator directly without sending invitation
        const creatorId = `creator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const creatorData = {
          id: creatorId,
          orgId: currentOrgId,
          projectId: currentProjectId,
          displayName: displayName.trim(),
          email: undefined,
          linkedAccountsCount: selectedAccountIds.length,
          totalEarnings: 0,
          payoutsEnabled: false,
          createdAt: new Date(),
          isPaid: isPaid,
          paymentStructure: paymentStructure.trim() || undefined,
          status: 'pending' // Pending until they claim their account with email
        };

        // Create creator document
        const creatorRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creators', creatorId);
        await setDoc(creatorRef, creatorData);

        // Link selected accounts to this creator
        for (const accountId of selectedAccountIds) {
          const linkId = `${creatorId}_${accountId}`;
          const linkRef = doc(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creatorLinks', linkId);
          await setDoc(linkRef, {
            id: linkId,
            orgId: currentOrgId,
            projectId: currentProjectId,
            creatorId: creatorId,
            accountId: accountId,
            createdAt: new Date(),
            createdBy: user.uid
          });
        }
      }

      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create creator:', error);
      setError(error.message || 'Failed to create creator');
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
      const hasDisplayName = displayName.trim().length > 0;
      // Email is now optional, but if provided, must be valid
      const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return hasDisplayName && emailValid;
    }
    return true;
  };

  const handleCopyTemplate = (example: string) => {
    setPaymentStructure(example);
    setShowTemplates(false);
  };

  // Step 1: Basic Info
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Display Name *
        </label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="John Doe"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
            autoFocus
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Email Address <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="creator@example.com"
            className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
          />
        </div>
      </div>

      <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4">
        <p className="text-sm text-gray-300">
          {email.trim() 
            ? "An invitation will be sent to this email address." 
            : "Without an email, the creator will be added directly. You can add their email later."}
        </p>
      </div>
    </div>
  );

  // Step 2: Link Accounts
  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white mb-3">
          Link Tracked Accounts (Optional)
        </label>
        <p className="text-sm text-gray-400 mb-4">
          Select which accounts this creator manages. You can also do this later.
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
          />
        </div>

        {/* Accounts List */}
        {loadingAccounts ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-white"></div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-8 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <LinkIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {searchQuery ? 'No accounts match your search' : 'No tracked accounts available'}
            </p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-700/50 rounded-lg p-2">
            {filteredAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => toggleAccountSelection(account.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  selectedAccountIds.includes(account.id)
                    ? 'bg-white/10 border-2 border-white/50'
                    : 'bg-gray-800/50 border-2 border-transparent hover:bg-gray-700/50'
                }`}
              >
                <div className="flex-shrink-0">
                  {account.profilePicture ? (
                    <img
                      src={account.profilePicture}
                      alt={account.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {account.displayName || account.username}
                    </span>
                    <PlatformIcon platform={account.platform} size="sm" />
                  </div>
                  <span className="text-xs text-gray-400">@{account.username}</span>
                </div>
                {selectedAccountIds.includes(account.id) && (
                  <Check className="w-5 h-5 text-white flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {selectedAccountIds.length > 0 && (
          <div className="mt-4 bg-white/10 border border-white/20 rounded-lg p-3">
            <p className="text-sm text-white font-medium">
              {selectedAccountIds.length} account{selectedAccountIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Step 3: Payment Settings
  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-white mb-3">
          Payment Status
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsPaid(true)}
            className={clsx(
              "p-4 rounded-lg border-2 transition-all",
              isPaid
                ? 'bg-white/10 border-white/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
            )}
          >
            <DollarSign className={clsx("w-6 h-6 mx-auto mb-2", isPaid ? 'text-white' : 'text-gray-400')} />
            <div className="text-sm font-medium text-white">Paid Creator</div>
            <div className="text-xs text-gray-400 mt-1">Receives payments</div>
          </button>

          <button
            onClick={() => setIsPaid(false)}
            className={clsx(
              "p-4 rounded-lg border-2 transition-all",
              !isPaid
                ? 'bg-white/10 border-white/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
            )}
          >
            <UserIcon className={clsx("w-6 h-6 mx-auto mb-2", !isPaid ? 'text-white' : 'text-gray-400')} />
            <div className="text-sm font-medium text-white">Unpaid Creator</div>
            <div className="text-xs text-gray-400 mt-1">No payments</div>
          </button>
        </div>
      </div>

      {isPaid && (
        <>
          {/* Payment Structure - Freeform Text Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white">
                Payment Structure *
              </label>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                {showTemplates ? 'Hide' : 'Show'} Examples
              </button>
            </div>

            {/* Template Examples */}
            {showTemplates && (
              <div className="mb-3 bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-white/80 mb-2">Click to use a template:</p>
                {PAYMENT_TEMPLATES.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCopyTemplate(template.example)}
                    className="w-full text-left p-2 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-white/90 mb-1">{template.title}</div>
                        <div className="text-xs text-gray-400">{template.example}</div>
                      </div>
                      <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-white flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={paymentStructure}
              onChange={(e) => setPaymentStructure(e.target.value)}
              placeholder="E.g., $500 upfront for 10 videos, then $50 per video + $10 CPM for views over 50k, bonus $1000 when reaching 100k total views"
              rows={5}
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none text-sm leading-relaxed"
            />
            <p className="text-xs text-gray-400 mt-2">
              Describe your complete payment structure in plain English. Be as specific as possible.
            </p>
          </div>
        </>
      )}

      <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg p-4">
        <p className="text-sm text-gray-300">
          <strong>Note:</strong> Payment settings can be edited after the creator accepts the invitation.
        </p>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Creator Information';
      case 2:
        return 'Link Accounts';
      case 3:
        return 'Payment Settings';
      default:
        return '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="space-y-6">
        {/* Custom Header with Step Indicator */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Invite Creator</h2>
          <div className="flex items-center gap-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors border-2",
                      stepNum === step
                        ? 'bg-white text-black border-white'
                        : stepNum < step
                        ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-transparent text-gray-500 border-gray-700'
                    )}
                  >
                    {stepNum < step ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  {stepNum < totalSteps && (
                    <div
                      className={clsx(
                        "w-8 h-0.5 mx-1",
                        stepNum < step ? 'bg-gray-600' : 'bg-gray-700'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium text-white mb-1">
            {getStepTitle()}
          </h3>
          <p className="text-sm text-gray-400">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[300px]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-700">
          <Button
            variant="ghost"
            onClick={step === 1 ? handleClose : handleBack}
            disabled={loading}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="bg-white hover:bg-gray-200 text-black font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-white hover:bg-gray-200 text-black font-semibold"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CreateCreatorModal;
