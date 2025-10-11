import React, { useState, useEffect } from 'react';
import { X, Search, FileText, UserCheck, Target, Crown, Video, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { CONTRACT_TEMPLATES } from '../types/contracts';
import { TemplateService, ContractTemplate } from '../services/TemplateService';
import { useAuth } from '../contexts/AuthContext';

// Icon mapping for templates
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText,
  Handshake: UserCheck,
  UserCheck,
  Target,
  Crown,
  Video,
};

interface ChangeTemplateModalProps {
  onClose: () => void;
  onSelectTemplate: (template: { id: string; terms: string; name: string }) => void;
}

const ChangeTemplateModal: React.FC<ChangeTemplateModalProps> = ({ onClose, onSelectTemplate }) => {
  const { currentOrgId } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'saved'>('system');
  const [savedTemplates, setSavedTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'updated'>('updated');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'saved' && currentOrgId) {
      loadSavedTemplates();
    }
  }, [activeTab, currentOrgId]);

  const loadSavedTemplates = async () => {
    if (!currentOrgId) return;
    
    setLoading(true);
    try {
      const templates = await TemplateService.getTemplates(currentOrgId);
      setSavedTemplates(templates);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setDeletingId(templateId);
    try {
      await TemplateService.deleteTemplate(templateId);
      await loadSavedTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectSystemTemplate = (templateId: string) => {
    const template = CONTRACT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      onSelectTemplate({
        id: template.id,
        terms: template.terms,
        name: template.name
      });
      onClose();
    }
  };

  const handleSelectSavedTemplate = (template: ContractTemplate) => {
    onSelectTemplate({
      id: template.id,
      terms: template.sections,
      name: template.name
    });
    onClose();
  };

  // Filter and sort system templates
  const filteredSystemTemplates = CONTRACT_TEMPLATES
    .filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0; // System templates don't have updatedAt
    });

  // Filter and sort saved templates
  const filteredSavedTemplates = savedTemplates
    .filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Default: sort by updatedAt (most recent first)
      return b.updatedAt.toMillis() - a.updatedAt.toMillis();
    });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white">Change Template</h2>
            <p className="text-sm text-gray-400 mt-1">Choose a different contract template</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 px-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('system')}
            className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'system'
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            System Templates ({CONTRACT_TEMPLATES.length})
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'saved'
                ? 'border-white text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            My Templates ({savedTemplates.length})
          </button>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-800">
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
            <option value="updated">Recently Updated</option>
            <option value="name">A-Z</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'system' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSystemTemplates.map((template) => {
                const IconComponent = ICON_MAP[template.icon] || FileText;
                return (
                  <div
                    key={template.id}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 p-2.5 bg-white/5 rounded-lg">
                        <IconComponent className="w-5 h-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm mb-1">{template.name}</h3>
                        <p className="text-xs text-gray-400 line-clamp-2">{template.description}</p>
                        {template.duration && (
                          <p className="text-xs text-gray-500 mt-2">Duration: {template.duration.months} months</p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSelectSystemTemplate(template.id)}
                      className="w-full"
                      size="sm"
                    >
                      Use Template
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
              ) : filteredSavedTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    {searchQuery ? 'No templates found' : 'No saved templates yet'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {searchQuery ? 'Try a different search term' : 'Save your first template to see it here'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSavedTemplates.map((template) => {
                    const IconComponent = ICON_MAP[template.icon || 'FileText'] || FileText;
                    return (
                      <div
                        key={template.id}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all group relative"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="flex-shrink-0 p-2.5 bg-white/5 rounded-lg">
                            <IconComponent className="w-5 h-5 text-white/80" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm mb-1">{template.name}</h3>
                            <p className="text-xs text-gray-400 line-clamp-2">{template.description}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              Updated: {template.updatedAt.toDate().toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={deletingId === template.id}
                            className="flex-shrink-0 p-1.5 hover:bg-red-500/10 text-red-400 rounded transition-colors disabled:opacity-50"
                            title="Delete template"
                          >
                            {deletingId === template.id ? (
                              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <Button
                          onClick={() => handleSelectSavedTemplate(template)}
                          className="w-full"
                          size="sm"
                        >
                          Use Template
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChangeTemplateModal;

