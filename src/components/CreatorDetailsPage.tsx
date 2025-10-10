import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
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
  User,
  Play,
  Eye
} from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import { Timestamp } from 'firebase/firestore';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import PaymentRuleBuilder from './PaymentRuleBuilder';
import { PaymentRule } from '../services/PaymentCalculationService';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'payment' | 'contract' | 'payouts'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<TrackedAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showLinkAccountsModal, setShowLinkAccountsModal] = useState(false);
  const [calculatedTotalEarnings, setCalculatedTotalEarnings] = useState<number>(0);
  const [timePeriod, setTimePeriod] = useState<'payment_period' | 'last_30' | 'last_7' | 'all_time'>('payment_period');
  
  // Payment rules state (new structured system)
  const [paymentRules, setPaymentRules] = useState<PaymentRule[]>([]);
  
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

  // Calculate total earnings from videos
  useEffect(() => {
    if (!creatorProfile?.customPaymentTerms || recentVideos.length === 0) {
      setCalculatedTotalEarnings(0);
      return;
    }

    // Filter videos by time period
    const now = new Date();
    let filteredVideos = recentVideos;
    
    switch (timePeriod) {
      case 'last_7':
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredVideos = recentVideos.filter(video => {
          const uploadDate = video.uploadDate?.toDate?.() || new Date(0);
          return uploadDate >= last7Days;
        });
        break;
      
      case 'last_30':
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredVideos = recentVideos.filter(video => {
          const uploadDate = video.uploadDate?.toDate?.() || new Date(0);
          return uploadDate >= last30Days;
        });
        break;
      
      case 'payment_period':
        const paymentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredVideos = recentVideos.filter(video => {
          const uploadDate = video.uploadDate?.toDate?.() || new Date(0);
          return uploadDate >= paymentStart;
        });
        break;
      
      case 'all_time':
      default:
        filteredVideos = recentVideos;
    }

    const terms = creatorProfile.customPaymentTerms;
    let total = 0;

    filteredVideos.forEach((video: any) => {
      let videoEarnings = 0;

      switch (terms.type) {
        case 'flat_fee':
          videoEarnings = terms.baseAmount || 0;
          break;

        case 'base_cpm':
          const views = video.views || 0;
          const cpmEarnings = (views / 1000) * (terms.cpmRate || 0);
          videoEarnings = (terms.baseAmount || 0) + cpmEarnings;
          break;

        case 'base_guaranteed_views':
          const actualViews = video.views || 0;
          const guaranteedViews = terms.guaranteedViews || 0;
          if (actualViews >= guaranteedViews) {
            videoEarnings = terms.baseAmount || 0;
          }
          break;

        case 'cpc':
          const clicks = (video as any).clicks || 0;
          videoEarnings = clicks * (terms.cpcRate || 0);
          break;

        case 'revenue_share':
          const revenue = (video as any).revenue || 0;
          videoEarnings = revenue * ((terms.revenueSharePercentage || 0) / 100);
          break;

        case 'retainer':
          videoEarnings = 0; // Retainer is monthly, not per video
          break;
      }

      total += videoEarnings;
    });

    setCalculatedTotalEarnings(total);
  }, [recentVideos, creatorProfile, timePeriod]);

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

      // Load payment rules from new system
      if (profile?.paymentInfo) {
        setPaymentRules((profile.paymentInfo.paymentRules as PaymentRule[]) || []);
      }

      // Load linked accounts
      console.log('🔍 Loading linked accounts for creator:', creator.userId);
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      console.log('📋 Found creator links:', links.length, links);
      const accountIds = links.map(link => link.accountId);
      console.log('📋 Account IDs to link:', accountIds);
      
      // Load all accounts from project
      const projectAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );
      console.log('📊 All project accounts:', projectAccounts.length);
      setAllAccounts(projectAccounts);
      
      // Filter to linked accounts
      const linked = projectAccounts.filter(acc => accountIds.includes(acc.id));
      console.log('✅ Linked accounts after filter:', linked.length, linked);
      setLinkedAccounts(linked);

      // Load all videos from linked accounts
      if (linked.length > 0) {
        console.log('🎬 Loading videos for', linked.length, 'accounts');
        const videosPromises = linked.map(async (account) => {
          try {
            console.log('📹 Fetching videos for account:', account.username);
            const videos = await FirestoreDataService.getVideos(
              currentOrgId,
              currentProjectId,
              { trackedAccountId: account.id }
            );
            console.log(`✅ Found ${videos.length} videos for ${account.username}`);
            return videos.map(v => ({ ...v, accountInfo: account }));
          } catch (error) {
            console.error(`❌ Failed to load videos for account ${account.id}:`, error);
            return [];
          }
        });
        
        const allVideos = (await Promise.all(videosPromises)).flat();
        console.log('🎬 Total videos loaded:', allVideos.length);
        // Sort by upload date (newest first)
        const sortedVideos = allVideos.sort((a, b) => {
          const dateA = a.uploadDate?.toDate?.() || new Date(0);
          const dateB = b.uploadDate?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        console.log('🎬 Sorted videos:', sortedVideos.length);
        setRecentVideos(sortedVideos);
      } else {
        console.log('⚠️ No linked accounts found, skipping video loading');
        setRecentVideos([]);
      }

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

  const handleSavePaymentRules = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setSaving(true);
    try {
      await CreatorLinksService.updateCreatorPaymentInfo(
        currentOrgId,
        currentProjectId,
        creator.userId,
        {
          isPaid: true,
          paymentRules: paymentRules as any,
          updatedAt: new Date()
        }
      );

      await loadData();
      onUpdate();
    } catch (error) {
      console.error('Failed to save payment rules:', error);
      alert('Failed to save payment rules');
    } finally {
      setSaving(false);
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
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-[#161616] border-b border-gray-800 px-6 py-5">
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
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all duration-200">
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Linked Accounts</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {linkedAccounts.length}
            </div>
          </div>
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all duration-200">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Total Earned</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${calculatedTotalEarnings.toFixed(2)}
            </div>
          </div>
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all duration-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Pending</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${totalPending.toFixed(2)}
            </div>
          </div>
          <div className="bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all duration-200">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Payouts</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {payouts.length}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 bg-[#0A0A0A] rounded-lg p-1 border border-gray-800">
          {(['overview', 'accounts', 'payment', 'contract', 'payouts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 rounded-md transition-all duration-200 capitalize font-medium text-sm ${
                activeTab === tab
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab === 'payment' ? 'Payment Terms' : tab === 'contract' ? 'Contract' : tab}
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
            recentVideos={recentVideos}
            timePeriod={timePeriod}
            onTimePeriodChange={setTimePeriod}
          />
        )}
        {activeTab === 'accounts' && (
          <AccountsTab
            linkedAccounts={linkedAccounts}
            allAccounts={allAccounts}
            creator={creator}
            onUpdate={loadData}
            onOpenLinkModal={() => setShowLinkAccountsModal(true)}
          />
        )}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            {/* New Payment Rules System */}
            <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  Payment Rules
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="px-2 py-1 bg-white/10 rounded">💹 Auto-calculates earnings</span>
                </div>
              </div>

              <PaymentRuleBuilder
                rules={paymentRules}
                onChange={setPaymentRules}
              />

              {/* Save Button */}
              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleSavePaymentRules}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Payment Rules
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'contract' && (
          <ContractTab
            contractNotes={contractNotes}
            onContractNotesChange={setContractNotes}
            contractStartDate={contractStartDate}
            onContractStartDateChange={setContractStartDate}
            contractEndDate={contractEndDate}
            onContractEndDateChange={setContractEndDate}
            onSave={handleSavePaymentRules}
            saving={saving}
          />
        )}
        {activeTab === 'payouts' && <PayoutsTab payouts={payouts} />}
      </div>

      {/* Link Accounts Modal */}
      {showLinkAccountsModal && (
        <LinkCreatorAccountsModal
          creator={creator}
          onClose={() => setShowLinkAccountsModal(false)}
          onSuccess={() => {
            setShowLinkAccountsModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  creator: OrgMember;
  profile: Creator | null;
  linkedAccounts: TrackedAccount[];
  payouts: Payout[];
  recentVideos: any[];
  timePeriod: 'payment_period' | 'last_30' | 'last_7' | 'all_time';
  onTimePeriodChange: (period: 'payment_period' | 'last_30' | 'last_7' | 'all_time') => void;
}> = ({ profile, linkedAccounts, recentVideos, timePeriod, onTimePeriodChange }) => {
  const [selectedAccount, setSelectedAccount] = React.useState<string>('all');
  const [hoveredVideo, setHoveredVideo] = React.useState<string | null>(null);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Filter videos by time period
  const getFilteredVideosByTime = () => {
    const now = new Date();
    
    switch (timePeriod) {
      case 'last_7':
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return recentVideos.filter(video => {
          const uploadDate = video.uploadDate?.toDate?.() || new Date(0);
          return uploadDate >= last7Days;
        });
      
      case 'last_30':
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return recentVideos.filter(video => {
          const uploadDate = video.uploadDate?.toDate?.() || new Date(0);
          return uploadDate >= last30Days;
        });
      
      case 'payment_period':
        // For payment period, we'll use last 30 days as default
        // This could be customized based on the creator's payment schedule
        const paymentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return recentVideos.filter(video => {
          const uploadDate = video.uploadDate?.toDate?.() || new Date(0);
          return uploadDate >= paymentStart;
        });
      
      case 'all_time':
      default:
        return recentVideos;
    }
  };

  const filteredVideosByTime = getFilteredVideosByTime();

  // Calculate real-time earnings based on payment structure
  const calculateEarnings = () => {
    if (!profile?.customPaymentTerms || filteredVideosByTime.length === 0) {
      return { total: 0, breakdown: [], details: '' };
    }

    const terms = profile.customPaymentTerms;
    let total = 0;
    const breakdown: any[] = [];

    filteredVideosByTime.forEach((video: any) => {
      let videoEarnings = 0;
      let calculation = '';

      switch (terms.type) {
        case 'flat_fee':
          videoEarnings = terms.baseAmount || 0;
          calculation = `Flat fee: $${videoEarnings.toFixed(2)}`;
          break;

        case 'base_cpm':
          const views = video.views || 0;
          const cpmEarnings = (views / 1000) * (terms.cpmRate || 0);
          videoEarnings = (terms.baseAmount || 0) + cpmEarnings;
          calculation = `Base: $${(terms.baseAmount || 0).toFixed(2)} + CPM: $${cpmEarnings.toFixed(2)} (${formatNumber(views)} views × $${terms.cpmRate}/1K)`;
          break;

        case 'base_guaranteed_views':
          const actualViews = video.views || 0;
          const guaranteedViews = terms.guaranteedViews || 0;
          if (actualViews >= guaranteedViews) {
            videoEarnings = terms.baseAmount || 0;
            calculation = `Base: $${videoEarnings.toFixed(2)} (${formatNumber(actualViews)} views ≥ ${formatNumber(guaranteedViews)} required)`;
          } else {
            videoEarnings = 0;
            calculation = `$0 (${formatNumber(actualViews)} views < ${formatNumber(guaranteedViews)} required)`;
          }
          break;

        case 'cpc':
          // Assuming clicks tracked somewhere, default to 0 if not available
          const clicks = (video as any).clicks || 0;
          videoEarnings = clicks * (terms.cpcRate || 0);
          calculation = `${clicks} clicks × $${terms.cpcRate} CPC`;
          break;

        case 'revenue_share':
          // This would need actual revenue data
          const revenue = (video as any).revenue || 0;
          videoEarnings = revenue * ((terms.revenueSharePercentage || 0) / 100);
          calculation = `${terms.revenueSharePercentage}% of $${revenue.toFixed(2)} revenue`;
          break;

        case 'retainer':
          // Retainer is usually monthly, not per video
          videoEarnings = 0;
          calculation = `Monthly retainer: $${(terms.retainerAmount || 0).toFixed(2)}`;
          break;

        default:
          videoEarnings = 0;
          calculation = 'No payment structure set';
      }

      total += videoEarnings;
      breakdown.push({
        videoId: video.id,
        videoTitle: video.title || video.description || 'Untitled',
        earnings: videoEarnings,
        calculation,
        views: video.views || 0,
        thumbnail: video.thumbnail,
        accountId: video.trackedAccountId,
        accountUsername: video.accountInfo?.username || 'Unknown',
        platform: video.accountInfo?.platform || video.platform
      });
    });

    return { total, breakdown, details: PAYMENT_TERM_TYPES.find(t => t.value === terms.type)?.label || 'Unknown' };
  };

  const earnings = calculateEarnings();
  
  // Calculate earnings by account
  const accountEarnings = linkedAccounts.map(account => {
    const accountVideos = earnings.breakdown.filter(v => v.accountId === account.id);
    const totalEarnings = accountVideos.reduce((sum, v) => sum + v.earnings, 0);
    const totalViews = accountVideos.reduce((sum, v) => sum + v.views, 0);
    return {
      account,
      earnings: totalEarnings,
      views: totalViews,
      videoCount: accountVideos.length
    };
  });

  // Filter videos by selected account
  const filteredVideos = selectedAccount === 'all' 
    ? earnings.breakdown 
    : earnings.breakdown.filter(v => v.accountId === selectedAccount);

  const handleMouseEnter = (videoId: string) => {
    setHoveredVideo(videoId);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredVideo(null);
    setShowTooltip(false);
  };

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="bg-[#161616] rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">Time Period</h3>
          <div className="flex gap-2">
            <button
              onClick={() => onTimePeriodChange('payment_period')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                timePeriod === 'payment_period'
                  ? 'bg-white text-black'
                  : 'bg-[#0A0A0A] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
              )}
            >
              Payment Period
            </button>
            <button
              onClick={() => onTimePeriodChange('last_7')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                timePeriod === 'last_7'
                  ? 'bg-white text-black'
                  : 'bg-[#0A0A0A] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
              )}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => onTimePeriodChange('last_30')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                timePeriod === 'last_30'
                  ? 'bg-white text-black'
                  : 'bg-[#0A0A0A] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
              )}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => onTimePeriodChange('all_time')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                timePeriod === 'all_time'
                  ? 'bg-white text-black'
                  : 'bg-[#0A0A0A] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
              )}
            >
              All Time
            </button>
            </div>
          </div>
              </div>

      {/* Account Cost Breakdown */}
      {profile?.customPaymentTerms && accountEarnings.length > 0 && (
        <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
            Cost Per Account
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accountEarnings.map((item) => (
              <div
                key={item.account.id}
                className={clsx(
                  'bg-[#0A0A0A] border rounded-lg p-4 cursor-pointer transition-all',
                  selectedAccount === item.account.id
                    ? 'border-white ring-2 ring-white/20'
                    : 'border-gray-800 hover:border-gray-700'
                )}
                onClick={() => setSelectedAccount(selectedAccount === item.account.id ? 'all' : item.account.id)}
              >
                <div className="flex items-center gap-3 mb-3">
                  {item.account.profilePicture ? (
                    <img
                      src={item.account.profilePicture}
                      alt={item.account.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
            </div>
          )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {item.account.displayName || item.account.username}
                      </span>
                      <PlatformIcon platform={item.account.platform} size="sm" />
        </div>
                    <div className="text-xs text-gray-400">@{item.account.username}</div>
      </div>
            </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Total Payout</span>
                    <span className="text-lg font-bold text-white">${item.earnings.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{item.videoCount} videos</span>
                    <span className="text-gray-500">{formatNumber(item.views)} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selectedAccount !== 'all' && (
            <button
              onClick={() => setSelectedAccount('all')}
              className="mt-4 text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Show all accounts
            </button>
          )}
            </div>
          )}

      {/* Video Performance */}
      <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-gray-400" />
            Video Performance
            <span className="text-sm font-normal text-gray-400">({filteredVideos.length})</span>
        </h2>
          </div>
        
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Play className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-sm">No videos found</p>
            <p className="text-xs text-gray-500 mt-1">
              {selectedAccount !== 'all' ? 'Try selecting a different account' : 'Link accounts and sync videos to see performance'}
            </p>
      </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Video
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Payout
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredVideos.map((video: any) => {
                  // Get account info for profile picture
                  const account = linkedAccounts.find(acc => acc.id === video.accountId);
                  
                  return (
                    <tr 
                      key={video.videoId}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {/* Video Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            {account?.profilePicture ? (
                              <img
                                src={account.profilePicture}
                                alt={video.accountUsername}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center ring-2 ring-white/10';
                                    fallback.innerHTML = `<span class="text-sm font-bold text-white">${video.accountUsername.charAt(0).toUpperCase()}</span>`;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center ring-2 ring-white/10">
                                <span className="text-sm font-bold text-white">
                                  {video.accountUsername.charAt(0).toUpperCase()}
                                </span>
            </div>
          )}
                            <div className="absolute -bottom-1 -right-1">
                              <PlatformIcon platform={video.platform} size="sm" />
        </div>
      </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white line-clamp-2">
                              {video.videoTitle}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              @{video.accountUsername}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.videoTitle}
                            className="w-16 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-12 bg-gray-900 rounded flex items-center justify-center">
                            <Play className="w-4 h-4 text-gray-700" />
            </div>
          )}
                      </td>
                      
                      {/* Upload Date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-400">
                          {formatDate(video.uploadDate)}
                        </div>
                      </td>
                      
                      {/* Views */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-white">
                          <Eye className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">{formatNumber(video.views)}</span>
        </div>
                      </td>
                      
                      {/* Payout */}
                      <td 
                        className="px-4 py-3 text-right relative"
                        onMouseEnter={() => handleMouseEnter(video.videoId)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="text-sm text-white">
                          ${video.earnings.toFixed(2)}
      </div>
                        
                        {/* Tooltip */}
                        {hoveredVideo === video.videoId && showTooltip && (
                          <div className="absolute right-0 bottom-full mb-2 w-64 bg-zinc-900 border border-gray-700 rounded-lg shadow-xl p-3 z-50 pointer-events-none">
                            <div className="text-xs font-semibold text-white mb-2">
                              Calculation Breakdown
                            </div>
                            <div className="text-xs text-gray-300 whitespace-pre-line">
                              {video.calculation}
                            </div>
                            <div className="absolute top-full right-4 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-700" />
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
  onOpenLinkModal: () => void;
}> = ({ linkedAccounts, onOpenLinkModal }) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-gray-400" />
          Linked Accounts 
          <span className="text-sm font-normal text-gray-400">({linkedAccounts.length})</span>
        </h2>
          <Button 
            onClick={onOpenLinkModal}
            className="bg-white hover:bg-gray-200 text-black font-semibold"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Link Accounts
          </Button>
        </div>
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


// Contract Tab Component
const ContractTab: React.FC<{
  contractNotes: string;
  onContractNotesChange: (val: string) => void;
  contractStartDate: string;
  onContractStartDateChange: (val: string) => void;
  contractEndDate: string;
  onContractEndDateChange: (val: string) => void;
  onSave: () => void;
  saving: boolean;
}> = (props) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          Contract Details
        </h2>

        <div className="space-y-6">
          {/* Contract Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Contract Start Date
              </label>
              <input
                type="date"
                value={props.contractStartDate}
                onChange={(e) => props.onContractStartDateChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Contract End Date
              </label>
              <input
                type="date"
                value={props.contractEndDate}
                onChange={(e) => props.onContractEndDateChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all"
              />
            </div>
          </div>

          {/* Contract Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contract Notes & Terms
            </label>
            <textarea
              value={props.contractNotes}
              onChange={(e) => props.onContractNotesChange(e.target.value)}
              rows={8}
              placeholder="Enter contract details, special terms, exclusivity clauses, etc..."
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none transition-all"
            />
            <p className="mt-2 text-sm text-gray-400">
              Document any special terms, exclusivity agreements, content rights, or other contractual obligations.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={props.onSave}
              disabled={props.saving}
              className="flex items-center gap-2"
            >
              {props.saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Contract Details
                </>
              )}
            </Button>
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
        return 'bg-white/10 text-white border-white/20';
      case 'pending':
        return 'bg-gray-700/50 text-gray-300 border-gray-600/50';
      case 'processing':
        return 'bg-gray-600/50 text-gray-200 border-gray-500/50';
      case 'failed':
        return 'bg-gray-800/50 text-gray-400 border-gray-700/50';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="bg-[#161616] rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gray-800/50">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-gray-400" />
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

