import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import OrganizationService from '../services/OrganizationService';
import { OrgMember } from '../types/firestore';
import { 
  ArrowLeft, 
  FileText, 
  Share2,
  Save,
  CheckCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import ContractPreview from '../components/ContractPreview';
import ChangeTemplateModal from '../components/ChangeTemplateModal';

const ContractEditorPage: React.FC = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId, user } = useAuth();
  
  const [creator, setCreator] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [initialContractNotes, setInitialContractNotes] = useState('');
  const [companyName, setCompanyName] = useState('[Your Company Name]');
  const [clientName, setClientName] = useState('');
  
  const [showChangeTemplateModal, setShowChangeTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Generate storage key for the draft
  const getDraftKey = () => {
    return `contract_editor_draft_${currentOrgId}_${currentProjectId}_${creatorId}`;
  };

  // Load draft from localStorage on mount and set default dates
  useEffect(() => {
    const savedDraft = localStorage.getItem(getDraftKey());
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.contractStartDate) setContractStartDate(draft.contractStartDate);
        if (draft.contractEndDate !== undefined) setContractEndDate(draft.contractEndDate);
        if (draft.contractNotes) {
          setContractNotes(draft.contractNotes);
          setInitialContractNotes(draft.contractNotes);
        }
        if (draft.companyName) setCompanyName(draft.companyName);
        if (draft.clientName) setClientName(draft.clientName);
      } catch (error) {
        console.error('Error loading contract draft:', error);
      }
    } else {
      // Set default start date to today if no draft exists
      const today = new Date();
      setContractStartDate(today.toISOString().split('T')[0]);
      
      // Leave end date empty (no default) - most contracts don't have an end date
      setContractEndDate('');
    }
  }, [creatorId]);

  // Pre-fill client name when creator is loaded
  useEffect(() => {
    if (creator && !clientName) {
      setClientName(creator.displayName || creator.email || '');
    }
  }, [creator]);

  // Save draft to localStorage whenever fields change
  useEffect(() => {
    if (contractStartDate || contractEndDate || contractNotes || companyName || clientName) {
      const draft = {
        contractStartDate,
        contractEndDate,
        contractNotes,
        companyName,
        clientName,
        timestamp: Date.now(),
      };
      localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    }
  }, [contractStartDate, contractEndDate, contractNotes, companyName, clientName]);

  useEffect(() => {
    loadCreator();
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

  const hasUnsavedChanges = contractNotes !== initialContractNotes && contractNotes.trim().length > 0;

  const handleSelectTemplate = (terms: string) => {
    setContractNotes(terms);
    setInitialContractNotes(terms);
    setShowChangeTemplateModal(false);
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

  const handleShareContract = async () => {
    if (!currentOrgId || !currentProjectId || !user || !creator) {
      alert('Missing required information');
      return;
    }

    if (!contractStartDate || !contractNotes) {
      alert('Please fill in start date and contract terms');
      return;
    }

    if (!companyName || !clientName) {
      alert('Please fill in company name and client name');
      return;
    }

    setSharing(true);
    try {
      await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        creator.userId,
        clientName,
        creator.email || '',
        contractStartDate,
        contractEndDate || 'Indefinite',
        contractNotes,
        undefined,
        user.uid
      );

      // Clear the draft on success
      localStorage.removeItem(getDraftKey());

      // Redirect back to creator details
      navigate(-1);
    } catch (error) {
      console.error('Error sharing contract:', error);
      alert('Failed to create contract');
      setSharing(false);
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
        <div className="grid grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Left: Editor */}
          <div className="bg-[#161616] rounded-xl border border-gray-800 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Contract Details</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowChangeTemplateModal(true)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Use Template
                </button>
                {contractNotes && (
                  <button
                    onClick={() => setShowSaveTemplateModal(true)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save as Template
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Company and Client Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Creator Name"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
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
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    placeholder="Leave empty for indefinite contract"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
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
                  placeholder="Enter contract terms or use a template..."
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleShareContract}
                  disabled={sharing || !contractStartDate || !contractNotes || !companyName || !clientName}
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
            </div>
          </div>

          {/* Right: Preview */}
          <div className="overflow-y-auto">
            <ContractPreview
              creatorName={clientName || creator?.displayName || creator?.email || 'Client Name'}
              contractStartDate={contractStartDate}
              contractEndDate={contractEndDate || 'Indefinite'}
              contractNotes={contractNotes || 'Enter contract terms to see preview...'}
              paymentStructureName={companyName}
            />
          </div>
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
            <h3 className="text-lg font-semibold text-white mb-4">Save as Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., My Standard Contract"
                  className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                  disabled={savingTemplate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description of this template..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                  disabled={savingTemplate}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSaveTemplateModal(false)}
                  disabled={savingTemplate}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-100 text-black rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingTemplate ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-[110] animate-in slide-in-from-bottom">
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-6 py-3 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-white font-medium">Template saved successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractEditorPage;

