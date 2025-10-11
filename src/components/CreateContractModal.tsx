import React, { useState, useEffect } from 'react';
import { X, FileText, Loader2, UserCheck, Target, Crown, Video, Save } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import { ContractService } from '../services/ContractService';
import { OrgMember } from '../types/firestore';
import { CONTRACT_TEMPLATES } from '../types/contracts';

// Icon mapping for contract templates
const CONTRACT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText,
  Handshake: UserCheck, // Using UserCheck as Handshake alternative
  Target,
  Crown,
  Video,
};

interface CreateContractModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateContractModal: React.FC<CreateContractModalProps> = ({ onClose, onSuccess }) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [paymentStructureName, setPaymentStructureName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    loadCreators();
  }, [currentOrgId, currentProjectId]);

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

  const handleSelectTemplate = (templateId: string) => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setContractNotes(template.terms);
      
      // Set dates if template has duration
      if (template.duration) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + template.duration.months);
        
        setContractStartDate(startDate.toISOString().split('T')[0]);
        setContractEndDate(endDate.toISOString().split('T')[0]);
      }
      
      setShowTemplates(false);
    }
  };

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
              <p className="text-sm text-gray-400">Generate a shareable contract for a creator</p>
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
          {showTemplates ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Choose a Template</h3>
                <p className="text-sm text-gray-400">Select a contract template to get started</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {CONTRACT_TEMPLATES.map((template) => {
                  const IconComponent = CONTRACT_ICON_MAP[template.icon] || FileText;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className="text-left p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 p-2.5 bg-white/5 rounded-lg">
                          <IconComponent className="w-5 h-5 text-white/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm group-hover:text-white/90">{template.name}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">{template.description}</p>
                          {template.duration && (
                            <p className="text-xs text-gray-500 mt-1">Duration: {template.duration.months} months</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowTemplates(false)}
                className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white font-medium text-sm transition-all"
              >
                Start from Scratch
              </button>
            </div>
          ) : (
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
                    onClick={() => setShowTemplates(true)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Use Template
                  </button>
                </div>
                <textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  rows={12}
                  placeholder="Enter contract terms..."
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showTemplates && (
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
                  <h3 className="text-lg font-semibold text-white mb-2">Save Contract as Template</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Give your contract terms a name to save as a reusable template.
                  </p>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 mb-4"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowSaveTemplateModal(false);
                        setTemplateName('');
                      }}
                      className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (templateName.trim()) {
                          // For now, just show an alert. In production, you'd save to localStorage or database
                          alert(`Contract template "${templateName}" saved! (Note: This is a demo - implement actual save functionality)`);
                          setShowSaveTemplateModal(false);
                          setTemplateName('');
                        }
                      }}
                      disabled={!templateName.trim()}
                      className="flex-1 px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateContractModal;

