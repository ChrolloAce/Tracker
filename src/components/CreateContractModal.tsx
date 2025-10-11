import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, Save, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import { OrgMember } from '../types/firestore';
import ChangeTemplateModal from './ChangeTemplateModal';

interface CreateContractModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateContractModal: React.FC<CreateContractModalProps> = ({ onClose, onSuccess }) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [creators, setCreators] = useState<OrgMember[]>([]);
  
  // Parse draft once and restore all fields
  const loadDraft = () => {
    try {
      const draftStr = localStorage.getItem('contractDraft');
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        return {
          selectedCreatorId: draft.selectedCreatorId || '',
          contractStartDate: draft.contractStartDate || '',
          contractEndDate: draft.contractEndDate || '',
          contractNotes: draft.contractNotes || '',
          paymentStructureName: draft.paymentStructureName || ''
        };
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    return {
      selectedCreatorId: '',
      contractStartDate: '',
      contractEndDate: '',
      contractNotes: '',
      paymentStructureName: ''
    };
  };
  
  const draft = loadDraft();
  const [selectedCreatorId, setSelectedCreatorId] = useState(draft.selectedCreatorId);
  const [contractStartDate, setContractStartDate] = useState(draft.contractStartDate);
  const [contractEndDate, setContractEndDate] = useState(draft.contractEndDate);
  const [contractNotes, setContractNotes] = useState(draft.contractNotes);
  const [initialContractNotes, setInitialContractNotes] = useState('');
  const [paymentStructureName, setPaymentStructureName] = useState(draft.paymentStructureName);
  
  const [loading, setLoading] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [showChangeTemplateModal, setShowChangeTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    loadCreators();
  }, [currentOrgId, currentProjectId]);
  
  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    const draft = {
      selectedCreatorId,
      contractStartDate,
      contractEndDate,
      contractNotes,
      paymentStructureName,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('contractDraft', JSON.stringify(draft));
  }, [selectedCreatorId, contractStartDate, contractEndDate, contractNotes, paymentStructureName]);

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoadingCreators(true);
    try {
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      // Filter to only show creators
      const creatorMembers = members.filter((m: OrgMember) => m.role === 'creator');
      setCreators(creatorMembers);
    } catch (error) {
      console.error('Error loading creators:', error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const handleSelectTemplate = (terms: string) => {
    setContractNotes(terms);
    setInitialContractNotes(terms);
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

    if (!contractStartDate || !contractEndDate || !contractNotes) {
      alert('Please fill in all contract details');
      return;
    }

    const selectedCreator = creators.find(c => c.userId === selectedCreatorId);
    if (!selectedCreator) {
      alert('Invalid creator selection');
      return;
    }

    setLoading(true);
    try {
      const contract = await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        selectedCreator.userId,
        selectedCreator.displayName || 'Creator',
        selectedCreator.email || '',
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName || undefined,
        user.uid
      );

      // Clear draft from localStorage after successful creation
      localStorage.removeItem('contractDraft');
      
      // Show success with links
      alert(`Contract created successfully!\n\n🎨 Creator Link:\n${contract.creatorLink}\n\n🏢 Company Link:\n${contract.companyLink}`);
      
      onSuccess();
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
              <p className="text-sm text-gray-400">
                Generate a shareable contract for a creator
                {(contractNotes || selectedCreatorId || contractStartDate || contractEndDate || paymentStructureName) && (
                  <span className="ml-2 text-green-400 text-xs">• Draft auto-saved</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
                ) : creators.length === 0 ? (
                  <div className="text-sm text-gray-400">No creators found in this project</div>
                ) : (
                  <select
                    value={selectedCreatorId}
                    onChange={(e) => setSelectedCreatorId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                  >
                    <option value="">Choose a creator...</option>
                    {creators.map((creator) => (
                      <option key={creator.userId} value={creator.userId}>
                        {creator.displayName || creator.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Payment Structure Name (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Structure Name (Optional)
                </label>
                <input
                  type="text"
                  value={paymentStructureName}
                  onChange={(e) => setPaymentStructureName(e.target.value)}
                  placeholder="e.g., Standard Creator Payment"
                  className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
                />
              </div>

              {/* Contract Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Contract Start Date *
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
                    Contract End Date *
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
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowSaveTemplateModal(true)}
                variant="secondary"
                disabled={loading || !contractNotes}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save as Template
              </Button>
              {(contractNotes || selectedCreatorId || contractStartDate || contractEndDate || paymentStructureName) && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear this draft? This action cannot be undone.')) {
                      localStorage.removeItem('contractDraft');
                      setSelectedCreatorId('');
                      setContractStartDate('');
                      setContractEndDate('');
                      setContractNotes('');
                      setPaymentStructureName('');
                    }
                  }}
                  disabled={loading}
                  className="px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Clear draft"
                >
                  Clear Draft
                </button>
              )}
            </div>
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
                disabled={loading || !selectedCreatorId || !contractStartDate || !contractEndDate || !contractNotes}
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
      </div>
    </div>
  );
};

export default CreateContractModal;

