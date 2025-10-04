import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TrackedAccount, Payout, PaymentTermPreset, PaymentTermType } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import PayoutsService from '../services/PayoutsService';
import FirestoreDataService from '../services/FirestoreDataService';
import { 
  ArrowLeft, 
  Link as LinkIcon, 
  DollarSign, 
  FileText,
  Edit3,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { Timestamp } from 'firebase/firestore';

interface CreatorDetailsPageProps {
  creator: OrgMember;
  onBack: () => void;
  onUpdate: () => void;
}

const PAYMENT_TERM_TYPES: { value: PaymentTermType; label: string; description: string }[] = [
  { value: 'flat_fee', label: 'Flat Fee', description: 'Fixed payment per deliverable' },
  { value: 'base_cpm', label: 'Base + CPM', description: 'Base payment + cost per 1000 views' },
  { value: 'base_guaranteed_views', label: 'Base + Guaranteed Views', description: 'Base payment with view guarantee' },
  { value: 'cpc', label: 'CPC (Cost per Click)', description: 'Payment per click generated' },
  { value: 'cpa_cps', label: 'CPA / CPS', description: 'Cost per acquisition or sale' },
  { value: 'revenue_share', label: 'Revenue Share / Affiliate', description: 'Percentage of revenue generated' },
  { value: 'tiered_performance', label: 'Tiered Performance Bonuses', description: 'Bonuses based on performance tiers' },
  { value: 'retainer', label: 'Retainer Agreement', description: 'Monthly retainer payment' },
];

/**
 * CreatorDetailsPage - Full dashboard view for managing creator details
 */
const CreatorDetailsPage: React.FC<CreatorDetailsPageProps> = ({
  creator,
  onBack,
  onUpdate,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'payment' | 'payouts'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<TrackedAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [editMode, setEditMode] = useState(false);
  
  // Payment terms state
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentTermType>('flat_fee');
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [cpmRate, setCpmRate] = useState<number>(0);
  const [guaranteedViews, setGuaranteedViews] = useState<number>(0);
  const [cpcRate, setCpcRate] = useState<number>(0);
  const [cpaRate, setCpaRate] = useState<number>(0);
  const [revenueSharePercentage, setRevenueSharePercentage] = useState<number>(0);
  const [retainerAmount, setRetainerAmount] = useState<number>(0);
  const [contractNotes, setContractNotes] = useState<string>('');
  const [contractStartDate, setContractStartDate] = useState<string>('');
  const [contractEndDate, setContractEndDate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, creator.userId]);

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      // Load creator profile
      const profile = await CreatorLinksService.getCreatorProfile(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      setCreatorProfile(profile);

      // Load payment terms from profile
      if (profile?.customPaymentTerms) {
        const terms = profile.customPaymentTerms;
        if (terms.type) setSelectedPaymentType(terms.type);
        if (terms.baseAmount !== undefined) setBaseAmount(terms.baseAmount);
        if (terms.cpmRate !== undefined) setCpmRate(terms.cpmRate);
        if (terms.guaranteedViews !== undefined) setGuaranteedViews(terms.guaranteedViews);
        if (terms.cpcRate !== undefined) setCpcRate(terms.cpcRate);
        if (terms.cpaRate !== undefined) setCpaRate(terms.cpaRate);
        if (terms.revenueSharePercentage !== undefined) setRevenueSharePercentage(terms.revenueSharePercentage);
        if (terms.retainerAmount !== undefined) setRetainerAmount(terms.retainerAmount);
      }
      if (profile?.contractNotes) setContractNotes(profile.contractNotes);
      if (profile?.contractStartDate) {
        setContractStartDate(profile.contractStartDate.toDate().toISOString().split('T')[0]);
      }
      if (profile?.contractEndDate) {
        setContractEndDate(profile.contractEndDate.toDate().toISOString().split('T')[0]);
      }

      // Load linked accounts
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      const accountIds = links.map(link => link.accountId);
      
      // Load all accounts from project
      const projectAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );
      setAllAccounts(projectAccounts);
      
      // Filter to linked accounts
      const linked = projectAccounts.filter(acc => accountIds.includes(acc.id));
      setLinkedAccounts(linked);

      // Load payouts
      const payoutsData = await PayoutsService.getCreatorPayouts(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      setPayouts(payoutsData);
    } catch (error) {
      console.error('Failed to load creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentTerms = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setSaving(true);
    try {
      const customTerms: Partial<PaymentTermPreset> = {
        type: selectedPaymentType,
        baseAmount,
        cpmRate,
        guaranteedViews,
        cpcRate,
        cpaRate,
        revenueSharePercentage,
        retainerAmount,
        currency: 'USD',
      };

      const updates: any = {
        customPaymentTerms: customTerms,
        contractNotes,
      };

      if (contractStartDate) {
        updates.contractStartDate = Timestamp.fromDate(new Date(contractStartDate));
      }
      if (contractEndDate) {
        updates.contractEndDate = Timestamp.fromDate(new Date(contractEndDate));
      }

      await CreatorLinksService.updateCreatorProfile(
        currentOrgId,
        currentProjectId,
        creator.userId,
        updates
      );

      setEditMode(false);
      await loadData();
      onUpdate();
    } catch (error) {
      console.error('Failed to save payment terms:', error);
      alert('Failed to save payment terms');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              {creator.photoURL ? (
                <img
                  src={creator.photoURL}
                  alt={creator.displayName || 'Creator'}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-xl font-medium text-white">
                    {(creator.displayName || creator.email || 'C')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {creator.displayName || 'Creator'}
                </h1>
                <p className="text-sm text-gray-400">{creator.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {editMode ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setEditMode(false)}
                  disabled={saving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSavePaymentTerms} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditMode(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Details
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Linked Accounts</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {linkedAccounts.length}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Total Earned</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${(creatorProfile?.totalEarnings || 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Pending</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${totalPending.toFixed(2)}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Payouts</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {payouts.length}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-6 border-b border-gray-700">
          {(['overview', 'accounts', 'payment', 'payouts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'payment' ? 'Payment Terms' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            creator={creator}
            profile={creatorProfile}
            linkedAccounts={linkedAccounts}
            payouts={payouts}
          />
        )}
        {activeTab === 'accounts' && (
          <AccountsTab
            linkedAccounts={linkedAccounts}
            allAccounts={allAccounts}
            creator={creator}
            onUpdate={loadData}
          />
        )}
        {activeTab === 'payment' && (
          <PaymentTermsTab
            editMode={editMode}
            selectedType={selectedPaymentType}
            onTypeChange={setSelectedPaymentType}
            baseAmount={baseAmount}
            onBaseAmountChange={setBaseAmount}
            cpmRate={cpmRate}
            onCpmRateChange={setCpmRate}
            guaranteedViews={guaranteedViews}
            onGuaranteedViewsChange={setGuaranteedViews}
            cpcRate={cpcRate}
            onCpcRateChange={setCpcRate}
            cpaRate={cpaRate}
            onCpaRateChange={setCpaRate}
            revenueSharePercentage={revenueSharePercentage}
            onRevenueSharePercentageChange={setRevenueSharePercentage}
            retainerAmount={retainerAmount}
            onRetainerAmountChange={setRetainerAmount}
            contractNotes={contractNotes}
            onContractNotesChange={setContractNotes}
            contractStartDate={contractStartDate}
            onContractStartDateChange={setContractStartDate}
            contractEndDate={contractEndDate}
            onContractEndDateChange={setContractEndDate}
          />
        )}
        {activeTab === 'payouts' && <PayoutsTab payouts={payouts} />}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  creator: OrgMember;
  profile: Creator | null;
  linkedAccounts: TrackedAccount[];
  payouts: Payout[];
}> = ({ creator, profile }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Contract Information</h2>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-gray-400">Payment Type:</span>
            <div className="text-white mt-1">
              {profile?.customPaymentTerms?.type 
                ? PAYMENT_TERM_TYPES.find(t => t.value === profile.customPaymentTerms?.type)?.label 
                : 'Not set'}
            </div>
          </div>
          {profile?.contractStartDate && (
            <div>
              <span className="text-sm text-gray-400">Contract Period:</span>
              <div className="text-white mt-1">
                {profile.contractStartDate.toDate().toLocaleDateString()} -{' '}
                {profile.contractEndDate?.toDate().toLocaleDateString() || 'Ongoing'}
              </div>
            </div>
          )}
          {profile?.contractNotes && (
            <div>
              <span className="text-sm text-gray-400">Notes:</span>
              <div className="text-white mt-1 whitespace-pre-wrap">{profile.contractNotes}</div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="text-sm text-gray-400">
            Joined: {creator.joinedAt?.toDate().toLocaleDateString()}
          </div>
          {profile?.lastPayoutAt && (
            <div className="text-sm text-gray-400">
              Last Payout: {profile.lastPayoutAt.toDate().toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Accounts Tab Component  
const AccountsTab: React.FC<{
  linkedAccounts: TrackedAccount[];
  allAccounts: TrackedAccount[];
  creator: OrgMember;
  onUpdate: () => void;
}> = ({ linkedAccounts }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Linked Accounts ({linkedAccounts.length})</h2>
        {linkedAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No accounts linked yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {linkedAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-gray-700/50 rounded-lg border border-gray-600 p-4"
              >
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={account.platform} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      @{account.username}
                    </div>
                    {account.displayName && (
                      <div className="text-xs text-gray-400 truncate">
                        {account.displayName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-gray-400">Videos</div>
                    <div className="text-white font-medium">{account.totalVideos || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Views</div>
                    <div className="text-white font-medium">
                      {(account.totalViews || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Payment Terms Tab Component
const PaymentTermsTab: React.FC<{
  editMode: boolean;
  selectedType: PaymentTermType;
  onTypeChange: (type: PaymentTermType) => void;
  baseAmount: number;
  onBaseAmountChange: (val: number) => void;
  cpmRate: number;
  onCpmRateChange: (val: number) => void;
  guaranteedViews: number;
  onGuaranteedViewsChange: (val: number) => void;
  cpcRate: number;
  onCpcRateChange: (val: number) => void;
  cpaRate: number;
  onCpaRateChange: (val: number) => void;
  revenueSharePercentage: number;
  onRevenueSharePercentageChange: (val: number) => void;
  retainerAmount: number;
  onRetainerAmountChange: (val: number) => void;
  contractNotes: string;
  onContractNotesChange: (val: string) => void;
  contractStartDate: string;
  onContractStartDateChange: (val: string) => void;
  contractEndDate: string;
  onContractEndDateChange: (val: string) => void;
}> = (props) => {
  const selectedTermType = PAYMENT_TERM_TYPES.find(t => t.value === props.selectedType);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Payment Structure</h2>
        
        {/* Payment Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Payment Type
          </label>
          <select
            value={props.selectedType}
            onChange={(e) => props.onTypeChange(e.target.value as PaymentTermType)}
            disabled={!props.editMode}
            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {PAYMENT_TERM_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {selectedTermType && (
            <p className="mt-2 text-sm text-gray-400">{selectedTermType.description}</p>
          )}
        </div>

        {/* Dynamic fields based on selected type */}
        <div className="space-y-4">
          {(props.selectedType === 'flat_fee' || props.selectedType === 'base_cpm' || props.selectedType === 'base_guaranteed_views') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Base Amount ($)
              </label>
              <input
                type="number"
                value={props.baseAmount}
                onChange={(e) => props.onBaseAmountChange(parseFloat(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="1000"
              />
            </div>
          )}

          {props.selectedType === 'base_cpm' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                CPM Rate ($ per 1000 views)
              </label>
              <input
                type="number"
                step="0.01"
                value={props.cpmRate}
                onChange={(e) => props.onCpmRateChange(parseFloat(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="10.00"
              />
            </div>
          )}

          {props.selectedType === 'base_guaranteed_views' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Guaranteed Views
              </label>
              <input
                type="number"
                value={props.guaranteedViews}
                onChange={(e) => props.onGuaranteedViewsChange(parseInt(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="100000"
              />
            </div>
          )}

          {props.selectedType === 'cpc' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cost Per Click ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={props.cpcRate}
                onChange={(e) => props.onCpcRateChange(parseFloat(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="0.50"
              />
            </div>
          )}

          {props.selectedType === 'cpa_cps' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cost Per Acquisition/Sale ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={props.cpaRate}
                onChange={(e) => props.onCpaRateChange(parseFloat(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="50.00"
              />
            </div>
          )}

          {props.selectedType === 'revenue_share' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Revenue Share Percentage (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={props.revenueSharePercentage}
                onChange={(e) => props.onRevenueSharePercentageChange(parseFloat(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="20"
              />
            </div>
          )}

          {props.selectedType === 'retainer' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Monthly Retainer ($)
              </label>
              <input
                type="number"
                value={props.retainerAmount}
                onChange={(e) => props.onRetainerAmountChange(parseFloat(e.target.value) || 0)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                placeholder="5000"
              />
            </div>
          )}
        </div>
      </div>

      {/* Contract Details */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Contract Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={props.contractStartDate}
                onChange={(e) => props.onContractStartDateChange(e.target.value)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={props.contractEndDate}
                onChange={(e) => props.onContractEndDateChange(e.target.value)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contract Notes
            </label>
            <textarea
              value={props.contractNotes}
              onChange={(e) => props.onContractNotesChange(e.target.value)}
              disabled={!props.editMode}
              rows={4}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              placeholder="Add any additional contract details, deliverables, or special terms..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Payouts Tab Component
const PayoutsTab: React.FC<{ payouts: Payout[] }> = ({ payouts }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'processing':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">Payment History</h2>
      </div>

      {payouts.length === 0 ? (
        <div className="p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No payouts yet</h3>
          <p className="text-gray-400">
            Payment history will appear here once payouts are processed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Metrics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4 text-sm text-white">
                    {payout.periodStart.toDate().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' - '}
                    {payout.periodEnd.toDate().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">
                      ${payout.amount.toFixed(2)}
                    </div>
                    {payout.rateDescription && (
                      <div className="text-xs text-gray-400">{payout.rateDescription}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {payout.totalViews.toLocaleString()} views
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        payout.status
                      )}`}
                    >
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {payout.paidAt
                      ? payout.paidAt.toDate().toLocaleDateString()
                      : payout.createdAt.toDate().toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CreatorDetailsPage;

