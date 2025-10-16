import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Save, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import { OrgMember } from '../types/firestore';
import ChangeTemplateModal from '../components/ChangeTemplateModal';

const CreateContractPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
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

  useEffect(() => {
    loadCreators();
    loadDefaultTemplate();
  }, [currentOrgId, currentProjectId]);

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoadingCreators(true);
    try {
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      const creatorMembers = members.filter((m: OrgMember) => m.role === 'creator');
      setCreators(creatorMembers);
    } catch (error) {
      console.error('Error loading creators:', error);
    } finally {
      setLoadingCreators(false);
    }
  };

  const loadDefaultTemplate = async () => {
    if (!currentOrgId) return;

    try {
      const templates = await TemplateService.getSavedTemplates(currentOrgId);
      const defaultTemplate = templates[0]; // Use first template as default
      
      if (defaultTemplate && !contractNotes) {
        setContractNotes(defaultTemplate.terms);
        setInitialContractNotes(defaultTemplate.terms);
      }
    } catch (error) {
      console.error('Error loading default template:', error);
    }
  };

  const handleTemplateChange = (template: { terms: string; companyName?: string; contractStartDate?: string; contractEndDate?: string }) => {
    setContractNotes(template.terms);
    if (template.contractStartDate) setContractStartDate(template.contractStartDate);
    if (template.contractEndDate) setContractEndDate(template.contractEndDate);
    setShowChangeTemplateModal(false);
  };

  const handleSaveTemplate = async () => {
    if (!currentOrgId || !user || !templateName.trim()) {
      alert('Please provide a template name');
      return;
    }

    setSavingTemplate(true);
    try {
      await TemplateService.saveTemplate(
        currentOrgId,
        templateName.trim(),
        templateDescription.trim() || '',
        contractNotes,
        user.uid,
        undefined, // companyName
        contractStartDate,
        contractEndDate
      );

      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
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
      await ContractService.createShareableContract(
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

      // Clear the draft on success
      localStorage.removeItem(getDraftKey());
      
      // Navigate back to contracts page
      navigate('/dashboard?tab=creators&subtab=contracts');
    } catch (error) {
      console.error('Error creating contract:', error);
      alert('Failed to create contract');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmLeave) return;
    }
    localStorage.removeItem(getDraftKey());
    navigate('/dashboard?tab=creators&subtab=contracts');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Create Contract</h1>
                  <p className="text-sm text-gray-400">Generate a shareable contract for a creator</p>
                </div>
              </div>
            </div>
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
                  <CheckCircle className="w-4 h-4" />
                  Create Contract
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Form */}
          <div className="space-y-6">
            {/* Creator Selection */}
            <div className="bg-zinc-900/60 backdrop-blur border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Contract Details</h2>
              
              <div className="space-y-4">
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
                      className="w-full px-4 py-2.5 bg-[#161616] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
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

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Structure Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentStructureName}
                    onChange={(e) => setPaymentStructureName(e.target.value)}
                    placeholder="e.g., 'Standard Rate', 'Premium Package'"
                    className="w-full px-4 py-2.5 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={contractStartDate}
                      onChange={(e) => setContractStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#161616] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
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
                      className="w-full px-4 py-2.5 bg-[#161616] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Terms */}
            <div className="bg-zinc-900/60 backdrop-blur border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Terms & Conditions</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChangeTemplateModal(true)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Change Template
                  </button>
                  <button
                    onClick={() => setShowSaveTemplateModal(true)}
                    disabled={!contractNotes.trim()}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save as Template
                  </button>
                </div>
              </div>
              
              <textarea
                value={contractNotes}
                onChange={(e) => setContractNotes(e.target.value)}
                placeholder="Enter contract terms and conditions..."
                className="w-full h-96 px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none font-mono text-sm"
              />
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="bg-zinc-900/60 backdrop-blur border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-gray-300 whitespace-pre-wrap">
                {contractNotes || <span className="text-gray-500">Contract preview will appear here...</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Template Modal */}
      {showChangeTemplateModal && (
        <ChangeTemplateModal
          onSelectTemplate={handleTemplateChange}
          onClose={() => setShowChangeTemplateModal(false)}
        />
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Save as Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., 'Standard Creator Agreement'"
                  className="w-full px-4 py-2.5 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
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
                  className="w-full px-4 py-2.5 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                disabled={savingTemplate}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-100 text-black rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 z-50">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Template saved successfully!</span>
        </div>
      )}
    </div>
  );
};

export default CreateContractPage;

