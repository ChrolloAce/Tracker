import { useState, useEffect, forwardRef, useImperativeHandle, memo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember, CreatorLabel } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import CreatorLabelService from '../services/CreatorLabelService';
import CreatorShareLinkService from '../services/CreatorShareLinkService';
import { DateFilterType } from './DateRangeFilter';
import { useCreatorsData } from '../hooks/useCreatorsData';
import { User, TrendingUp, Plus, FileText, UserPlus, Link as LinkIcon, ChevronDown, X as XIcon, Check } from 'lucide-react';
import CreatorSignupFormModal from './creators/CreatorSignupFormModal';
import { EmptyState } from './ui/EmptyState';
import CreateCreatorModal from './CreateCreatorModal';
import EditPortalModal from './EditPortalModal';
import EditCreatorModal from './EditCreatorModal';
import EditCreatorProfileModal from './EditCreatorProfileModal';
import LinkCreatorAccountsModal from './LinkCreatorAccountsModal';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import ContractsManagementPage from './ContractsManagementPage';
import CreatorDetailModal from './CreatorDetailModal';
import CreatorPaymentPlanModal from './CreatorPaymentPlanModal';
import CreatorActivitySection from './CreatorActivitySection';
import { CreatorDirectVideoSubmission } from './CreatorDirectVideoSubmission';
import CreatorsTable from './creators/CreatorsTable';
import ManageCreatorLabelsModal from './creators/ManageCreatorLabelsModal';
import BulkLabelModal from './creators/BulkLabelModal';
import { getLabelColorClass } from './creators/CreatorLabelBadges';
import { Tag } from 'lucide-react';
import AssignCreatorProjectsModal from './creators/AssignCreatorProjectsModal';

export interface CreatorsManagementPageRef {
  openInviteModal: () => void;
  refreshData?: () => Promise<void>;
}

interface CreatorsManagementPageProps {
  dateFilter?: DateFilterType;
  /** Header-level search query (rendered by the parent dashboard header,
   *  next to the date filter). Filters by display name, email, or handle. */
  searchQuery?: string;
  organizationId?: string;
  projectId?: string;
  onRequiresPaidPlan?: (context: string) => boolean;
}

/**
 * CreatorsManagementPage
 * Admin interface to manage creators, link accounts, and track payouts
 */
const CreatorsManagementPage = forwardRef<CreatorsManagementPageRef, CreatorsManagementPageProps>((props, ref) => {
  const { dateFilter = 'all', searchQuery = '', organizationId, projectId, onRequiresPaidPlan } = props;
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
    creatorAccounts,
    isAdmin,
    loading,
    loadData,
  } = useCreatorsData(currentOrgId, currentProjectId, user?.uid, dateFilter);

  // ─── Local UI state ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'accounts' | 'contracts' | 'activity'>('accounts');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editPortalCreator, setEditPortalCreator] = useState<OrgMember | null>(null);
  const [linkingCreator, setLinkingCreator] = useState<OrgMember | null>(null);
  const [editingPaymentCreator, setEditingPaymentCreator] = useState<OrgMember | null>(null);
  const [, setActionLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [detailCreator, setDetailCreator] = useState<OrgMember | null>(null);
  const [paymentPlanCreator, setPaymentPlanCreator] = useState<OrgMember | null>(null);
  const [editingProfileCreator, setEditingProfileCreator] = useState<OrgMember | null>(null);
  const [addVideosForCreator, setAddVideosForCreator] = useState<OrgMember | null>(null);
  const [labelingCreator, setLabelingCreator] = useState<OrgMember | null>(null);
  const [showBulkLabelModal, setShowBulkLabelModal] = useState(false);
  const [showSignupFormModal, setShowSignupFormModal] = useState(false);
  // In-page label filter. Empty set = show all. Multi-select uses OR semantics
  // (creator passes if ANY selected label is on their profile) — that matches
  // how a "show me UGC OR Influencer" mental model usually works for admins
  // segmenting their roster.
  const [selectedFilterLabelIds, setSelectedFilterLabelIds] = useState<Set<string>>(new Set());
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click — same pattern as the other popovers in
  // this codebase (AddAccountModal etc.).
  useEffect(() => {
    if (!labelDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(e.target as Node)) {
        setLabelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [labelDropdownOpen]);
  const [assigningProjectsCreator, setAssigningProjectsCreator] = useState<OrgMember | null>(null);
  const [labels, setLabels] = useState<CreatorLabel[]>([]);

  // Reset to page 1 whenever the header search query changes so results from
  // the new query don't land on a stale page index.
  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedFilterLabelIds]);

  // Load labels for the project (seeds UGC/Influencer/Faceless on first read).
  const loadLabels = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !user?.uid) return;
    try {
      const list = await CreatorLabelService.listLabels(currentOrgId, currentProjectId, user.uid);
      setLabels(list);
    } catch (err) {
      console.error('Failed to load creator labels:', err);
    }
  }, [currentOrgId, currentProjectId, user?.uid]);

  useEffect(() => { loadLabels(); }, [loadLabels]);

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

  const handleRemoveCreator = async (creatorId: string) => {
    if (!currentOrgId || !currentProjectId) return;

    setActionLoading(creatorId);
    try {
      const memberRole = await OrganizationService.getUserRole(currentOrgId, creatorId);

      if (memberRole === 'owner') {
        alert('Cannot remove the organization owner. You can unlink their creator accounts instead.');
        return;
      }

      // Revoke any public share links before tearing down the creator profile.
      // Best-effort: a failure here shouldn't block removal since the link
      // becomes effectively orphaned either way (reads would 404 on missing creator).
      try {
        await CreatorShareLinkService.revoke({ orgId: currentOrgId, creatorId });
      } catch (err) {
        console.warn('Failed to revoke share links during creator removal (non-critical):', err);
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

  // Toast message state
  const [toastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  
  // Apply search filter against display name + email + linked-account handles.
  // Including handles makes "@username" lookups work even when the creator's
  // display name doesn't contain the term.
  const q = searchQuery.trim().toLowerCase();
  const searchedCreators = q
    ? creators.filter(c => {
        if ((c.displayName || '').toLowerCase().includes(q)) return true;
        if ((c.email || '').toLowerCase().includes(q)) return true;
        const accs = creatorAccounts.get(c.userId) || [];
        return accs.some(a => (a.username || '').toLowerCase().includes(q));
      })
    : creators;

  // Then apply the label filter (OR semantics — pass if any selected label is
  // on the creator's profile). Falls through unchanged when no labels picked.
  const filteredCreators = selectedFilterLabelIds.size === 0
    ? searchedCreators
    : searchedCreators.filter(c => {
        const ids = creatorProfiles.get(c.userId)?.labelIds || [];
        return ids.some(id => selectedFilterLabelIds.has(id));
      });

  // Pagination calculations (against the filtered list)
  const totalPages = Math.max(1, Math.ceil(filteredCreators.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedCreators = filteredCreators.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Tab Navigation — header row with tabs on the left and a small
          Signup-form CTA on the right (admins only manage one form per
          project so a single button is enough; the modal handles the rest). */}
      <div className="border-b border-border flex items-center justify-between">
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
        <button
          onClick={() => setShowSignupFormModal(true)}
          className="hidden sm:inline-flex items-center gap-1.5 mb-2 px-3 py-1.5 rounded-lg border border-border bg-surface-secondary hover:border-border-strong text-content-muted hover:text-content text-xs font-semibold transition-colors"
          title="Manage the public Creator Signup form"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Signup form
        </button>
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
          {/* Label filter dropdown — multi-select with OR semantics. The
              previous chip row had legibility issues in light mode (some
              label colors landed white-on-white when active); a dropdown
              gives a stable trigger surface and keeps the colored badges
              for differentiation inside the list, not on the trigger. */}
          {creators.length > 0 && labels.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative" ref={labelDropdownRef}>
                <button
                  onClick={() => setLabelDropdownOpen(o => !o)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    labelDropdownOpen
                      ? 'bg-surface-tertiary border-border-strong text-content'
                      : 'bg-surface-secondary border-border text-content hover:border-border-strong'
                  }`}
                >
                  <Tag className="w-4 h-4 text-content-muted" />
                  <span className="text-content-muted">Labels:</span>
                  <span className="font-semibold">
                    {selectedFilterLabelIds.size === 0
                      ? 'All'
                      : selectedFilterLabelIds.size === 1
                        ? labels.find(l => selectedFilterLabelIds.has(l.id))?.name || '1 label'
                        : `${selectedFilterLabelIds.size} labels`}
                  </span>
                  {selectedFilterLabelIds.size > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFilterLabelIds(new Set()); }}
                      className="p-0.5 rounded hover:bg-surface-hover text-content-muted hover:text-content"
                      aria-label="Clear filter"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${labelDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {labelDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-surface border border-border rounded-xl shadow-2xl z-30 overflow-hidden">
                    <button
                      onClick={() => { setSelectedFilterLabelIds(new Set()); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover border-b border-border-subtle"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedFilterLabelIds.size === 0
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-border bg-surface-secondary'
                      }`}>
                        {selectedFilterLabelIds.size === 0 && <Check className="w-3 h-3" />}
                      </span>
                      <span className="text-content">All creators</span>
                    </button>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {labels.map(label => {
                        const active = selectedFilterLabelIds.has(label.id);
                        return (
                          <button
                            key={label.id}
                            onClick={() => {
                              setSelectedFilterLabelIds(prev => {
                                const next = new Set(prev);
                                if (next.has(label.id)) next.delete(label.id);
                                else next.add(label.id);
                                return next;
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              active
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'border-border bg-surface-secondary'
                            }`}>
                              {active && <Check className="w-3 h-3" />}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getLabelColorClass(label.color)}`}>
                              {label.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              {selectedFilterLabelIds.size > 0 && (
                <span className="text-xs text-content-muted">
                  {filteredCreators.length} of {creators.length}
                </span>
              )}
            </div>
          )}

          {/* Creators List - Dashboard Style */}
          {creators.length === 0 ? (
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
          creators={filteredCreators}
          paginatedCreators={paginatedCreators}
          creatorProfiles={creatorProfiles}
          creatorAccounts={creatorAccounts}
          labels={labels}
          calculatedEarnings={calculatedEarnings}
          creatorTotalViews={creatorTotalViews}
          videoCounts={videoCounts}
          totalEarnings={totalEarnings}
          selectedCreatorIds={selectedCreatorIds}
          isAdmin={isAdmin}
          currentPage={safePage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          bulkActionLoading={bulkActionLoading}
          onToggleSelectCreator={toggleSelectCreator}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          onBulkLabel={() => setShowBulkLabelModal(true)}
          onCreatorClick={setDetailCreator}
          onEditPayment={setEditingPaymentCreator}
          onSetPaymentPlan={setPaymentPlanCreator}
          onEditLinks={setLinkingCreator}
          onEditProfile={setEditingProfileCreator}
          onEditPortal={(creator) => setEditPortalCreator(creator)}
          onAddVideosForCreator={(creator) => setAddVideosForCreator(creator)}
          onRemoveCreator={(creator) => {
            if (confirm(`Remove ${creator.displayName || creator.email} from your team?\n\nThis will:\n• Remove them from the organization\n• Delete their creator profile\n• Unlink all their accounts\n• Remove all creator links`)) {
              handleRemoveCreator(creator.userId);
            }
          }}
          onTogglePayoutPortal={async (creator, next) => {
            // Flip the per-creator `payoutPortalEnabled` flag. Default for every creator is OFF
            // until the admin explicitly turns it on here. Writes to creators/{id} via
            // CreatorLinksService so the gate takes effect on the creator's next portal load.
            try {
              await CreatorLinksService.updateCreatorPayoutPortalEnabled(
                currentOrgId!,
                currentProjectId!,
                creator.userId,
                next,
              );
              await loadData();
            } catch (e) {
              console.error('Failed to toggle payout portal:', e);
              alert('Failed to update setting. Check console for details.');
            }
          }}
          onManageLabels={(creator) => setLabelingCreator(creator)}
          onManageProjects={(creator) => setAssigningProjectsCreator(creator)}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
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

      {/* Edit Portal Modal — manage existing share link: copy URL, toggle submissions, revoke */}
      {editPortalCreator && (
        <EditPortalModal
          isOpen={!!editPortalCreator}
          onClose={() => setEditPortalCreator(null)}
          onSuccess={() => loadData()}
          creator={editPortalCreator}
          profile={creatorProfiles.get(editPortalCreator.userId)}
        />
      )}

      {/* Add Videos for Creator Modal — uses the existing bulk-paste submission
          component with the assignedCreatorId pre-set so videos land attributed
          to this specific creator in the dashboard and public share page. */}
      {addVideosForCreator && (
        <CreatorDirectVideoSubmission
          isOpen={!!addVideosForCreator}
          onClose={() => setAddVideosForCreator(null)}
          onSuccess={() => {
            setAddVideosForCreator(null);
            loadData();
          }}
          assignedCreatorId={addVideosForCreator.userId}
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

      {/* Manage Labels Modal — assign UGC/Influencer/Faceless or any custom tag
          to this creator. Modal also lets the admin create/delete labels inline. */}
      {labelingCreator && currentOrgId && currentProjectId && user?.uid && (
        <ManageCreatorLabelsModal
          orgId={currentOrgId}
          projectId={currentProjectId}
          userId={user.uid}
          creator={labelingCreator}
          initialLabelIds={creatorProfiles.get(labelingCreator.userId)?.labelIds || []}
          onClose={() => setLabelingCreator(null)}
          onSaved={async () => {
            await loadLabels();
            await loadData();
          }}
        />
      )}

      {/* Bulk Label Modal — applies one or more labels to every selected creator
          at once (additive by default, optional replace mode). Triggered from
          the table's bulk action bar when the selection is non-empty. */}
      {showBulkLabelModal && currentOrgId && currentProjectId && user?.uid && (
        <BulkLabelModal
          orgId={currentOrgId}
          projectId={currentProjectId}
          userId={user.uid}
          creatorIds={Array.from(selectedCreatorIds)}
          labels={labels}
          creatorProfiles={creatorProfiles}
          onClose={() => setShowBulkLabelModal(false)}
          onSaved={async () => {
            setSelectedCreatorIds(new Set());
            await loadLabels();
            await loadData();
          }}
        />
      )}

      {/* Creator Signup Form modal — admin-side config for the public form
          that lets external creators self-onboard via a shared link. */}
      <CreatorSignupFormModal
        isOpen={showSignupFormModal}
        onClose={() => setShowSignupFormModal(false)}
      />

      {/* Assign Creator to Projects Modal — choose which projects this creator
          appears in (member.creatorProjectIds is the source of truth). */}
      {assigningProjectsCreator && currentOrgId && (
        <AssignCreatorProjectsModal
          orgId={currentOrgId}
          creator={assigningProjectsCreator}
          onClose={() => setAssigningProjectsCreator(null)}
          onSaved={async () => { await loadData(); }}
        />
      )}

      {/* Toast — bottom center */}
      {toastMessage && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg shadow-lg z-50 text-sm font-medium ${
          toastMessage.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toastMessage.text}
        </div>
      )}

          {/* Floating Action Button — single entry point for adding creators.
              Portal creation is now a toggle inside the CreateCreatorModal. */}
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
