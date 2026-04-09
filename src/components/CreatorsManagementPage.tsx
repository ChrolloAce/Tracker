import { useState, useEffect, forwardRef, useImperativeHandle, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import TeamInvitationService from '../services/TeamInvitationService';
import { DateFilterType } from './DateRangeFilter';
import { useCreatorsData } from '../hooks/useCreatorsData';
import { User, TrendingUp, Plus, FileText, UserPlus } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import CreateCreatorModal from './CreateCreatorModal';
import EditCreatorModal from './EditCreatorModal';
import EditCreatorProfileModal from './EditCreatorProfileModal';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import ContractsManagementPage from './ContractsManagementPage';
import CreatorPayoutsPage from './CreatorPayoutsPage';
import CreatorDetailModal from './CreatorDetailModal';
import CreatorPaymentPlanModal from './CreatorPaymentPlanModal';
import CreatorActivitySection from './CreatorActivitySection';
import CreatorsTable from './creators/CreatorsTable';
import PendingInvitationsTable from './creators/PendingInvitationsTable';

export interface CreatorsManagementPageRef {
  openInviteModal: () => void;
  refreshData?: () => Promise<void>;
}

interface CreatorsManagementPageProps {
  dateFilter?: DateFilterType;
  organizationId?: string;
  projectId?: string;
  onRequiresPaidPlan?: (context: string) => boolean;
}

/**
 * CreatorsManagementPage
 * Admin interface to manage creators, link accounts, and track payouts
 */
const CreatorsManagementPage = forwardRef<CreatorsManagementPageRef, CreatorsManagementPageProps>((props, ref) => {
  const { dateFilter = 'all', organizationId, projectId, onRequiresPaidPlan } = props;
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId } = useAuth();
  
  const currentOrgId = organizationId || authOrgId;
  const currentProjectId = projectId || authProjectId;

  // Lazy load animation data
  const [userProfileAnimation, setUserProfileAnimation] = useState<any>(null);
  useEffect(() => {
    import('../../public/lottie/User Profile.json').then(module => setUserProfileAnimation(module.default));
  }, []);

  // ─── Data from hook ──────────────────────────────────────────
  const {
    creators,
    creatorProfiles,
    calculatedEarnings,
    creatorTotalViews,
    videoCounts,
    pendingInvitations,
    isAdmin,
    loading,
    loadData,
  } = useCreatorsData(currentOrgId, currentProjectId, user?.uid, dateFilter);

  // ─── Local UI state ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'accounts' | 'contracts' | 'activity'>('accounts');
  const [isCreator, setIsCreator] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [linkingCreator, setLinkingCreator] = useState<OrgMember | null>(null);
  const [editingPaymentCreator, setEditingPaymentCreator] = useState<OrgMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [detailCreator, setDetailCreator] = useState<OrgMember | null>(null);
  const [paymentPlanCreator, setPaymentPlanCreator] = useState<OrgMember | null>(null);
  const [editingProfileCreator, setEditingProfileCreator] = useState<OrgMember | null>(null);

  // Check if user is a creator
  useEffect(() => {
    const checkRole = async () => {
      if (!currentOrgId || !user) return;
      const role = await OrganizationService.getUserRole(currentOrgId, user.uid);
      setIsCreator(role === 'creator');
    };
    checkRole();
  }, [currentOrgId, user]);

  // Keyboard shortcut - Press Space to add creator
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if Space is pressed and no input/textarea is focused
      if (e.code === 'Space' && 
          !showInviteModal && 
          !(document.activeElement instanceof HTMLInputElement) && 
          !(document.activeElement instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (onRequiresPaidPlan?.('to add creators')) return;
        setShowInviteModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showInviteModal, onRequiresPaidPlan]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openInviteModal: () => { if (onRequiresPaidPlan?.('to add creators')) return; setShowInviteModal(true); },
    refreshData: async () => {
      await loadData();
    }
  }));

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
      const memberRole = await OrganizationService.getUserRole(currentOrgId, creatorId);

      if (memberRole === 'owner') {
        alert('Cannot remove the organization owner. You can unlink their creator accounts instead.');
        return;
      }

      await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, creatorId);

      // Only remove org membership for pure creators; admins/members keep their membership
      if (memberRole === 'creator') {
        await OrganizationService.removeMember(currentOrgId, creatorId);
      }

      await loadData();
    } catch (error) {
      console.error('Failed to remove creator:', error);
      alert('Failed to remove creator. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Multi-select helpers
  const toggleSelectCreator = (creatorId: string) => {
    setSelectedCreatorIds(prev => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCreatorIds.size === paginatedCreators.length) {
      setSelectedCreatorIds(new Set());
    } else {
      setSelectedCreatorIds(new Set(paginatedCreators.map(c => c.userId)));
    }
  };

  const handleBulkDelete = async () => {
    if (!currentOrgId || !currentProjectId || selectedCreatorIds.size === 0) return;

    // Filter out any owners from the selection
    const safeIds: string[] = [];
    let ownerSkipped = false;
    for (const creatorId of selectedCreatorIds) {
      const role = await OrganizationService.getUserRole(currentOrgId, creatorId);
      if (role === 'owner') {
        ownerSkipped = true;
        continue;
      }
      safeIds.push(creatorId);
    }

    if (ownerSkipped) {
      alert('The organization owner cannot be removed and was skipped.');
    }

    if (safeIds.length === 0) return;

    const count = safeIds.length;
    if (!confirm(`Remove ${count} creator${count > 1 ? 's' : ''} from your team?\n\nThis will delete their profiles and unlink all accounts.`)) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        safeIds.map(async (creatorId) => {
          const role = await OrganizationService.getUserRole(currentOrgId, creatorId);
          await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, creatorId);
          if (role === 'creator') {
            await OrganizationService.removeMember(currentOrgId, creatorId);
          }
        })
      );
      setSelectedCreatorIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Failed to bulk remove creators:', error);
      alert('Some creators could not be removed. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Invite to portal state
  const [inviteConfirm, setInviteConfirm] = useState<OrgMember | null>(null);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInviteToPortal = (creator: OrgMember) => {
    const creatorEmail = creator.email || creatorProfiles.get(creator.userId)?.email;
    if (!creatorEmail) {
      setInviteMessage({ type: 'error', text: 'This creator has no email address. Please edit their profile to add an email first.' });
      return;
    }
    setInviteConfirm(creator);
  };

  const confirmInviteToPortal = async () => {
    if (!inviteConfirm || !user || !currentOrgId || !currentProjectId) return;
    const creatorEmail = inviteConfirm.email || creatorProfiles.get(inviteConfirm.userId)?.email;
    if (!creatorEmail) return;

    try {
      setActionLoading(inviteConfirm.userId);
      const orgs = await OrganizationService.getUserOrganizations(user.uid);
      const currentOrg = orgs.find(o => o.id === currentOrgId);
      if (!currentOrg) throw new Error('Organization not found');

      await TeamInvitationService.createInvitation(
        currentOrgId,
        creatorEmail,
        'creator',
        user.uid,
        user.displayName || user.email || 'Team Member',
        user.email || '',
        currentOrg.name,
        currentProjectId
      );

      setInviteConfirm(null);
      setInviteMessage({ type: 'success', text: `Invitation sent to ${creatorEmail}` });
      setTimeout(() => setInviteMessage(null), 4000);
      await loadData();
    } catch (error: any) {
      console.error('Failed to send portal invitation:', error);
      setInviteConfirm(null);
      setInviteMessage({ type: 'error', text: error.message || 'Failed to send invitation' });
      setTimeout(() => setInviteMessage(null), 5000);
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

  // Sum total paid across all creators (prefer payments array, fallback to calculatedEarnings)
  const totalEarnings = Array.from(creatorProfiles.values()).reduce((sum, p) => {
    if (p.paymentPlan?.payments && p.paymentPlan.payments.length > 0) {
      return sum + p.paymentPlan.payments.reduce((s: number, pay: any) => s + (pay.amount || 0), 0);
    }
    return sum + (calculatedEarnings.get(p.id) || 0);
  }, 0);
  
  // Pagination calculations
  const totalPages = Math.ceil(creators.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCreators = creators.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
        <button
          onClick={() => setActiveTab('accounts')}
            className={`
              flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'accounts'
                ? 'border-content text-content'
                : 'border-transparent text-content-muted hover:text-content-secondary'
              }
            `}
        >
          <User className="w-4 h-4" />
          Creators
        </button>
        <button
          onClick={() => setActiveTab('activity')}
            className={`
              flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'activity'
                ? 'border-content text-content'
                : 'border-transparent text-content-muted hover:text-content-secondary'
              }
            `}
        >
          <TrendingUp className="w-4 h-4" />
          Activity & Performance
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
            className={`
              flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'contracts'
                ? 'border-content text-content'
                : 'border-transparent text-content-muted hover:text-content-secondary'
              }
            `}
        >
          <FileText className="w-4 h-4" />
          Contracts
        </button>
        </nav>
      </div>

      {/* Activity & Performance Tab */}
      {activeTab === 'activity' && (
        <CreatorActivitySection
          dateFilter={dateFilter}
          organizationId={currentOrgId || undefined}
          projectId={currentProjectId || undefined}
        />
      )}

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
              onClick: () => { if (onRequiresPaidPlan?.('to add creators')) return; setShowInviteModal(true); },
              icon: UserPlus,
              primary: true
            }
          ]}
        />
      ) : (
        <CreatorsTable
          creators={creators}
          paginatedCreators={paginatedCreators}
          creatorProfiles={creatorProfiles}
          calculatedEarnings={calculatedEarnings}
          creatorTotalViews={creatorTotalViews}
          videoCounts={videoCounts}
          totalEarnings={totalEarnings}
          selectedCreatorIds={selectedCreatorIds}
          isAdmin={isAdmin}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          bulkActionLoading={bulkActionLoading}
          onToggleSelectCreator={toggleSelectCreator}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onCreatorClick={setDetailCreator}
          onEditPayment={setEditingPaymentCreator}
          onSetPaymentPlan={setPaymentPlanCreator}
          onEditLinks={setLinkingCreator}
          onEditProfile={setEditingProfileCreator}
          onInviteToPortal={handleInviteToPortal}
          onRemoveCreator={(creator) => {
            if (confirm(`Remove ${creator.displayName || creator.email} from your team?\n\nThis will:\n• Remove them from the organization\n• Delete their creator profile\n• Unlink all their accounts\n• Remove all creator links`)) {
              handleRemoveCreator(creator.userId);
            }
          }}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
        />
      )}

      {/* Pending Creator Invitations */}
      {isAdmin && (
        <PendingInvitationsTable
          invitations={pendingInvitations}
          actionLoading={actionLoading}
          onCopyLink={handleCopyInvitationLink}
          onCancel={handleCancelInvitation}
        />
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

      {/* Edit Creator Profile Modal */}
      {editingProfileCreator && (
        <EditCreatorProfileModal
          isOpen={!!editingProfileCreator}
          creator={editingProfileCreator}
          profile={creatorProfiles.get(editingProfileCreator.userId)}
          onClose={() => setEditingProfileCreator(null)}
          onSuccess={() => {
            setEditingProfileCreator(null);
            loadData();
          }}
        />
      )}

      {/* Creator Detail Modal */}
      {detailCreator && (
        <CreatorDetailModal
          isOpen={!!detailCreator}
          onClose={() => setDetailCreator(null)}
          creator={detailCreator}
          profile={creatorProfiles.get(detailCreator.userId)}
          earnings={calculatedEarnings.get(detailCreator.userId) || 0}
          videoCount={videoCounts.get(detailCreator.userId) || 0}
          onProfileUpdated={loadData}
        />
      )}

      {/* Payment Plan Modal */}
      {paymentPlanCreator && (
        <CreatorPaymentPlanModal
          isOpen={!!paymentPlanCreator}
          onClose={() => setPaymentPlanCreator(null)}
          onSuccess={() => {
            setPaymentPlanCreator(null);
            loadData();
          }}
          creator={paymentPlanCreator}
        />
      )}

      {/* Invite Confirmation Modal */}
      {inviteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-secondary rounded-xl border border-border shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-content mb-2">Send Portal Invitation?</h3>
            <p className="text-sm text-content-secondary mb-6">
              {inviteConfirm.displayName || inviteConfirm.email} will receive an email with a link to access the Creator Portal.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setInviteConfirm(null)} className="flex-1 px-4 py-2.5 bg-surface-secondary text-content border border-border rounded-lg font-semibold shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all">
                Cancel
              </button>
              <button onClick={confirmInviteToPortal} className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all">
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Message Toast */}
      {inviteMessage && (
        <div className={`fixed bottom-20 right-8 px-5 py-3 rounded-lg shadow-lg z-50 text-sm font-medium ${
          inviteMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {inviteMessage.text}
        </div>
      )}

          {/* Floating Action Button - Add Creator (only on Accounts tab) */}
          <button
            onClick={() => { if (onRequiresPaidPlan?.('to add creators')) return; setShowInviteModal(true); }}
            className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all z-40"
            title="Add Creator (Space)"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-semibold">Add Creator</span>
          </button>
        </>
      )}
    </div>
  );
});

CreatorsManagementPage.displayName = 'CreatorsManagementPage';

export default memo(CreatorsManagementPage);
