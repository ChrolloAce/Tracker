import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit3, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ProjectService from '../services/ProjectService';
import FirebaseStorageService from '../services/FirebaseStorageService';
import { Project } from '../types/projects';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSuccess?: () => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, project, onSuccess }) => {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(project.imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    setError(null);

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

    if (!currentOrgId) {
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

      let imageUrl = project.imageUrl;

      // Upload new image if provided
      if (imageFile) {
        setUploadingImage(true);
        try {
          imageUrl = await FirebaseStorageService.uploadProjectImage(
            currentOrgId,
            imageFile
          );
        } catch (uploadError) {
          console.error('Failed to upload image:', uploadError);
          setError('Failed to upload image. Updating project without new image.');
        } finally {
          setUploadingImage(false);
        }
      }

      // If image was removed (imagePreview is null but project had an image)
      if (!imagePreview && project.imageUrl) {
        imageUrl = undefined;
      }

      await ProjectService.updateProject(currentOrgId, project.id, {
        name: name.trim(),
        imageUrl,
      });


      if (onSuccess) {
        onSuccess();
      }

      onClose();

      // Reload to show updated project
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to update project:', error);
      setError(error.message || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentOrgId || !user) {
      setError('Not authenticated');
      return;
    }

    if (deleteConfirmText !== project.name) {
      setError('Project name does not match');
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      console.log(`🗑️ Deleting project "${project.name}"...`);
      
      await ProjectService.deleteProject(currentOrgId, project.id, user.uid);
      
      console.log('✅ Project deleted successfully');
      
      // Close modal
      onClose();
      
      // Navigate to dashboard and reload
      navigate('/dashboard');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      setError(error.message || 'Failed to delete project');
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Edit Project
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Update project details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q4 Marketing Campaign"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={50}
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {name.length}/50 characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Image (Optional)
            </label>
            
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 text-gray-400 mb-3" />
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
                  className="w-full h-40 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Danger Zone - Delete Project */}
          <div className="border-t border-red-200 dark:border-red-900/30 pt-6 mt-6">
            <div className="flex items-start space-x-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Deleting this project will permanently remove all data including tracked accounts, videos, links, and campaigns.
                </p>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg transition-colors"
                disabled={loading || deleting}
              >
                <Trash2 className="w-4 h-4 inline-block mr-2" />
                Delete Project
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Type "{project.name}" to confirm deletion:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={project.name}
                  className="w-full px-3 py-2 text-sm border border-red-300 dark:border-red-800 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={deleting}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteConfirmText !== project.name || deleting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-800 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              disabled={loading || deleting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage || deleting || !name.trim()}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {uploadingImage ? 'Uploading...' : loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default EditProjectModal;

