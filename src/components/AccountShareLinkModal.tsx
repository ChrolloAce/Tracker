import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import AccountShareLinkService from '../services/AccountShareLinkService';
import { TrackedAccount } from '../types/firestore';
import { X, Copy, Check, ExternalLink, AlertTriangle, Loader2, Link2 } from 'lucide-react';

interface AccountShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: TrackedAccount;
}

/**
 * AccountShareLinkModal — super-admin-only modal to mint/manage a public
 * share link for a single tracked account. Used for marketing/demo.
 *
 * Opens with a loading state, auto-mints (or fetches existing) link on
 * mount, then shows the copy-link UI with a revoke button.
 */
const AccountShareLinkModal: React.FC<AccountShareLinkModalProps> = ({
  isOpen,
  onClose,
  account,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Mint (or fetch existing) link on open
  useEffect(() => {
    if (!isOpen || !currentOrgId || !currentProjectId) return;
    setLoading(true);
    setError(null);
    AccountShareLinkService.create({
      orgId: currentOrgId,
      projectId: currentProjectId,
      accountId: account.id,
    })
      .then((result) => {
        setShareUrl(result.shareUrl);
        setToken(result.token);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to create share link');
      })
      .finally(() => setLoading(false));
  }, [isOpen, currentOrgId, currentProjectId, account.id]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy this link:', shareUrl);
    }
  };

  const handleRevoke = async () => {
    if (!currentOrgId || !token) return;
    setRevoking(true);
    setError(null);
    try {
      await AccountShareLinkService.revoke({ orgId: currentOrgId, token });
      setShareUrl(null);
      setToken(null);
      setShowRevokeConfirm(false);
      // Close after a brief delay so the user sees the action completed
      setTimeout(() => onClose(), 500);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke share link');
    } finally {
      setRevoking(false);
    }
  };

  const handleClose = () => {
    setShowRevokeConfirm(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="bg-surface-secondary rounded-2xl border border-border w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-content rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-content-inverse" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-content">Share Account Dashboard</h2>
              <p className="text-xs text-content-muted mt-0.5 truncate">@{account.username}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-content-muted animate-spin" />
            </div>
          ) : shareUrl ? (
            <>
              <div>
                <p className="text-sm text-content-muted mb-3">
                  Anyone with this link can see a public dashboard of this account's tracked videos and stats.
                </p>

                <label className="block text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                  Share Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 px-3 py-2.5 bg-surface-tertiary border border-border rounded-lg text-content text-xs font-mono focus:outline-none focus:ring-2 focus:ring-border-strong"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-content text-content-inverse rounded-lg font-semibold text-sm hover:opacity-90 transition-all whitespace-nowrap"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-content-muted hover:text-content transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview in new tab
                </a>
              </div>

              {!showRevokeConfirm ? (
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="w-full px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-colors"
                >
                  Revoke link
                </button>
              ) : (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                  <p className="text-sm text-red-300">
                    The existing link will stop working immediately.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRevokeConfirm(false)}
                      disabled={revoking}
                      className="flex-1 px-3 py-2 text-sm font-medium text-content bg-surface-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRevoke}
                      disabled={revoking}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Revoke
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-content-muted">No active share link.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AccountShareLinkModal;
