import React, { useState, useEffect } from 'react';
import { X, Video, Plus, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CampaignService from '../services/CampaignService';
import RulesService from '../services/RulesService';
import { CreateVideoSubmissionInput } from '../types/campaigns';
import { TrackingRule } from '../types/rules';

interface CampaignVideoSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onSuccess: () => void;
}

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

const CampaignVideoSubmissionModal: React.FC<CampaignVideoSubmissionModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  onSuccess,
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [rules, setRules] = useState<TrackingRule[]>([]);
  const [showCreateRule, setShowCreateRule] = useState(false);
  
  // Create rule fields
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      loadRules();
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  const loadRules = async () => {
    if (!currentOrgId || !currentProjectId) return;
    
    try {
      const rulesData = await RulesService.getRules(currentOrgId, currentProjectId);
      setRules(rulesData);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const handleCreateRule = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    if (!newRuleName.trim()) {
      setError('Rule name is required');
      return;
    }

    try {
      const keywords = newRuleKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const ruleId = await RulesService.createRule(currentOrgId, currentProjectId, user.uid, {
        name: newRuleName.trim(),
        keywords,
        platforms: [platform],
        isActive: true,
      });

      // Reload rules and select the new one
      await loadRules();
      setSelectedRuleId(ruleId);
      setShowCreateRule(false);
      setNewRuleName('');
      setNewRuleKeywords('');
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      setError(error.message || 'Failed to create rule');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentOrgId || !currentProjectId || !user) {
      setError('Not authenticated');
      return;
    }

    if (!videoUrl.trim()) {
      setError('Video URL is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const input: CreateVideoSubmissionInput = {
        campaignId,
        videoUrl: videoUrl.trim(),
        platform,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        ruleId: selectedRuleId || undefined,
      };

      await CampaignService.submitVideo(currentOrgId, currentProjectId, user.uid, input);

      setSuccess(true);
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Failed to submit video:', error);
      setError(error.message || 'Failed to submit video');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVideoUrl('');
    setPlatform('instagram');
    setTitle('');
    setDescription('');
    setSelectedRuleId('');
    setShowCreateRule(false);
    setNewRuleName('');
    setNewRuleKeywords('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1A1A] rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Video Submitted!</h2>
          <p className="text-gray-400">Your video has been submitted for review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#1A1A1A] rounded-2xl max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Submit Video</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Video URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://instagram.com/reel/..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
              required
            />
          </div>

          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Platform <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['instagram', 'tiktok', 'youtube', 'twitter'] as Platform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`px-4 py-3 rounded-lg border transition-all capitalize ${
                    platform === p
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Title (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a title"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes about this video"
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Rule Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tracking Rule (Optional)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Link this video to a rule to automatically track its performance
            </p>

            {!showCreateRule ? (
              <div className="space-y-2">
                <select
                  value={selectedRuleId}
                  onChange={(e) => setSelectedRuleId(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-all"
                >
                  <option value="">No rule (manual tracking)</option>
                  {rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateRule(true)}
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create New Rule
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="e.g., My Campaign Videos"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Keywords (Optional)
                  </label>
                  <input
                    type="text"
                    value={newRuleKeywords}
                    onChange={(e) => setNewRuleKeywords(e.target.value)}
                    placeholder="keyword1, keyword2, keyword3"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateRule}
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                  >
                    Create Rule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRule(false);
                      setNewRuleName('');
                      setNewRuleKeywords('');
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !videoUrl.trim()}
              className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all"
            >
              {loading ? 'Submitting...' : 'Submit Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignVideoSubmissionModal;

