import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, CheckCircle, Plus, Copy, ExternalLink, Link2, Trash2, GripVertical, Calendar, Type, DollarSign, PenTool, ChevronDown, UserPlus, Building2 } from 'lucide-react';
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

// ─── Saved Company Profiles ────────────────────────────────
interface SavedCompanyProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const COMPANY_PROFILES_KEY = 'viewtrack_company_profiles';

const loadCompanyProfiles = (): SavedCompanyProfile[] => {
  try { return JSON.parse(localStorage.getItem(COMPANY_PROFILES_KEY) || '[]'); }
  catch { return []; }
};

const persistCompanyProfiles = (profiles: SavedCompanyProfile[]) => {
  localStorage.setItem(COMPANY_PROFILES_KEY, JSON.stringify(profiles));
};

interface CreatorOption {
  userId: string;
  displayName: string;
  email?: string;
  isPending?: boolean;
  photoURL?: string;
}

const CreateContractPage: React.FC = () => {
  const navigate = useNavigate();
  const { contractId: editContractId } = useParams<{ contractId?: string }>();
  const isEditMode = !!editContractId;
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [editLoading, setEditLoading] = useState(false);
  const [editBlocked, setEditBlocked] = useState(false); // true if creator already signed
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
  const [swapTarget, setSwapTarget] = useState<{ varKey: string; index: number } | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [companyProfiles, setCompanyProfiles] = useState<SavedCompanyProfile[]>(loadCompanyProfiles());
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [customCreatorName, setCustomCreatorName] = useState('');
  const [customCreatorEmail, setCustomCreatorEmail] = useState('');
  const [customCreatorPhone, setCustomCreatorPhone] = useState('');
  const [customCreatorAddress, setCustomCreatorAddress] = useState('');
  const [isCustomCreator, setIsCustomCreator] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const skipRebuildRef = useRef(false);

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

  // ─── ContentEditable Editor Logic ───────────────────────
  const serializeEditor = (el: HTMLElement): string => {
    let result = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node instanceof HTMLElement) {
        if (node.dataset.var) {
          result += node.dataset.var;
        } else if (node.tagName === 'BR') {
          result += '\n';
        } else if (node.tagName === 'DIV' || node.tagName === 'P') {
          if (result.length > 0 && !result.endsWith('\n')) result += '\n';
          result += serializeEditor(node);
        } else {
          result += serializeEditor(node);
        }
      }
    });
    return result;
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    skipRebuildRef.current = true;
    setContractNotes(serializeEditor(editorRef.current));
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);

      // Allow select-all + delete
      if (!range.collapsed && editorRef.current) {
        const editorRange = document.createRange();
        editorRange.selectNodeContents(editorRef.current);
        const isFullSelect =
          range.startOffset === editorRange.startOffset &&
          range.startContainer === editorRange.startContainer &&
          range.endOffset === editorRange.endOffset &&
          range.endContainer === editorRange.endContainer;
        if (isFullSelect) return; // Allow full clear
      }

      // Block deletion of individual chips
      if (range.collapsed) {
        const node = range.startContainer;
        if (e.key === 'Backspace' && node.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
          const prev = node.previousSibling;
          if (prev instanceof HTMLElement && prev.dataset.var) { e.preventDefault(); return; }
        }
        if (e.key === 'Delete' && node.nodeType === Node.TEXT_NODE && range.startOffset === (node.textContent?.length || 0)) {
          const next = node.nextSibling;
          if (next instanceof HTMLElement && next.dataset.var) { e.preventDefault(); return; }
        }
      } else {
        // Selection spans nodes — check if it contains chips
        const fragment = range.cloneContents();
        if (fragment.querySelector('[data-var]')) { e.preventDefault(); return; }
      }
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const chip = target.closest('[data-var]') as HTMLElement | null;
    if (chip?.dataset.var && editorRef.current) {
      e.stopPropagation();
      const allChips = editorRef.current.querySelectorAll(`[data-var="${chip.dataset.var}"]`);
      let occIdx = 0;
      allChips.forEach((el, i) => { if (el === chip) occIdx = i; });

      const editorRect = editorRef.current.getBoundingClientRect();
      const chipRect = chip.getBoundingClientRect();
      setSwapTarget({ varKey: chip.dataset.var, index: occIdx });
      setPopoverPos({ top: chipRect.bottom - editorRect.top + 6, left: chipRect.left - editorRect.left });
    } else {
      setSwapTarget(null);
    }
  };

  const handleDeleteVariable = (varKey: string, occurrenceIndex: number) => {
    setContractNotes(prev => {
      let count = 0;
      return prev.replace(new RegExp(varKey.replace(/[{}]/g, '\\$&'), 'g'), (match) => {
        return count++ === occurrenceIndex ? '' : match;
      });
    });
    setSwapTarget(null);
  };

  // Insert a variable — append to end of contract notes
  const insertVariable = (variable: string) => {
    setContractNotes(prev => prev + variable);
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
    if (!isEditMode) loadDefaultTemplate();
  }, [currentOrgId, currentProjectId]);

  // Load existing contract for edit mode
  useEffect(() => {
    if (!editContractId) return;
    const loadExisting = async () => {
      setEditLoading(true);
      try {
        const contract = await ContractService.getContractById(editContractId);
        if (!contract) { alert('Contract not found'); navigate('/creators'); return; }
        if (contract.creatorSignature) {
          setEditBlocked(true);
        }
        // Pre-fill all fields
        setContractTitle(contract.contractTitle || 'Content Creation Agreement');
        setContractStartDate(contract.contractStartDate || '');
        setContractEndDate(contract.contractEndDate === 'Indefinite' ? '' : (contract.contractEndDate || ''));
        setContractNotes(contract.contractNotes || '');
        setInitialContractNotes(contract.contractNotes || '');
        setCompanyName(contract.companyName || '');
        setCompanyEmail(contract.companyInfo?.email || '');
        setCompanyPhone(contract.companyInfo?.phone || '');
        setPaymentStructureName(contract.paymentStructureName || '');
        // Try to match creator
        if (contract.creatorId?.startsWith('custom_')) {
          setIsCustomCreator(true);
          setCustomCreatorName(contract.creatorName || '');
          setCustomCreatorEmail(contract.creatorEmail || '');
          setCustomCreatorPhone(contract.creatorInfo?.phone || '');
          setCustomCreatorAddress(contract.creatorInfo?.address || '');
        } else {
          setSelectedCreatorId(contract.creatorId || '');
        }
      } catch (err) {
        console.error('Error loading contract for edit:', err);
        alert('Failed to load contract');
        navigate('/creators');
      } finally {
        setEditLoading(false);
      }
    };
    loadExisting();
  }, [editContractId]);

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
          photoURL: creator.photoURL,
        }])
      );

      const memberCreators = allMembers
        .filter(member => member.role === 'creator')
        .map(member => ({
          userId: member.userId,
          displayName: member.displayName || member.email || 'Unknown',
          email: member.email,
          isPending: false,
          photoURL: member.photoURL,
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
            photoURL: creator.photoURL || existing.photoURL,
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
      ['{{CREATOR_NAME}}', isCustomCreator ? customCreatorName : (selectedCreator?.displayName || '')],
      ['{{CREATOR_EMAIL}}', isCustomCreator ? customCreatorEmail : (selectedCreator?.email || '')],
      ['{{CONTRACT_TITLE}}', contractTitle || ''],
      ['{{START_DATE}}', formatDate(contractStartDate)],
      ['{{END_DATE}}', contractEndDate ? formatDate(contractEndDate) : ''],
      ['{{TODAY_DATE}}', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
    ]);
  }, [companyName, companyEmail, companyPhone, selectedCreator, isCustomCreator, customCreatorName, customCreatorEmail, contractTitle, contractStartDate, contractEndDate]);

  // ─── Build editor HTML (must be after variableValues) ───
  const buildEditorHtml = (raw: string): string => {
    if (!raw) return '';
    const regex = /(\{\{[A-Z_]+\}\})/g;
    const parts = raw.split(regex);

    return parts.map(part => {
      const varDef = TEMPLATE_VARIABLES.find(v => v.key === part);
      if (varDef) {
        const value = variableValues.get(part);
        const hasValue = !!value;
        const isFillable = varDef.type === 'fillable';
        const displayValue = isFillable ? varDef.label : (hasValue ? value : varDef.label);
        const bg = isFillable ? '#fffbeb' : hasValue ? '#eff6ff' : '#fef2f2';
        const color = isFillable ? '#d97706' : hasValue ? '#111827' : '#f87171';
        const border = isFillable ? '#fcd34d' : hasValue ? '#93c5fd' : '#fecaca';
        const fw = hasValue && !isFillable ? '500' : '400';
        const fs = (!hasValue || isFillable) ? 'italic' : 'normal';

        return `<span contenteditable="false" data-var="${part}" style="display:inline-block;position:relative;cursor:pointer;padding:1px 5px;border-radius:3px;background:${bg};color:${color};border-bottom:2px solid ${border};font-weight:${fw};font-style:${fs};user-select:none;margin:2px 1px;line-height:1.8;"><span style="position:absolute;top:-11px;left:0;font-size:6.5px;font-weight:700;color:#ef4444;background:#fef2f2;border:1px solid #fee2e2;padding:0 3px;border-radius:3px;line-height:1.3;white-space:nowrap;pointer-events:none;">${varDef.label}</span>${displayValue}</span>`;
      }
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }).join('');
  };

  // Sync editor HTML on external changes (not from user typing)
  useEffect(() => {
    if (!editorRef.current) return;
    if (skipRebuildRef.current) {
      skipRebuildRef.current = false;
      return;
    }
    editorRef.current.innerHTML = buildEditorHtml(contractNotes);
  }, [contractNotes, variableValues]);

  // ─── Company profile helpers ──────────────────────────────
  const handleSaveCompanyProfile = () => {
    if (!companyName.trim()) return;
    const existing = companyProfiles.find(p => p.name === companyName.trim());
    const profile: SavedCompanyProfile = {
      id: existing?.id || `cp_${Date.now()}`,
      name: companyName.trim(),
      email: companyEmail,
      phone: companyPhone,
    };
    const updated = existing
      ? companyProfiles.map(p => p.id === existing.id ? profile : p)
      : [...companyProfiles, profile];
    setCompanyProfiles(updated);
    persistCompanyProfiles(updated);
  };

  const handleSelectCompanyProfile = (profile: SavedCompanyProfile) => {
    setCompanyName(profile.name);
    setCompanyEmail(profile.email);
    setCompanyPhone(profile.phone);
    setShowCompanyDropdown(false);
  };

  const handleDeleteCompanyProfile = (id: string) => {
    const updated = companyProfiles.filter(p => p.id !== id);
    setCompanyProfiles(updated);
    persistCompanyProfiles(updated);
  };

  // ─── Variable swap: replace the nth occurrence ──────────
  const handleSwapVariable = (oldVar: string, newVar: string, occurrenceIndex: number) => {
    setContractNotes(prev => {
      let count = 0;
      return prev.replace(new RegExp(oldVar.replace(/[{}]/g, '\\$&'), 'g'), (match) => {
        return count++ === occurrenceIndex ? newVar : match;
      });
    });
    setSwapTarget(null);
  };

  const handleCreate = async () => {
    if (!currentOrgId || !currentProjectId || !user) {
      alert('Please fill in all required fields');
      return;
    }

    if (!companyName || !contractTitle || !contractStartDate) {
      alert('Please fill in all contract details');
      return;
    }

    // Support custom creator (not in system) or selected creator
    let creatorId: string;
    let creatorName: string;
    let creatorEmailVal: string;
    let isPending = false;

    if (isCustomCreator) {
      if (!customCreatorName.trim()) {
        alert('Please enter the creator/client name');
        return;
      }
      creatorId = `custom_${Date.now()}`;
      creatorName = customCreatorName.trim();
      creatorEmailVal = customCreatorEmail;
    } else {
      if (!selectedCreatorId) {
        alert('Please select a creator');
        return;
      }
      const selectedCreator = creators.find(c => c.userId === selectedCreatorId);
      if (!selectedCreator) {
        alert('Invalid creator selection');
        return;
      }
      creatorId = selectedCreator.isPending
        ? selectedCreatorId.replace('pending_', '')
        : selectedCreatorId;
      creatorName = selectedCreator.displayName || 'Creator';
      creatorEmailVal = selectedCreator.email || '';
      isPending = selectedCreator.isPending || false;
    }

    setLoading(true);
    try {
      const contract = await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        creatorId,
        creatorName,
        creatorEmailVal,
        contractStartDate,
        contractEndDate,
        contractNotes,
        paymentStructureName || undefined,
        user.uid,
        isPending,
        contractTitle,
        companyName,
        isCustomCreator ? {
          name: customCreatorName,
          email: customCreatorEmail || undefined,
          phone: customCreatorPhone || undefined,
          address: customCreatorAddress || undefined,
        } : undefined,
        {
          name: companyName,
          email: companyEmail || undefined,
          phone: companyPhone || undefined,
        },
        undefined, // expirationDays
        !isCustomCreator ? creators.find(c => c.userId === selectedCreatorId)?.photoURL : undefined
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

  // Save as draft — creates contract with status 'draft'
  const handleSaveDraft = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    if (!companyName.trim()) { alert('Please enter a company name'); return; }

    let creatorId = 'draft_placeholder';
    let creatorName = 'TBD';
    let creatorEmailVal = '';

    if (isCustomCreator && customCreatorName.trim()) {
      creatorId = `custom_${Date.now()}`;
      creatorName = customCreatorName.trim();
      creatorEmailVal = customCreatorEmail;
    } else if (selectedCreatorId) {
      const sel = creators.find(c => c.userId === selectedCreatorId);
      if (sel) {
        creatorId = sel.isPending ? selectedCreatorId.replace('pending_', '') : selectedCreatorId;
        creatorName = sel.displayName || 'Creator';
        creatorEmailVal = sel.email || '';
      }
    }

    setLoading(true);
    try {
      const contract = await ContractService.createShareableContract(
        currentOrgId, currentProjectId, creatorId, creatorName, creatorEmailVal,
        contractStartDate || new Date().toISOString().split('T')[0],
        contractEndDate || 'Indefinite', contractNotes,
        paymentStructureName || undefined, user.uid, false,
        contractTitle, companyName,
        isCustomCreator ? { name: customCreatorName, email: customCreatorEmail || undefined, phone: customCreatorPhone || undefined, address: customCreatorAddress || undefined } : undefined,
        { name: companyName, email: companyEmail || undefined, phone: companyPhone || undefined },
        undefined,
        !isCustomCreator && selectedCreatorId ? creators.find(c => c.userId === selectedCreatorId)?.photoURL : undefined
      );
      // Set status to draft
      await ContractService.updateContract(contract.id, { status: 'draft' as any });
      localStorage.removeItem(getDraftKey());
      navigate('/creators');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  // Save edits to an existing contract
  const handleSaveEdit = async () => {
    if (!editContractId || !user) return;
    if (editBlocked) { alert('Cannot edit — creator has already signed'); return; }

    let creatorId: string | undefined;
    let creatorName: string | undefined;
    let creatorEmailVal: string | undefined;

    if (isCustomCreator) {
      creatorId = `custom_${Date.now()}`;
      creatorName = customCreatorName.trim();
      creatorEmailVal = customCreatorEmail;
    } else if (selectedCreatorId) {
      const sel = creators.find(c => c.userId === selectedCreatorId);
      if (sel) {
        creatorId = sel.isPending ? selectedCreatorId.replace('pending_', '') : selectedCreatorId;
        creatorName = sel.displayName || 'Creator';
        creatorEmailVal = sel.email || '';
      }
    }

    setLoading(true);
    try {
      const updates: any = {
        contractTitle,
        contractStartDate: contractStartDate || '',
        contractEndDate: contractEndDate || 'Indefinite',
        contractNotes,
        companyName,
        companyInfo: { name: companyName, email: companyEmail || undefined, phone: companyPhone || undefined },
      };
      if (creatorId) updates.creatorId = creatorId;
      if (creatorName) updates.creatorName = creatorName;
      if (creatorEmailVal !== undefined) updates.creatorEmail = creatorEmailVal;
      if (isCustomCreator) {
        updates.creatorInfo = { name: customCreatorName, email: customCreatorEmail || undefined, phone: customCreatorPhone || undefined, address: customCreatorAddress || undefined };
      }
      // If contract was a draft and we're editing, keep it as draft. User sends separately.
      await ContractService.updateContract(editContractId, updates);
      navigate('/creators');
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Failed to save changes');
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
    navigate('/creators');
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
            <span className="text-sm font-semibold text-neutral-900">
              {isEditMode ? 'Edit Contract' : 'New Contract'}
            </span>
            {editBlocked && (
              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                Read-only — creator signed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading || editBlocked}
                  className="h-9 px-5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-[0_2px_0_0_rgba(30,64,175,1)] hover:shadow-[0_1px_0_0_rgba(30,64,175,1)] active:shadow-none active:translate-y-[1px] flex items-center gap-1.5"
                >
                  {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                </button>
              </>
            ) : (
              <>
                {/* Save Draft */}
                <button
                  onClick={handleSaveDraft}
                  disabled={loading || !companyName.trim()}
                  className="h-9 px-4 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Draft
                </button>
                {/* Send Contract */}
                <button
                  onClick={handleCreate}
                  disabled={loading || (!selectedCreatorId && !isCustomCreator) || !contractStartDate || !companyName}
                  className="h-9 px-5 text-xs font-semibold text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-[0_2px_0_0_rgba(30,64,175,1)] hover:shadow-[0_1px_0_0_rgba(30,64,175,1)] active:shadow-none active:translate-y-[1px] flex items-center gap-1.5"
                >
                  {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : 'Send Contract'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Loading state for edit mode */}
      {editLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          <span className="ml-2 text-sm text-neutral-500">Loading contract...</span>
        </div>
      )}

      {/* ── Three-column layout ── */}
      <div className="max-w-[1440px] mx-auto flex">

        {/* ── LEFT SIDEBAR: Field Palette ── */}
        <aside className="w-64 flex-shrink-0 border-r border-neutral-200 bg-white min-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="px-3 py-4">
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
                className="text-xs font-medium text-neutral-700 bg-white border border-neutral-300 px-3 py-1.5 rounded-md transition-all hover:bg-neutral-50 active:bg-neutral-100 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-[1px]"
              >
                Change Template
              </button>
              <button
                onClick={() => setShowSaveTemplateModal(true)}
                disabled={!contractNotes.trim()}
                className="text-xs font-medium text-neutral-700 bg-white border border-neutral-300 px-3 py-1.5 rounded-md transition-all hover:bg-neutral-50 active:bg-neutral-100 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed"
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
                    {isCustomCreator ? (customCreatorName || '[Creator Name]') : (selectedCreator?.displayName || '[Creator Name]')}
                  </p>
                  {isCustomCreator
                    ? customCreatorEmail && <p className="text-[10px] text-neutral-500">{customCreatorEmail}</p>
                    : selectedCreator?.email && <p className="text-[10px] text-neutral-500">{selectedCreator.email}</p>
                  }
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

              {/* Contract body — contentEditable with inline variable chips */}
              <div className="mb-8">
                <p className="text-xs font-medium text-neutral-400 mb-3">Terms & Conditions</p>

                <div className="relative">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleEditorInput}
                    onKeyDown={handleEditorKeyDown}
                    onPaste={handleEditorPaste}
                    onClick={handleEditorClick}
                    data-placeholder="Start typing your contract terms..."
                    className="min-h-[320px] text-neutral-700 text-sm leading-loose outline-none whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-300 empty:before:italic empty:before:pointer-events-none"
                    style={{ wordBreak: 'break-word' }}
                  />

                  {/* Swap / Delete popover */}
                  {swapTarget && popoverPos && (
                    <div
                      className="absolute bg-white border border-neutral-200 rounded-xl shadow-2xl w-56 py-2 max-h-72 overflow-y-auto"
                      style={{ top: popoverPos.top, left: popoverPos.left, zIndex: 100 }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Header with delete */}
                      <div className="flex items-center justify-between px-3 pb-1.5 mb-1 border-b border-neutral-100">
                        <div>
                          <span className="text-[10px] font-semibold text-neutral-900 block">Edit Variable</span>
                          <span className="text-[9px] text-neutral-400">Swap or remove this field</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteVariable(swapTarget.varKey, swapTarget.index)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                          title="Remove variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Swap options */}
                      {['auto', 'fillable'].map(type => {
                        const items = TEMPLATE_VARIABLES.filter(v => v.type === type && v.key !== swapTarget.varKey);
                        if (!items.length) return null;
                        return (
                          <div key={type}>
                            <span className="block px-3 pt-2 pb-1 text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                              {type === 'auto' ? 'Standard Fields' : 'Fillable Fields'}
                            </span>
                            {items.map(v => {
                              const vValue = variableValues.get(v.key);
                              return (
                                <button
                                  key={v.key}
                                  type="button"
                                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-blue-50 transition-colors"
                                  onClick={() => handleSwapVariable(swapTarget.varKey, v.key, swapTarget.index)}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${vValue ? 'bg-emerald-500' : v.type === 'fillable' ? 'bg-amber-400' : 'bg-neutral-300'}`} />
                                  <span className="flex-1 min-w-0">
                                    <span className="text-xs text-neutral-800 font-medium block">{v.label}</span>
                                    {vValue && <span className="text-[10px] text-neutral-400 truncate block">{vValue}</span>}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Signature blocks */}
              <div className="border-t border-neutral-200 pt-6">
                <div className="grid grid-cols-2 gap-8">
                  {[
                    { label: 'Company', name: companyName || '' },
                    { label: 'Creator', name: isCustomCreator ? customCreatorName : (selectedCreator?.displayName || '') },
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
          <div className="divide-y divide-neutral-100">

            {/* ── Company Details (collapsible) ── */}
            <div>
              <button
                type="button"
                onClick={() => setCollapsedSections(prev => { const n = new Set(prev); n.has('company') ? n.delete('company') : n.add('company'); return n; })}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs font-medium text-neutral-900">Company Details</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${collapsedSections.has('company') ? '-rotate-90' : ''}`} />
              </button>
              {!collapsedSections.has('company') && (
                <div className="px-4 pb-4 space-y-2">
                  {/* Saved profiles dropdown */}
                  {companyProfiles.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                        className="w-full flex items-center justify-between px-2.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md hover:bg-neutral-100 transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="text-neutral-700 truncate text-xs">{companyName || 'Select saved company...'}</span>
                        </span>
                        <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform flex-shrink-0 ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showCompanyDropdown && (
                        <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl py-1">
                          {companyProfiles.map(p => (
                            <div key={p.id} className="flex items-center group">
                              <button type="button" onClick={() => handleSelectCompanyProfile(p)} className="flex-1 text-left px-3 py-2 hover:bg-blue-50 transition-colors">
                                <div className="text-xs text-neutral-900 font-medium">{p.name}</div>
                                {p.email && <div className="text-[9px] text-neutral-400">{p.email}</div>}
                              </button>
                              <button type="button" onClick={() => handleDeleteCompanyProfile(p.id)} className="p-1.5 mr-2 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-0.5">Company Name *</label>
                    <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-0.5">Email <span className="text-neutral-300">(optional)</span></label>
                    <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="hello@acme.com" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-0.5">Phone <span className="text-neutral-300">(optional)</span></label>
                    <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+1 (555) 123-4567" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                  </div>
                  {companyName.trim() && (
                    <button type="button" onClick={handleSaveCompanyProfile} className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors">
                      <Save className="w-3 h-3" />
                      {companyProfiles.find(p => p.name === companyName.trim()) ? 'Update Saved Profile' : 'Save Company Profile'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Creator (collapsible) ── */}
            <div>
              <button
                type="button"
                onClick={() => setCollapsedSections(prev => { const n = new Set(prev); n.has('creator') ? n.delete('creator') : n.add('creator'); return n; })}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs font-medium text-neutral-900">Creator</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${collapsedSections.has('creator') ? '-rotate-90' : ''}`} />
              </button>
              {!collapsedSections.has('creator') && (
                <div className="px-4 pb-4">
                  {isCustomCreator ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md">
                        <UserPlus className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="text-[10px] text-emerald-700 font-medium">New Contact</span>
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 mb-0.5">Name *</label>
                        <input type="text" value={customCreatorName} onChange={(e) => setCustomCreatorName(e.target.value)} placeholder="Full name" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 mb-0.5">Email <span className="text-neutral-300">(optional)</span></label>
                        <input type="email" value={customCreatorEmail} onChange={(e) => setCustomCreatorEmail(e.target.value)} placeholder="email@example.com" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 mb-0.5">Phone <span className="text-neutral-300">(optional)</span></label>
                        <input type="tel" value={customCreatorPhone} onChange={(e) => setCustomCreatorPhone(e.target.value)} placeholder="+1 (555) 123-4567" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-neutral-500 mb-0.5">Address <span className="text-neutral-300">(optional)</span></label>
                        <input type="text" value={customCreatorAddress} onChange={(e) => setCustomCreatorAddress(e.target.value)} placeholder="123 Main St, City, State" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                      </div>
                      <button type="button" onClick={() => { setIsCustomCreator(false); setCustomCreatorName(''); setCustomCreatorEmail(''); setCustomCreatorPhone(''); setCustomCreatorAddress(''); }} className="text-[10px] text-neutral-500 hover:text-neutral-700 transition-colors">&larr; Back to existing creators</button>
                    </div>
                  ) : loadingCreators ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-400 py-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
                  ) : (
                    <div className="space-y-2">
                      <select value={selectedCreatorId} onChange={(e) => setSelectedCreatorId(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white">
                        <option value="">Choose a creator...</option>
                        {creators.filter(c => !c.isPending).length > 0 && (
                          <optgroup label="Active Creators">
                            {creators.filter(c => !c.isPending).map((c) => (<option key={c.userId} value={c.userId}>{c.displayName || c.email}</option>))}
                          </optgroup>
                        )}
                        {creators.filter(c => c.isPending).length > 0 && (
                          <optgroup label="Pending">
                            {creators.filter(c => c.isPending).map((c) => (<option key={c.userId} value={c.userId}>{c.email || c.displayName} (pending)</option>))}
                          </optgroup>
                        )}
                      </select>
                      <button type="button" onClick={() => { setIsCustomCreator(true); setSelectedCreatorId(''); }} className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors font-medium">
                        <UserPlus className="w-3.5 h-3.5" /> New Contact
                      </button>
                      {selectedCreatorId?.startsWith('pending_') && (
                        <div className="flex items-start gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 leading-tight">
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-0.5 flex-shrink-0" />
                          This creator hasn't accepted their invitation yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Contract Details (collapsible) ── */}
            <div>
              <button
                type="button"
                onClick={() => setCollapsedSections(prev => { const n = new Set(prev); n.has('details') ? n.delete('details') : n.add('details'); return n; })}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs font-medium text-neutral-900">Contract Details</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${collapsedSections.has('details') ? '-rotate-90' : ''}`} />
              </button>
              {!collapsedSections.has('details') && (
                <div className="px-4 pb-4 space-y-2">
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-0.5">Contract Title</label>
                    <input type="text" value={contractTitle} onChange={(e) => setContractTitle(e.target.value)} placeholder="Content Creation Agreement" className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-0.5">Start Date *</label>
                    <input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-0.5">End Date <span className="text-neutral-300">(optional)</span></label>
                    <input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className="w-full px-2.5 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Variables in Contract ── */}
            {contractNotes.includes('{{') && (
              <div>
                <button
                  type="button"
                  onClick={() => setCollapsedSections(prev => { const n = new Set(prev); n.has('variables') ? n.delete('variables') : n.add('variables'); return n; })}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-xs font-medium text-neutral-900">Variables <span className="text-neutral-400 font-normal">({TEMPLATE_VARIABLES.filter(v => contractNotes.includes(v.key)).length})</span></span>
                  <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${collapsedSections.has('variables') ? '-rotate-90' : ''}`} />
                </button>
                {!collapsedSections.has('variables') && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {TEMPLATE_VARIABLES.filter(v => contractNotes.includes(v.key)).map(v => {
                      const resolved = variableValues.get(v.key);
                      const isFillable = v.type === 'fillable';
                      return (
                        <div key={v.key} className="flex items-center justify-between gap-2 py-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isFillable ? 'bg-amber-400' : resolved ? 'bg-emerald-500' : 'bg-red-300'}`} />
                            <span className="text-[10px] text-neutral-600 truncate">{v.label}</span>
                          </div>
                          {isFillable ? (
                            <span className="text-[10px] text-amber-600 flex-shrink-0">signer fills</span>
                          ) : resolved ? (
                            <span className="text-[10px] text-emerald-600 truncate max-w-[100px] flex-shrink-0">{resolved}</span>
                          ) : (
                            <span className="text-[10px] text-red-400 flex-shrink-0">empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
          onClose={() => navigate('/creators')}
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
