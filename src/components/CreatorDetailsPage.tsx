import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TrackedAccount, Payout, PaymentTermPreset, PaymentTermType, PaymentDueDateType } from '../types/firestore';
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
  AlertCircle,
  User
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
  
  // Payment due date state
  const [dueDateType, setDueDateType] = useState<PaymentDueDateType>('none');
  const [fixedDueDate, setFixedDueDate] = useState<string>('');
  const [daysAfterPosted, setDaysAfterPosted] = useState<number>(30);
  const [viewsRequired, setViewsRequired] = useState<number>(100000);

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
        if (terms.dueDateType) setDueDateType(terms.dueDateType);
        if (terms.fixedDueDate) {
          setFixedDueDate(terms.fixedDueDate.toDate().toISOString().split('T')[0]);
        }
        if (terms.daysAfterPosted !== undefined) setDaysAfterPosted(terms.daysAfterPosted);
        if (terms.viewsRequired !== undefined) setViewsRequired(terms.viewsRequired);
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
        dueDateType,
        daysAfterPosted,
        viewsRequired,
      };

      if (fixedDueDate) {
        customTerms.fixedDueDate = Timestamp.fromDate(new Date(fixedDueDate));
      }

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
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700/50 shadow-lg px-6 py-5">
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
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4 hover:border-blue-500/40 transition-all duration-200 shadow-sm hover:shadow-blue-500/10">
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Linked Accounts</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {linkedAccounts.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4 hover:border-green-500/40 transition-all duration-200 shadow-sm hover:shadow-green-500/10">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Total Earned</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${(creatorProfile?.totalEarnings || 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-4 hover:border-yellow-500/40 transition-all duration-200 shadow-sm hover:shadow-yellow-500/10">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-400">Pending</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${totalPending.toFixed(2)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4 hover:border-purple-500/40 transition-all duration-200 shadow-sm hover:shadow-purple-500/10">
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
        <div className="flex gap-1 mt-6 bg-gray-800/50 rounded-lg p-1">
          {(['overview', 'accounts', 'payment', 'payouts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 rounded-md transition-all duration-200 capitalize font-medium text-sm ${
                activeTab === tab
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
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
            dueDateType={dueDateType}
            onDueDateTypeChange={setDueDateType}
            fixedDueDate={fixedDueDate}
            onFixedDueDateChange={setFixedDueDate}
            daysAfterPosted={daysAfterPosted}
            onDaysAfterPostedChange={setDaysAfterPosted}
            viewsRequired={viewsRequired}
            onViewsRequiredChange={setViewsRequired}
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
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Contract Information
        </h2>
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

      <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-400" />
          Recent Activity
        </h2>
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
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-blue-400" />
          Linked Accounts 
          <span className="text-sm font-normal text-gray-400">({linkedAccounts.length})</span>
        </h2>
        {linkedAccounts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No accounts linked yet</h3>
            <p className="text-sm">Link social media accounts to start tracking their content</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/20 border-b border-gray-700/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Videos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Followers
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {linkedAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {account.profilePicture ? (
                          <img
                            src={account.profilePicture}
                            alt={`@${account.username}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
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
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={account.platform} size="sm" />
                        <span className="text-sm text-gray-300 capitalize">{account.platform}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {(account.totalVideos || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {(account.totalViews || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {(account.followerCount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  dueDateType: PaymentDueDateType;
  onDueDateTypeChange: (type: PaymentDueDateType) => void;
  fixedDueDate: string;
  onFixedDueDateChange: (val: string) => void;
  daysAfterPosted: number;
  onDaysAfterPostedChange: (val: number) => void;
  viewsRequired: number;
  onViewsRequiredChange: (val: number) => void;
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
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Payment Structure
        </h2>
        
        {/* Payment Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Payment Type
          </label>
          <select
            value={props.selectedType}
            onChange={(e) => props.onTypeChange(e.target.value as PaymentTermType)}
            disabled={!props.editMode}
            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
                placeholder="5000"
              />
            </div>
          )}
        </div>
      </div>

      {/* Payment Due Date */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-yellow-400" />
          Payment Due Date
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Due Date Type
            </label>
            <select
              value={props.dueDateType}
              onChange={(e) => props.onDueDateTypeChange(e.target.value as PaymentDueDateType)}
              disabled={!props.editMode}
              className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
            >
              <option value="none">None (No due date)</option>
              <option value="fixed_date">Fixed due date (specific calendar date)</option>
              <option value="days_after_posted">Due X days after video is posted</option>
              <option value="after_views_reached">Due after video reaches X views</option>
            </select>
          </div>

          {props.dueDateType === 'fixed_date' && (
            <div className="bg-gray-700/20 rounded-lg p-4 border border-gray-600/30">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fixed Due Date
              </label>
              <input
                type="date"
                value={props.fixedDueDate}
                onChange={(e) => props.onFixedDueDateChange(e.target.value)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
              />
              <p className="mt-2 text-xs text-gray-400">Payment will be due on this specific date</p>
            </div>
          )}

          {props.dueDateType === 'days_after_posted' && (
            <div className="bg-gray-700/20 rounded-lg p-4 border border-gray-600/30">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Days After Video Posted
              </label>
              <input
                type="number"
                min="1"
                value={props.daysAfterPosted}
                onChange={(e) => props.onDaysAfterPostedChange(parseInt(e.target.value) || 1)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
                placeholder="30"
              />
              <p className="mt-2 text-xs text-gray-400">
                Payment will be due {props.daysAfterPosted} day{props.daysAfterPosted !== 1 ? 's' : ''} after the video is posted
              </p>
            </div>
          )}

          {props.dueDateType === 'after_views_reached' && (
            <div className="bg-gray-700/20 rounded-lg p-4 border border-gray-600/30">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Required Views
              </label>
              <input
                type="number"
                min="1"
                value={props.viewsRequired}
                onChange={(e) => props.onViewsRequiredChange(parseInt(e.target.value) || 1)}
                disabled={!props.editMode}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
                placeholder="100000"
              />
              <p className="mt-2 text-xs text-gray-400">
                Payment will be due after the video reaches {props.viewsRequired.toLocaleString()} views
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Contract Details */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Contract Details
        </h2>
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
              className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 disabled:opacity-50 transition-all"
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
    <div className="bg-gray-800 rounded-xl border border-gray-700/50 shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gray-800/50">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Payment History
        </h2>
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
            <thead className="bg-gray-700/20 border-b border-gray-700/30">
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
            <tbody className="divide-y divide-gray-700/30">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-700/20 transition-colors">
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

