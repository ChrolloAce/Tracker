import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Link as LinkIcon, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FirestoreDataService from '../services/FirestoreDataService';
import CreatorLinksService from '../services/CreatorLinksService';
import { TrackedAccount, Creator } from '../types/firestore';
import { PlatformIcon } from './ui/PlatformIcon';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string, subdomain?: string) => void;
  editingLink?: any | null;
  preselectedAccountId?: string; // Account ID to pre-select and lock
}

const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ isOpen, onClose, onCreate, editingLink, preselectedAccountId }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [originalUrl, setOriginalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<string>('');
  const [linkedCreatorId, setLinkedCreatorId] = useState<string>('');
  const [linkToType, setLinkToType] = useState<'account' | 'creator'>('account');
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Populate fields when editing or preselecting
  useEffect(() => {
    if (editingLink) {
      setOriginalUrl(editingLink.originalUrl || '');
      setTitle(editingLink.title || '');
      setSubdomain(editingLink.subdomain || '');
      setLinkedAccountId(editingLink.linkedAccountId || '');
    } else if (preselectedAccountId) {
      // Set preselected account when creating from account detail view
      setLinkedAccountId(preselectedAccountId);
      setOriginalUrl('');
      setTitle('');
      setSubdomain('');
    } else {
      // Reset fields when creating new link
      setOriginalUrl('');
      setTitle('');
      setSubdomain('');
      setLinkedAccountId('');
    }
  }, [editingLink, preselectedAccountId]);

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen && currentOrgId && currentProjectId) {
      FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId)
        .then(setAccounts)
        .catch(err => console.error('Failed to load accounts:', err));
      CreatorLinksService.getAllCreators(currentOrgId, currentProjectId)
        .then(setCreators)
        .catch(err => console.error('Failed to load creators:', err));
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

  const handleSubmit = (e: React.FormEvent) => {
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

    // Sanitize subdomain: lowercase, alphanumeric + hyphens only
    const cleanSubdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    onCreate(
      formattedUrl,
      title.trim(),
      undefined, // description removed
      undefined, // tags removed
      linkedAccountId || undefined,
      cleanSubdomain || undefined
    );

    // Reset form
    setOriginalUrl('');
    setTitle('');
    setSubdomain('');
    setLinkedAccountId('');
    setIsDropdownOpen(false);
  };

  const selectedAccount = accounts.find(acc => acc.id === linkedAccountId);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-content">
              {editingLink ? 'Edit Tracked Link' : 'Create Tracked Link'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-content-muted" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Branded Subdomain (optional) */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Brand Name <span className="text-content-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="yourbrand"
              className="w-full px-4 py-2 border border-border rounded-lg bg-surface-secondary text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {subdomain.trim() ? (
              <p className="mt-1.5 text-xs text-orange-400 font-mono">
                {subdomain.trim().toLowerCase()}.viewtrack.app/<span className="text-content-muted">shortcode</span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-content-muted">
                Creates a branded link like <span className="font-mono">yourbrand.viewtrack.app/abc123</span>
              </p>
            )}
          </div>

          {/* Original URL */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Destination URL *
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input
                type="text"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="example.com/page or apps.apple.com/..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface-secondary text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Campaign Link"
              className="w-full px-4 py-2 border border-border rounded-lg bg-surface-secondary text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Link to Account or Creator */}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              Assign to (optional)
            </label>
            {/* Toggle */}
            <div className="flex gap-1 mb-3 p-1 bg-surface-tertiary rounded-lg border border-border">
              <button
                type="button"
                onClick={() => { setLinkToType('account'); setLinkedCreatorId(''); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${linkToType === 'account' ? 'bg-content text-content-inverse shadow-sm' : 'text-content-muted hover:text-content'}`}
              >
                Account
              </button>
              <button
                type="button"
                onClick={() => { setLinkToType('creator'); setLinkedAccountId(''); }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${linkToType === 'creator' ? 'bg-content text-content-inverse shadow-sm' : 'text-content-muted hover:text-content'}`}
              >
                Creator
              </button>
            </div>
            {linkToType === 'creator' ? (
              /* Creator Dropdown */
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 border border-border rounded-lg bg-surface-secondary text-content hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {linkedCreatorId ? (() => {
                    const c = creators.find(cr => cr.id === linkedCreatorId);
                    return c ? (
                      <div className="flex items-center gap-3">
                        {c.photoURL ? (
                          <img src={c.photoURL} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{c.displayName?.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <span className="text-sm">{c.displayName}</span>
                      </div>
                    ) : <span className="text-content-muted">None</span>;
                  })() : (
                    <span className="text-content-muted">Select a creator</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-surface-secondary border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <button type="button" onClick={() => { setLinkedCreatorId(''); setIsDropdownOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors">
                      <span className="text-content-muted">None</span>
                      {!linkedCreatorId && <Check className="w-4 h-4 text-content" />}
                    </button>
                    {creators.map(c => (
                      <button key={c.id} type="button" onClick={() => { setLinkedCreatorId(c.id); setIsDropdownOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors">
                        <div className="flex items-center gap-3">
                          {c.photoURL ? (
                            <img src={c.photoURL} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                              <span className="text-xs font-bold text-white">{c.displayName?.charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <span className="text-sm text-content">{c.displayName}</span>
                        </div>
                        {linkedCreatorId === c.id && <Check className="w-4 h-4 text-content" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
            /* Account Dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => !preselectedAccountId && setIsDropdownOpen(!isDropdownOpen)}
                disabled={!!preselectedAccountId}
                className={`w-full flex items-center justify-between px-4 py-2 border border-border rounded-lg ${
                  preselectedAccountId
                    ? 'bg-surface-tertiary cursor-not-allowed opacity-75'
                    : 'bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-surface-hover'
                } text-content`}
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
                      <div className="w-6 h-6 rounded-full bg-surface-tertiary flex items-center justify-center">
                        <span className="text-xs font-bold text-content">
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
                  <span className="text-content-muted">None</span>
                )}
                {!preselectedAccountId && (
                  <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-surface-secondary border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedAccountId('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors"
                  >
                    <span className="text-content-muted">None</span>
                    {!linkedAccountId && <Check className="w-4 h-4 text-content" />}
                  </button>
                  {accounts.map(account => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setLinkedAccountId(account.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {account.profilePicture ? (
                          <img
                            src={account.profilePicture}
                            alt={account.username}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-surface-tertiary flex items-center justify-center">
                            <span className="text-xs font-bold text-content">
                              {account.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-content">@{account.username}</span>
                          <PlatformIcon platform={account.platform} size="sm" />
                        </div>
                      </div>
                      {linkedAccountId === account.id && <Check className="w-4 h-4 text-content" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
            <p className="mt-1 text-xs text-content-muted">
              {linkToType === 'creator' ? 'Attribute link clicks to a creator' : 'Attribute link clicks to a tracked account'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-content-secondary hover:bg-surface-hover rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
            >
              {editingLink ? 'Update Link' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateLinkModal;
