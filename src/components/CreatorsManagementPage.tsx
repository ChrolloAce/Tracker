import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import Lottie from 'lottie-react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, Creator } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import { UserPlus, Link as LinkIcon, DollarSign, User, X, Edit3, Users as UsersIcon, TrendingUp } from 'lucide-react';
import { Button } from './ui/Button';
import CreateCreatorModal from './CreateCreatorModal';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import CreatorDetailsPage from './CreatorDetailsPage';
import userProfileAnimation from '../../public/lottie/User Profile.json';

export interface CreatorsManagementPageRef {
  openInviteModal: () => void;
}

/**
 * CreatorsManagementPage
 * Admin interface to manage creators, link accounts, and track payouts
 */
const CreatorsManagementPage = forwardRef<CreatorsManagementPageRef, {}>((_props, ref) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, Creator>>(new Map());
  const [calculatedEarnings, setCalculatedEarnings] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkingCreator, setLinkingCreator] = useState<OrgMember | null>(null);
  const [editingCreator, setEditingCreator] = useState<OrgMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentOrgId, currentProjectId, user]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openInviteModal: () => setShowInviteModal(true)
  }));

  const calculateCreatorEarnings = async (creatorId: string, profile: Creator) => {
    if (!currentOrgId || !currentProjectId || !profile.customPaymentTerms) {
      return 0;
    }

    try {
      // Get linked accounts
      const links = await CreatorLinksService.getCreatorLinkedAccounts(
        currentOrgId,
        currentProjectId,
        creatorId
      );
      
      if (links.length === 0) return 0;

      const accountIds = links.map(link => link.accountId);
      
      // Load all accounts
      const projectAccounts = await FirestoreDataService.getTrackedAccounts(
        currentOrgId,
        currentProjectId
      );
      
      const linkedAccounts = projectAccounts.filter(acc => accountIds.includes(acc.id));
      
      if (linkedAccounts.length === 0) return 0;

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
      
      const allVideos = (await Promise.all(videosPromises)).flat();
      
      if (allVideos.length === 0) return 0;

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

      return total;
    } catch (error) {
      console.error(`Failed to calculate earnings for creator ${creatorId}:`, error);
      return 0;
    }
  };

  const loadData = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;

    setLoading(true);
    try {
      // Load creators for THIS PROJECT
      const creatorProfilesList = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
      
      // Load member data for each creator
      const membersData = await OrganizationService.getOrgMembers(currentOrgId);
      const creatorMembers = membersData.filter(m => 
        creatorProfilesList.some(p => p.id === m.userId)
      );
      setCreators(creatorMembers);

      // Store creator profiles
      const creatorProfilesMap = new Map<string, Creator>();
      creatorProfilesList.forEach(profile => {
        creatorProfilesMap.set(profile.id, profile);
      });
      setCreatorProfiles(creatorProfilesMap);

      // Calculate real-time earnings for each creator
      const earningsMap = new Map<string, number>();
      await Promise.all(
        creatorProfilesList.map(async (profile) => {
          const earnings = await calculateCreatorEarnings(profile.id, profile);
          earningsMap.set(profile.id, earnings);
        })
      );
      setCalculatedEarnings(earningsMap);
    } catch (error) {
      console.error('Failed to load creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCreator = async (userId: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    if (!window.confirm('Are you sure you want to remove this creator from this project? This will unlink all their accounts in this project.')) {
      return;
    }

    setActionLoading(userId);
    try {
      // Remove all creator links from THIS PROJECT
      await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, userId);
      
      await loadData();
    } catch (error) {
      console.error('Failed to remove creator:', error);
      alert('Failed to remove creator from project');
    } finally {
      setActionLoading(null);
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

  // Show creator details page if editing
  if (editingCreator) {
    return (
      <CreatorDetailsPage
        creator={editingCreator}
        onBack={() => setEditingCreator(null)}
        onUpdate={() => loadData()}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-purple-500"></div>
      </div>
    );
  }

  const totalLinkedAccounts = Array.from(creatorProfiles.values()).reduce((sum, p) => sum + p.linkedAccountsCount, 0);
  const totalEarnings = Array.from(calculatedEarnings.values()).reduce((sum, earnings) => sum + earnings, 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards with Gradient Backgrounds */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Creators */}
        <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-purple-500/10 rounded-lg p-3 group-hover:bg-purple-500/20 transition-colors">
              <UsersIcon className="w-6 h-6 text-purple-400" />
            </div>
              <Button
                onClick={() => setShowInviteModal(true)}
                size="sm"
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {creators.length}
            </div>
            <div className="text-sm text-gray-400">Total Creators</div>
          </div>
        </div>

        {/* Linked Accounts */}
        <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500/10 rounded-lg p-3 group-hover:bg-blue-500/20 transition-colors">
              <LinkIcon className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {totalLinkedAccounts}
          </div>
          <div className="text-sm text-gray-400">Linked Accounts</div>
        </div>

        {/* Total Paid Out */}
        <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500/10 rounded-lg p-3 group-hover:bg-green-500/20 transition-colors">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            ${totalEarnings.toFixed(2)}
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>Total Earnings</span>
            <TrendingUp className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Creators List - Dashboard Style */}
      {creators.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-12 text-center">
          <div className="w-64 h-64 mx-auto mb-4">
            <Lottie animationData={userProfileAnimation} loop={true} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No creators yet</h3>
          <p className="text-gray-400 mb-6">
            Invite content creators to track their accounts and manage payouts
          </p>
          <Button
            onClick={() => setShowInviteModal(true)}
            className="mx-auto"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Your First Creator
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40">
            <h2 className="text-lg font-semibold text-white">
              All Creators ({creators.length})
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Manage creators, link accounts, and track performance
            </p>
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
                {creators.map((creator) => {
                  const profile = creatorProfiles.get(creator.userId);
                  
                  return (
                    <tr 
                      key={creator.userId} 
                      className="hover:bg-white/5 transition-colors group"
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
                            <div className="text-sm font-semibold text-white truncate">
                              {creator.displayName || 'Unknown Creator'}
                            </div>
                            <div className="text-xs text-gray-400 truncate">{creator.email}</div>
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
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingCreator(creator)}
                            disabled={actionLoading === creator.userId}
                            className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Edit Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setLinkingCreator(creator)}
                            disabled={actionLoading === creator.userId}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Link Accounts"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveCreator(creator.userId)}
                            disabled={actionLoading === creator.userId}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Remove Creator"
                          >
                            {actionLoading === creator.userId ? (
                              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
});

CreatorsManagementPage.displayName = 'CreatorsManagementPage';

export default CreatorsManagementPage;
