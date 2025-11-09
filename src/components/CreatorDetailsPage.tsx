import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TrackedAccount, Payout } from '../types/firestore';
import CreatorLinksService from '../services/CreatorLinksService';
import PayoutsService from '../services/PayoutsService';
import FirestoreDataService from '../services/FirestoreDataService';
import TieredPaymentService from '../services/TieredPaymentService';
import CampaignService from '../services/CampaignService';
import { Campaign } from '../types/campaigns';
import { 
  ArrowLeft, 
  Link as LinkIcon, 
  DollarSign, 
  FileText,
  AlertCircle,
  User,
  Play,
  Eye,
  Trash2,
  Target,
  Calendar
} from 'lucide-react';
import { Button } from './ui/Button';
import { PlatformIcon } from './ui/PlatformIcon';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import { TieredPaymentStructure } from '../types/payments';
import { HeicImage } from './HeicImage';

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
  onUpdate: _onUpdate,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get active tab from URL or default to 'overview'
  const activeTab = (searchParams.get('tab') as 'overview' | 'accounts' | 'campaigns' | 'settings') || 'overview';
  
  // Function to change tab and update URL
  const setActiveTab = (tab: 'overview' | 'accounts' | 'campaigns' | 'settings') => {
    setSearchParams({ tab });
  };
  
  // Settings state
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<TrackedAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<TrackedAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [showLinkAccountsModal, setShowLinkAccountsModal] = useState(false);
  const [calculatedTotalEarnings, setCalculatedTotalEarnings] = useState<number>(0);
  const [timePeriod, setTimePeriod] = useState<'payment_period' | 'last_30' | 'last_7' | 'all_time'>('payment_period');
  
  // Tiered payment structure state
  const [tieredPaymentStructure, setTieredPaymentStructure] = useState<TieredPaymentStructure | null>(null);
  
  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, creator.userId]);

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

      // Load all videos from linked accounts
      if (linked.length > 0) {
        const videosPromises = linked.map(async (account) => {
          try {
            const videos = await FirestoreDataService.getVideos(
              currentOrgId,
              currentProjectId,
              { trackedAccountId: account.id }
            );
            // Ensure platform is set from account data
            return videos.map(v => ({ 
              ...v, 
              accountInfo: account,
              platform: v.platform || account.platform // Use account platform as fallback
            }));
          } catch (error) {
            console.error(`❌ Failed to load videos for account ${account.id}:`, error);
            return [];
          }
        });
        
        const allVideos = (await Promise.all(videosPromises)).flat();
        // Sort by upload date (newest first)
        const sortedVideos = allVideos.sort((a, b) => {
          const dateA = a.uploadDate?.toDate?.() || new Date(0);
          const dateB = b.uploadDate?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        setRecentVideos(sortedVideos);
      } else {
        setRecentVideos([]);
      }

      // Load payouts
      const payoutsData = await PayoutsService.getCreatorPayouts(
        currentOrgId,
        currentProjectId,
        creator.userId
      );
      setPayouts(payoutsData);

      // Load campaigns where this creator is a participant
      const allCampaigns = await CampaignService.getCampaigns(currentOrgId, currentProjectId);
      const creatorCampaigns = allCampaigns.filter(campaign => 
        campaign.participantIds?.includes(creator.userId)
      );
      setCampaigns(creatorCampaigns);
    } catch (error) {
      console.error('Failed to load creator data:', error);
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return <PageLoadingSkeleton />;
  }

  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen h-full flex flex-col bg-[#0A0A0A]">
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
              {creator.photoURL && !imageError ? (
                <img
                  src={creator.photoURL}
                  alt={creator.displayName || 'Creator'}
                  className="w-12 h-12 rounded-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
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
            {(['overview', 'accounts', 'campaigns', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
                className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors capitalize ${
                activeTab === tab
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
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
        {activeTab === 'campaigns' && (
          <CampaignsTab
            campaigns={campaigns}
            creatorId={creator.userId}
              />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            creator={creator}
            profile={creatorProfile}
            editingName={editingName}
            setEditingName={setEditingName}
            editingEmail={editingEmail}
            setEditingEmail={setEditingEmail}
            tempName={tempName}
            setTempName={setTempName}
            tempEmail={tempEmail}
            setTempEmail={setTempEmail}
            onUpdate={loadData}
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
                  <th className="px-6 py-4 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Likes
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Comments
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
                                alt={account.username}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center ring-2 ring-white/10';
                                    fallback.innerHTML = `<span class="text-sm font-bold text-white">${(account.username || 'U').charAt(0).toUpperCase()}</span>`;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center ring-2 ring-white/10">
                                <span className="text-sm font-bold text-white">
                                  {(account?.username || 'U').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1">
                              <PlatformIcon platform={account?.platform || video.platform || 'instagram'} size="sm" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white line-clamp-2">
                              {video.title}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              @{account?.username || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Thumbnail */}
                      <td className="px-6 py-4">
                        {video.thumbnail ? (
                          <HeicImage
                            src={video.thumbnail}
                            alt={video.title || 'Video thumbnail'}
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
                      
                      {/* Likes */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm font-medium text-white">{formatNumber(video.likes || 0)}</span>
                        </div>
                      </td>
                      
                      {/* Comments */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm font-medium text-white">{formatNumber(video.comments || 0)}</span>
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
}> = ({ linkedAccounts, creator, onUpdate, onOpenLinkModal }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [unlinking, setUnlinking] = React.useState<string | null>(null);

  const handleUnlink = async (accountId: string) => {
    if (!currentOrgId || !currentProjectId) return;
    if (!confirm('Are you sure you want to unlink this account from the creator?')) return;

    setUnlinking(accountId);
    try {
      await CreatorLinksService.unlinkCreatorFromAccount(
        currentOrgId,
        currentProjectId,
        creator.userId,
        accountId
      );
      onUpdate();
    } catch (error) {
      console.error('Failed to unlink account:', error);
      alert('Failed to unlink account');
    } finally {
      setUnlinking(null);
    }
  };
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {linkedAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-white/5 transition-colors"
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
                    <td className="px-6 py-4 text-right">
                      <Button
                        onClick={() => handleUnlink(account.id)}
                        disabled={unlinking === account.id}
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        {unlinking === account.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                            Unlinking...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Unlink
                          </>
                        )}
                      </Button>
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
const SettingsTab: React.FC<{
  creator: OrgMember;
  profile: Creator | null;
  editingName: boolean;
  setEditingName: (value: boolean) => void;
  editingEmail: boolean;
  setEditingEmail: (value: boolean) => void;
  tempName: string;
  setTempName: (value: string) => void;
  tempEmail: string;
  setTempEmail: (value: string) => void;
  onUpdate: () => void;
}> = ({
  creator,
  profile,
  editingName,
  setEditingName,
  editingEmail,
  setEditingEmail,
  tempName,
  setTempName,
  tempEmail,
  setTempEmail,
  onUpdate,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [saving, setSaving] = React.useState(false);

  const handleEditName = () => {
    setTempName(profile?.displayName || creator.displayName || '');
    setEditingName(true);
  };

  const handleEditEmail = () => {
    setTempEmail(profile?.email || creator.email || '');
    setEditingEmail(true);
  };

  const handleSaveName = async () => {
    if (!currentOrgId || !currentProjectId || !tempName.trim()) return;

    setSaving(true);
    try {
      await CreatorLinksService.updateCreatorProfile(
        currentOrgId,
        currentProjectId,
        creator.userId,
        { displayName: tempName.trim() }
      );
      setEditingName(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!currentOrgId || !currentProjectId) return;

    // Validate email if provided
    if (tempEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tempEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      const emailValue = tempEmail.trim() || undefined;
      await CreatorLinksService.updateCreatorProfile(
        currentOrgId,
        currentProjectId,
        creator.userId,
        { email: emailValue }
      );
      setEditingEmail(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to update email:', error);
      alert('Failed to update email');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Creator Settings</h2>
        
        {/* Display Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Display Name
          </label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                autoFocus
              />
              <Button
                onClick={handleSaveName}
                disabled={saving || !tempName.trim()}
                className="bg-white hover:bg-gray-200 text-black"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={() => setEditingName(false)}
                disabled={saving}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-700/20 rounded-lg border border-gray-700">
              <span className="text-white">{profile?.displayName || creator.displayName || 'Not set'}</span>
              <Button
                onClick={handleEditName}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Email Address
          </label>
          {editingEmail ? (
            <div className="flex gap-2">
              <input
                type="email"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                placeholder="creator@example.com (optional)"
                className="flex-1 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                autoFocus
              />
              <Button
                onClick={handleSaveEmail}
                disabled={saving}
                className="bg-white hover:bg-gray-200 text-black"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={() => setEditingEmail(false)}
                disabled={saving}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-700/20 rounded-lg border border-gray-700">
              <span className="text-white">{profile?.email || creator.email || 'No email provided'}</span>
              <Button
                onClick={handleEditEmail}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                Edit
              </Button>
            </div>
          )}
          {(!profile?.email && !creator.email) && (
            <p className="text-xs text-gray-400 mt-2">
              No email set. The creator can't receive invitations or notifications.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Campaigns Tab Component
const CampaignsTab: React.FC<{
  campaigns: Campaign[];
  creatorId: string;
}> = ({ campaigns }) => {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {campaigns.length === 0 ? (
        <div className="bg-[#161616] rounded-xl border border-gray-800 p-12 text-center">
          <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Campaigns Yet</h3>
          <p className="text-gray-400">
            This creator is not currently part of any campaigns
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-[#161616] rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-all duration-200"
            >
              {/* Campaign Cover Image */}
              {campaign.coverImage ? (
                <div className="w-full h-48 bg-gradient-to-br from-purple-600 to-blue-600 relative">
                  <img
                    src={campaign.coverImage}
                    alt={campaign.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center relative">
                  <Target className="w-12 h-12 text-white/60" />
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
              )}

              {/* Campaign Info */}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {campaign.name}
                </h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {campaign.description || 'No description'}
                </p>

                {/* Campaign Dates */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(campaign.startDate)}</span>
                  <span>→</span>
                  <span>{campaign.isIndefinite ? 'Ongoing' : formatDate(campaign.endDate)}</span>
                </div>

                {/* Campaign Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Goal</div>
                    <div className="text-sm font-semibold text-white">
                      {formatNumber(campaign.goalAmount)} {campaign.goalType}
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Progress</div>
                    <div className="text-sm font-semibold text-white">
                      {campaign.progressPercent.toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(campaign.progressPercent, 100)}%` }}
                  />
                </div>

                {/* Campaign Type & Compensation */}
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-1 bg-white/5 rounded text-gray-400 capitalize">
                    {campaign.campaignType}
                  </span>
                  <div className="flex items-center gap-1 text-gray-400">
                    <DollarSign className="w-3 h-3" />
                    <span className="capitalize">{campaign.compensationType}</span>
                  </div>
                </div>

                {/* Participants Count */}
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{campaign.participantIds?.length || 0} participants</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    <span>{campaign.totalVideos || 0} videos</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorDetailsPage;

