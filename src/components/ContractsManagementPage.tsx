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
  Trash2
} from 'lucide-react';
import Pagination from './ui/Pagination';

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

  const handleDownloadContract = (contract: ShareableContract) => {
    // Open contract page with auto-print enabled
    // The ContractSigningPage already has print optimization built in
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
                {paginatedContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{contract.creatorName}</div>
                        <div className="text-xs text-gray-400">{contract.creatorEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(contract.status)}
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
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            
                            {/* Menu */}
                            <div className="absolute right-0 top-8 w-48 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
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
                ))}
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
        className="fixed bottom-8 right-8 w-14 h-14 bg-white text-black rounded-full shadow-2xl hover:bg-gray-100 transition-all duration-200 flex items-center justify-center z-40 hover:scale-110"
        title="Create Contract"
      >
        <Plus className="w-6 h-6" />
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

