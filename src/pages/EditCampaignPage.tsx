import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft,
  Save,
  Upload,
  X,
  Loader
} from 'lucide-react';
import { Campaign } from '../types/campaigns';
import CampaignService from '../services/CampaignService';

const EditCampaignPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [goalAmount, setGoalAmount] = useState(0);
  const [status, setStatus] = useState<'draft' | 'active' | 'completed' | 'cancelled'>('draft');

  useEffect(() => {
    loadCampaign();
  }, [campaignId, currentOrgId, currentProjectId]);

  const loadCampaign = async () => {
    if (!campaignId || !currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      const campaignData = await CampaignService.getCampaign(
        currentOrgId,
        currentProjectId,
        campaignId
      );
      
      if (!campaignData) {
        alert('Campaign not found');
        navigate('/campaigns');
        return;
      }
      
      setCampaign(campaignData);
      setName(campaignData.name);
      setDescription(campaignData.description);
      setCoverImage(campaignData.coverImage || '');
      setGoalAmount(campaignData.goalAmount);
      setStatus(campaignData.status);
    } catch (error) {
      console.error('Failed to load campaign:', error);
      alert('Failed to load campaign');
      navigate('/campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrgId) return;

    setUploadingImage(true);
    try {
      const imageUrl = await CampaignService.uploadCoverImage(currentOrgId, file);
      setCoverImage(imageUrl);
      console.log('✅ Cover image uploaded:', imageUrl);
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!campaignId || !currentOrgId || !currentProjectId || !campaign) return;

    if (!name.trim()) {
      alert('Campaign name is required');
      return;
    }

    setSaving(true);
    try {
      await CampaignService.updateCampaign(
        currentOrgId,
        currentProjectId,
        campaignId,
        {
          name: name.trim(),
          description: description.trim(),
          coverImage: coverImage || undefined,
          goalAmount,
          status,
        }
      );

      console.log('✅ Campaign updated successfully');
      navigate(`/campaign/${campaignId}`);
    } catch (error) {
      console.error('Failed to update campaign:', error);
      alert('Failed to update campaign. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Campaign not found</p>
          <button
            onClick={() => navigate('/campaigns')}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <h1 className="text-xl font-bold">Edit Campaign</h1>

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Cover Image
            </label>
            {coverImage ? (
              <div className="relative w-full h-64 rounded-xl overflow-hidden border border-white/10 group">
                <img 
                  src={coverImage} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Change Image
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                  <button
                    onClick={() => setCoverImage('')}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="block w-full h-64 border-2 border-dashed border-white/10 rounded-xl hover:border-emerald-500 transition-colors cursor-pointer">
                <div className="h-full flex flex-col items-center justify-center text-gray-400 hover:text-emerald-400 transition-colors">
                  {uploadingImage ? (
                    <>
                      <Loader className="w-12 h-12 animate-spin mb-3" />
                      <p className="text-sm">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mb-3" />
                      <p className="text-sm font-medium">Click to upload cover image</p>
                      <p className="text-xs mt-1">PNG, JPG up to 10MB</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
              </label>
            )}
          </div>

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter campaign name"
              className="w-full px-4 py-3 bg-[#121214] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your campaign..."
              rows={4}
              className="w-full px-4 py-3 bg-[#121214] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Goal Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Goal Amount
            </label>
            <input
              type="number"
              value={goalAmount}
              onChange={(e) => setGoalAmount(Number(e.target.value))}
              min="0"
              className="w-full px-4 py-3 bg-[#121214] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Campaign Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-4 py-3 bg-[#121214] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-white/10">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-[#121214] hover:bg-[#1a1a1a] border border-white/10 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditCampaignPage;

