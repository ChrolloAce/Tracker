import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TrackedAccount, Payout } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import PayoutsService from '../services/PayoutsService';
import FirestoreDataService from '../services/FirestoreDataService';
import TieredPaymentService from '../services/TieredPaymentService';
import { ContractService } from '../services/ContractService';
import { ShareableContract } from '../types/contract';
import { 
  ArrowLeft, 
  Link as LinkIcon, 
  DollarSign, 
  FileText,
  AlertCircle,
  User,
  Play,
  Eye,
  Copy,
  ExternalLink,
  Check,
  Clock,
  Plus,
  Save,
  Trash2,
  MoreVertical,
  Download
} from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import TieredPaymentBuilder from './TieredPaymentBuilder';
import PaymentInvoicePreview from './PaymentInvoicePreview';
import { TieredPaymentStructure } from '../types/payments';

interface CreatorDetailsPageProps {
  creator: OrgMember;
  onBack: () => void;
  onUpdate: () => void;
}

/**
 * CreatorDetailsPage - Full dashboard view for managing creator details
 */
const CreatorDetailsPage: React.FC<CreatorDetailsPageProps> = ({
  creator,
  onBack,
  onUpdate,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get active tab from URL or default to 'overview'
  const activeTab = (searchParams.get('tab') as 'overview' | 'accounts' | 'payment' | 'contract') || 'overview';
  
  // Function to change tab and update URL
  const setActiveTab = (tab: 'overview' | 'accounts' | 'payment' | 'contract') => {
    setSearchParams({ tab });
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<TrackedAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [showLinkAccountsModal, setShowLinkAccountsModal] = useState(false);
  const [calculatedTotalEarnings, setCalculatedTotalEarnings] = useState<number>(0);
  const [contracts, setContracts] = useState<ShareableContract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'payment_period' | 'last_30' | 'last_7' | 'all_time'>('payment_period');
  
  // Tiered payment structure state
  const [tieredPaymentStructure, setTieredPaymentStructure] = useState<TieredPaymentStructure | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, creator.userId]);

  // Load contracts when contract tab is active
  useEffect(() => {
    if (activeTab === 'contract') {
      loadContracts();
    }
  }, [activeTab, currentOrgId, currentProjectId, creator.userId]);

  // Calculate total earnings from videos using tiered payment structure
  useEffect(() => {
    if (!tieredPaymentStructure || recentVideos.length === 0) {
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

    // Use TieredPaymentService to calculate earnings
    const totalVideos = filteredVideos.length;
    const totalViews = filteredVideos.reduce((sum: number, video: any) => sum + (video.views || 0), 0);
    const totalEngagement = filteredVideos.reduce((sum: number, video: any) => 
      sum + (video.likes || 0) + (video.comments || 0) + (video.shares || 0), 0
    );
    const daysElapsed = Math.floor((now.getTime() - (creatorProfile?.createdAt?.toDate?.()?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24));

    let total = 0;

    // Calculate per-video earnings
    filteredVideos.forEach((video: any) => {
      const videoEarnings = TieredPaymentService.calculateVideoEarnings(
        tieredPaymentStructure,
        video.views || 0,
        (video.likes || 0) + (video.comments || 0) + (video.shares || 0)
      );
      total += videoEarnings.total;
    });

    // Add milestone bonuses (calculated once, not per video)
    const milestoneEarnings = TieredPaymentService.calculateMilestoneBonuses(
      tieredPaymentStructure,
      totalViews,
      totalVideos,
      daysElapsed,
      totalEngagement
    );
    total += milestoneEarnings.total;

    // OLD SYSTEM FALLBACK (in case no tiered structure but has customPaymentTerms)
    if (total === 0 && creatorProfile?.customPaymentTerms) {
      const terms = creatorProfile.customPaymentTerms;

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
    }

    setCalculatedTotalEarnings(total);
  }, [recentVideos, creatorProfile, timePeriod, tieredPaymentStructure]);

  const loadContracts = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoadingContracts(true);
    try {
      const fetchedContracts = await ContractService.getContractsForCreator(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      setContracts(fetchedContracts);
    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

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

      // Load tiered payment structure from paymentInfo
      if (profile?.paymentInfo && (profile.paymentInfo as any).tieredStructure) {
        const loadedStructure = (profile.paymentInfo as any).tieredStructure as TieredPaymentStructure;
        
        // Migrate old structure format - ensure tiers array exists
        if (!loadedStructure.tiers || !Array.isArray(loadedStructure.tiers)) {
          loadedStructure.tiers = [];
        }
        
        setTieredPaymentStructure(loadedStructure);
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
          tieredStructure: tieredPaymentStructure,
          updatedAt: new Date()
        }
      );

      await loadData();
      onUpdate();
    } catch (error) {
      console.error('Failed to save payment structure:', error);
      alert('Failed to save payment structure');
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
      <div className="px-6 pt-6">
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
        </div>

        {/* Tabs and Time Period Selector */}
        <div className="flex items-center justify-between mt-8 border-b border-gray-800">
          <div className="flex gap-6">
            {(['overview', 'accounts', 'payment', 'contract'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
                className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors capitalize ${
                activeTab === tab
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'payment' ? 'Payment Terms' : tab === 'contract' ? 'Contract' : tab}
            </button>
          ))}
          </div>

          {/* Time Period Dropdown - Only show in Overview */}
          {activeTab === 'overview' && (
            <div className="relative mb-4">
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as any)}
                className="pl-3 pr-10 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-sm font-medium text-white/90 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all appearance-none cursor-pointer"
              >
                <option value="payment_period" className="bg-[#161616]">Payment Period</option>
                <option value="last_7" className="bg-[#161616]">Last 7 Days</option>
                <option value="last_30" className="bg-[#161616]">Last 30 Days</option>
                <option value="all_time" className="bg-[#161616]">All Time</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
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
            tieredPaymentStructure={tieredPaymentStructure}
            calculatedTotalEarnings={calculatedTotalEarnings}
            totalPending={totalPending}
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
          <div className="grid grid-cols-2 gap-6 h-[calc(100vh-300px)]">
            {/* Left: Edit Payment Structure */}
            <div className="bg-[#161616] rounded-xl border border-gray-800 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  Payment Structure
                </h2>
              </div>

              <TieredPaymentBuilder
                value={tieredPaymentStructure}
                onChange={setTieredPaymentStructure}
                alwaysEdit={false}
              />

              {/* Save Button */}
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-800">
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
                      Save Structure
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right: Invoice Preview */}
            <div className="overflow-y-auto">
              <PaymentInvoicePreview
                structure={tieredPaymentStructure}
                creatorName={creator.displayName || creator.email || 'Creator'}
              />
            </div>
          </div>
        )}
        {activeTab === 'contract' && (
          <ContractTab
            creator={creator}
            contracts={contracts}
            loading={loadingContracts}
            onReload={loadContracts}
          />
        )}
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
  tieredPaymentStructure: TieredPaymentStructure | null;
  calculatedTotalEarnings: number;
  totalPending: number;
}> = ({ profile, linkedAccounts, payouts, recentVideos, timePeriod, tieredPaymentStructure, calculatedTotalEarnings, totalPending }) => {
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
    if (filteredVideosByTime.length === 0) {
      return { total: 0, breakdown: [], details: '' };
    }

    // Use TieredPaymentService if tiered structure exists
    if (tieredPaymentStructure && tieredPaymentStructure.tiers && tieredPaymentStructure.tiers.length > 0) {
      let total = 0;
      const breakdown: any[] = [];

      filteredVideosByTime.forEach((video: any) => {
        const result = TieredPaymentService.calculateVideoEarnings(
          tieredPaymentStructure,
          video.views || 0,
          (video.likes || 0) + (video.comments || 0) + (video.shares || 0)
        );

        breakdown.push({
          video: video.title || 'Untitled',
          videoId: video.id,
          accountId: video.trackedAccountId,
          earnings: result.total,
          views: video.views || 0,
          uploadDate: video.uploadDate,
          calculation: result.breakdown.map(b => `${b.label}: $${b.amount.toFixed(2)}`).join(' + ')
        });

        total += result.total;
      });

      return { total, breakdown, details: tieredPaymentStructure.name || 'Tiered Payment' };
    }

    // Fallback to old system
    if (!profile?.customPaymentTerms) {
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

    return { total, breakdown, details: terms.type || 'Custom Payment' };
  };

  const earnings = calculateEarnings();
  
  // All videos from earnings breakdown
  const filteredVideos = earnings.breakdown;

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
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
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

      {/* Video Performance */}
      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
          <h2 className="text-lg font-semibold text-white">
            Video Breakdown & Payouts ({filteredVideos.length})
        </h2>
          </div>
        
        {filteredVideos.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Play className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No videos found</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
              Link accounts and sync videos to see performance
            </p>
      </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900/40">
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Video
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Preview
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Payout
                  </th>
                </tr>
              </thead>
              <tbody className="bg-zinc-900/60 divide-y divide-white/5">
                {filteredVideos.map((video: any) => {
                  // Get account info for profile picture
                  const account = linkedAccounts.find(acc => acc.id === video.accountId);
                  
                  return (
                    <tr 
                      key={video.videoId}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Video Info */}
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        {video.thumbnail ? (
                          <img
                            src={video.thumbnail}
                            alt={video.videoTitle}
                            className="w-20 h-14 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-20 h-14 bg-zinc-800 rounded-lg flex items-center justify-center">
                            <Play className="w-5 h-5 text-gray-600" />
            </div>
          )}
                      </td>
                      
                      {/* Upload Date */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-400">
                          {formatDate(video.uploadDate)}
                        </div>
                      </td>
                      
                      {/* Views */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Eye className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-white">{formatNumber(video.views)}</span>
        </div>
                      </td>
                      
                      {/* Payout */}
                      <td 
                        className="px-6 py-4 text-right relative"
                        onMouseEnter={() => handleMouseEnter(video.videoId)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="text-sm font-semibold text-white">
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

        {/* Pagination */}
        {filteredVideos.length > 0 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'}
            </div>
            <div className="text-xs text-gray-500">
              Pagination coming soon
            </div>
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
  creator: OrgMember;
  contracts: ShareableContract[];
  loading: boolean;
  onReload: () => void;
}> = ({ creator, contracts, loading, onReload }) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [copiedLink, setCopiedLink] = React.useState<string | null>(null);
  const [deletingContractId, setDeletingContractId] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [contractToDelete, setContractToDelete] = React.useState<ShareableContract | null>(null);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(contracts.length / itemsPerPage);
  const paginatedContracts = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return contracts.slice(startIndex, startIndex + itemsPerPage);
  }, [contracts, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleCopyLink = async (link: string, id: string) => {
    try {
      // Ensure we have the full URL
      const fullUrl = link.startsWith('http') ? link : `${window.location.origin}${link}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy link. Please try again.');
    }
  };

  const handleDownloadContract = (contract: ShareableContract) => {
    const contractContent = `
CREATOR CONTRACT
Content Creation Agreement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTIES

Creator: ${contract.creatorName}
Company: ${contract.creatorName} (Representative)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTRACT PERIOD

Start Date: ${new Date(contract.contractStartDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
${contract.contractEndDate && contract.contractEndDate !== 'Indefinite' ? `End Date: ${new Date(contract.contractEndDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${contract.paymentStructureName ? `PAYMENT STRUCTURE\n\n${contract.paymentStructureName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : ''}TERMS & CONDITIONS

${contract.contractNotes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SIGNATURES

Creator: ___________________________
${contract.creatorName}

Company Representative: ___________________________
[Authorized Signatory]

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    `.trim();

    const blob = new Blob([contractContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contract_${contract.creatorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (contract: ShareableContract) => {
    setContractToDelete(contract);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contractToDelete) return;

    setDeletingContractId(contractToDelete.id);
    try {
      await ContractService.deleteContract(contractToDelete.id);
      setShowDeleteConfirm(false);
      setContractToDelete(null);
      await onReload();
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Failed to delete contract. Please try again.');
    } finally {
      setDeletingContractId(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setContractToDelete(null);
  };

  const getStatusBadge = (contract: ShareableContract) => {
    const hasCreatorSigned = !!contract.creatorSignature;
    const hasCompanySigned = !!contract.companySignature;

    if (hasCreatorSigned && hasCompanySigned) {
  return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
          <Check className="w-3 h-3" />
          Fully Signed
        </span>
      );
    }

    if (!hasCreatorSigned && !hasCompanySigned) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
          <Clock className="w-3 h-3" />
          Awaiting Signatures
        </span>
      );
    }

    if (hasCreatorSigned) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <Check className="w-3 h-3" />
          Creator Signed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
        <Check className="w-3 h-3" />
        Company Signed
      </span>
    );
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

  const getContractName = (contract: ShareableContract) => {
    return `Contract vs ${contract.creatorName}`;
  };

  return (
    <div className="bg-[#161616] rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Contracts ({contracts.length})
        </h2>
          <p className="text-sm text-gray-400 mt-1">Manage contracts for {creator.displayName || creator.email}</p>
        </div>
        <Button
          onClick={() => window.location.href = `/contract/edit/${creator.userId}`}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Contract
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading contracts...</p>
        </div>
      ) : contracts.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No contracts yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first contract for {creator.displayName || creator.email}
          </p>
          <Button
            onClick={() => window.location.href = `/contract/edit/${creator.userId}`}
            className="flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create Contract
          </Button>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full">
              <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Contract
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status & Signatures
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Period
                </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Links
                </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Created
                </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                </th>
              </tr>
            </thead>
              <tbody className="divide-y divide-gray-800">
                {paginatedContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-800/20 transition-colors">
                    {/* Contract Name */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{getContractName(contract)}</div>
                      {contract.paymentStructureName && (
                        <div className="text-xs text-gray-500 mt-0.5">{contract.paymentStructureName}</div>
                      )}
                  </td>

                    {/* Status & Signatures */}
                  <td className="px-6 py-4">
                      {getStatusBadge(contract)}
                  </td>

                    {/* Period */}
                    <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">
                      {formatDate(contract.contractStartDate)} - {formatDate(contract.contractEndDate)}
                  </td>

                    {/* Links */}
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {/* Creator Link */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyLink(contract.creatorLink, `creator-${contract.id}`)}
                            className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"
                            title="Copy Creator Link"
                          >
                            {copiedLink === `creator-${contract.id}` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={contract.creatorLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition-colors"
                            title="Open Creator Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <span className="text-xs text-blue-400/60">Creator</span>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-6 bg-gray-700"></div>

                        {/* Company Link */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyLink(contract.companyLink, `company-${contract.id}`)}
                            className="p-1.5 hover:bg-purple-500/10 text-purple-400 rounded transition-colors"
                            title="Copy Company Link"
                          >
                            {copiedLink === `company-${contract.id}` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={contract.companyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-purple-500/10 text-purple-400 rounded transition-colors"
                            title="Open Company Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <span className="text-xs text-purple-400/60">Company</span>
                        </div>
                      </div>
                  </td>

                    {/* Created Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">
                      {formatDate(contract.createdAt)}
                  </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === contract.id ? null : contract.id)}
                        className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded transition-colors"
                        title="More Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {openMenuId === contract.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                            <button
                              onClick={() => handleDownloadContract(contract)}
                              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download Contract</span>
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDeleteClick(contract);
                              }}
                              disabled={deletingContractId === contract.id}
                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {deletingContractId === contract.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                  <span>Deleting...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4" />
                                  <span>Delete Contract</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, contracts.length)} of {contracts.length} contracts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                >
                  Next
                </Button>
              </div>
        </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && contractToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161616] border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-full">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Delete Contract?</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Are you sure you want to delete this contract? This action cannot be undone.
                </p>
                <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-gray-500 mb-1">Contract</div>
                  <div className="text-sm font-medium text-white">{getContractName(contractToDelete)}</div>
                  {contractToDelete.paymentStructureName && (
                    <div className="text-xs text-gray-400 mt-1">{contractToDelete.paymentStructureName}</div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDeleteCancel}
                    variant="secondary"
                    className="flex-1"
                    disabled={deletingContractId !== null}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteConfirm}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    disabled={deletingContractId !== null}
                  >
                    {deletingContractId ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorDetailsPage;

