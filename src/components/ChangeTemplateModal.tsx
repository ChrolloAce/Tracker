import React, { useState, useEffect } from 'react';
import { X, FileText, UserCheck, Target, Crown, Video, Search, Clock } from 'lucide-react';
import { Button } from './ui/Button';
import { CONTRACT_TEMPLATES } from '../types/contracts';
import { TemplateService, ContractTemplate } from '../services/TemplateService';
import { useAuth } from '../contexts/AuthContext';

interface ChangeTemplateModalProps {
  onClose: () => void;
  onSelectTemplate: (terms: string) => void;
  hasUnsavedChanges?: boolean;
}

// Icon mapping for contract templates
const CONTRACT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText,
  Handshake: UserCheck,
  Target,
  Crown,
  Video,
};

const ChangeTemplateModal: React.FC<ChangeTemplateModalProps> = ({ 
  onClose, 
  onSelectTemplate,
  hasUnsavedChanges = false 
}) => {
  const { currentOrgId } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'saved'>(() => {
    // Remember last used tab
    return (localStorage.getItem('lastTemplateTab') as 'system' | 'saved') || 'system';
  });
  const [savedTemplates, setSavedTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'updated'>('updated');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'saved' && currentOrgId) {
      loadSavedTemplates();
    }
  }, [activeTab, currentOrgId]);

  const loadSavedTemplates = async () => {
    if (!currentOrgId) return;
    
    setLoading(true);
    try {
      const templates = await TemplateService.getSavedTemplates(currentOrgId);
      setSavedTemplates(templates);
    } catch (error) {
      console.error('Error loading saved templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'system' | 'saved') => {
    setActiveTab(tab);
    localStorage.setItem('lastTemplateTab', tab);
  };

  const handleSelectTemplate = (terms: string) => {
    if (hasUnsavedChanges) {
      setPendingTemplate(terms);
      setShowConfirm(true);
    } else {
      onSelectTemplate(terms);
      onClose();
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingTemplate) {
      onSelectTemplate(pendingTemplate);
      setShowConfirm(false);
      setPendingTemplate(null);
      onClose();
    }
  };

  const handleCancelSwitch = () => {
    setShowConfirm(false);
    setPendingTemplate(null);
  };

  // Filter and sort templates
  const getFilteredTemplates = () => {
    let templates = activeTab === 'system' 
      ? CONTRACT_TEMPLATES.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          terms: t.terms,
          source: 'system' as const,
          updatedAt: { toDate: () => new Date() } as any,
        }))
      : savedTemplates;

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.description.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortBy === 'name') {
      templates = [...templates].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      templates = [...templates].sort((a, b) => {
        const dateA = a.updatedAt?.toDate?.() || new Date(0);
        const dateB = b.updatedAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    }

    return templates;
  };

  const filteredTemplates = getFilteredTemplates();

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-semibold text-white">Change Template</h2>
              <p className="text-sm text-gray-400 mt-1">Choose a contract template to start with</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 border-b border-gray-800">
            <div className="flex gap-6">
              <button
                onClick={() => handleTabChange('system')}
                className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'system'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                System Templates
              </button>
              <button
                onClick={() => handleTabChange('saved')}
                className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'saved'
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                My Templates {savedTemplates.length > 0 && `(${savedTemplates.length})`}
              </button>
            </div>
          </div>

          {/* Search and Sort */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'updated')}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="updated" className="bg-[#161616]">Recently Updated</option>
                <option value="name" className="bg-[#161616]">A-Z</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {searchQuery ? 'No templates found' : activeTab === 'saved' ? 'No saved templates yet' : 'No templates available'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {searchQuery ? 'Try a different search term' : activeTab === 'saved' ? 'Save a template to see it here' : ''}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredTemplates.map((template) => {
                  const IconComponent = activeTab === 'system' 
                    ? (CONTRACT_ICON_MAP[(CONTRACT_TEMPLATES.find(t => t.id === template.id)?.icon || '')] || FileText)
                    : FileText;
                  
                  return (
                    <div
                      key={template.id}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 p-2.5 bg-white/5 rounded-lg">
                          <IconComponent className="w-5 h-5 text-white/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm mb-1">{template.name}</h4>
                          <p className="text-xs text-gray-400 mb-2">{template.description}</p>
                          {template.updatedAt && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              Updated {formatDate(template.updatedAt)}
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={() => handleSelectTemplate(template.terms)}
                          className="flex-shrink-0"
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[#161616] border border-gray-800 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Switch Template?</h3>
            <p className="text-sm text-gray-400 mb-6">
              You have unsaved changes. Switching templates will discard your current draft.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleCancelSwitch}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSwitch}
                className="flex-1"
              >
                Switch Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChangeTemplateModal;

