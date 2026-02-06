import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, Save, CheckCircle, Clock, Copy, ExternalLink, Link2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import { OrgMember, TeamInvitation } from '../types/firestore';
import ChangeTemplateModal from './ChangeTemplateModal';

interface CreateContractModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// Combined type for creators (active members + pending invitations)
interface CreatorOption {
  id: string;
  displayName: string;
  email?: string;
  isPending: boolean;
}

const CreateContractModal: React.FC<CreateContractModalProps> = ({ onClose, onSuccess }) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [contractStartDate, setContractStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [contractEndDate, setContractEndDate] = useState('');
  const [createdContract, setCreatedContract] = useState<{ creatorLink: string; companyLink: string } | null>(null);
  const [copiedCreator, setCopiedCreator] = useState(false);
  const [copiedCompany, setCopiedCompany] = useState(false);
  const [contractNotes, setContractNotes] = useState('');
  const [initialContractNotes, setInitialContractNotes] = useState('');
  const [paymentStructureName, setPaymentStructureName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [showChangeTemplateModal, setShowChangeTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Generate storage key for the draft
  const getDraftKey = () => {
    return `contract_draft_${currentOrgId}_${currentProjectId}_${selectedCreatorId || 'new'}`;
  };

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(getDraftKey());
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.selectedCreatorId) setSelectedCreatorId(draft.selectedCreatorId);
        if (draft.contractStartDate) setContractStartDate(draft.contractStartDate);
        if (draft.contractEndDate) setContractEndDate(draft.contractEndDate);
        if (draft.contractNotes) {
          setContractNotes(draft.contractNotes);
          setInitialContractNotes(draft.contractNotes);
        }
        if (draft.paymentStructureName) setPaymentStructureName(draft.paymentStructureName);
      } catch (error) {
        console.error('Error loading contract draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever fields change
  useEffect(() => {
    if (selectedCreatorId || contractStartDate || contractEndDate || contractNotes || paymentStructureName) {
      const draft = {
        selectedCreatorId,
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName,
        timestamp: Date.now(),
      };
      localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    }
  }, [selectedCreatorId, contractStartDate, contractEndDate, contractNotes, paymentStructureName]);

  // Clear draft when modal is closed
  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }
    // Clear the draft
    localStorage.removeItem(getDraftKey());
    onClose();
  };

  useEffect(() => {
    loadCreators();
  }, [currentOrgId, currentProjectId]);

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoadingCreators(true);
    try {
      // Load active creator members
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      const creatorMembers = members.filter((m: OrgMember) => m.role === 'creator');
      
      // Load pending creator invitations
      const invitations = await TeamInvitationService.getOrgInvitations(currentOrgId);
      const creatorInvitations = invitations.filter((inv: TeamInvitation) => inv.role === 'creator');
      
      // Combine into options list
      const options: CreatorOption[] = [
        // Active creators first
        ...creatorMembers.map(m => ({
          id: m.userId,
          displayName: m.displayName || m.email || 'Unknown',
          email: m.email,
          isPending: false
        })),
        // Pending invitations
        ...creatorInvitations.map(inv => ({
          id: `pending_${inv.id}`, // Prefix to distinguish from active members
          displayName: inv.email,
          email: inv.email,
          isPending: true
        }))
      ];
      
      setCreatorOptions(options);
    } catch (error) {
      console.error('Error loading creators:', error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleSelectTemplate = (template: { 
    terms: string; 
    companyName?: string; 
    contractStartDate?: string; 
    contractEndDate?: string;
  }) => {
    setContractNotes(template.terms);
    setInitialContractNotes(template.terms);
    // Note: CreateContractModal doesn't have company/date fields like ContractEditorPage
    // Templates will only apply the terms here
  };

  const handleSaveTemplate = async () => {
    if (!currentOrgId || !user || !templateName.trim() || !contractNotes.trim()) {
      alert('Please provide a template name and contract content');
      return;
    }

    setSavingTemplate(true);
    try {
      await TemplateService.saveTemplate(
        currentOrgId,
        templateName.trim(),
        templateDescription.trim() || 'Custom contract template',
        contractNotes,
        user.uid
      );
      
      // Show success toast
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      // Reset modal
      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const hasUnsavedChanges = contractNotes !== initialContractNotes && contractNotes.trim().length > 0;

  const handleCreate = async () => {
    if (!currentOrgId || !currentProjectId || !user || !selectedCreatorId) {
      alert('Please fill in all required fields');
      return;
    }

    if (!contractStartDate) {
      alert('Please fill in all contract details');
      return;
    }

    const selectedOption = creatorOptions.find(c => c.id === selectedCreatorId);
    if (!selectedOption) {
      alert('Invalid creator selection');
      return;
    }
    
    // For pending invitations, use the invitation ID (without prefix) as creator ID
    // The contract will be associated when they accept the invitation
    const creatorId = selectedOption.isPending 
      ? selectedCreatorId.replace('pending_', '') // Use invitation ID
      : selectedCreatorId;

    setLoading(true);
    try {
      const contract = await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        creatorId,
        selectedOption.displayName || 'Creator',
        selectedOption.email || '',
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName || undefined,
        user.uid,
        selectedOption.isPending // Pass flag to indicate this is for a pending invitation
      );

      // Clear the draft on success
      localStorage.removeItem(getDraftKey());
      
      // Show success popup with links
      setCreatedContract({
        creatorLink: contract.creatorLink,
        companyLink: contract.companyLink,
      });
    } catch (error) {
      console.error('Error creating contract:', error);
      alert('Failed to create contract');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Create Contract</h2>
              <p className="text-sm text-gray-400">Generate a shareable contract for a creator</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
              {/* Creator Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Creator *
                </label>
                {loadingCreators ? (
                  <div className="text-sm text-gray-400">Loading creators...</div>
                ) : creatorOptions.length === 0 ? (
                  <div className="text-sm text-gray-400">No creators found. Invite a creator first.</div>
                ) : (
                  <select
                    value={selectedCreatorId}
                    onChange={(e) => setSelectedCreatorId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  >
                    <option value="">Choose a creator...</option>
                    {creatorOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.displayName}{option.isPending ? ' (Pending Invitation)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedCreatorId?.startsWith('pending_') && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span>This creator hasn't accepted their invitation yet. Contract will be ready when they join.</span>
                  </div>
                )}
              </div>

              {/* Contract Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date <span className="text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  />
                </div>
              </div>

              {/* Contract Terms */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Contract Terms & Conditions *
                  </label>
                  <button
                    onClick={() => setShowChangeTemplateModal(true)}
                    className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-lg transition-colors font-medium"
                  >
                    Change Template
                  </button>
                </div>
                <textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  rows={12}
                  placeholder="Start from scratch or click 'Change Template' above..."
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none"
                />
              </div>
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
            <Button
              onClick={() => setShowSaveTemplateModal(true)}
              variant="secondary"
              disabled={loading || !contractNotes}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save as Template
            </Button>
            <div className="flex items-center gap-3">
              <Button
                onClick={onClose}
                variant="secondary"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading || !selectedCreatorId || !contractStartDate}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Create Contract
                  </>
              )}
            </Button>
          </div>
        </div>

        {/* Change Template Modal */}
        {showChangeTemplateModal && (
          <ChangeTemplateModal
            onClose={() => setShowChangeTemplateModal(false)}
            onSelectTemplate={handleSelectTemplate}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        )}

        {/* Save Template Modal */}
        {showSaveTemplateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-[#161616] border border-gray-800 rounded-2xl max-w-md w-full p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/5 rounded-full">
                  <Save className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Save as Template</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Save this contract to your templates for future use
                  </p>
                  <div className="space-y-3 mb-4">
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name (required)..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description (optional)..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowSaveTemplateModal(false);
                        setTemplateName('');
                        setTemplateDescription('');
                      }}
                      disabled={savingTemplate}
                      className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || savingTemplate}
                      className="flex-1 px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingTemplate ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Template
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-[110] animate-in slide-in-from-top-2 duration-300">
            <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Template saved successfully!</span>
            </div>
          </div>
        )}

        {/* Contract Created Success Modal */}
        {createdContract && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <div className="bg-[#161616] border border-gray-800 rounded-2xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Contract Created!</h3>
                <p className="text-sm text-gray-400 mt-1">Share these links with the relevant parties</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase mb-2">
                    <Link2 className="w-3.5 h-3.5" />
                    Creator Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={createdContract.creatorLink}
                      readOnly
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-sm truncate"
                    />
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(createdContract.creatorLink);
                        setCopiedCreator(true);
                        setTimeout(() => setCopiedCreator(false), 2000);
                      }}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        copiedCreator ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-white'
                      }`}
                    >
                      {copiedCreator ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={createdContract.creatorLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase mb-2">
                    <Link2 className="w-3.5 h-3.5" />
                    Company Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={createdContract.companyLink}
                      readOnly
                      className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-sm truncate"
                    />
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(createdContract.companyLink);
                        setCopiedCompany(true);
                        setTimeout(() => setCopiedCompany(false), 2000);
                      }}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        copiedCompany ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-white'
                      }`}
                    >
                      {copiedCompany ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={createdContract.companyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              <button
                onClick={onSuccess}
                className="w-full mt-6 px-4 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateContractModal;

