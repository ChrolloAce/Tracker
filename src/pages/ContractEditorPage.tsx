import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import { OrgMember } from '../types/firestore';
import { TieredPaymentStructure } from '../types/payments';
import TieredPaymentService from '../services/TieredPaymentService';
import { Timestamp } from 'firebase/firestore';
import { 
  ArrowLeft, 
  FileText, 
  Share2,
  Save,
  CheckCircle,
  Plus,
  X
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import ContractPreview from '../components/ContractPreview';
import ChangeTemplateModal from '../components/ChangeTemplateModal';
import TieredPaymentBuilder from '../components/TieredPaymentBuilder';

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
  
  // Payment structure state
  const [creatorPaymentStructure, setCreatorPaymentStructure] = useState<TieredPaymentStructure | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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
      const today = new Date();
      setContractStartDate(today.toISOString().split('T')[0]);
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

  // Load creator data and payment structure
  useEffect(() => {
    const loadCreator = async () => {
      if (!currentOrgId || !creatorId) {
        setLoading(false);
        return;
      }

      try {
        const members = await OrganizationService.getOrgMembers(currentOrgId);
        const foundCreator = members.find(
          (member: OrgMember) => member.userId === creatorId || member.email === creatorId
        );

        if (foundCreator) {
          setCreator(foundCreator);
          
          // Load creator's payment structure
          if (currentProjectId) {
            try {
              const profile = await CreatorLinksService.getCreatorProfile(
                currentOrgId,
                currentProjectId,
                creatorId
              );
              
              if (profile?.paymentInfo && (profile.paymentInfo as any).tieredStructure) {
                const loadedStructure = (profile.paymentInfo as any).tieredStructure as TieredPaymentStructure;
                setCreatorPaymentStructure(loadedStructure);
              }
            } catch (error) {
              console.error('Error loading payment structure:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading creator:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreator();
  }, [creatorId, currentOrgId, currentProjectId]);

  const handleSelectTemplate = (template: { 
    terms: string; 
    companyName?: string; 
    contractStartDate?: string; 
    contractEndDate?: string;
  }) => {
    setContractNotes(template.terms);
    setInitialContractNotes(template.terms);
    if (template.companyName) setCompanyName(template.companyName);
    if (template.contractStartDate) setContractStartDate(template.contractStartDate);
    if (template.contractEndDate !== undefined) setContractEndDate(template.contractEndDate);
  };

  const handleInsertPaymentTerms = () => {
    if (!creatorPaymentStructure) return;
    
    const formattedTerms = TieredPaymentService.formatForContract(creatorPaymentStructure);
    const highlightedTerms = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PAYMENT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${formattedTerms}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    setContractNotes(contractNotes + highlightedTerms);
  };

  const handleSavePaymentStructure = async (structure: TieredPaymentStructure) => {
    if (!currentOrgId || !currentProjectId || !creatorId) return;

    try {
      const profile = await CreatorLinksService.getCreatorProfile(
        currentOrgId,
        currentProjectId,
        creatorId
      );

      await CreatorLinksService.updateCreatorProfile(
        currentOrgId,
        currentProjectId,
        creatorId,
        {
          ...profile,
          paymentInfo: {
            ...(profile?.paymentInfo || { isPaid: false }),
            tieredStructure: structure,
            updatedAt: Timestamp.now()
          }
        }
      );

      setCreatorPaymentStructure(structure);
      setShowPaymentModal(false);
      
      // Show success toast
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error saving payment structure:', error);
      alert('Failed to save payment structure');
    }
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
        user.uid,
        companyName,
        contractStartDate,
        contractEndDate
      );
      
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleShareContract = async () => {
    if (!creator || !user || !currentOrgId || !currentProjectId) return;

    // Validation
    if (!contractNotes.trim()) {
      alert('Please add contract terms before sharing');
      return;
    }
    if (!contractStartDate) {
      alert('Please select a start date');
      return;
    }
    if (!clientName.trim()) {
      alert('Please enter a client name');
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
        creatorPaymentStructure?.name || undefined,
        user.uid
      );

      // Clear the draft on success
      localStorage.removeItem(getDraftKey());
      
      alert('Contract shared successfully!');
      navigate(`/creators/${creatorId}?tab=contract`);
    } catch (error) {
      console.error('Error sharing contract:', error);
      alert('Failed to share contract');
    } finally {
      setSharing(false);
    }
  };

  const hasUnsavedChanges = contractNotes !== initialContractNotes;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-4">Creator Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/creators/${creatorId}?tab=contract`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  New Contract
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  For {creator.displayName || creator.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowChangeTemplateModal(true)}
                variant="secondary"
                size="sm"
              >
                Use Template
              </Button>
              
              <Button
                onClick={() => setShowSaveTemplateModal(true)}
                variant="secondary"
                size="sm"
                disabled={!contractNotes.trim()}
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save as Template
              </Button>

              <Button
                onClick={handleShareContract}
                disabled={sharing || !contractNotes.trim()}
                size="sm"
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                {sharing ? 'Sharing...' : 'Share Contract'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Editor Column */}
          <div className="space-y-6">
            <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Contract Details</h2>
              
              <div className="space-y-5">
                {/* Company Name */}
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

                {/* Client Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client Name"
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>

                {/* Start Date */}
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

                {/* End Date (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank for an indefinite contract
                  </p>
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Structure
                  </label>
                  {creatorPaymentStructure ? (
                    <div className="space-y-2">
                      <div className="p-4 bg-gray-700/30 border border-gray-600/50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium text-sm">
                              {creatorPaymentStructure.name}
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                              {creatorPaymentStructure.tiers?.length || 0} tier{creatorPaymentStructure.tiers?.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Button
                            onClick={handleInsertPaymentTerms}
                            variant="secondary"
                            size="sm"
                          >
                            Insert into Contract
                          </Button>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Edit payment structure
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Payment Structure
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Create or edit the payment structure for this creator. You can insert it into the contract terms.
                  </p>
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
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-[#161616] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Preview</h2>
              <ContractPreview
                creatorName={clientName}
                contractStartDate={contractStartDate}
                contractEndDate={contractEndDate || 'Indefinite'}
                contractNotes={contractNotes}
                paymentStructureName={creatorPaymentStructure?.name}
              />
            </div>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161616] rounded-xl border border-gray-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Save as Template</h3>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Creator Contract"
                  className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
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
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowSaveTemplateModal(false)}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Structure Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161616] rounded-xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#161616] border-b border-gray-800 p-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Payment Structure</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6">
              <TieredPaymentBuilder
                value={creatorPaymentStructure}
                onChange={handleSavePaymentStructure}
                alwaysEdit={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Saved successfully!</span>
        </div>
      )}
    </div>
  );
};

export default ContractEditorPage;
