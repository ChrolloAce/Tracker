import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator, TeamInvitation } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import DateFilterService from '../services/DateFilterService';
import TeamInvitationService from '../services/TeamInvitationService';
import { DateFilterType } from './DateRangeFilter';
import { User, TrendingUp, Plus, Mail, Clock, X, FileText } from 'lucide-react';
import { Button } from './ui/Button';
import Pagination from './ui/Pagination';
import CreateCreatorModal from './CreateCreatorModal';
import EditCreatorModal from './EditCreatorModal';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import ContractsManagementPage from './ContractsManagementPage';
import userProfileAnimation from '../../public/lottie/User Profile.json';

export interface CreatorsManagementPageRef {
  openInviteModal: () => void;
  refreshData?: () => Promise<void>;
}

interface CreatorsManagementPageProps {
  dateFilter?: DateFilterType;
}

/**
 * CreatorsManagementPage
 * Admin interface to manage creators, link accounts, and track payouts
 */
const CreatorsManagementPage = forwardRef<CreatorsManagementPageRef, CreatorsManagementPageProps>((props, ref) => {
  const { dateFilter = 'all' } = props;
  const { user, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'accounts' | 'contracts'>('accounts');
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, Creator>>(new Map());
  const [calculatedEarnings, setCalculatedEarnings] = useState<Map<string, number>>(new Map());
  const [videoCounts, setVideoCounts] = useState<Map<string, number>>(new Map());
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkingCreator, setLinkingCreator] = useState<OrgMember | null>(null);
  const [editingPaymentCreator, setEditingPaymentCreator] = useState<OrgMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user, dateFilter]);

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

  const calculateCreatorEarnings = async (creatorId: string, profile: Creator): Promise<{ earnings: number; videoCount: number }> => {
    if (!currentOrgId || !currentProjectId) {
      return { earnings: 0, videoCount: 0 };
    }

    try {
      // Get linked accounts
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        creatorId
      );
      
      if (links.length === 0) return { earnings: 0, videoCount: 0 };

      const accountIds = links.map(link => link.accountId);
      
      // Load all accounts
      const projectAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );
      
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
      // Check if user is admin
      const role = await OrganizationService.getUserRole(currentOrgId, user.uid);
      setIsAdmin(role === 'owner' || role === 'admin');

      // Load creators for THIS PROJECT
      const creatorProfilesList = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
      
      // Load member data for each creator
      const membersData = await OrganizationService.getOrgMembers(currentOrgId);
      
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
      
      // Combine both lists
      const allCreators = [...creatorMembers, ...pendingCreators];
      setCreators(allCreators);

      // Store creator profiles
      const creatorProfilesMap = new Map<string, Creator>();
      creatorProfilesList.forEach(profile => {
        creatorProfilesMap.set(profile.id, profile);
      });
      setCreatorProfiles(creatorProfilesMap);

      // Load pending creator invitations (only for admins)
      if (role === 'owner' || role === 'admin') {
        const invitesData = await TeamInvitationService.getOrgInvitations(currentOrgId);
        const creatorInvitations = invitesData.filter(inv => inv.role === 'creator');
        setPendingInvitations(creatorInvitations);
      }

      // Calculate real-time earnings and video counts for each creator
      const earningsMap = new Map<string, number>();
      const videoCountsMap = new Map<string, number>();
      await Promise.all(
        creatorProfilesList.map(async (profile) => {
          const { earnings, videoCount } = await calculateCreatorEarnings(profile.id, profile);
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
      <div className="flex items-center gap-4 border-b border-white/5 pb-3">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
            activeTab === 'accounts'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <User className="w-4 h-4" />
          Creators
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
            activeTab === 'contracts'
              ? 'bg-white text-black'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          Contracts
        </button>
      </div>

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <ContractsManagementPage />
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <>
          {/* Creators List - Dashboard Style */}
          {creators.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-12 text-center">
          <div className="w-64 h-64 mx-auto mb-4">
            <Lottie animationData={userProfileAnimation} loop={true} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No creators yet</h3>
          <p className="text-gray-400">
            Invite content creators to track their accounts and manage payouts
          </p>
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedCreators.map((creator) => {
                  const profile = creatorProfiles.get(creator.userId);
                  
                  return (
                    <tr 
                      key={creator.userId} 
                      onClick={() => navigate(`/creators/${creator.userId}`)}
                      className="hover:bg-white/5 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 flex-shrink-0">
                            {creator.photoURL ? (
                              <img
                                src={creator.photoURL}
                                alt={creator.displayName || 'Creator'}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const placeholder = e.currentTarget.parentElement?.querySelector('.placeholder-icon');
                                  if (placeholder) {
                                    (placeholder as HTMLElement).classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`placeholder-icon w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center ring-2 ring-white/10 ${creator.photoURL ? 'hidden' : ''}`}>
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
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
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">
                          {profile?.linkedAccountsCount || 0} {profile?.linkedAccountsCount === 1 ? 'account' : 'accounts'}
                        </div>
                        {profile?.payoutsEnabled && (
                          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mt-1">
                            Payouts enabled
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">
                          {videoCounts.get(creator.userId) || 0} {videoCounts.get(creator.userId) === 1 ? 'video' : 'videos'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-400">
                          {formatDate(creator.joinedAt)}
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
            className="fixed bottom-8 right-8 w-14 h-14 bg-white text-black rounded-full shadow-2xl hover:bg-gray-100 transition-all duration-200 flex items-center justify-center z-40 hover:scale-110"
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
