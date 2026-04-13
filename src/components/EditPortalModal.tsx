import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import CreatorShareLinkService from '../services/CreatorShareLinkService';
import { OrgMember, Creator } from '../types/firestore';
import { X, Copy, Check, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';

interface EditPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  creator: OrgMember;
  profile: Creator | undefined;
}

/**
 * EditPortalModal
 *
 * Small modal for managing an existing creator's portal link:
 *   - Copy the share URL
 *   - Toggle video submissions on/off
 *   - Revoke access (deletes the link)
 *
 * If the creator doesn't have a portal yet, shows a "Create Portal" button
 * that mints a new share link.
 */
const EditPortalModal: React.FC<EditPortalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  creator,
  profile,
}) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [acceptSubmissions, setAcceptSubmissions] = useState(true);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const token = profile?.externalShareToken;

  // Build URL from token on mount
  useEffect(() => {
    if (token) {
      const host = window.location.host;
      const protocol = window.location.protocol;
      setShareUrl(`${protocol}//${host}/c/${token}`);
    } else {
      setShareUrl(null);
    }
  }, [token]);

  // Fetch current acceptSubmissions state from the share link doc
  useEffect(() => {
    if (!token) return;
    // We read this from the public endpoint since it's fast and avoids a new API
    fetch(`/api/public-creator-share?token=${token}`)
      .then(r => r.json())
      .then(body => {
        if (body.success) {
          setAcceptSubmissions(body.data.acceptSubmissions !== false);
        }
      })
      .catch(() => {}); // non-critical
  }, [token]);

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

  const handleCreatePortal = async () => {
    if (!currentOrgId || !currentProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const { shareUrl: newUrl } = await CreatorShareLinkService.create({
        orgId: currentOrgId,
        projectId: currentProjectId,
        creatorId: creator.userId,
        acceptSubmissions: true,
      });
      setShareUrl(newUrl);
      setAcceptSubmissions(true);
      onSuccess(); // refresh parent data so profile.externalShareToken is set
    } catch (err: any) {
      setError(err.message || 'Failed to create portal');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubmissions = async () => {
    if (!currentOrgId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const newValue = !acceptSubmissions;
      await CreatorShareLinkService.update({
        orgId: currentOrgId,
        token,
        acceptSubmissions: newValue,
      });
      setAcceptSubmissions(newValue);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    setError(null);
    try {
      await CreatorShareLinkService.revoke({
        orgId: currentOrgId,
        creatorId: creator.userId,
      });
      setShareUrl(null);
      setShowRevokeConfirm(false);
      onSuccess(); // refresh parent
    } catch (err: any) {
      setError(err.message || 'Failed to revoke');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasPortal = !!shareUrl;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-secondary rounded-2xl border border-border w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-content">
              {hasPortal ? 'Edit Portal' : 'Create Portal'}
            </h2>
            <p className="text-xs text-content-muted mt-0.5">
              {creator.displayName || creator.email}
            </p>
          </div>
          <button
            onClick={onClose}
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

          {!hasPortal ? (
            /* No portal yet — offer to create one */
            <div className="text-center py-4">
              <p className="text-sm text-content-muted mb-4">
                This creator doesn't have a portal yet. Create one to generate a shareable link.
              </p>
              <button
                onClick={handleCreatePortal}
                disabled={loading}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create Portal
              </button>
            </div>
          ) : (
            <>
              {/* Share link */}
              <div>
                <label className="block text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                  Portal Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl || ''}
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
                  href={shareUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-content-muted hover:text-content transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview in new tab
                </a>
              </div>

              {/* Submissions toggle */}
              <div className="flex items-start justify-between gap-4 p-4 bg-surface-tertiary rounded-xl border border-border">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-content">Video submissions</p>
                  <p className="text-[11px] text-content-muted mt-0.5">
                    {acceptSubmissions
                      ? 'Creator can submit videos from their portal.'
                      : 'Only admins can add videos for this creator.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSubmissions}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                    acceptSubmissions ? 'bg-orange-500' : 'bg-surface-hover'
                  }`}
                  role="switch"
                  aria-checked={acceptSubmissions}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                    acceptSubmissions ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Revoke */}
              {!showRevokeConfirm ? (
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="w-full px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-colors"
                >
                  Revoke portal access
                </button>
              ) : (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                  <p className="text-sm text-red-300">
                    The existing link will stop working immediately. You can create a new one later.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRevokeConfirm(false)}
                      disabled={loading}
                      className="flex-1 px-3 py-2 text-sm font-medium text-content bg-surface-secondary border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRevoke}
                      disabled={loading}
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Revoke
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditPortalModal;
