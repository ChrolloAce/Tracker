import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import ContractsManagementPage from './ContractsManagementPage';
import CreatorPayoutsPage from './CreatorPayoutsPage';
import CreatorDetailModal from './CreatorDetailModal';
import CreatorPaymentPlanModal from './CreatorPaymentPlanModal';
import CreatorActivitySection from './CreatorActivitySection';
import CreatorsTable from './creators/CreatorsTable';
import PendingInvitationsTable from './creators/PendingInvitationsTable';
import userProfileAnimation from '../../public/lottie/User Profile.json';

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
  const { user, currentOrgId: authOrgId, currentProjectId: authProjectId } = useAuth();
  
  const currentOrgId = organizationId || authOrgId;
  const currentProjectId = projectId || authProjectId;

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
      await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, creatorId);
      await OrganizationService.removeMember(currentOrgId, creatorId);
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
    
    const count = selectedCreatorIds.size;
    if (!confirm(`Remove ${count} creator${count > 1 ? 's' : ''} from your team?\n\nThis will remove them from the organization, delete their profiles, and unlink all accounts.`)) return;

    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedCreatorIds).map(async (creatorId) => {
          await CreatorLinksService.removeAllCreatorLinks(currentOrgId, currentProjectId, creatorId);
          await OrganizationService.removeMember(currentOrgId, creatorId);
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
          onClick={() => setActiveTab('activity')}
            className={`
              flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'activity'
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
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
              onClick: () => setShowInviteModal(true),
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
