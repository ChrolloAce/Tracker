import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { Button } from './ui/Button';
import clsx from 'clsx';
import CreateContractModal from './CreateContractModal';

const ContractsManagementPage: React.FC = () => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [contracts, setContracts] = useState<ShareableContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'signed' | 'expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [deletingContract, setDeletingContract] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<ShareableContract | null>(null);
  
  const itemsPerPage = 10;

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
    if (!link) {
      alert('Invalid link');
      return;
    }

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          textArea.remove();
        } catch (err) {
          console.error('Fallback: Could not copy text: ', err);
          textArea.remove();
          throw err;
        }
      }
      
      setCopiedLink(linkId);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      alert('Failed to copy link to clipboard. Please copy manually: ' + link);
    }
  };

  const handleDeleteClick = (contract: ShareableContract) => {
    setContractToDelete(contract);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contractToDelete) return;

    setDeletingContract(contractToDelete.id);
    try {
      await ContractService.deleteContract(contractToDelete.id);
      await loadContracts();
      setShowDeleteConfirm(false);
      setContractToDelete(null);
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Failed to delete contract. Please try again.');
    } finally {
      setDeletingContract(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setContractToDelete(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.creatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.creatorEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Paginate
  const totalPages = Math.ceil(filteredContracts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContracts = filteredContracts.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'signed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-xs font-medium">
            <Check className="w-3 h-3" />
            Signed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-md text-xs font-medium">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium">
            <X className="w-3 h-3" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded-md text-xs font-medium">
            Draft
          </span>
        );
    }
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
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 bg-[#0A0A0A]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Contracts
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Manage creator contracts and track signatures
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Contract
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            {/* Search */}
            <div className="flex-1 relative">
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

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-8 py-2 bg-[#161616] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="signed">Signed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {paginatedContracts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No contracts found</h3>
            <p className="text-gray-400 text-sm mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first contract to get started'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Contract
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-[#161616] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Creator
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Contract Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Links
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paginatedContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-white">{contract.creatorName}</div>
                        <div className="text-xs text-gray-400">{contract.creatorEmail}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(contract.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-white">
                        {formatDate(contract.contractStartDate)} - {formatDate(contract.contractEndDate)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-400">
                        {contract.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDeleteClick(contract)}
                        disabled={deletingContract === contract.id}
                        className="p-1.5 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete contract"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 border-t border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredContracts.length)} of {filteredContracts.length} contracts
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={clsx(
                  'px-3 py-2 rounded-lg transition-colors flex items-center gap-2',
                  currentPage === 1
                    ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                    : 'bg-[#161616] text-white hover:bg-white/10'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={clsx(
                  'px-3 py-2 rounded-lg transition-colors flex items-center gap-2',
                  currentPage === totalPages
                    ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
                    : 'bg-[#161616] text-white hover:bg-white/10'
                )}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Contract Modal */}
      {showCreateModal && (
        <CreateContractModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadContracts();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && contractToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Delete Contract</h3>
                <p className="text-gray-400 text-sm">
                  Are you sure you want to delete this contract for{' '}
                  <span className="font-medium text-white">{contractToDelete.creatorName}</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleDeleteCancel}
                variant="secondary"
                disabled={!!deletingContract}
              >
                Cancel
              </Button>
              <button
                onClick={handleDeleteConfirm}
                disabled={!!deletingContract}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingContract ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
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
    </div>
  );
};

export default ContractsManagementPage;

