import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import OrganizationService from '../services/OrganizationService';
import { OrgMember } from '../types/firestore';
import { ShareableContract } from '../types/contract';
import { CONTRACT_TEMPLATES, ContractTemplate } from '../types/contracts';
import { 
  ArrowLeft, 
  FileText, 
  Save, 
  Share2, 
  Copy, 
  ExternalLink, 
  Check 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import ContractPreview from '../components/ContractPreview';
import clsx from 'clsx';

const ContractEditorPage: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId, user } = useAuth();
  
  const [creator, setCreator] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [paymentStructureName, setPaymentStructureName] = useState('');
  
  const [showTemplates, setShowTemplates] = useState(true);
  const [sharedContracts, setSharedContracts] = useState<ShareableContract[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    loadCreator();
    loadContracts();
  }, [creatorId, currentOrgId]);

  const loadCreator = async () => {
    if (!currentOrgId || !creatorId) return;

    setLoading(true);
    try {
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      const foundCreator = members.find((m: OrgMember) => m.userId === creatorId);
      setCreator(foundCreator || null);
    } catch (error) {
      console.error('Error loading creator:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async () => {
    if (!currentOrgId || !currentProjectId || !creatorId) return;

    try {
      const contracts = await ContractService.getContractsForCreator(
        currentOrgId,
        currentProjectId,
        creatorId
      );
      setSharedContracts(contracts);
      
      // If there's only one contract and we don't have notes yet, load it
      if (contracts.length === 1 && !contractNotes) {
        const contract = contracts[0];
        setContractStartDate(contract.contractStartDate);
        setContractEndDate(contract.contractEndDate);
        setContractNotes(contract.contractNotes);
        setPaymentStructureName(contract.paymentStructureName || '');
        setShowTemplates(false);
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  };

  const handleSelectTemplate = (template: ContractTemplate) => {
    setContractNotes(template.terms);
    
    if (template.duration && !contractStartDate) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + template.duration.months);
      
      setContractStartDate(startDate.toISOString().split('T')[0]);
      setContractEndDate(endDate.toISOString().split('T')[0]);
    }
    
    setShowTemplates(false);
  };

  const handleShareContract = async () => {
    if (!currentOrgId || !currentProjectId || !user || !creator) {
      alert('Missing required information');
      return;
    }

    if (!contractStartDate || !contractEndDate || !contractNotes) {
      alert('Please fill in all contract details');
      return;
    }

    setSharing(true);
    try {
      const contract = await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        creator.userId,
        creator.displayName || 'Creator',
        creator.email || '',
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName || undefined,
        user.uid
      );

      await loadContracts();
      
      alert(`Contract links created!\n\n🎨 Creator Link:\n${contract.creatorLink}\n\n🏢 Company Link:\n${contract.companyLink}`);
    } catch (error) {
      console.error('Error sharing contract:', error);
      alert('Failed to create contract');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async (link: string, id: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Creator not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Contract: {creator.displayName || creator.email}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Create and manage contract for this creator
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {showTemplates && !contractNotes ? (
          <div className="grid grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            <div className="bg-[#161616] rounded-xl border border-gray-800 p-6 overflow-y-auto">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Choose a Template</h2>
                <p className="text-sm text-gray-400">Select a contract template to get started</p>
              </div>

              <div className="space-y-3 mb-6">
                {CONTRACT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{template.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-sm group-hover:text-white/90">{template.name}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{template.description}</p>
                        {template.duration && (
                          <p className="text-xs text-gray-500 mt-1">Duration: {template.duration.months} months</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowTemplates(false)}
                className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white font-medium text-sm transition-all"
              >
                Start from Scratch
              </button>
            </div>

            <div className="overflow-y-auto">
              <ContractPreview
                creatorName={creator.displayName || creator.email || 'Creator'}
                contractStartDate={contractStartDate}
                contractEndDate={contractEndDate}
                contractNotes={contractNotes || 'Select a template to preview contract terms...'}
                paymentStructureName={paymentStructureName}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            {/* Left: Editor */}
            <div className="bg-[#161616] rounded-xl border border-gray-800 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Contract Details</h2>
                {contractNotes && (
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Use Template
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {/* Payment Structure Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Structure Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentStructureName}
                    onChange={(e) => setPaymentStructureName(e.target.value)}
                    placeholder="e.g., Standard Creator Payment"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={contractStartDate}
                      onChange={(e) => setContractStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={contractEndDate}
                      onChange={(e) => setContractEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                </div>

                {/* Terms */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contract Terms & Conditions *
                  </label>
                  <textarea
                    value={contractNotes}
                    onChange={(e) => setContractNotes(e.target.value)}
                    rows={15}
                    placeholder="Enter contract terms..."
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleShareContract}
                    disabled={sharing || !contractStartDate || !contractEndDate || !contractNotes}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    {sharing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        Create & Share Contract
                      </>
                    )}
                  </Button>
                </div>

                {/* Shared Contracts */}
                {sharedContracts.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">Shared Contracts</h3>
                    <div className="space-y-3">
                      {sharedContracts.map((contract) => (
                        <div
                          key={contract.id}
                          className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className={clsx(
                              'text-xs font-medium px-2 py-0.5 rounded',
                              contract.status === 'signed' ? 'bg-green-500/20 text-green-400' :
                              contract.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            )}>
                              {contract.status === 'signed' && '✓ Signed'}
                              {contract.status === 'pending' && '⏳ Pending'}
                              {contract.status === 'draft' && '📝 Draft'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {contract.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                            </span>
                          </div>

                          {/* Creator Link */}
                          <div className="flex items-center gap-2 bg-white/5 rounded p-2">
                            <span className="text-xs font-medium text-blue-400 whitespace-nowrap">🎨 Creator:</span>
                            <p className="text-xs text-gray-500 truncate flex-1">{contract.creatorLink}</p>
                            <button
                              onClick={() => handleCopyLink(contract.creatorLink, `creator-${contract.id}`)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                              {copiedLink === `creator-${contract.id}` ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                            <a
                              href={contract.creatorLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </a>
                          </div>

                          {/* Company Link */}
                          <div className="flex items-center gap-2 bg-white/5 rounded p-2">
                            <span className="text-xs font-medium text-purple-400 whitespace-nowrap">🏢 Company:</span>
                            <p className="text-xs text-gray-500 truncate flex-1">{contract.companyLink}</p>
                            <button
                              onClick={() => handleCopyLink(contract.companyLink, `company-${contract.id}`)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                              {copiedLink === `company-${contract.id}` ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                            <a
                              href={contract.companyLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Preview */}
            <div className="overflow-y-auto">
              <ContractPreview
                creatorName={creator.displayName || creator.email || 'Creator'}
                contractStartDate={contractStartDate}
                contractEndDate={contractEndDate}
                contractNotes={contractNotes}
                paymentStructureName={paymentStructureName}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractEditorPage;

