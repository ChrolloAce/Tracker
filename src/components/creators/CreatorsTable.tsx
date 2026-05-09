import { useState, useRef } from 'react';
import { OrgMember, Creator, TrackedAccount, CreatorLabel } from '../../types/firestore';
import { Trash2, MoreVertical, Edit3, DollarSign, FileText, TrendingUp, User as UserIcon, Film, ExternalLink, Plus, Banknote, EyeOff, Tag, FolderTree } from 'lucide-react';
import AdminCreatorPaymentBar from '../AdminCreatorPaymentBar';
import Pagination from '../ui/Pagination';
import { FloatingDropdown, DropdownItem, DropdownDivider } from '../ui/FloatingDropdown';
import { PlatformIcon } from '../ui/PlatformIcon';
import { CreatorPlatformBubbles } from './CreatorPlatformBubbles';
import { CreatorLabelBadges } from './CreatorLabelBadges';

interface CreatorsTableProps {
  creators: OrgMember[];
  paginatedCreators: OrgMember[];
  creatorProfiles: Map<string, Creator>;
  /** creatorId → list of linked TrackedAccount objects. Drives the stacked-avatar
   *  identity column (one circle per linked account). When a creator has no
   *  linked accounts the row falls back to a neutral initial circle. */
  creatorAccounts: Map<string, TrackedAccount[]>;
  /** All labels available in this project. Looked up by id when rendering the
   *  per-row badge row (creator.labelIds → CreatorLabel objects). */
  labels: CreatorLabel[];
  calculatedEarnings: Map<string, number>;
  creatorTotalViews: Map<string, number>;
  videoCounts: Map<string, number>;
  totalEarnings: number;
  selectedCreatorIds: Set<string>;
  isAdmin: boolean;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  bulkActionLoading: boolean;
  onToggleSelectCreator: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  /** Open the bulk-label modal for every currently selected creator. */
  onBulkLabel: () => void;
  onCreatorClick: (creator: OrgMember) => void;
  onEditPayment: (creator: OrgMember) => void;
  onSetPaymentPlan: (creator: OrgMember) => void;
  onEditLinks: (creator: OrgMember) => void;
  onEditProfile: (creator: OrgMember) => void;
  onEditPortal: (creator: OrgMember) => void;
  onAddVideosForCreator: (creator: OrgMember) => void;
  onRemoveCreator: (creator: OrgMember) => void;
  /** Open the per-creator labels modal (assign UGC/Influencer/Faceless or any
   *  custom tag). */
  onManageLabels: (creator: OrgMember) => void;
  /** Open the per-creator project assignment modal (which projects can see this
   *  creator). */
  onManageProjects: (creator: OrgMember) => void;
  /** Flip the creator's `payoutPortalEnabled` flag (show/hide the Stripe Connect banner and
   *  "My payouts" section on their public portal). Default is OFF for every creator. */
  onTogglePayoutPortal: (creator: OrgMember, next: boolean) => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
}

const formatDate = (date: any) => {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Stacked-avatar identity for a creator on the org-level Creators table.
 *
 * Renders one circular avatar per linked TrackedAccount, overlapping (`-space-x-2`).
 * The 4th and beyond collapse into a `+N` chip in the last slot. A tiny platform
 * badge (TT/IG/YT/X) sits on each avatar so the admin can tell which network the
 * handle belongs to without hovering. Creators with no linked accounts get a
 * neutral initial circle so the column width stays stable. Replaces the single
 * `creator.photoURL` avatar to align with the payouts page treatment.
 */
/**
 * Account avatar with built-in `<img>` error fallback. The default broken-image
 * glyph the browser renders when a profile-picture URL has expired (very common
 * for TikTok / IG CDN URLs) is hideous; this component swaps to a clean initial
 * circle on `onError` so the row stays presentable. Platform corner badge still
 * renders either way.
 */
function AccountAvatar({ pic, fallbackChar }: { pic?: string; fallbackChar: string }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!pic && !failed;
  return showImg ? (
    <img
      src={pic}
      alt={fallbackChar}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-content-muted">
      {fallbackChar}
    </div>
  );
}

function LinkedAccountStack({
  accounts,
  fallbackInitial,
  max = 3,
}: { accounts: TrackedAccount[]; fallbackInitial: string; max?: number }) {
  if (accounts.length === 0) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface-tertiary border border-border flex items-center justify-center text-content-muted text-sm font-bold ring-2 ring-border">
        {fallbackInitial}
      </div>
    );
  }
  const visible = accounts.slice(0, max);
  const overflow = accounts.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((a, i) => (
        // Outer wrapper is `relative` only — NOT `overflow-hidden`. The avatar
        // image is clipped via the inner div; the platform badge is a sibling
        // so it can hang off the corner without being chopped.
        <div key={`${a.id}-${i}`} className="relative w-10 h-10" title={`@${a.username} · ${a.platform}`}>
          <div className="w-full h-full rounded-full ring-2 ring-border bg-surface-tertiary overflow-hidden">
            <AccountAvatar
              pic={a.profilePicture}
              fallbackChar={(a.username || a.platform).charAt(0).toUpperCase()}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-surface ring-2 ring-surface flex items-center justify-center">
            <PlatformIcon platform={a.platform as any} size="sm" />
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative w-10 h-10 rounded-full ring-2 ring-border bg-surface-tertiary flex items-center justify-center text-xs font-semibold text-content-secondary"
          title={`${overflow} more account${overflow === 1 ? '' : 's'}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

const CreatorsTable: React.FC<CreatorsTableProps> = ({
  creators,
  paginatedCreators,
  creatorProfiles,
  creatorAccounts,
  labels,
  calculatedEarnings,
  creatorTotalViews,
  videoCounts,
  selectedCreatorIds,
  isAdmin,
  currentPage,
  totalPages,
  itemsPerPage,
  bulkActionLoading,
  onToggleSelectCreator,
  onToggleSelectAll,
  onBulkDelete,
  onBulkLabel,
  onCreatorClick,
  onEditPayment,
  onSetPaymentPlan,
  onEditLinks,
  onEditProfile,
  onEditPortal,
  onAddVideosForCreator,
  onRemoveCreator,
  onTogglePayoutPortal,
  onManageLabels,
  onManageProjects,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const labelById = new Map(labels.map(l => [l.id, l]));
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  return (
    <div className="rounded-2xl bg-surface-secondary backdrop-blur border border-border-subtle shadow-lg overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-surface-secondary flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content">
          All Creators ({creators.length})
        </h2>
      </div>

      {/* Bulk Action Bar */}
      {selectedCreatorIds.size > 0 && (
        <div className="px-6 py-3 bg-surface-secondary border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-content">{selectedCreatorIds.size} selected</span>
            <button onClick={() => onToggleSelectAll()} className="text-xs text-content-muted hover:text-content transition-colors">
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBulkLabel}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              <Tag className="w-4 h-4" />
              Label Selected
            </button>
            <button
              onClick={onBulkDelete}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {bulkActionLoading ? (
                <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Remove Selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-3 sm:-mx-0">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="pl-6 pr-2 py-4 w-10">
                <input
                  type="checkbox"
                  checked={paginatedCreators.length > 0 && selectedCreatorIds.size === paginatedCreators.length}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-border bg-surface-secondary text-white focus:ring-border-strong cursor-pointer"
                />
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Creator</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Portal</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Linked Accounts</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Total Videos</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Payment Progress</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider">Joined</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-content-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedCreators.map((creator) => {
              const profile = creatorProfiles.get(creator.userId);
              const isSelected = selectedCreatorIds.has(creator.userId);
              const hasPortal = !!profile?.externalShareToken;

              return (
                <tr key={creator.userId} className={`hover:bg-surface-hover transition-colors group ${isSelected ? 'bg-surface-secondary' : ''}`}>
                  <td className="pl-6 pr-2 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectCreator(creator.userId)}
                      className="h-4 w-4 rounded border-border bg-surface-secondary text-white focus:ring-border-strong cursor-pointer"
                    />
                  </td>

                  {/* Creator — stacked avatars (one per linked tracked account)
                      replacing the single profile picture, matching the payouts page. */}
                  <td className="px-4 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <LinkedAccountStack
                          accounts={creatorAccounts.get(creator.userId) || []}
                          fallbackInitial={(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-semibold text-content truncate">{creator.displayName || 'Unknown Creator'}</div>
                          <CreatorPlatformBubbles items={creatorAccounts.get(creator.userId) || []} max={3} />
                          <CreatorLabelBadges
                            labels={(profile?.labelIds || [])
                              .map(id => labelById.get(id))
                              .filter((l): l is CreatorLabel => !!l)}
                            max={3}
                          />
                        </div>
                        <div className="text-xs text-content-muted truncate">{creator.email || 'No email provided'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Portal — direct button */}
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onEditPortal(creator)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        hasPortal
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-surface-tertiary text-content-muted border border-border hover:text-content hover:border-border-strong'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {hasPortal ? 'Edit Portal' : 'Create Portal'}
                    </button>
                  </td>

                  {/* Linked Accounts */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-content font-medium">
                        {profile?.linkedAccountsCount || 0} {profile?.linkedAccountsCount === 1 ? 'account' : 'accounts'}
                      </div>
                      {profile?.customPaymentTerms && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditPayment(creator); }}
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                          title="View Contract"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Total Videos — count + inline add button */}
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm text-content font-medium cursor-pointer hover:underline"
                        onClick={() => onCreatorClick(creator)}
                      >
                        {videoCounts.get(creator.userId) || 0} {videoCounts.get(creator.userId) === 1 ? 'video' : 'videos'}
                      </span>
                      <button
                        onClick={() => onAddVideosForCreator(creator)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-tertiary border border-border text-content-muted hover:text-content hover:border-border-strong hover:bg-surface-hover transition-all"
                        title="Add videos for this creator"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Payment Progress */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    {profile?.paymentPlan ? (
                      <AdminCreatorPaymentBar
                        plan={profile.paymentPlan}
                        totalViews={creatorTotalViews.get(creator.userId) || 0}
                        paidAmount={
                          profile.paymentPlan.payments
                            ? profile.paymentPlan.payments.reduce((s: number, p: any) => s + (p.amount || 0), 0)
                            : profile.totalEarnings || 0
                        }
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-content">
                            ${(calculatedEarnings.get(creator.userId) || 0).toFixed(2)}
                          </div>
                          {profile?.customPaymentTerms && (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                        {profile?.customPaymentTerms ? (
                          <div className="text-xs text-content-muted mt-0.5">Legacy rules</div>
                        ) : (
                          <div className="text-xs text-content-muted mt-0.5">No plan set</div>
                        )}
                      </>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="text-sm text-content-muted">{formatDate(creator.joinedAt)}</div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 relative" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && (
                        <div className="relative">
                          <button
                            ref={(el) => { if (el) triggerRefs.current.set(creator.userId, el); }}
                            onClick={() => setOpenDropdownId(openDropdownId === creator.userId ? null : creator.userId)}
                            className="p-2 text-content-muted hover:text-content hover:bg-surface-active rounded-lg transition-colors"
                            title="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          <FloatingDropdown
                            isOpen={openDropdownId === creator.userId}
                            onClose={() => setOpenDropdownId(null)}
                            triggerRef={{ current: triggerRefs.current.get(creator.userId) || null } as React.RefObject<HTMLElement>}
                            align="right"
                          >
                            <DropdownItem
                              icon={<UserIcon className="w-4 h-4 text-content-muted" />}
                              label="Edit Profile"
                              onClick={() => { onEditProfile(creator); setOpenDropdownId(null); }}
                            />
                            {profile?.customPaymentTerms && (
                              <DropdownItem
                                icon={<FileText className="w-4 h-4 text-purple-400" />}
                                label="View Contract"
                                onClick={() => { onEditPayment(creator); setOpenDropdownId(null); }}
                              />
                            )}
                            <DropdownItem
                              icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
                              label="Payment Plan"
                              onClick={() => { onSetPaymentPlan(creator); setOpenDropdownId(null); }}
                            />
                            <DropdownItem
                              icon={<Edit3 className="w-4 h-4 text-blue-400" />}
                              label="Edit Linked Accounts"
                              onClick={() => { onEditLinks(creator); setOpenDropdownId(null); }}
                            />
                            <DropdownItem
                              icon={<Film className="w-4 h-4 text-violet-400" />}
                              label="Add Videos"
                              onClick={() => { onAddVideosForCreator(creator); setOpenDropdownId(null); }}
                            />
                            <DropdownDivider />
                            <DropdownItem
                              icon={<Tag className="w-4 h-4 text-orange-400" />}
                              label="Manage labels"
                              onClick={() => { onManageLabels(creator); setOpenDropdownId(null); }}
                            />
                            <DropdownItem
                              icon={<FolderTree className="w-4 h-4 text-blue-400" />}
                              label="Assign to projects"
                              onClick={() => { onManageProjects(creator); setOpenDropdownId(null); }}
                            />
                            {/* Payout portal gate — show/hide the Stripe Connect banner and
                                 "My payouts" section on this creator's public share link.
                                 Default OFF; admin must explicitly enable per creator. The label
                                 flips based on current state so one menu item handles both actions. */}
                            <DropdownDivider />
                            <DropdownItem
                              icon={profile?.payoutPortalEnabled
                                ? <EyeOff className="w-4 h-4 text-content-muted" />
                                : <Banknote className="w-4 h-4 text-orange-500" />}
                              label={profile?.payoutPortalEnabled ? 'Hide payouts in portal' : 'Show payouts in portal'}
                              onClick={() => {
                                onTogglePayoutPortal(creator, !profile?.payoutPortalEnabled);
                                setOpenDropdownId(null);
                              }}
                            />
                            {creator.role !== 'owner' && (
                              <>
                                <DropdownDivider />
                                <DropdownItem
                                  icon={<Trash2 className="w-4 h-4" />}
                                  label="Remove Creator"
                                  variant="danger"
                                  onClick={() => { setOpenDropdownId(null); onRemoveCreator(creator); }}
                                />
                              </>
                            )}
                          </FloatingDropdown>
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
          onPageChange(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onItemsPerPageChange={(n) => {
          onItemsPerPageChange(n);
        }}
      />
    </div>
  );
};

export default CreatorsTable;
