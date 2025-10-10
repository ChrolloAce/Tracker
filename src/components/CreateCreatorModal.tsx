import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import { X, Check, Mail, User as UserIcon, Link as LinkIcon, DollarSign, Search, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import { Modal } from './ui/Modal';

interface CreateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentRule {
  id: string;
  type: 'flat' | 'per-video' | 'cpm' | 'percentage' | 'custom';
  amount: string;
  condition: string; // e.g., "for 10 videos", "per 1000 views", "of revenue"
  description: string; // Full readable description
}

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
  const [paymentRules, setPaymentRules] = useState<PaymentRule[]>([]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState<'weekly' | 'bi-weekly' | 'monthly' | 'custom'>('monthly');

  // New payment rule form
  const [newRuleType, setNewRuleType] = useState<PaymentRule['type']>('flat');
  const [newRuleAmount, setNewRuleAmount] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('');

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
    setPaymentRules([]);
    setPaymentNotes('');
    setPaymentSchedule('monthly');
    setNewRuleType('flat');
    setNewRuleAmount('');
    setNewRuleCondition('');
    setError(null);
    onClose();
  };

  const handleNext = () => {
    if (step === 1) {
      if (!displayName.trim()) {
        setError('Please enter a display name');
        return;
      }
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

    try {
      setLoading(true);
      setError(null);

      // Get organization details
      const orgs = await OrganizationService.getUserOrganizations(user.uid);
      const currentOrg = orgs.find(o => o.id === currentOrgId);
      if (!currentOrg) {
        throw new Error('Organization not found');
      }

      // Note: Payment rules, account linking, and other details will need to be handled
      // after the creator accepts the invitation

      // Create invitation using TeamInvitationService
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

      // Note: Account linking and payment details will need to be handled after creator accepts
      // You might want to store these temporarily or handle them in a follow-up step

      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create creator invitation:', error);
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
      const hasDisplayName = displayName.trim().length > 0;
      const hasEmail = email.trim().length > 0;
      const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return hasDisplayName && hasEmail && emailValid;
    }
    if (step === 2) {
      return true; // Linking accounts is optional
    }
    if (step === 3) {
      return true; // Payment settings are optional
    }
    return false;
  };

  const addPaymentRule = () => {
    if (!newRuleAmount.trim()) {
      setError('Please enter an amount');
      return;
    }

    const rule: PaymentRule = {
      id: Date.now().toString(),
      type: newRuleType,
      amount: newRuleAmount,
      condition: newRuleCondition,
      description: buildRuleDescription(newRuleType, newRuleAmount, newRuleCondition)
    };

    setPaymentRules([...paymentRules, rule]);
    setNewRuleAmount('');
    setNewRuleCondition('');
    setError(null);
  };

  const removePaymentRule = (id: string) => {
    setPaymentRules(paymentRules.filter(r => r.id !== id));
  };

  const buildRuleDescription = (type: PaymentRule['type'], amount: string, condition: string): string => {
    switch (type) {
      case 'flat':
        return `Pay $${amount} flat fee${condition ? ` for ${condition} videos` : ''}`;
      case 'per-video':
        return `Pay $${amount} per video${condition ? ` (${condition})` : ''}`;
      case 'cpm':
        return `Pay $${amount} CPM${condition ? ` (per ${condition} views)` : ' (per 1000 views)'}`;
      case 'percentage':
        return `Pay ${amount}% of revenue${condition ? ` ${condition}` : ''}`;
      case 'custom':
        return condition || `Pay $${amount}`;
      default:
        return `Pay $${amount}`;
    }
  };

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
          Email Address *
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
          An invitation email will be sent to the creator with instructions to join your project.
        </p>
      </div>
    </div>
  );

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

  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-white mb-3">
          Payment Status
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsPaid(true)}
            className={`p-4 rounded-lg border-2 transition-all ${
              isPaid
                ? 'bg-white/10 border-white/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
            }`}
          >
            <DollarSign className={`w-6 h-6 mx-auto mb-2 ${isPaid ? 'text-white' : 'text-gray-400'}`} />
            <div className="text-sm font-medium text-white">Paid Creator</div>
            <div className="text-xs text-gray-400 mt-1">Receives payments</div>
          </button>

          <button
            onClick={() => setIsPaid(false)}
            className={`p-4 rounded-lg border-2 transition-all ${
              !isPaid
                ? 'bg-white/10 border-white/50'
                : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50'
            }`}
          >
            <UserIcon className={`w-6 h-6 mx-auto mb-2 ${!isPaid ? 'text-white' : 'text-gray-400'}`} />
            <div className="text-sm font-medium text-white">Unpaid Creator</div>
            <div className="text-xs text-gray-400 mt-1">No payments</div>
          </button>
        </div>
      </div>

      {isPaid && (
        <>
          {/* Payment Rule Builder */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Payment Rules
            </label>
            
            {/* Add New Rule Form */}
            <div className="space-y-3 mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <div className="grid grid-cols-5 gap-2">
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as PaymentRule['type'])}
                  className="col-span-2 px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="flat">Flat Fee</option>
                  <option value="per-video">Per Video</option>
                  <option value="cpm">CPM</option>
                  <option value="percentage">% Revenue</option>
                  <option value="custom">Custom</option>
                </select>
                
                <div className="relative col-span-2">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={newRuleAmount}
                    onChange={(e) => setNewRuleAmount(e.target.value)}
                    placeholder={newRuleType === 'percentage' ? '%' : 'Amount'}
                    className="w-full pl-7 pr-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>

                <button
                  onClick={addPaymentRule}
                  className="flex items-center justify-center bg-white hover:bg-gray-200 text-black rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={newRuleCondition}
                onChange={(e) => setNewRuleCondition(e.target.value)}
                placeholder={
                  newRuleType === 'flat' ? 'e.g., "10" (for 10 videos)' :
                  newRuleType === 'cpm' ? 'e.g., "1000" (per 1000 views)' :
                  newRuleType === 'custom' ? 'Describe the payment rule...' :
                  'Optional condition or details...'
                }
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />

              {/* Preview */}
              {newRuleAmount && (
                <div className="text-xs text-gray-300 italic">
                  Preview: {buildRuleDescription(newRuleType, newRuleAmount, newRuleCondition)}
                </div>
              )}
            </div>

            {/* Current Rules */}
            {paymentRules.length > 0 && (
              <div className="space-y-2">
                {paymentRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{rule.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {rule.type === 'flat' && 'One-time or periodic flat payment'}
                        {rule.type === 'per-video' && 'Payment per video published'}
                        {rule.type === 'cpm' && 'Payment based on views (Cost Per Mille)'}
                        {rule.type === 'percentage' && 'Percentage of revenue share'}
                        {rule.type === 'custom' && 'Custom payment structure'}
                      </p>
                    </div>
                    <button
                      onClick={() => removePaymentRule(rule.id)}
                      className="ml-3 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {paymentRules.length === 0 && (
              <div className="text-center py-6 bg-gray-800/30 rounded-lg border border-gray-700/30">
                <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No payment rules added yet</p>
                <p className="text-xs text-gray-500 mt-1">Add flexible payment rules above</p>
              </div>
            )}
          </div>

          {/* Payment Schedule */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Payment Schedule
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentSchedule('weekly')}
                className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                  paymentSchedule === 'weekly'
                    ? 'bg-white/10 border-white text-white'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setPaymentSchedule('bi-weekly')}
                className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                  paymentSchedule === 'bi-weekly'
                    ? 'bg-white/10 border-white text-white'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Bi-weekly
              </button>
              <button
                onClick={() => setPaymentSchedule('monthly')}
                className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                  paymentSchedule === 'monthly'
                    ? 'bg-white/10 border-white text-white'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setPaymentSchedule('custom')}
                className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                  paymentSchedule === 'custom'
                    ? 'bg-white/10 border-white text-white'
                    : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:bg-gray-700/50'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Payment Notes */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Additional payment terms, conditions, or notes..."
              rows={3}
              className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none"
            />
          </div>
        </>
      )}
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
        {/* Custom Header with Title, Steps, and Close Button in One Row */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Invite Creator</h2>
          
          <div className="flex items-center gap-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors border-2 ${
                      stepNum === step
                        ? 'bg-white text-black border-white'
                        : stepNum < step
                        ? 'bg-gray-600 text-white border-gray-600'
                        : 'bg-transparent text-gray-500 border-gray-700'
                    }`}
                  >
                    {stepNum < step ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  {stepNum < totalSteps && (
                    <div
                      className={`w-8 h-0.5 mx-1 ${
                        stepNum < step ? 'bg-gray-600' : 'bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Title and Description */}
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
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={loading}
              className="text-gray-400 hover:text-white"
            >
              Back
            </Button>
          )}

          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="bg-white hover:bg-gray-200 text-black font-semibold"
            >
              Next
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
