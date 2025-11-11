import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FolderPlus, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectService from '../services/ProjectService';
import FirebaseStorageService from '../services/FirebaseStorageService';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentOrgId, user, switchProject } = useAuth();
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrgId || !user) {
      setError('Not authenticated');
      return;
    }

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let imageUrl: string | undefined;

      // Upload image if provided
      if (imageFile) {
        setUploadingImage(true);
        try {
          imageUrl = await FirebaseStorageService.uploadProjectImage(
            currentOrgId,
            imageFile
          );
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          setError('Failed to upload image. Creating project without image.');
        } finally {
          setUploadingImage(false);
        }
      }

      const projectId = await ProjectService.createProject(currentOrgId, user.uid, {
        name: name.trim(),
        imageUrl,
      });


      // Switch to the new project
      await switchProject(projectId);

      // Reset form
      setName('');
      setImageFile(null);
      setImagePreview(null);

      if (onSuccess) {
        onSuccess();
      }

      onClose();

      // Reload to show new project
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to create project:', error);
      setError(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-white/10 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-white dark:text-black" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q4 Marketing Campaign"
              className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent transition-colors"
              maxLength={50}
              required
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {name.length}/50 characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Project Image <span className="text-gray-500 dark:text-gray-400 font-normal">(Optional)</span>
            </label>
            
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl cursor-pointer hover:border-gray-400 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Click to upload image
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </label>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Project preview"
                  className="w-full h-40 object-cover rounded-xl border border-gray-200 dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Preview
            </label>
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-white/10 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {name || 'Project Name'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {imageFile ? imageFile.name : 'No image'}
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || uploadingImage || !name.trim()}
            className="flex-1 px-4 py-3 bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadingImage ? 'Uploading...' : loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateProjectModal;
