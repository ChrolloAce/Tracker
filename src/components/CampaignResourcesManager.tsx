import React, { useState, useEffect } from 'react';
import { Plus, Link as LinkIcon, Upload, Download, Trash2, ExternalLink, File, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CampaignResourcesService from '../services/CampaignResourcesService';
import { CampaignResource, CampaignResourceType } from '../types/campaigns';

interface CampaignResourcesManagerProps {
  campaignId: string;
  isAdmin: boolean; // Can add/delete resources
}

const CampaignResourcesManager: React.FC<CampaignResourcesManagerProps> = ({
  campaignId,
  isAdmin
}) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [resources, setResources] = useState<CampaignResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'link' | 'file'>('link');
  const [uploading, setUploading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<CampaignResourceType>('document');

  useEffect(() => {
    loadResources();
  }, [campaignId]);

  const loadResources = async () => {
    if (!currentOrgId || !currentProjectId) return;

    setLoading(true);
    try {
      const data = await CampaignResourcesService.getResources(
        currentOrgId,
        currentProjectId,
        campaignId
      );
      setResources(data);
    } catch (error) {
      console.error('Failed to load resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!currentOrgId || !currentProjectId || !user || !name || !url) return;

    setUploading(true);
    try {
      await CampaignResourcesService.addLinkResource(
        currentOrgId,
        currentProjectId,
        campaignId,
        user.uid,
        name,
        url,
        description
      );
      
      await loadResources();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add link:', error);
      alert('Failed to add link. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFile = async () => {
    if (!currentOrgId || !currentProjectId || !user || !name || !file) return;

    setUploading(true);
    try {
      await CampaignResourcesService.uploadFileResource(
        currentOrgId,
        currentProjectId,
        campaignId,
        user.uid,
        file,
        name,
        fileType,
        description
      );

      await loadResources();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResource = async (resource: CampaignResource) => {
    if (!currentOrgId || !currentProjectId) return;
    
    if (!confirm(`Delete "${resource.name}"?`)) return;

    try {
      await CampaignResourcesService.deleteResource(
        currentOrgId,
        currentProjectId,
        campaignId,
        resource.id,
        resource.storagePath
      );
      await loadResources();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      alert('Failed to delete resource. Please try again.');
    }
  };

  const handleDownload = async (resource: CampaignResource) => {
    if (!currentOrgId || !currentProjectId) return;

    try {
      await CampaignResourcesService.downloadResource(
        currentOrgId,
        currentProjectId,
        campaignId,
        resource
      );
    } catch (error) {
      console.error('Failed to download resource:', error);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setUrl('');
    setFile(null);
    setFileType('document');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setName(selectedFile.name);

    // Auto-detect type
    if (selectedFile.type.startsWith('image/')) {
      setFileType('image');
    } else if (selectedFile.type.startsWith('video/')) {
      setFileType('video');
    } else {
      setFileType('document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-xl font-bold text-white">
            Campaign Resources
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Links, images, and files for participants
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Resource
          </button>
        )}
      </div>

      {/* Resources List - Full Width Cards */}
      {resources.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
          <File className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No resources yet</p>
          {isAdmin && (
            <p className="text-sm text-gray-500 mt-1">Add links or files to share with participants</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map(resource => (
            <div
              key={resource.id}
              className="bg-white/5 rounded-lg border border-white/10 p-4 hover:bg-white/10 hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                {/* Left: Icon and Info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">
                      {CampaignResourcesService.getFileIcon(resource)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-base mb-1 truncate">
                      {resource.name}
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <span className="capitalize">{resource.type}</span>
                      {resource.downloadCount > 0 && (
                        <>
                          <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                          <span>{resource.downloadCount} download{resource.downloadCount !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                    {resource.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                        {resource.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(resource)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    {resource.type === 'link' ? (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        Open Link
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download
                      </>
                    )}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteResource(resource)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Resource Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Add Resource
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Selection */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAddType('link')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                  addType === 'link'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                }`}
              >
                <LinkIcon className="w-5 h-5" />
                Link
              </button>
              <button
                onClick={() => setAddType('file')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                  addType === 'file'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Upload className="w-5 h-5" />
                File
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {addType === 'link' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Link Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Brand Guidelines"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      URL *
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      File *
                    </label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 dark:file:bg-emerald-900/20 file:text-emerald-600 dark:file:text-emerald-400 file:cursor-pointer hover:file:bg-emerald-100 dark:hover:file:bg-emerald-900/30"
                    />
                    {file && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        {CampaignResourcesService.formatFileSize(file.size)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Brand Kit.zip"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={addType === 'link' ? handleAddLink : handleUploadFile}
                disabled={uploading || !name || (addType === 'link' ? !url : !file)}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {addType === 'link' ? 'Adding...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {addType === 'link' ? 'Add Link' : 'Upload File'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignResourcesManager;

