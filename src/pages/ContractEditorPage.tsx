import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ContractService } from '../services/ContractService';
import { TemplateService } from '../services/TemplateService';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import { OrgMember } from '../types/firestore';
import { Creator } from '../types/creator';
import { CreatorContactInfo, CompanyContactInfo } from '../types/contract';
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
  X,
  Copy,
  Check,
  ChevronDown,
  User
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
  
  // Available creators for dropdown
  const [availableCreators, setAvailableCreators] = useState<Creator[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [showCreatorDropdown, setShowCreatorDropdown] = useState(false);
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [initialContractNotes, setInitialContractNotes] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState('');
  
  // Creator contact info
  const [creatorEmail, setCreatorEmail] = useState('');
  const [creatorPhone, setCreatorPhone] = useState('');
  const [creatorAddress, setCreatorAddress] = useState('');
  
  // Company contact info
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  
  const [showChangeTemplateModal, setShowChangeTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  // Share links modal
  const [showShareLinksModal, setShowShareLinksModal] = useState(false);
  const [creatorLink, setCreatorLink] = useState('');
  const [companyLink, setCompanyLink] = useState('');
  const [copiedCreatorLink, setCopiedCreatorLink] = useState(false);
  const [copiedCompanyLink, setCopiedCompanyLink] = useState(false);
  
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
        // Only load company name from draft if it's different from default
        if (draft.companyName && draft.companyName !== '[Your Company Name]') {
          setCompanyName(draft.companyName);
        }
        if (draft.clientName) setClientName(draft.clientName);
      } catch (error) {
        console.error('Error loading contract draft:', error);
      }
    }
    
    // Set default start date if no draft exists
    if (!savedDraft) {
      const today = new Date();
      setContractStartDate(today.toISOString().split('T')[0]);
      setContractEndDate('');
    }
  }, [creatorId]);

  // Load available creators for the dropdown
  useEffect(() => {
    const loadAvailableCreators = async () => {
      if (!currentOrgId || !currentProjectId) return;
      
      try {
        const creators = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
        setAvailableCreators(creators);
      } catch (error) {
        console.error('Error loading creators:', error);
      }
    };
    
    loadAvailableCreators();
  }, [currentOrgId, currentProjectId]);
  
  // Filter creators based on search query
  const filteredCreators = useMemo(() => {
    if (!creatorSearchQuery.trim()) return availableCreators;
    const query = creatorSearchQuery.toLowerCase();
    return availableCreators.filter(c => 
      c.displayName?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query)
    );
  }, [availableCreators, creatorSearchQuery]);

  // Pre-fill client name and email when creator is loaded
  useEffect(() => {
    if (creator && !clientName) {
      setClientName(creator.displayName || creator.email || '');
      if (creator.email && !creatorEmail) {
        setCreatorEmail(creator.email);
      }
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
        // Load organization to get company name
        const org = await OrganizationService.getOrganization(currentOrgId);
        if (org && org.name && !companyName) {
          setCompanyName(org.name);
        }

        // First, try to find in members collection (accepted invitations)
        const members = await OrganizationService.getOrgMembers(currentOrgId);
        let foundCreator = members.find(
          (member: OrgMember) => member.userId === creatorId || member.email === creatorId
        );

        // If not found in members, check project creators (pending, no email)
        if (!foundCreator && currentProjectId) {
          const projectCreators = await CreatorLinksService.getAllCreators(currentOrgId, currentProjectId);
          const creatorProfile = projectCreators.find(c => c.id === creatorId);
          
          if (creatorProfile) {
            // Convert Creator profile to OrgMember format for compatibility
            foundCreator = {
              userId: creatorProfile.id,
              displayName: creatorProfile.displayName,
              email: creatorProfile.email || '',
              photoURL: creatorProfile.photoURL,
              joinedAt: creatorProfile.createdAt,
              role: 'creator' as const,
              status: 'invited' as const
            };
          }
        }

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
    const insertedTerms = `\n\n${formattedTerms}\n\n`;
    
    setContractNotes(contractNotes + insertedTerms);
  };

  const handleCopyCreatorLink = async () => {
    try {
      await navigator.clipboard.writeText(creatorLink);
      setCopiedCreatorLink(true);
      setTimeout(() => setCopiedCreatorLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCompanyLink = async () => {
    try {
      await navigator.clipboard.writeText(companyLink);
      setCopiedCompanyLink(true);
      setTimeout(() => setCopiedCompanyLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCloseShareModal = () => {
    setShowShareLinksModal(false);
    navigate(`/creators/${creatorId}?tab=contract`);
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
    if (!user || !currentOrgId || !currentProjectId) return;

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
    if (!companyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    setSharing(true);
    try {
      // Build creator contact info
      const creatorContactInfo: CreatorContactInfo = {
        name: clientName,
        email: creatorEmail || undefined,
        phone: creatorPhone || undefined,
        address: creatorAddress || undefined,
      };
      
      // Build company contact info
      const companyContactInfo: CompanyContactInfo = {
        name: companyName,
        email: companyEmail || undefined,
        phone: companyPhone || undefined,
        address: companyAddress || undefined,
      };
      
      // Use selected creator ID or generate a custom one for typed names
      const effectiveCreatorId = selectedCreatorId || creator?.userId || `custom_${Date.now()}`;
      
      const contract = await ContractService.createShareableContract(
        currentOrgId,
        currentProjectId,
        effectiveCreatorId,
        clientName,
        creatorEmail || creator?.email || '',
        contractStartDate,
        contractEndDate || 'Indefinite',
        contractNotes,
        creatorPaymentStructure?.name || undefined,
        user.uid,
        undefined, // contractTitle
        companyName,
        creatorContactInfo,
        companyContactInfo
      );

      // Clear the draft on success
      localStorage.removeItem(getDraftKey());
      
      // Set links and show modal
      setCreatorLink(contract.creatorLink);
      setCompanyLink(contract.companyLink);
      setShowShareLinksModal(true);
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

  // Note: We allow the page to load even without a pre-selected creator
  // The user can type a custom creator name in the form

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
                onClick={() => creatorId ? navigate(`/creators/${creatorId}?tab=contract`) : navigate('/creators')}
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
                  {clientName ? `For ${clientName}` : (creator?.displayName || creator?.email || 'Select or enter client details below')}
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
                {/* Company Section */}
                <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 text-xs">Co</span>
                    </div>
                    Company Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your Company Name"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        placeholder="company@example.com"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Address
                      </label>
                      <input
                        type="text"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="123 Business St, City, State 12345"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Creator/Client Section */}
                <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-purple-400" />
                    </div>
                    Creator/Client Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Creator Name with Dropdown */}
                    <div className="md:col-span-2 relative">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Name * (Select or type)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => {
                            setClientName(e.target.value);
                            setSelectedCreatorId(null);
                            setShowCreatorDropdown(true);
                            setCreatorSearchQuery(e.target.value);
                          }}
                          onFocus={() => setShowCreatorDropdown(true)}
                          placeholder="Select or type a name"
                          className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreatorDropdown(!showCreatorDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      
                      {/* Creator Dropdown */}
                      {showCreatorDropdown && filteredCreators.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {filteredCreators.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setClientName(c.displayName || c.email || '');
                                setCreatorEmail(c.email || '');
                                setSelectedCreatorId(c.id);
                                setShowCreatorDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-3 transition-colors"
                            >
                              {c.photoURL ? (
                                <img src={c.photoURL} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                                  <User className="w-3 h-3 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <div className="text-sm text-white">{c.displayName || 'Unnamed'}</div>
                                {c.email && (
                                  <div className="text-xs text-gray-400">{c.email}</div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={creatorEmail}
                        onChange={(e) => setCreatorEmail(e.target.value)}
                        placeholder="creator@example.com"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={creatorPhone}
                        onChange={(e) => setCreatorPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">
                        Address
                      </label>
                      <input
                        type="text"
                        value={creatorAddress}
                        onChange={(e) => setCreatorAddress(e.target.value)}
                        placeholder="123 Creator Ave, City, State 12345"
                        className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                      />
                    </div>
                  </div>
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
                companyName={companyName}
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

      {/* Share Links Modal */}
      {showShareLinksModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161616] rounded-xl border border-gray-800 w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Contract Shared Successfully!
                </h3>
                <p className="text-sm text-gray-400 mt-1">Share these links with the respective parties to sign the contract</p>
              </div>
              <button
                onClick={handleCloseShareModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Creator Link */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Creator Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={creatorLink}
                    readOnly
                    className="flex-1 px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 font-mono text-sm"
                  />
                  <Button
                    onClick={handleCopyCreatorLink}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    {copiedCreatorLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Send this link to <span className="text-white font-medium">{clientName}</span> to sign as the creator
                </p>
                </div>

              {/* Company Link */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={companyLink}
                    readOnly
                    className="flex-1 px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/50 font-mono text-sm"
                  />
                  <Button
                    onClick={handleCopyCompanyLink}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    {copiedCompanyLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use this link to sign as the company representative
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-800">
              <Button
                onClick={handleCloseShareModal}
                className="w-full"
              >
                Done
              </Button>
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
