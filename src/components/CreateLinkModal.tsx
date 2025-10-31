import React, { useState, useEffect, useRef } from 'react';
import { X, Link as LinkIcon, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FirestoreDataService from '../services/FirestoreDataService';
import { TrackedAccount } from '../types/firestore';
import { PlatformIcon } from './ui/PlatformIcon';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string) => void;
  editingLink?: any | null;
  preselectedAccountId?: string; // Account ID to pre-select and lock
}

const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ isOpen, onClose, onCreate, editingLink, preselectedAccountId }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [originalUrl, setOriginalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Populate fields when editing or preselecting
  useEffect(() => {
    if (editingLink) {
      setOriginalUrl(editingLink.originalUrl || '');
      setTitle(editingLink.title || '');
      setLinkedAccountId(editingLink.linkedAccountId || '');
    } else if (preselectedAccountId) {
      // Set preselected account when creating from account detail view
      setLinkedAccountId(preselectedAccountId);
      setOriginalUrl('');
      setTitle('');
    } else {
      // Reset fields when creating new link
      setOriginalUrl('');
      setTitle('');
      setLinkedAccountId('');
    }
  }, [editingLink, preselectedAccountId]);

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId)
        .then(setAccounts)
        .catch(err => console.error('Failed to load accounts:', err));
    }
  }, [isOpen, currentOrgId, currentProjectId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Auto-add https:// if protocol is missing
    let formattedUrl = originalUrl.trim();
    if (formattedUrl && !formattedUrl.match(/^[a-zA-Z]+:\/\//)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    // Validate URL
    try {
      new URL(formattedUrl);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    // Call onCreate and wait for it to complete
    try {
      await onCreate(
        formattedUrl,
        title.trim(),
        undefined, // description removed
        undefined, // tags removed
        linkedAccountId || undefined
      );

      // Reset form
      setOriginalUrl('');
      setTitle('');
      setLinkedAccountId('');
      setIsDropdownOpen(false);
      
      // Close modal after successful creation
      onClose();
    } catch (error) {
      console.error('Failed to create link:', error);
      setError('Failed to create link. Please try again.');
    }
  };

  const selectedAccount = accounts.find(acc => acc.id === linkedAccountId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#161616] rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {editingLink ? 'Edit Tracked Link' : 'Create Tracked Link'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Original URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Destination URL *
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="example.com/page or apps.apple.com/..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Campaign Link"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Linked Account - Custom Dropdown with Profile Pictures */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link to Account (optional)
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => !preselectedAccountId && setIsDropdownOpen(!isDropdownOpen)}
                disabled={!!preselectedAccountId}
                className={`w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg ${
                  preselectedAccountId 
                    ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed opacity-75' 
                    : 'bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 dark:hover:bg-gray-750'
                } text-gray-900 dark:text-white`}
              >
                {selectedAccount ? (
                  <div className="flex items-center gap-3">
                    {selectedAccount.profilePicture ? (
                      <img
                        src={selectedAccount.profilePicture}
                        alt={selectedAccount.username}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {selectedAccount.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm">@{selectedAccount.username}</span>
                      <PlatformIcon platform={selectedAccount.platform} size="sm" />
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">None</span>
                )}
                {!preselectedAccountId && (
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedAccountId('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-gray-500 dark:text-gray-400">None</span>
                    {!linkedAccountId && <Check className="w-4 h-4 text-gray-900 dark:text-white" />}
                  </button>
                  {accounts.map(account => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setLinkedAccountId(account.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {account.profilePicture ? (
                          <img
                            src={account.profilePicture}
                            alt={account.username}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {account.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white">@{account.username}</span>
                          <PlatformIcon platform={account.platform} size="sm" />
                        </div>
                      </div>
                      {linkedAccountId === account.id && <Check className="w-4 h-4 text-gray-900 dark:text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Attribute link clicks to a tracked account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              {editingLink ? 'Update Link' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLinkModal;
