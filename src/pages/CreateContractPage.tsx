import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Save, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import CreatorLinksService from '../services/CreatorLinksService';
import ChangeTemplateModal from '../components/ChangeTemplateModal';

interface CreatorOption {
  userId: string;
  displayName: string;
  email?: string;
}

const CreateContractPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [contractTitle, setContractTitle] = useState('Content Creation Agreement');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [initialContractNotes, setInitialContractNotes] = useState('');
  const [paymentStructureName, setPaymentStructureName] = useState('');
  const [companyName, setCompanyName] = useState('');
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
        if (draft.companyName) setCompanyName(draft.companyName);
      } catch (error) {
        console.error('Error loading contract draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever fields change
  useEffect(() => {
    if (selectedCreatorId || contractStartDate || contractEndDate || contractNotes || paymentStructureName || companyName) {
      const draft = {
        selectedCreatorId,
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName,
        companyName,
        timestamp: Date.now(),
      };
      localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    }
  }, [selectedCreatorId, contractStartDate, contractEndDate, contractNotes, paymentStructureName, companyName]);

  useEffect(() => {
    loadCreators();
    loadDefaultTemplate();
  }, [currentOrgId, currentProjectId]);

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoadingCreators(true);
    try {
      // Get ALL creators from this project directly
      const projectCreators = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
      
      // Map to the format expected by the dropdown (same as OrgMember structure)
      const creatorMembers = projectCreators.map(creator => ({
        userId: creator.id,
        displayName: creator.displayName,
        email: creator.email,
        role: 'creator' as const,
      }));
      
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

    if (!companyName || !contractTitle || !contractStartDate || !contractNotes) {
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
        user.uid,
        contractTitle,
        companyName
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-700" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Create Contract</h1>
                  <p className="text-sm text-gray-500">Generate a shareable contract for a creator</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={loading || !selectedCreatorId || !contractStartDate || !contractNotes || !companyName}
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
            {/* Contract Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h2>
              
              <div className="space-y-4">
                {/* Company Section */}
                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-200/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-bold">B</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Company</span>
                  </div>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contract Title *
                  </label>
                  <input
                    type="text"
                    value={contractTitle}
                    onChange={(e) => setContractTitle(e.target.value)}
                    placeholder="e.g., Content Creation Agreement"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Creator Section */}
                <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-200/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-emerald-600 text-xs font-bold">C</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Creator</span>
                  </div>
                  {loadingCreators ? (
                    <div className="text-sm text-gray-500">Loading creators...</div>
                  ) : creators.length === 0 ? (
                    <div className="text-sm text-gray-500">No creators found in this project</div>
                  ) : (
                    <select
                      value={selectedCreatorId}
                      onChange={(e) => setSelectedCreatorId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
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

                {/* Payment Structure */}
                <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-600 text-xs font-bold">$</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Payment Structure <span className="text-gray-400">(Optional)</span></span>
                  </div>
                  <input
                    type="text"
                    value={paymentStructureName}
                    onChange={(e) => setPaymentStructureName(e.target.value)}
                    placeholder="e.g., 'Standard Rate', 'Premium Package'"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Contract Period */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-xs font-bold">📅</span>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Contract Period</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={contractStartDate}
                        onChange={(e) => setContractStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        End Date <span className="text-gray-400">(Optional)</span>
                      </label>
                      <input
                        type="date"
                        value={contractEndDate}
                        onChange={(e) => setContractEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Terms */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Terms & Conditions</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChangeTemplateModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Change Template
                  </button>
                  <button
                    onClick={() => setShowSaveTemplateModal(true)}
                    disabled={!contractNotes.trim()}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save as Template
                  </button>
                </div>
              </div>
              
              <textarea
                value={contractNotes}
                onChange={(e) => setContractNotes(e.target.value)}
                placeholder="Enter contract terms and conditions..."
                className="w-full h-96 px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none font-mono text-sm"
              />
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-fit sticky top-24 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Contract Preview</h2>
            
            {/* Contract Paper */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-serif font-semibold text-gray-900 text-center">
                  {contractTitle || 'Contract Agreement'}
                </h3>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Parties */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="text-xs text-blue-600 font-medium mb-1">COMPANY</div>
                    <div className="text-gray-900 font-medium text-sm">{companyName || '[Not Set]'}</div>
                  </div>
                  
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="text-xs text-emerald-600 font-medium mb-1">CREATOR</div>
                    <div className="text-gray-900 font-medium text-sm">{creators.find(c => c.userId === selectedCreatorId)?.displayName || '[Not Selected]'}</div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 font-medium mb-1">START DATE</div>
                    <div className="text-gray-900 text-sm">{contractStartDate ? new Date(contractStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '[Not Set]'}</div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 font-medium mb-1">END DATE</div>
                    <div className="text-gray-900 text-sm">{contractEndDate ? new Date(contractEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Until further notice'}</div>
                  </div>
                </div>

                {paymentStructureName && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div className="text-xs text-amber-600 font-medium mb-1">PAYMENT STRUCTURE</div>
                    <div className="text-gray-900 font-medium text-sm">{paymentStructureName}</div>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-200 my-4"></div>

                {/* Contract Terms Preview */}
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-3 uppercase tracking-wide">Contract Terms</div>
                  {contractNotes ? (
                    <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-serif">
                      {contractNotes}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm italic">
                      Contract terms will appear here...
                    </div>
                  )}
                </div>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Save as Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., 'Standard Creator Agreement'"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description of this template..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                disabled={savingTemplate}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
        <div className="fixed bottom-8 right-8 bg-emerald-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Template saved successfully!</span>
        </div>
      )}
    </div>
  );
};

export default CreateContractPage;

