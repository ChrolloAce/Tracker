import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Campaign } from '../types/campaigns';
import CampaignService from '../services/CampaignService';
import { UrlParserService } from '../services/UrlParserService';

interface VideoInput {
  id: string;
  url: string;
  detectedPlatform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
  error?: string;
}

interface CreatorVideoSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatorVideoSubmissionModal: React.FC<CreatorVideoSubmissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [videoInputs, setVideoInputs] = useState<VideoInput[]>([
    { id: '1', url: '', detectedPlatform: null }
  ]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Load campaigns when modal opens
  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId && user) {
      loadCampaigns();
    }
  }, [isOpen, currentOrgId, currentProjectId, user]);

  const loadCampaigns = async () => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    try {
      setLoadingCampaigns(true);
      const creatorCampaigns = await CampaignService.getCreatorCampaigns(
        currentOrgId,
        currentProjectId,
        user.uid
      );
      
      // Only show active campaigns
      const activeCampaigns = creatorCampaigns.filter(c => c.status === 'active');
      setCampaigns(activeCampaigns);
      
      // Auto-select first campaign if available
      if (activeCampaigns.length > 0) {
        setSelectedCampaignId(activeCampaigns[0].id);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setGlobalError('Failed to load campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleAddVideoInput = () => {
    setVideoInputs([...videoInputs, { 
      id: Date.now().toString(), 
      url: '', 
      detectedPlatform: null 
    }]);
  };

  const handleRemoveVideoInput = (id: string) => {
    if (videoInputs.length > 1) {
      setVideoInputs(videoInputs.filter(input => input.id !== id));
    }
  };

  const handleVideoUrlChange = (id: string, url: string) => {
    // Detect platform from URL
    const parsed = UrlParserService.parseUrl(url);
    const detectedPlatform = parsed.platform;
    
    setVideoInputs(videoInputs.map(input => 
      input.id === id ? { ...input, url, detectedPlatform, error: undefined } : input
    ));
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !currentProjectId || !user) {
      setGlobalError('Not authenticated');
      return;
    }

    if (!selectedCampaignId) {
      setGlobalError('Please select a campaign');
      return;
    }

    // Validate inputs
    const validInputs = videoInputs.filter(input => input.url.trim() && input.detectedPlatform);
    
    if (validInputs.length === 0) {
      setGlobalError('Please enter at least one valid video URL');
      return;
    }

    // Check for invalid URLs
    const invalidUrls = videoInputs.filter(input => input.url.trim() && !input.detectedPlatform);
    if (invalidUrls.length > 0) {
      setGlobalError('Some URLs are invalid. Please check and enter valid social media video URLs.');
      return;
    }

    try {
      setLoading(true);
      setGlobalError(null);

      // Submit each video to the selected campaign
      for (const input of validInputs) {
        await CampaignService.submitVideo(
          currentOrgId,
          currentProjectId,
          user.uid,
          {
            campaignId: selectedCampaignId,
            videoUrl: input.url.trim(),
            platform: input.detectedPlatform as 'instagram' | 'tiktok' | 'youtube',
          }
        );
      }

      // Show success state
      setSuccess(true);
      
      // Call onSuccess after delay
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Failed to submit videos:', error);
      setGlobalError(error.message || 'Failed to submit videos');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVideoInputs([{ id: '1', url: '', detectedPlatform: null }]);
    setSelectedCampaignId('');
    setGlobalError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  // Success state
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1A1A] rounded-2xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Videos Submitted!</h2>
          <p className="text-gray-400">Your videos have been submitted to the campaign and are pending approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-white">Submit Videos</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Campaign Selection */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Select Campaign *
            </label>
            {loadingCampaigns ? (
              <div className="bg-white/5 rounded-lg px-4 py-3 text-sm text-gray-400">
                Loading campaigns...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                No active campaigns available. Please contact your admin.
              </div>
            ) : (
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id} className="bg-[#1A1A1A]">
                    {campaign.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Video URLs */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Video URLs *
            </label>
            <div className="space-y-3">
              {videoInputs.map((input) => (
                <div key={input.id} className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="url"
                      value={input.url}
                      onChange={(e) => handleVideoUrlChange(input.id, e.target.value)}
                      placeholder="https://instagram.com/reel/... or https://tiktok.com/@user/video/..."
                      className={`w-full bg-white/5 border ${
                        input.detectedPlatform 
                          ? 'border-emerald-500/50' 
                          : input.error 
                          ? 'border-red-500/50' 
                          : 'border-white/10'
                      } rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50`}
                    />
                    {input.detectedPlatform && (
                      <p className="mt-1 text-xs text-emerald-400">
                        ✓ {input.detectedPlatform.charAt(0).toUpperCase() + input.detectedPlatform.slice(1)} video detected
                      </p>
                    )}
                    {input.error && (
                      <p className="mt-1 text-xs text-red-400">
                        {input.error}
                      </p>
                    )}
                  </div>
                  {videoInputs.length > 1 && (
                    <button
                      onClick={() => handleRemoveVideoInput(input.id)}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleAddVideoInput}
              className="mt-3 flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another video
            </button>
          </div>

          {/* Global Error */}
          {globalError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {globalError}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || campaigns.length === 0 || !selectedCampaignId}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Submitting...' : `Submit ${videoInputs.filter(v => v.url.trim()).length > 0 ? videoInputs.filter(v => v.url.trim()).length : ''} Video${videoInputs.filter(v => v.url.trim()).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorVideoSubmissionModal;

