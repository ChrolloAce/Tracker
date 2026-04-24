import { useState, useRef } from 'react';
import { OrgMember, Creator } from '../../types/firestore';
import { Trash2, MoreVertical, Edit3, DollarSign, FileText, TrendingUp, User as UserIcon, Film, ExternalLink, Plus, Banknote, EyeOff } from 'lucide-react';
import { ProxiedImage } from '../ProxiedImage';
import AdminCreatorPaymentBar from '../AdminCreatorPaymentBar';
import Pagination from '../ui/Pagination';
import { FloatingDropdown, DropdownItem, DropdownDivider } from '../ui/FloatingDropdown';

interface CreatorsTableProps {
  creators: OrgMember[];
  paginatedCreators: OrgMember[];
  creatorProfiles: Map<string, Creator>;
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
  onCreatorClick: (creator: OrgMember) => void;
  onEditPayment: (creator: OrgMember) => void;
  onSetPaymentPlan: (creator: OrgMember) => void;
  onEditLinks: (creator: OrgMember) => void;
  onEditProfile: (creator: OrgMember) => void;
  onEditPortal: (creator: OrgMember) => void;
  onAddVideosForCreator: (creator: OrgMember) => void;
  onRemoveCreator: (creator: OrgMember) => void;
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

const CreatorsTable: React.FC<CreatorsTableProps> = ({
  creators,
  paginatedCreators,
  creatorProfiles,
  calculatedEarnings,
  creatorTotalViews,
  videoCounts,
  totalEarnings,
  selectedCreatorIds,
  isAdmin,
  currentPage,
  totalPages,
  itemsPerPage,
  bulkActionLoading,
  onToggleSelectCreator,
  onToggleSelectAll,
  onBulkDelete,
  onCreatorClick,
  onEditPayment,
  onSetPaymentPlan,
  onEditLinks,
  onEditProfile,
  onEditPortal,
  onAddVideosForCreator,
  onRemoveCreator,
  onTogglePayoutPortal,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  return (
    <div className="rounded-2xl bg-surface-secondary backdrop-blur border border-border-subtle shadow-lg overflow-hidden">
      {/* Table Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-surface-secondary flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content">
          All Creators ({creators.length})
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-content-muted">Total Earnings:</span>
          <span className="text-lg font-bold text-content">${totalEarnings.toFixed(2)}</span>
        </div>
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

                  {/* Creator */}
                  <td className="px-4 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 flex-shrink-0">
                        {creator.photoURL ? (
                          <ProxiedImage
                            src={creator.photoURL}
                            alt={creator.displayName || 'Creator'}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                            fallback={
                              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-border text-white font-bold text-sm">
                                {(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                              </div>
                            }
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-border text-white font-bold text-sm">
                            {(creator.displayName || creator.email || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-content truncate">{creator.displayName || 'Unknown Creator'}</div>
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
