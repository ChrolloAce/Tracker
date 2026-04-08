import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { ShareableContract } from '../types/contract';
import {
  FileText,
  Plus,
  Copy,
  ExternalLink,
  Check,
  Clock,
  X,
  Search,
  Filter,
  MoreVertical,
  Download,
  Mail,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import Pagination from './ui/Pagination';

/**
 * Resolve the effective status of a contract.
 * If the contract's stored status is not 'signed' and either expiresAt or
 * contractEndDate is in the past, treat it as expired.
 */
const resolveEffectiveStatus = (contract: ShareableContract): ShareableContract['status'] => {
  if (contract.status === 'signed') return 'signed';

  const now = new Date();

  // Check expiresAt (Firestore Timestamp)
  if (contract.expiresAt) {
    const expiresDate = contract.expiresAt.toDate?.() ?? new Date(contract.expiresAt as any);
    if (expiresDate < now) return 'expired';
  }

  // Check contractEndDate (string like "2025-12-31")
  if (contract.contractEndDate) {
    const endDate = new Date(contract.contractEndDate);
    if (endDate < now) return 'expired';
  }

  return contract.status;
};

/**
 * Calculate days until a Firestore Timestamp date.
 * Returns null if no date provided.
 */
const daysUntil = (timestamp: any): number | null => {
  if (!timestamp) return null;
  const target = timestamp.toDate?.() ?? new Date(timestamp);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * Count how many signatures are still needed.
 */
const countPendingSignatures = (contract: ShareableContract): number => {
  let pending = 0;
  if (!contract.creatorSignature) pending++;
  if (!contract.companySignature) pending++;
  return pending;
};

const ContractsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId } = useAuth();
  const [contracts, setContracts] = useState<ShareableContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'signed' | 'expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  useEffect(() => {
    loadContracts();
  }, [currentOrgId, currentProjectId]);

  const loadContracts = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      // Get all contracts for this org/project
      const allContracts = await ContractService.getAllContractsForProject(
        currentOrgId,
        currentProjectId
      );
      setContracts(allContracts);
    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (link: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate?.() ?? new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDownloadContract = (contract: ShareableContract) => {
    const printUrl = `${contract.creatorLink}${contract.creatorLink.includes('?') ? '&' : '?'}print=true`;
    window.open(printUrl, '_blank');
    setOpenMenuId(null);
  };

  const handleSendCopyToCreator = async (contract: ShareableContract) => {
    if (!contract.creatorEmail) return;

    try {
      // TODO: Implement email sending via EmailService
      alert(`Sending contract to ${contract.creatorEmail}...`);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error sending contract:', error);
      alert('Failed to send contract. Please try again.');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    setIsDeleting(true);
    try {
      await ContractService.deleteContract(contractId);
      await loadContracts();
      setDeleteConfirmId(null);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Failed to delete contract. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenewContract = async (contractId: string) => {
    setRenewingId(contractId);
    try {
      // Renew with 90-day expiration
      const newExpiration = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await ContractService.renewContract(contractId, newExpiration);
      await loadContracts();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error renewing contract:', error);
      alert('Failed to renew contract. Please try again.');
    } finally {
      setRenewingId(null);
    }
  };

  // Filter contracts using effective (resolved) status
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch =
      contract.creatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.creatorEmail.toLowerCase().includes(searchTerm.toLowerCase());

    const effectiveStatus = resolveEffectiveStatus(contract);
    const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Paginate
  const totalPages = Math.ceil(filteredContracts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContracts = filteredContracts.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (contract: ShareableContract) => {
    const effectiveStatus = resolveEffectiveStatus(contract);

    switch (effectiveStatus) {
      case 'signed': {
        // Determine the signed date: use the later of the two signatures
        let signedDate = '';
        const creatorDate = contract.creatorSignature?.signedAt;
        const companyDate = contract.companySignature?.signedAt;
        const laterTimestamp = creatorDate && companyDate
          ? (creatorDate.toDate() > companyDate.toDate() ? creatorDate : companyDate)
          : creatorDate || companyDate;
        if (laterTimestamp) {
          signedDate = formatTimestamp(laterTimestamp);
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-xs font-medium">
            <Check className="w-3 h-3" />
            Signed {signedDate}
          </span>
        );
      }
      case 'pending': {
        const pendingCount = countPendingSignatures(contract);
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-md text-xs font-medium">
            <Clock className="w-3 h-3" />
            Awaiting {pendingCount} signature{pendingCount !== 1 ? 's' : ''}
          </span>
        );
      }
      case 'expired': {
        // Show the date at which it expired
        let expiredDate = '';
        if (contract.expiresAt) {
          const d = contract.expiresAt.toDate?.() ?? new Date(contract.expiresAt as any);
          if (d < new Date()) {
            expiredDate = formatTimestamp(contract.expiresAt);
          }
        }
        if (!expiredDate && contract.contractEndDate) {
          const d = new Date(contract.contractEndDate);
          if (d < new Date()) {
            expiredDate = formatDate(contract.contractEndDate);
          }
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium">
            <X className="w-3 h-3" />
            Expired {expiredDate}
          </span>
        );
      }
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded-md text-xs font-medium">
            Draft
          </span>
        );
    }
  };

  /**
   * Render an expiration warning for pending contracts with expiresAt.
   */
  const getExpirationWarning = (contract: ShareableContract) => {
    const effectiveStatus = resolveEffectiveStatus(contract);
    if (effectiveStatus !== 'pending') return null;

    const days = daysUntil(contract.expiresAt);
    if (days === null || days > 14) return null;

    const isUrgent = days < 3;
    const colorClass = isUrgent ? 'text-red-400' : 'text-amber-400';
    const bgClass = isUrgent ? 'bg-red-500/10' : 'bg-amber-500/10';

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${bgClass} ${colorClass} rounded text-[11px] font-medium mt-1`}>
        <AlertTriangle className="w-3 h-3" />
        {days <= 0 ? 'Expiring today' : `Expires in ${days} day${days !== 1 ? 's' : ''}`}
      </span>
    );
  };

  /**
   * Render signature progress indicators:
   * Two small circles -- creator and company.
   * Filled green if signed, hollow gray if not.
   */
  const getSignatureProgress = (contract: ShareableContract) => {
    const creatorSigned = !!contract.creatorSignature;
    const companySigned = !!contract.companySignature;

    return (
      <div className="flex items-center gap-2">
        {/* Creator */}
        <div className="flex items-center gap-1" title={creatorSigned ? `Creator signed: ${contract.creatorSignature?.name}` : 'Creator has not signed'}>
          <span
            className={`inline-block w-3 h-3 rounded-full border-2 ${
              creatorSigned
                ? 'bg-green-400 border-green-400'
                : 'bg-transparent border-gray-500'
            }`}
          />
          <span className="text-[11px] text-gray-400">Creator</span>
        </div>
        {/* Company */}
        <div className="flex items-center gap-1" title={companySigned ? `Company signed: ${contract.companySignature?.name}` : 'Company has not signed'}>
          <span
            className={`inline-block w-3 h-3 rounded-full border-2 ${
              companySigned
                ? 'bg-green-400 border-green-400'
                : 'bg-transparent border-gray-500'
            }`}
          />
          <span className="text-[11px] text-gray-400">Company</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading contracts...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Filters Bar */}
      <div className="flex gap-3 mb-6">
        {/* Search */}
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by creator name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        {/* Status Filter - Icon Only */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="pl-10 pr-3 py-2 bg-[#161616] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer"
            title="Filter by status"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="signed">Signed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Contracts List - Dashboard Style */}
      {filteredContracts.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No contracts found</h3>
          <p className="text-gray-400">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first contract to get started'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-5 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              All Contracts ({filteredContracts.length})
            </h2>
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
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Signatures
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Contract Period
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Links
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedContracts.map((contract) => {
                  const effectiveStatus = resolveEffectiveStatus(contract);
                  return (
                  <tr key={contract.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{contract.creatorName}</div>
                        <div className="text-xs text-gray-400">{contract.creatorEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {getStatusBadge(contract)}
                        {getExpirationWarning(contract)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getSignatureProgress(contract)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">
                        {formatDate(contract.contractStartDate)} - {formatDate(contract.contractEndDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-400">
                        {contract.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {/* Creator Link */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleCopyLink(contract.creatorLink, `creator-${contract.id}`)}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            title="Copy creator link"
                          >
                            {copiedLink === `creator-${contract.id}` ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-blue-400" />
                            )}
                          </button>
                          <a
                            href={contract.creatorLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            title="Open creator link"
                          >
                            <ExternalLink className="w-4 h-4 text-blue-400" />
                          </a>
                        </div>

                        {/* Company Link */}
                        <div className="flex gap-1 border-l border-gray-700 pl-2">
                          <button
                            onClick={() => handleCopyLink(contract.companyLink, `company-${contract.id}`)}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            title="Copy company link"
                          >
                            {copiedLink === `company-${contract.id}` ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-purple-400" />
                            )}
                          </button>
                          <a
                            href={contract.companyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            title="Open company link"
                          >
                            <ExternalLink className="w-4 h-4 text-purple-400" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === contract.id ? null : contract.id);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="More actions"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === contract.id && (
                          <>
                            {/* Backdrop to close menu */}
                            <div
                              className="fixed inset-0 z-[9998]"
                              onClick={() => setOpenMenuId(null)}
                            />

                            {/* Menu */}
                            <div className="absolute right-0 top-8 w-48 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-[9999] overflow-hidden">
                              {/* Download */}
                              <button
                                onClick={() => handleDownloadContract(contract)}
                                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3"
                              >
                                <Download className="w-4 h-4 text-blue-400" />
                                Download Contract
                              </button>

                              {/* Send Copy */}
                              <button
                                onClick={() => handleSendCopyToCreator(contract)}
                                disabled={!contract.creatorEmail}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-3 ${
                                  contract.creatorEmail
                                    ? 'text-white hover:bg-white/10'
                                    : 'text-gray-500 cursor-not-allowed opacity-50'
                                }`}
                                title={!contract.creatorEmail ? 'No email available' : 'Send copy to creator'}
                              >
                                <Mail className="w-4 h-4 text-purple-400" />
                                Send Copy to Creator
                              </button>

                              {/* Renew Contract - only for expired */}
                              {effectiveStatus === 'expired' && (
                                <button
                                  onClick={() => handleRenewContract(contract.id)}
                                  disabled={renewingId === contract.id}
                                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <RefreshCw className={`w-4 h-4 text-amber-400 ${renewingId === contract.id ? 'animate-spin' : ''}`} />
                                  {renewingId === contract.id ? 'Renewing...' : 'Renew Contract'}
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  setDeleteConfirmId(contract.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-red-500/20 transition-colors flex items-center gap-3 border-t border-white/5"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                                Delete Contract
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination - Inside Container */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredContracts.length}
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

      {/* Floating Action Button - Create Contract */}
      <button
        onClick={() => navigate('/contracts/create')}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all z-40"
        title="Create Contract"
      >
        <Plus className="w-5 h-5" />
        <span className="text-sm font-semibold">New Contract</span>
      </button>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Contract</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this contract? All associated data will be permanently removed.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteContract(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Contract
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContractsManagementPage;
