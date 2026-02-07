import React, { useState, useCallback, useEffect } from 'react';
import { X, Plus, Loader2, Trash2, CheckCircle, Link2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UrlParserService } from '../services/UrlParserService';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import CreatorLinksService from '../services/CreatorLinksService';

// Platform icons (inline SVGs for monotone theme)
const PlatformIcons: Record<string, React.FC<{ className?: string }>> = {
  instagram: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || "w-5 h-5"} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  tiktok: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || "w-5 h-5"} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  ),
  youtube: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || "w-5 h-5"} fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  twitter: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className || "w-5 h-5"} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

interface AccountInput {
  id: string;
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
  username: string | null;
  error: string | null;
}

interface CreatorAddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatorAddAccountModal: React.FC<CreatorAddAccountModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [accounts, setAccounts] = useState<AccountInput[]>([
    { id: '1', url: '', platform: null, username: null, error: null }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setAccounts([{ id: '1', url: '', platform: null, username: null, error: null }]);
      setSuccessCount(0);

      // Check clipboard
      const checkClipboard = async () => {
        try {
          const parsed = await UrlParserService.autoDetectFromClipboard();
          if (parsed?.isValid && parsed.platform) {
            const username = UrlParserService.extractUsername(parsed.url, parsed.platform);
            setAccounts([{
              id: '1',
              url: parsed.url,
              platform: parsed.platform,
              username,
              error: null
            }]);
          }
        } catch {}
      };
      checkClipboard();
    }
  }, [isOpen]);

  const handleUrlChange = useCallback((index: number, url: string) => {
    setAccounts(prev => {
      const updated = [...prev];
      updated[index].url = url;
      updated[index].error = null;

      if (!url.trim()) {
        updated[index].platform = null;
        updated[index].username = null;
        return updated;
      }

      // Auto-add https if needed
      let fullUrl = url.trim();
      if (!fullUrl.match(/^https?:\/\//)) {
        fullUrl = 'https://' + fullUrl;
      }

      const parsed = UrlParserService.parseUrl(fullUrl);
      if (parsed.platform) {
        updated[index].platform = parsed.platform;
        updated[index].username = UrlParserService.extractUsername(fullUrl, parsed.platform);
        updated[index].error = null;
      } else if (url.trim().length > 5) {
        updated[index].platform = null;
        updated[index].username = null;
        updated[index].error = 'Paste a valid Instagram, TikTok, YouTube, or X profile link';
      }

      return updated;
    });
  }, []);

  const addRow = () => {
    setAccounts(prev => [
      ...prev,
      { id: Date.now().toString(), url: '', platform: null, username: null, error: null }
    ]);
  };

  const removeRow = (index: number) => {
    if (accounts.length <= 1) return;
    setAccounts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user || !currentOrgId || !currentProjectId) return;

    // Validate all
    const validAccounts = accounts.filter(a => a.platform && a.username);
    if (validAccounts.length === 0) return;

    setSubmitting(true);
    let added = 0;

    try {
      for (const account of validAccounts) {
        try {
          // Add account to the tracking system
          const accountId = await AccountTrackingServiceFirebase.addAccount(
            currentOrgId,
            currentProjectId,
            user.uid,
            account.username!,
            account.platform!,
            'my',
            10
          );

          // Link the account to this creator
          await CreatorLinksService.linkCreatorToAccounts(
            currentOrgId,
            currentProjectId,
            user.uid,
            [accountId],
            user.uid
          );
          added++;
        } catch (err: any) {
          console.error(`Failed to add account @${account.username}:`, err);
          setAccounts(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(a => a.id === account.id);
            if (idx >= 0) {
              updated[idx].error = err.message?.includes('already') 
                ? 'Account already tracked' 
                : 'Failed to add';
            }
            return updated;
          });
        }
      }

      if (added > 0) {
        setSuccessCount(added);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const validCount = accounts.filter(a => a.platform && a.username).length;

  if (!isOpen) return null;

  // Success state
  if (successCount > 0) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#111113] rounded-2xl border border-white/10 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {successCount} account{successCount > 1 ? 's' : ''} linked!
          </h3>
          <p className="text-sm text-gray-400">Your accounts are being synced now</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111113] rounded-2xl border border-white/10 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Link Account</h2>
              <p className="text-xs text-gray-400">Paste your social media profile links</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Account Inputs */}
        <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
          {accounts.map((account, index) => (
            <div key={account.id} className="space-y-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={account.url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://instagram.com/yourname"
                    className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/20 text-sm"
                    autoFocus={index === 0}
                  />
                  {/* Platform indicator */}
                  {account.platform && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {PlatformIcons[account.platform] && 
                        React.createElement(PlatformIcons[account.platform], { className: 'w-5 h-5 text-white' })
                      }
                    </div>
                  )}
                </div>
                {accounts.length > 1 && (
                  <button
                    onClick={() => removeRow(index)}
                    className="p-3 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                  </button>
                )}
              </div>

              {/* Detected username */}
              {account.username && account.platform && (
                <div className="flex items-center gap-2 pl-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400">
                    @{account.username} on <span className="capitalize">{account.platform === 'twitter' ? 'X' : account.platform}</span>
                  </span>
                </div>
              )}

              {/* Error */}
              {account.error && (
                <div className="flex items-center gap-2 pl-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs text-red-400">{account.error}</span>
                </div>
              )}
            </div>
          ))}

          {/* Add another */}
          <button
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-2"
          >
            <Plus className="w-4 h-4" />
            Add another account
          </button>
        </div>

        {/* Supported platforms hint */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3 text-gray-600">
            <span className="text-xs">Supports:</span>
            <div className="flex items-center gap-2">
              {Object.entries(PlatformIcons).map(([key, Icon]) => (
                <Icon key={key} className="w-4 h-4" />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || validCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Link {validCount > 0 ? `${validCount} Account${validCount > 1 ? 's' : ''}` : 'Account'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatorAddAccountModal;
