import { useState } from 'react';
import { OrgMember, Creator } from '../../types/firestore';
import { Trash2, MoreVertical, Edit3, DollarSign, FileText, TrendingUp } from 'lucide-react';
import { ProxiedImage } from '../ProxiedImage';
import AdminCreatorPaymentBar from '../AdminCreatorPaymentBar';
import Pagination from '../ui/Pagination';

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
  onRemoveCreator: (creator: OrgMember) => void;
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
  onRemoveCreator,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  return (
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

      {/* Bulk Action Bar */}
      {selectedCreatorIds.size > 0 && (
        <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">{selectedCreatorIds.size} selected</span>
            <button onClick={() => onToggleSelectAll()} className="text-xs text-gray-400 hover:text-white transition-colors">
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
            <tr className="border-b border-white/5">
              <th className="pl-6 pr-2 py-4 w-10">
                <input
                  type="checkbox"
                  checked={paginatedCreators.length > 0 && selectedCreatorIds.size === paginatedCreators.length}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-white/20 cursor-pointer"
                />
              </th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Creator</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Linked Accounts</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Videos</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Payment Progress</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedCreators.map((creator) => {
              const profile = creatorProfiles.get(creator.userId);
              const isSelected = selectedCreatorIds.has(creator.userId);

              return (
                <tr key={creator.userId} className={`hover:bg-white/5 transition-colors group ${isSelected ? 'bg-white/5' : ''}`}>
                  <td className="pl-6 pr-2 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectCreator(creator.userId)}
                      className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-white focus:ring-white/20 cursor-pointer"
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
                        <div className="text-sm font-semibold text-white truncate">{creator.displayName || 'Unknown Creator'}</div>
                        <div className="text-xs text-gray-400 truncate">{creator.email || 'No email provided'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Linked Accounts */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-white font-medium">
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
                    {profile?.payoutsEnabled && (
                      <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 mt-1">
                        Payouts enabled
                      </div>
                    )}
                  </td>

                  {/* Total Videos */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="text-sm text-white font-medium">
                      {videoCounts.get(creator.userId) || 0} {videoCounts.get(creator.userId) === 1 ? 'video' : 'videos'}
                    </div>
                  </td>

                  {/* Payment Progress */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    {profile?.paymentPlan ? (
                      <AdminCreatorPaymentBar
                        plan={profile.paymentPlan}
                        totalViews={creatorTotalViews.get(creator.userId) || 0}
                        paidAmount={profile.totalEarnings || 0}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-white">
                            ${(calculatedEarnings.get(creator.userId) || 0).toFixed(2)}
                          </div>
                          {profile?.customPaymentTerms && (
                            <TrendingUp className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                        {profile?.customPaymentTerms ? (
                          <div className="text-xs text-gray-500 mt-0.5">Legacy rules</div>
                        ) : (
                          <div className="text-xs text-gray-500 mt-0.5">No plan set</div>
                        )}
                      </>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onCreatorClick(creator)}>
                    <div className="text-sm text-gray-400">{formatDate(creator.joinedAt)}</div>
                  </td>

                  {/* Actions */}
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
                              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                              <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-50 py-1">
                                {profile?.customPaymentTerms && (
                                  <button
                                    onClick={() => { onEditPayment(creator); setOpenDropdownId(null); }}
                                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                  >
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    <span>View Contract</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => { onSetPaymentPlan(creator); setOpenDropdownId(null); }}
                                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                >
                                  <DollarSign className="w-4 h-4 text-emerald-400" />
                                  <span>Payment Plan</span>
                                </button>
                                <button
                                  onClick={() => { onEditLinks(creator); setOpenDropdownId(null); }}
                                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                                >
                                  <Edit3 className="w-4 h-4 text-blue-400" />
                                  <span>Edit Linked Accounts</span>
                                </button>
                                <div className="my-1 border-t border-white/10" />
                                <button
                                  onClick={() => { setOpenDropdownId(null); onRemoveCreator(creator); }}
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
