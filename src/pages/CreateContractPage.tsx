import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Save, CheckCircle, Plus, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import CreatorLinksService from '../services/CreatorLinksService';
import OrganizationService from '../services/OrganizationService';
import ChangeTemplateModal from '../components/ChangeTemplateModal';

// Template variables that can be inserted into contracts
const TEMPLATE_VARIABLES = [
  { key: '{{COMPANY_NAME}}', label: 'Company Name', description: 'Auto-filled from Company section' },
  { key: '{{COMPANY_EMAIL}}', label: 'Company Email', description: 'Auto-filled from Company section' },
  { key: '{{COMPANY_PHONE}}', label: 'Company Phone', description: 'Auto-filled from Company section' },
  { key: '{{CREATOR_NAME}}', label: 'Creator Name', description: 'Auto-filled from selected creator' },
  { key: '{{START_DATE}}', label: 'Start Date', description: 'Contract start date' },
  { key: '{{END_DATE}}', label: 'End Date', description: 'Contract end date (if set)' },
  { key: '{{PAYMENT_STRUCTURE}}', label: 'Payment Structure', description: 'Payment structure name' },
  { key: '{{TODAY_DATE}}', label: 'Today\'s Date', description: 'Current date when viewed' },
  { key: '{{SIGNATURE_DATE}}', label: 'Signature Date', description: 'Date to be filled when signing', fillableBy: 'both' },
  { key: '{{CUSTOM_DATE}}', label: 'Custom Date', description: 'Date field to be filled in', fillableBy: 'both' },
  { key: '{{CUSTOM_TEXT}}', label: 'Custom Text', description: 'Text field to be filled in', fillableBy: 'both' },
  { key: '{{CUSTOM_AMOUNT}}', label: 'Custom Amount', description: 'Amount field to be filled in', fillableBy: 'both' },
];

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
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [showChangeTemplateModal, setShowChangeTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showVariablesDropdown, setShowVariablesDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVariablesDropdown(false);
      }
    };

    if (showVariablesDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVariablesDropdown]);

  // Insert a variable at the current cursor position
  const insertVariable = (variable: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newText = contractNotes.substring(0, start) + variable + contractNotes.substring(end);
      setContractNotes(newText);
      // Reset cursor position after the inserted variable
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start + variable.length, start + variable.length);
        }
      }, 0);
    } else {
      setContractNotes(contractNotes + variable);
    }
    setShowVariablesDropdown(false);
  };

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
        if (draft.companyEmail) setCompanyEmail(draft.companyEmail);
        if (draft.companyPhone) setCompanyPhone(draft.companyPhone);
      } catch (error) {
        console.error('Error loading contract draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever fields change
  useEffect(() => {
    if (selectedCreatorId || contractStartDate || contractEndDate || contractNotes || paymentStructureName || companyName || companyEmail || companyPhone) {
      const draft = {
        selectedCreatorId,
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName,
        companyName,
        companyEmail,
        companyPhone,
        timestamp: Date.now(),
      };
      localStorage.setItem(getDraftKey(), JSON.stringify(draft));
    }
  }, [selectedCreatorId, contractStartDate, contractEndDate, contractNotes, paymentStructureName, companyName, companyEmail, companyPhone]);

  useEffect(() => {
    loadCreators();
    loadDefaultTemplate();
  }, [currentOrgId, currentProjectId]);

  const loadCreators = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoadingCreators(true);
    try {
      // Fetch BOTH project creators AND organization members with role 'creator' in parallel
      const [projectCreators, allMembers] = await Promise.all([
        CreatorLinksService.getAllCreators(currentOrgId, currentProjectId),
        OrganizationService.getOrgMembers(currentOrgId)
      ]);
      
      // 1. Get creators from project profiles (linked to accounts)
      const projectCreatorMap = new Map(
        projectCreators.map(creator => [creator.id, {
          userId: creator.id,
          displayName: creator.displayName,
          email: creator.email,
        }])
      );
      
      // 2. Get creators from org members with role='creator' (may not have project profile yet)
      const memberCreators = allMembers
        .filter(member => member.role === 'creator')
        .map(member => ({
          userId: member.userId,
          displayName: member.displayName || member.email || 'Unknown',
          email: member.email,
        }));
      
      // 3. Merge both lists (members take precedence for display name if both exist)
      const mergedCreators = new Map<string, CreatorOption>();
      
      // First add all project creators
      projectCreatorMap.forEach((creator, id) => {
        mergedCreators.set(id, creator);
      });
      
      // Then add/update with member creators (these have more up-to-date info)
      memberCreators.forEach(creator => {
        const existing = mergedCreators.get(creator.userId);
        if (existing) {
          // Update with member data if available
          mergedCreators.set(creator.userId, {
            ...existing,
            displayName: creator.displayName || existing.displayName,
            email: creator.email || existing.email,
          });
        } else {
          // Add new creator
          mergedCreators.set(creator.userId, creator);
        }
      });
      
      // Convert to array and sort by display name
      const allCreators = Array.from(mergedCreators.values())
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      
      console.log(`[CreateContractPage] Loaded ${allCreators.length} creators (${projectCreators.length} from project, ${memberCreators.length} from org members)`);
      
      setCreators(allCreators);
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
    if (!templateName.trim()) {
      alert('Please provide a template name');
      return;
    }
    
    if (!currentOrgId) {
      alert('No organization selected. Please refresh and try again.');
      return;
    }
    
    if (!user) {
      alert('You must be signed in to save templates.');
      return;
    }

    setSavingTemplate(true);
    try {
      console.log('[CreateContractPage] Saving template...', {
        orgId: currentOrgId,
        userId: user.uid,
        templateName: templateName.trim(),
      });
      
      await TemplateService.saveTemplate(
        currentOrgId,
        templateName.trim(),
        templateDescription.trim() || '',
        contractNotes || '',
        user.uid,
        companyName || undefined,
        contractStartDate || undefined,
        contractEndDate || undefined
      );

      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error: any) {
      console.error('Error saving template:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to save template: ${errorMessage}`);
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
                <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">1</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Company Details</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your company name"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="company@example.com"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Title */}
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Contract Title *
                  </label>
                  <input
                    type="text"
                    value={contractTitle}
                    onChange={(e) => setContractTitle(e.target.value)}
                    placeholder="e.g., Content Creation Agreement"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
                  />
                </div>

                {/* Creator Section */}
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-3">
                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">2</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Creator</span>
                  </div>
                  {loadingCreators ? (
                    <div className="text-sm text-gray-500">Loading creators...</div>
                  ) : creators.length === 0 ? (
                    <div className="text-sm text-gray-500">No creators found in this project</div>
                  ) : (
                    <select
                      value={selectedCreatorId}
                      onChange={(e) => setSelectedCreatorId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
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
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-3">
                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">3</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Payment Structure <span className="text-gray-400 font-normal">(Optional)</span></span>
                  </div>
                  <input
                    type="text"
                    value={paymentStructureName}
                    onChange={(e) => setPaymentStructureName(e.target.value)}
                    placeholder="e.g., 'Standard Rate', 'Premium Package'"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
                  />
                </div>

                {/* Contract Period */}
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-3">
                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">4</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Contract Period</span>
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
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
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
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white text-sm"
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
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Change Template
                  </button>
                  <button
                    onClick={() => setShowSaveTemplateModal(true)}
                    disabled={!contractNotes.trim()}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save as Template
                  </button>
                </div>
              </div>
              
              {/* Template Variables Toolbar */}
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">Insert Variable:</span>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowVariablesDropdown(!showVariablesDropdown)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Variable
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      
                      {showVariablesDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
                          <div className="p-2 border-b border-gray-100">
                            <p className="text-[10px] text-gray-500">Click a variable to insert it at cursor position</p>
                          </div>
                          <div className="p-1">
                            {TEMPLATE_VARIABLES.map((variable) => (
                              <button
                                key={variable.key}
                                onClick={() => insertVariable(variable.key)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono text-gray-900">{variable.key}</span>
                                  {variable.fillableBy && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Fillable</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-0.5">{variable.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Variables will be auto-filled or available for signing parties
                  </div>
                </div>
              </div>
              
              <textarea
                ref={textareaRef}
                value={contractNotes}
                onChange={(e) => setContractNotes(e.target.value)}
                placeholder="Enter contract terms and conditions...&#10;&#10;Example: This agreement is entered into on {{TODAY_DATE}} between {{COMPANY_NAME}} and {{CREATOR_NAME}}..."
                className="w-full h-96 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:bg-white resize-none font-mono text-sm"
              />
              
              {/* Variable Legend */}
              {contractNotes.includes('{{') && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-[10px] font-medium text-gray-600 mb-2">Variables detected in your contract:</p>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_VARIABLES.filter(v => contractNotes.includes(v.key)).map(v => (
                      <span key={v.key} className="text-[10px] px-2 py-1 bg-white border border-gray-200 rounded font-mono text-gray-700">
                        {v.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="h-fit sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Contract Preview</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Live Preview</span>
            </div>
            
            {/* Legal Document Paper */}
            <div 
              className="bg-white relative overflow-hidden"
              style={{ 
                fontFamily: '"Times New Roman", Times, Georgia, serif',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 0 60px rgba(0,0,0,0.02)'
              }}
            >
              {/* Double border frame */}
              <div className="absolute inset-3 border-2 border-gray-300 pointer-events-none"></div>
              <div className="absolute inset-4 border border-gray-200 pointer-events-none"></div>
              
              {/* Watermark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-100 text-4xl font-bold rotate-[-30deg] pointer-events-none select-none tracking-[0.2em] opacity-30">
                DRAFT
              </div>
              
              {/* Document content */}
              <div className="p-8 relative z-10">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-gray-400"></div>
                    <span className="text-[10px] text-gray-400 tracking-[0.15em]">LEGAL DOCUMENT</span>
                    <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-gray-400"></div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-[0.1em] uppercase">
                    {contractTitle || 'CONTENT CREATOR AGREEMENT'}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-1">Independent Contractor Services Contract</p>
                </div>

                {/* Preamble */}
                <p className="text-[11px] text-gray-700 text-justify leading-relaxed mb-4">
                  <strong>THIS AGREEMENT</strong> is entered into as of{' '}
                  <span className="underline">
                    {contractStartDate ? new Date(contractStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '[DATE]'}
                  </span>{' '}
                  by and between the parties identified herein.
                </p>

                {/* Parties Section */}
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-gray-900 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                    ARTICLE I — PARTIES
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <div className="border-l-2 border-gray-800 pl-3">
                      <div className="text-[9px] text-gray-500 uppercase mb-1">Section 1.1 — Company</div>
                      <div className="font-bold text-gray-900">{companyName || '[COMPANY NAME]'}</div>
                      {companyEmail && <div className="text-[9px] text-gray-600">{companyEmail}</div>}
                      {companyPhone && <div className="text-[9px] text-gray-600">{companyPhone}</div>}
                      <div className="text-[9px] text-gray-500 italic mt-1">("Client")</div>
                    </div>
                    <div className="border-l-2 border-gray-800 pl-3">
                      <div className="text-[9px] text-gray-500 uppercase mb-1">Section 1.2 — Creator</div>
                      <div className="font-bold text-gray-900">{creators.find(c => c.userId === selectedCreatorId)?.displayName || '[CREATOR NAME]'}</div>
                      <div className="text-[9px] text-gray-500 italic mt-1">("Contractor")</div>
                    </div>
                  </div>
                </div>

                {/* Term Section */}
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-gray-900 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                    ARTICLE II — TERM
                  </div>
                  <p className="text-[11px] text-gray-700 leading-relaxed">
                    <strong>2.1</strong> Effective Date:{' '}
                    <span className="underline">
                      {contractStartDate ? new Date(contractStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '[START DATE]'}
                    </span>
                    <br />
                    <strong>2.2</strong> Termination:{' '}
                    {contractEndDate ? (
                      <span className="underline">{new Date(contractEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    ) : (
                      <span>Ongoing until terminated per provisions herein</span>
                    )}
                  </p>
                </div>

                {/* Payment Section */}
                {paymentStructureName && (
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-gray-900 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                      ARTICLE III — COMPENSATION
                    </div>
                    <p className="text-[11px] text-gray-700">
                      Payment Structure: <span className="font-semibold underline">{paymentStructureName}</span>
                    </p>
                  </div>
                )}

                {/* Terms Section */}
                <div className="mb-6">
                  <div className="text-[10px] font-bold text-gray-900 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                    ARTICLE {paymentStructureName ? 'IV' : 'III'} — TERMS AND CONDITIONS
                  </div>
                  {contractNotes ? (
                    <div className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap text-justify max-h-48 overflow-y-auto pr-2">
                      {contractNotes}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">
                      Terms and conditions will appear here...
                    </div>
                  )}
                </div>

                {/* Signature Block */}
                <div className="border-t-2 border-gray-800 pt-4">
                  <p className="text-[10px] text-gray-600 italic text-center mb-4">
                    IN WITNESS WHEREOF, the Parties have executed this Agreement.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-bold">THE COMPANY:</div>
                      <div className="h-8 border-b border-gray-400"></div>
                      <div className="text-[9px] text-gray-500 mt-1">Signature / Date</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-bold">THE CREATOR:</div>
                      <div className="h-8 border-b border-gray-400"></div>
                      <div className="text-[9px] text-gray-500 mt-1">Signature / Date</div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-2 border-t border-gray-200 flex justify-between text-[8px] text-gray-400">
                  <span>Draft Preview</span>
                  <span>Page 1 of 1</span>
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

