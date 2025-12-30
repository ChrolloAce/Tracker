import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TeamInvitation } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import DateFilterService from '../services/DateFilterService';
import TeamInvitationService from '../services/TeamInvitationService';
import { DateFilterType } from './DateRangeFilter';
import { User, TrendingUp, Plus, Mail, Clock, X, FileText, UserPlus, Copy, Trash2, MoreVertical, Edit3 } from 'lucide-react';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import Pagination from './ui/Pagination';
import CreateCreatorModal from './CreateCreatorModal';
import EditCreatorModal from './EditCreatorModal';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import ContractsManagementPage from './ContractsManagementPage';
import CreatorPayoutsPage from './CreatorPayoutsPage';
import userProfileAnimation from '../../public/lottie/User Profile.json';
import { ProxiedImage } from './ProxiedImage';

export interface CreatorsManagementPageRef {
  openInviteModal: () => void;
  refreshData?: () => Promise<void>;
}

interface CreatorsManagementPageProps {
  dateFilter?: DateFilterType;
  organizationId?: string;
  projectId?: string;
}

/**
 * CreatorsManagementPage
 * Admin interface to manage creators, link accounts, and track payouts
 */
const CreatorsManagementPage = forwardRef<CreatorsManagementPageRef, CreatorsManagementPageProps>((props, ref) => {
  const { dateFilter = 'all', organizationId, projectId } = props;
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId, userRole } = useAuth();
  const navigate = useNavigate();
  
  // Use props if provided (for demo mode), otherwise use auth
  const currentOrgId = organizationId || authOrgId;
  const currentProjectId = projectId || authProjectId;
  const [activeTab, setActiveTab] = useState<'accounts' | 'contracts'>('accounts');
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, Creator>>(new Map());
  const [calculatedEarnings, setCalculatedEarnings] = useState<Map<string, number>>(new Map());
  const [videoCounts, setVideoCounts] = useState<Map<string, number>>(new Map());
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkingCreator, setLinkingCreator] = useState<OrgMember | null>(null);
  const [editingPaymentCreator, setEditingPaymentCreator] = useState<OrgMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Check if user is a creator
  useEffect(() => {
    const checkRole = async () => {
      if (!currentOrgId || !user) return;
      const role = await OrganizationService.getUserRole(currentOrgId, user.uid);
      setIsCreator(role === 'creator');
    };
    checkRole();
  }, [currentOrgId, user]);

  useEffect(() => {
    // Only load admin data if not a creator
    if (!isCreator) {
      loadData();
    }
  }, [currentOrgId, currentProjectId, user, dateFilter, isCreator]);

  // Keyboard shortcut - Press Space to add creator
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if Space is pressed and no input/textarea is focused
      if (e.code === 'Space' && 
          !showInviteModal && 
          !(document.activeElement instanceof HTMLInputElement) && 
          !(document.activeElement instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowInviteModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showInviteModal]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openInviteModal: () => setShowInviteModal(true),
    refreshData: async () => {
      await loadData();
    }
  }));

  // Optimized: accepts pre-loaded accounts and links (no redundant fetching!)
  const calculateCreatorEarningsOptimized = async (
    creatorId: string, 
    profile: Creator,
    projectAccounts: any[],
    creatorLinks: any[]
  ): Promise<{ earnings: number; videoCount: number }> => {
    if (!currentOrgId || !currentProjectId) {
      return { earnings: 0, videoCount: 0 };
    }

    try {
      // Use pre-loaded links (no Firestore query!)
      if (creatorLinks.length === 0) return { earnings: 0, videoCount: 0 };

      const accountIds = creatorLinks.map(link => link.accountId);
      
      // Use pre-loaded accounts (no Firestore query!)
      const linkedAccounts = projectAccounts.filter(acc => accountIds.includes(acc.id));
      
      if (linkedAccounts.length === 0) return { earnings: 0, videoCount: 0 };

      // Load videos for each account
      const videosPromises = linkedAccounts.map(async (account) => {
        try {
          const videos = await FirestoreDataService.getVideos(
            currentOrgId,
            currentProjectId,
            { trackedAccountId: account.id, limitCount: 10 }
          );
          return videos;
        } catch (error) {
          console.error(`Failed to load videos for account ${account.id}:`, error);
          return [];
        }
      });
      
      let allVideos = (await Promise.all(videosPromises)).flat();
      
      // Apply date filter
      if (dateFilter !== 'all') {
        const dateRange = DateFilterService.getDateRange(dateFilter);
        if (dateRange) {
          allVideos = allVideos.filter((video: any) => {
            const uploadDate = video.uploadDate?.toDate ? video.uploadDate.toDate() : new Date(video.uploadDate);
            return uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate;
          });
        }
      }
      
      const videoCount = allVideos.length;
      
      if (!profile.customPaymentTerms || allVideos.length === 0) {
        return { earnings: 0, videoCount };
      }

      // Calculate earnings
      const terms = profile.customPaymentTerms;
      let total = 0;

      allVideos.forEach((video: any) => {
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

      return { earnings: total, videoCount };
    } catch (error) {
      console.error(`Failed to calculate earnings for creator ${creatorId}:`, error);
      return { earnings: 0, videoCount: 0 };
    }
  };

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // PHASE 1: Load ALL basic data in PARALLEL
      const [role, creatorProfilesList, membersData, invitesData, projectAccounts, allCreatorLinksSnapshot] = await Promise.all([
        OrganizationService.getUserRole(currentOrgId, user.uid),
        CreatorLinksService.getAllCreators(currentOrgId, currentProjectId),
        OrganizationService.getOrgMembers(currentOrgId),
        TeamInvitationService.getOrgInvitations(currentOrgId),
        FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId),
        getDocs(collection(db, 'organizations', currentOrgId, 'projects', currentProjectId, 'creatorLinks'))
      ]);
      
      setIsAdmin(role === 'owner' || role === 'admin');
      
      // Create a combined list:
      // 1. Creators with member accounts (accepted invitations)
      const creatorMembers = membersData.filter(m => 
        creatorProfilesList.some(p => p.id === m.userId)
      );
      
      // 2. Creators without member accounts (pending, added without email)
      const pendingCreators = creatorProfilesList
        .filter(profile => !membersData.some(m => m.userId === profile.id))
        .map(profile => ({
          userId: profile.id,
          displayName: profile.displayName,
          email: profile.email || '',
          photoURL: profile.photoURL,
          joinedAt: profile.createdAt,
          role: 'creator' as const,
          status: 'invited' as const
        }));
      
      // 3. Members with role='creator' but no creator profile (edge case: profile creation failed)
      const creatorsWithoutProfile = membersData
        .filter(m => m.role === 'creator' && !creatorProfilesList.some(p => p.id === m.userId))
        .map(member => ({
          ...member,
          role: 'creator' as const
        }));
      
      // Combine all three lists
      const allCreators = [...creatorMembers, ...pendingCreators, ...creatorsWithoutProfile];
      setCreators(allCreators);

      // Store creator profiles
      const creatorProfilesMap = new Map<string, Creator>();
      creatorProfilesList.forEach(profile => {
        creatorProfilesMap.set(profile.id, profile);
      });
      setCreatorProfiles(creatorProfilesMap);

      // Filter for creator invitations (already loaded in parallel!)
        const creatorInvitations = invitesData.filter(inv => inv.role === 'creator');
        setPendingInvitations(creatorInvitations);

      // Create a map of creatorId -> links for O(1) lookup
      const creatorLinksMap = new Map<string, any[]>();
      allCreatorLinksSnapshot.docs.forEach(doc => {
        const link = { id: doc.id, ...doc.data() };
        const creatorId = (link as any).creatorId;
        if (!creatorLinksMap.has(creatorId)) {
          creatorLinksMap.set(creatorId, []);
        }
        creatorLinksMap.get(creatorId)!.push(link);
      });

      // PHASE 2: Calculate earnings for all creators in parallel
      // Reuse pre-loaded accounts and links!
      const earningsMap = new Map<string, number>();
      const videoCountsMap = new Map<string, number>();
      
      await Promise.all(
        creatorProfilesList.map(async (profile) => {
          const creatorLinks = creatorLinksMap.get(profile.id) || [];
          const { earnings, videoCount } = await calculateCreatorEarningsOptimized(profile.id, profile, projectAccounts, creatorLinks);
          earningsMap.set(profile.id, earnings);
          videoCountsMap.set(profile.id, videoCount);
        })
      );
      setCalculatedEarnings(earningsMap);
      setVideoCounts(videoCountsMap);
    } catch (error) {
      console.error('Failed to load creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!currentOrgId) return;

    setActionLoading(invitationId);
    try {
      await TeamInvitationService.cancelInvitation(invitationId, currentOrgId);
      await loadData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyInvitationLink = (invitationId: string) => {
    const inviteUrl = `${window.location.origin}/invitations/${invitationId}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        alert('Invitation link copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy link');
      });
  };

  const handleRemoveCreator = async (creatorId: string) => {
    if (!currentOrgId || !currentProjectId) return;

    setActionLoading(creatorId);
    try {
      // Remove all creator links and creator profile from the project
      await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, creatorId);
      
      // Remove from organization members
      await OrganizationService.removeMember(currentOrgId, creatorId);
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Failed to remove creator:', error);
      alert('Failed to remove creator. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // If user is a creator, show their personal payouts page
  if (isCreator) {
    return <CreatorPayoutsPage />;
  }

  if (loading) {
    return <PageLoadingSkeleton type="creators" />;
  }

  const totalEarnings = Array.from(calculatedEarnings.values()).reduce((sum, earnings) => sum + earnings, 0);
  
  // Pagination calculations
  const totalPages = Math.ceil(creators.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCreators = creators.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-white/10">
        <nav className="flex space-x-8">
        <button
          onClick={() => setActiveTab('accounts')}
            className={`
              flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'accounts'
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
        >
          <User className="w-4 h-4" />
          Creators
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
            className={`
              flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'contracts'
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
        >
          <FileText className="w-4 h-4" />
          Contracts
        </button>
        </nav>
      </div>

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <ContractsManagementPage />
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <>
          {/* Creators List - Dashboard Style */}
          {creators.length === 0 && pendingInvitations.length === 0 ? (
        <EmptyState
          title="Invite Your First Creator"
          description="Add content creators to your team, link their social accounts, track performance, and manage payments all in one place."
          tooltipText="Creators can be influencers, team members, or partners. Link their social accounts to track their content performance, calculate earnings based on views/engagement, and manage contracts. Perfect for agencies, brands, and creator networks."
          animation={userProfileAnimation}
          actions={[
            {
              label: 'Invite Creator',
              onClick: () => setShowInviteModal(true),
              icon: UserPlus,
              primary: true
            }
          ]}
        />
      ) : (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              All Creators ({creators.length})
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Total Earnings:</span>
              <span className="text-lg font-bold text-white">${totalEarnings.toFixed(2)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-3 sm:-mx-0">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Linked Accounts
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Total Videos
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Total Earnings
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedCreators.map((creator) => {
                  const profile = creatorProfiles.get(creator.userId);
                  
                  return (
                    <tr 
                      key={creator.userId} 
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td 
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => {
                          // Redirect to dashboard with creator filter instead of separate creator page
                          const linkedAccounts = (creator as any).linkedAccounts || [];
                          if (linkedAccounts.length > 0) {
                            navigate(`/dashboard?creator=${creator.userId}`);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 flex-shrink-0">
                            {creator.photoURL ? (
                              <ProxiedImage
                                src={creator.photoURL}
                                alt={creator.displayName || 'Creator'}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                                fallback={
                                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/10 text-white font-bold text-sm">
                                    {(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white/10 text-white font-bold text-sm">
                                {(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-white truncate">
                                {creator.displayName || 'Unknown Creator'}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {creator.email || 'No email provided'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td 
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => {
                          const linkedAccounts = (creator as any).linkedAccounts || [];
                          if (linkedAccounts.length > 0) {
                            navigate(`/dashboard?creator=${creator.userId}`);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-white font-medium">
                            {profile?.linkedAccountsCount || 0} {profile?.linkedAccountsCount === 1 ? 'account' : 'accounts'}
                          </div>
                          {profile?.customPaymentTerms && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPaymentCreator(creator);
                              }}
                              className="text-purple-400 hover:text-purple-300 transition-colors"
                              title="View Contract"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {profile?.payoutsEnabled && (
                          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mt-1">
                            Payouts enabled
                          </div>
                        )}
                      </td>
                      <td 
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => {
                          const linkedAccounts = (creator as any).linkedAccounts || [];
                          if (linkedAccounts.length > 0) {
                            navigate(`/dashboard?creator=${creator.userId}`);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                      >
                        <div className="text-sm text-white font-medium">
                          {videoCounts.get(creator.userId) || 0} {videoCounts.get(creator.userId) === 1 ? 'video' : 'videos'}
                        </div>
                      </td>
                      <td 
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => {
                          const linkedAccounts = (creator as any).linkedAccounts || [];
                          if (linkedAccounts.length > 0) {
                            navigate(`/dashboard?creator=${creator.userId}`);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-white">
                            ${(calculatedEarnings.get(creator.userId) || 0).toFixed(2)}
                          </div>
                          {profile?.customPaymentTerms && (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                        {profile?.customPaymentTerms && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Calculated
                          </div>
                        )}
                      </td>
                      <td 
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => {
                          const linkedAccounts = (creator as any).linkedAccounts || [];
                          if (linkedAccounts.length > 0) {
                            navigate(`/dashboard?creator=${creator.userId}`);
                          } else {
                            navigate('/dashboard');
                          }
                        }}
                      >
                        <div className="text-sm text-gray-400">
                          {formatDate(creator.joinedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdownId(openDropdownId === creator.userId ? null : creator.userId)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {openDropdownId === creator.userId && (
                                <>
                                  {/* Backdrop */}
                                  <div 
                                    className="fixed inset-0 z-40"
                                    onClick={() => setOpenDropdownId(null)}
                                  />
                                  
                                  {/* Dropdown Menu */}
                                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-50 py-1">
                                    {/* View Contract */}
                                    {profile?.customPaymentTerms && (
                                      <button
                                        onClick={() => {
                                          setEditingPaymentCreator(creator);
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                      >
                                        <FileText className="w-4 h-4 text-purple-400" />
                                        <span>View Contract</span>
                                      </button>
                                    )}
                                    
                                    {/* Edit Linked Accounts */}
                                    <button
                                      onClick={() => {
                                        setLinkingCreator(creator);
                                        setOpenDropdownId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                    >
                                      <Edit3 className="w-4 h-4 text-blue-400" />
                                      <span>Edit Linked Accounts</span>
                                    </button>

                                    {/* Divider */}
                                    <div className="my-1 border-t border-white/10" />
                                    
                                    {/* Remove Creator */}
                                    <button
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        if (confirm(`Remove ${creator.displayName || creator.email} from your team?\n\nThis will:\n• Remove them from the organization\n• Delete their creator profile\n• Unlink all their accounts\n• Remove all creator links`)) {
                                          handleRemoveCreator(creator.userId);
                                        }
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span>Remove Creator</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={creators.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onItemsPerPageChange={(newItemsPerPage) => {
              setItemsPerPage(newItemsPerPage);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* Pending Creator Invitations */}
      {isAdmin && pendingInvitations.length > 0 && (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/40">
            <h2 className="text-lg font-semibold text-white">
              Pending Creator Invitations ({pendingInvitations.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Invited By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingInvitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-white">{invitation.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {invitation.invitedByName || invitation.invitedByEmail || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-4 h-4" />
                        {formatDate(invitation.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyInvitationLink(invitation.id)}
                          className="text-gray-400 hover:text-gray-300 hover:bg-gray-500/10"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        disabled={actionLoading === invitation.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        {actionLoading === invitation.id ? (
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            Canceling...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <X className="w-4 h-4" />
                            Cancel
                          </span>
                        )}
                      </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Creator Modal - Multi-step with account linking and payment settings */}
      {showInviteModal && (
        <CreateCreatorModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadData();
          }}
        />
      )}

      {/* Link Creator Accounts Modal */}
      {linkingCreator && (
        <LinkCreatorAccountsModal
          creator={linkingCreator}
          onClose={() => setLinkingCreator(null)}
          onSuccess={() => {
            setLinkingCreator(null);
            loadData();
          }}
        />
      )}

      {/* Edit Creator Payment Modal */}
      {editingPaymentCreator && (
        <EditCreatorModal
          isOpen={!!editingPaymentCreator}
          creator={editingPaymentCreator}
          onClose={() => setEditingPaymentCreator(null)}
          onSuccess={() => {
            setEditingPaymentCreator(null);
            loadData();
          }}
        />
      )}

          {/* Floating Action Button - Add Creator (only on Accounts tab) */}
          <button
            onClick={() => setShowInviteModal(true)}
            className="fixed bottom-8 right-8 flex items-center justify-center p-4 rounded-full font-medium transition-all transform hover:scale-105 active:scale-95 bg-white/10 hover:bg-white/15 text-white border border-white/20 hover:border-white/30 shadow-2xl z-40"
            title="Add Creator (Space)"
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
});

CreatorsManagementPage.displayName = 'CreatorsManagementPage';

export default CreatorsManagementPage;
