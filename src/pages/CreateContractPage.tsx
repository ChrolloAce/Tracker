import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, CheckCircle, Plus, Copy, ExternalLink, Link2, Trash2, GripVertical, Calendar, Type, DollarSign, PenTool } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import CreatorLinksService from '../services/CreatorLinksService';
import OrganizationService from '../services/OrganizationService';
import TeamInvitationService from '../services/TeamInvitationService';
import ChangeTemplateModal from '../components/ChangeTemplateModal';

// Template variables that can be inserted into contracts
const TEMPLATE_VARIABLES: Array<{
  key: string;
  label: string;
  description: string;
  fillableBy?: string;
  type?: 'auto' | 'fillable';
}> = [
  { key: '{{COMPANY_NAME}}', label: 'Company Name', description: 'Auto-filled from Company section', type: 'auto' },
  { key: '{{COMPANY_EMAIL}}', label: 'Company Email', description: 'Auto-filled from Company section', type: 'auto' },
  { key: '{{COMPANY_PHONE}}', label: 'Company Phone', description: 'Auto-filled from Company section', type: 'auto' },
  { key: '{{CREATOR_NAME}}', label: 'Creator Name', description: 'Auto-filled from selected creator', type: 'auto' },
  { key: '{{CREATOR_EMAIL}}', label: 'Creator Email', description: 'Auto-filled from selected creator', type: 'auto' },
  { key: '{{CONTRACT_TITLE}}', label: 'Contract Title', description: 'Auto-filled from title field', type: 'auto' },
  { key: '{{START_DATE}}', label: 'Start Date', description: 'Contract start date', type: 'auto' },
  { key: '{{END_DATE}}', label: 'End Date', description: 'Contract end date (if set)', type: 'auto' },
  { key: '{{TODAY_DATE}}', label: 'Today\'s Date', description: 'Current date when viewed', type: 'auto' },
  { key: '{{SIGNATURE_DATE}}', label: 'Signature Date', description: 'Blank line — to be filled when signing', type: 'fillable', fillableBy: 'both' },
  { key: '{{CUSTOM_TEXT}}', label: 'Custom Text', description: 'Blank line — to be filled in by a party', type: 'fillable', fillableBy: 'both' },
  { key: '{{CUSTOM_AMOUNT}}', label: 'Custom Amount', description: 'Blank amount — to be filled in', type: 'fillable', fillableBy: 'both' },
  { key: '{{CUSTOM_DATE}}', label: 'Custom Date', description: 'Blank date — to be filled in', type: 'fillable', fillableBy: 'both' },
];

interface CreatorOption {
  userId: string;
  displayName: string;
  email?: string;
  isPending?: boolean;
}

const CreateContractPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [contractTitle, setContractTitle] = useState('Content Creation Agreement');
  const [contractStartDate, setContractStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [initialContractNotes, setInitialContractNotes] = useState('');
  const [paymentStructureName, setPaymentStructureName] = useState('');
  const [createdContract, setCreatedContract] = useState<{ creatorLink: string; companyLink: string } | null>(null);
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
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
      const [projectCreators, allMembers, pendingInvitations] = await Promise.all([
        CreatorLinksService.getAllCreators(currentOrgId, currentProjectId),
        OrganizationService.getOrgMembers(currentOrgId),
        TeamInvitationService.getOrgInvitations(currentOrgId)
      ]);

      const projectCreatorMap = new Map(
        projectCreators.map(creator => [creator.id, {
          userId: creator.id,
          displayName: creator.displayName,
          email: creator.email,
          isPending: false,
        }])
      );

      const memberCreators = allMembers
        .filter(member => member.role === 'creator')
        .map(member => ({
          userId: member.userId,
          displayName: member.displayName || member.email || 'Unknown',
          email: member.email,
          isPending: false,
        }));

      const mergedCreators = new Map<string, CreatorOption>();

      projectCreatorMap.forEach((creator, id) => {
        mergedCreators.set(id, creator);
      });

      memberCreators.forEach(creator => {
        const existing = mergedCreators.get(creator.userId);
        if (existing) {
          mergedCreators.set(creator.userId, {
            ...existing,
            displayName: creator.displayName || existing.displayName,
            email: creator.email || existing.email,
          });
        } else {
          mergedCreators.set(creator.userId, creator);
        }
      });

      const pendingCreators = pendingInvitations
        .filter(inv => inv.role === 'creator' && inv.status === 'pending')
        .map(inv => ({
          userId: `pending_${inv.id}`,
          displayName: inv.email,
          email: inv.email,
          isPending: true,
        }));

      const activeCreators = Array.from(mergedCreators.values())
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

      const allCreators = [...activeCreators, ...pendingCreators];

      console.log(`[CreateContractPage] Loaded ${allCreators.length} creators (${activeCreators.length} active, ${pendingCreators.length} pending)`);

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
      const defaultTemplate = templates[0];

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

  // Build variable resolution map from current form values
  const selectedCreator = creators.find(c => c.userId === selectedCreatorId);
  const variableValues = useMemo(() => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    return new Map<string, string>([
      ['{{COMPANY_NAME}}', companyName || ''],
      ['{{COMPANY_EMAIL}}', companyEmail || ''],
      ['{{COMPANY_PHONE}}', companyPhone || ''],
      ['{{CREATOR_NAME}}', selectedCreator?.displayName || ''],
      ['{{CREATOR_EMAIL}}', selectedCreator?.email || ''],
      ['{{CONTRACT_TITLE}}', contractTitle || ''],
      ['{{START_DATE}}', formatDate(contractStartDate)],
      ['{{END_DATE}}', contractEndDate ? formatDate(contractEndDate) : ''],
      ['{{TODAY_DATE}}', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
    ]);
  }, [companyName, companyEmail, companyPhone, selectedCreator, contractTitle, contractStartDate, contractEndDate]);

  const handleCreate = async () => {
    if (!currentOrgId || !currentProjectId || !user || !selectedCreatorId) {
      alert('Please fill in all required fields');
      return;
    }

    if (!companyName || !contractTitle || !contractStartDate) {
      alert('Please fill in all contract details');
      return;
    }

    const selectedCreator = creators.find(c => c.userId === selectedCreatorId);
    if (!selectedCreator) {
      alert('Invalid creator selection');
      return;
    }

    const creatorId = selectedCreator.isPending
      ? selectedCreatorId.replace('pending_', '')
      : selectedCreatorId;

    setLoading(true);
    try {
      const contract = await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        creatorId,
        selectedCreator.displayName || 'Creator',
        selectedCreator.email || '',
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName || undefined,
        user.uid,
        selectedCreator.isPending || false,
        contractTitle,
        companyName
      );

      localStorage.removeItem(getDraftKey());

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

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmLeave) return;
    }
    localStorage.removeItem(getDraftKey());
    navigate('/dashboard?tab=creators&subtab=contracts');
  };

  // Helper: get icon for a field chip
  const getFieldIcon = (key: string) => {
    if (key.includes('DATE') || key.includes('SIGNATURE_DATE')) return <Calendar className="w-3 h-3" />;
    if (key.includes('AMOUNT')) return <DollarSign className="w-3 h-3" />;
    if (key.includes('SIGNATURE')) return <PenTool className="w-3 h-3" />;
    return <Type className="w-3 h-3" />;
  };

  const autoFields = TEMPLATE_VARIABLES.filter(v => v.type === 'auto');
  const fillableFields = TEMPLATE_VARIABLES.filter(v => v.type === 'fillable');

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Sticky Top Bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-200">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-1.5 rounded-md hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-500" />
            </button>
            <span className="text-sm font-semibold text-neutral-900">New Contract</span>
          </div>
          <Button
            onClick={handleCreate}
            disabled={loading || !selectedCreatorId || !contractStartDate || !companyName}
            className="h-8 px-4 text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 rounded-md flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Contract'
            )}
          </Button>
        </div>
      </div>

      {/* ── Three-column layout ── */}
      <div className="max-w-[1440px] mx-auto flex">

        {/* ── LEFT SIDEBAR: Field Palette ── */}
        <aside className="w-64 flex-shrink-0 border-r border-neutral-200 bg-white min-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-4">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">Fields</p>

            {/* Legend */}
            <div className="flex items-center gap-3 mb-4 text-[10px] text-neutral-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Auto-filled</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Signer fills</span>
            </div>

            {/* Standard Fields — Auto */}
            <div className="mb-5">
              <p className="text-[10px] font-medium text-neutral-500 mb-2">Standard Fields</p>
              <div className="space-y-1">
                {autoFields.map((v) => {
                  const resolved = variableValues.get(v.key);
                  const hasValue = !!resolved;
                  return (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-neutral-50 transition-colors group"
                      title={v.description}
                    >
                      <GripVertical className="w-3 h-3 text-neutral-300 group-hover:text-neutral-400 flex-shrink-0" />
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasValue ? 'bg-emerald-500' : 'bg-red-300'}`} />
                      <span className="text-xs text-neutral-700 truncate flex-1">{v.label}</span>
                      {getFieldIcon(v.key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Signature fields */}
            <div className="mb-5">
              <p className="text-[10px] font-medium text-neutral-500 mb-2">Signature &amp; Fillable</p>
              <div className="space-y-1">
                {fillableFields.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-neutral-50 transition-colors group"
                    title={v.description}
                  >
                    <GripVertical className="w-3 h-3 text-neutral-300 group-hover:text-neutral-400 flex-shrink-0" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="text-xs text-neutral-700 truncate flex-1">{v.label}</span>
                    {getFieldIcon(v.key)}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-neutral-100 my-4" />

            {/* Custom Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-neutral-500">Custom Fields</p>
                <button
                  onClick={() => setCustomFields(prev => [...prev, { label: '', value: '' }])}
                  className="p-1 rounded hover:bg-neutral-100 transition-colors"
                >
                  <Plus className="w-3 h-3 text-neutral-400" />
                </button>
              </div>
              {customFields.length === 0 ? (
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  Add label + value pairs that appear in the document.
                </p>
              ) : (
                <div className="space-y-2">
                  {customFields.map((field, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...customFields];
                            updated[index].label = e.target.value;
                            setCustomFields(updated);
                          }}
                          placeholder="Label"
                          className="flex-1 px-2 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
                        />
                        <button
                          onClick={() => setCustomFields(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-neutral-400 hover:text-red-500" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => {
                          const updated = [...customFields];
                          updated[index].value = e.target.value;
                          setCustomFields(updated);
                        }}
                        placeholder="Value"
                        className="w-full px-2 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── CENTER: Document View ── */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-6">
          {/* Thin toolbar */}
          <div className="max-w-[700px] mx-auto mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowChangeTemplateModal(true)}
                className="text-xs text-neutral-500 hover:text-neutral-900 px-2.5 py-1 rounded-md hover:bg-neutral-100 transition-colors"
              >
                Change Template
              </button>
              <button
                onClick={() => setShowSaveTemplateModal(true)}
                disabled={!contractNotes.trim()}
                className="text-xs text-neutral-500 hover:text-neutral-900 px-2.5 py-1 rounded-md hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Template
              </button>
            </div>
            {hasUnsavedChanges && (
              <span className="text-[10px] text-neutral-400">Draft auto-saved</span>
            )}
          </div>

          {/* The "paper" document */}
          <div
            className="max-w-[700px] mx-auto bg-white rounded-sm border border-neutral-200 shadow-sm"
            style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
          >
            <div className="px-12 py-10">
              {/* Document title */}
              <div className="text-center mb-8">
                <h2 className="text-lg font-bold text-neutral-900 uppercase tracking-wide">
                  {contractTitle || 'Untitled Agreement'}
                </h2>
                <div className="w-10 h-px bg-neutral-300 mx-auto mt-3" />
              </div>

              {/* Parties header */}
              <p className="text-xs text-neutral-500 text-center leading-relaxed mb-6" style={{ fontFamily: 'Georgia, serif' }}>
                This Agreement is entered into as of{' '}
                <span className="font-semibold text-neutral-800">
                  {contractStartDate
                    ? new Date(contractStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : '[Date]'}
                </span>
                , by and between the parties identified below.
              </p>

              {/* Parties block */}
              <div className="grid grid-cols-2 gap-6 mb-6 py-3 border-y border-neutral-200">
                <div>
                  <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Company</p>
                  <p className="text-sm font-semibold text-neutral-900">{companyName || '[Company Name]'}</p>
                  {companyEmail && <p className="text-[10px] text-neutral-500">{companyEmail}</p>}
                  {companyPhone && <p className="text-[10px] text-neutral-500">{companyPhone}</p>}
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Creator</p>
                  <p className="text-sm font-semibold text-neutral-900">
                    {selectedCreator?.displayName || '[Creator Name]'}
                  </p>
                  {selectedCreator?.email && <p className="text-[10px] text-neutral-500">{selectedCreator.email}</p>}
                </div>
              </div>

              {/* Period */}
              <div className="flex gap-6 mb-6 text-[11px]">
                <div>
                  <span className="text-neutral-400">Start: </span>
                  <span className="text-neutral-800 font-medium">
                    {contractStartDate
                      ? new Date(contractStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : '[Start Date]'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400">End: </span>
                  <span className="text-neutral-800 font-medium">
                    {contractEndDate
                      ? new Date(contractEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Ongoing'}
                  </span>
                </div>
              </div>

              {/* Custom fields rendered in document */}
              {customFields.filter(f => f.label && f.value).length > 0 && (
                <div className="mb-6">
                  <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest mb-2 pb-1 border-b border-neutral-200">
                    Additional Terms
                  </p>
                  <div className="space-y-1">
                    {customFields.filter(f => f.label && f.value).map((field, idx) => (
                      <p key={idx} className="text-[11px] text-neutral-700">
                        <span className="font-medium">{field.label}:</span> {field.value}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable contract body */}
              <div className="mb-8">
                <p className="text-xs font-medium text-neutral-400 mb-3">Terms & Conditions</p>
                <textarea
                  ref={textareaRef}
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  placeholder={"Enter contract terms and conditions...\n\nYou can use variables like {{COMPANY_NAME}} and {{CREATOR_NAME}} that auto-fill when the contract is sent."}
                  className="w-full min-h-[320px] px-0 py-0 bg-transparent text-neutral-700 placeholder-neutral-300 focus:outline-none resize-none text-sm leading-relaxed"
                />
              </div>

              {/* Signature blocks */}
              <div className="border-t border-neutral-200 pt-6">
                <div className="grid grid-cols-2 gap-8">
                  {[
                    { label: 'Company', name: companyName || '' },
                    { label: 'Creator', name: selectedCreator?.displayName || '' },
                  ].map(p => (
                    <div key={p.label}>
                      <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-widest mb-4">{p.label}</p>
                      <div className="h-8" />
                      <div className="border-t border-dashed border-neutral-300 pt-1.5">
                        <p className="text-[10px] text-neutral-500">{p.name || '_______________'}</p>
                        <p className="text-[9px] text-neutral-300 mt-0.5">Date: _______________</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: Contract Setup ── */}
        <aside className="w-72 flex-shrink-0 border-l border-neutral-200 bg-white min-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-5 space-y-5">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Contract Setup</p>

            {/* Company Details */}
            <div>
              <p className="text-xs font-medium text-neutral-900 mb-2">Company Details</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">Company Name *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Inc."
                    className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">Email</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="hello@acme.com"
                    className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">Phone</label>
                  <input
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100" />

            {/* Creator */}
            <div>
              <p className="text-xs font-medium text-neutral-900 mb-2">Creator</p>
              {loadingCreators ? (
                <div className="flex items-center gap-2 text-xs text-neutral-400 py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </div>
              ) : creators.length === 0 ? (
                <p className="text-xs text-neutral-400">No creators found</p>
              ) : (
                <>
                  <select
                    value={selectedCreatorId}
                    onChange={(e) => setSelectedCreatorId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
                  >
                    <option value="">Choose a creator...</option>
                    {creators.filter(c => !c.isPending).length > 0 && (
                      <optgroup label="Active Creators">
                        {creators.filter(c => !c.isPending).map((creator) => (
                          <option key={creator.userId} value={creator.userId}>
                            {creator.displayName || creator.email}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {creators.filter(c => c.isPending).length > 0 && (
                      <optgroup label="Pending">
                        {creators.filter(c => c.isPending).map((creator) => (
                          <option key={creator.userId} value={creator.userId}>
                            {creator.email || creator.displayName} (pending)
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {selectedCreatorId?.startsWith('pending_') && (
                    <div className="flex items-start gap-1.5 mt-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 leading-tight">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-0.5 flex-shrink-0" />
                      This creator hasn't accepted their invitation yet.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-neutral-100" />

            {/* Contract Period */}
            <div>
              <p className="text-xs font-medium text-neutral-900 mb-2">Contract Period</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">Start Date *</label>
                  <input
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-0.5">End Date <span className="text-neutral-300">(optional)</span></label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100" />

            {/* Contract Title */}
            <div>
              <p className="text-xs font-medium text-neutral-900 mb-2">Contract Title</p>
              <input
                type="text"
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                placeholder="Content Creation Agreement"
                className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
              />
            </div>

            <div className="border-t border-neutral-100" />

            {/* Payment Structure */}
            <div>
              <p className="text-xs font-medium text-neutral-900 mb-2">Payment Structure <span className="text-neutral-300 font-normal">(optional)</span></p>
              <input
                type="text"
                value={paymentStructureName}
                onChange={(e) => setPaymentStructureName(e.target.value)}
                placeholder="e.g., Net 30, per deliverable"
                className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
              />
            </div>

            {/* Variable status */}
            {contractNotes.includes('{{') && (
              <>
                <div className="border-t border-neutral-100" />
                <div>
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Variables</p>
                  <div className="space-y-1">
                    {TEMPLATE_VARIABLES.filter(v => contractNotes.includes(v.key)).map(v => {
                      const resolved = variableValues.get(v.key);
                      const isFillable = v.type === 'fillable';
                      return (
                        <div key={v.key} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isFillable ? 'bg-amber-400' : resolved ? 'bg-emerald-500' : 'bg-red-300'}`} />
                            <span className="text-[10px] text-neutral-600 truncate">{v.label}</span>
                          </div>
                          {isFillable ? (
                            <span className="text-[10px] text-amber-600 flex-shrink-0">signer</span>
                          ) : resolved ? (
                            <span className="text-[10px] text-emerald-600 truncate max-w-[100px] flex-shrink-0">{resolved}</span>
                          ) : (
                            <span className="text-[10px] text-red-400 flex-shrink-0">empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ── Modals ── */}

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
          <div className="bg-white rounded-lg border border-neutral-200 max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900 mb-4">Save as Template</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Creator Agreement"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Description <span className="text-neutral-300">(optional)</span></label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white resize-none text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                disabled={savingTemplate}
                className="flex-1 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateName.trim()}
                className="flex-1 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-md shadow-lg flex items-center gap-2 z-50">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Template saved</span>
        </div>
      )}

      {/* Contract Created Success Modal */}
      {createdContract && (
        <ContractCreatedModal
          creatorLink={createdContract.creatorLink}
          companyLink={createdContract.companyLink}
          onClose={() => navigate('/dashboard?tab=creators&subtab=contracts')}
        />
      )}
    </div>
  );
};

// Contract Created Success Modal
interface ContractCreatedModalProps {
  creatorLink: string;
  companyLink: string;
  onClose: () => void;
}

const ContractCreatedModal: React.FC<ContractCreatedModalProps> = ({ creatorLink, companyLink, onClose }) => {
  const [copiedCreator, setCopiedCreator] = useState(false);
  const [copiedCompany, setCopiedCompany] = useState(false);

  const copyToClipboard = async (text: string, type: 'creator' | 'company') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'creator') {
        setCopiedCreator(true);
        setTimeout(() => setCopiedCreator(false), 2000);
      } else {
        setCopiedCompany(true);
        setTimeout(() => setCopiedCompany(false), 2000);
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900">Contract Created</h3>
          <p className="text-xs text-neutral-500 mt-1">Share these links with the relevant parties</p>
        </div>

        {/* Links */}
        <div className="space-y-3">
          {/* Creator Link */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 uppercase mb-1.5">
              <Link2 className="w-3 h-3" />
              Creator Link
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={creatorLink}
                readOnly
                className="flex-1 px-2.5 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 text-xs truncate"
              />
              <button
                onClick={() => copyToClipboard(creatorLink, 'creator')}
                className={`px-2.5 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  copiedCreator
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {copiedCreator ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCreator ? 'Copied' : 'Copy'}
              </button>
              <a
                href={creatorLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Company Link */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 uppercase mb-1.5">
              <Link2 className="w-3 h-3" />
              Company Link
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={companyLink}
                readOnly
                className="flex-1 px-2.5 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 text-xs truncate"
              />
              <button
                onClick={() => copyToClipboard(companyLink, 'company')}
                className={`px-2.5 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  copiedCompany
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {copiedCompany ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCompany ? 'Copied' : 'Copy'}
              </button>
              <a
                href={companyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Done */}
        <button
          onClick={onClose}
          className="w-full mt-5 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-md text-sm font-medium transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default CreateContractPage;
