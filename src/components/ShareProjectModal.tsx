import { useState, useEffect, useRef } from 'react';
import { Copy, ExternalLink, Check, Globe } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import AuthenticatedApiService from '../services/AuthenticatedApiService';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  projectId: string;
  projectName?: string;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface CreateShareResponse {
  success: boolean;
  token: string;
  shareUrl: string;
  message?: string;
  error?: string;
}

export default function ShareProjectModal({
  isOpen,
  onClose,
  orgId,
  projectId,
  projectName,
  onToast,
}: ShareProjectModalProps) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch (or create) the share link whenever the modal opens for a project
  useEffect(() => {
    if (!isOpen || !orgId || !projectId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setShareUrl('');
    setCopied(false);

    AuthenticatedApiService.post<CreateShareResponse>('/api/create-project-share', {
      orgId,
      projectId,
    })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.success && resp.shareUrl) {
          // Rebuild from the current frontend origin — the backend uses req.headers.host,
          // which returns localhost:3001 in dev.
          const url = `${window.location.origin}/share/${resp.token}`;
          setShareUrl(url);
        } else {
          setError(resp?.error || 'Could not create share link');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Create project share error:', err);
        setError(err?.message || 'Could not create share link');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, orgId, projectId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onToast?.('Share link copied to clipboard', 'success');
      inputRef.current?.select();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast?.('Failed to copy link', 'error');
    }
  };

  const handleOpen = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  // Input displays either the URL or a fixed-width placeholder while generating —
  // no spinner, no layout jitter while we wait.
  const inputValue = loading ? '' : error ? '' : shareUrl;
  const inputPlaceholder = loading
    ? 'Generating link…'
    : error
    ? 'Failed to create link'
    : 'https://…';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share project">
      <div className="space-y-4 pb-1">
        {/* Description */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Globe className="w-4 h-4 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-content leading-snug">
              Anyone with the link can view{' '}
              {projectName ? (
                <>
                  <span className="font-semibold">{projectName}</span>'s stats.
                </>
              ) : (
                "this project's stats."
              )}
            </p>
            <p className="text-xs text-content-muted mt-1 leading-snug">
              Read-only access to all-time metrics, top performers and tracked videos.
              No account required.
            </p>
          </div>
        </div>

        {/* Link input + copy */}
        <div>
          <label className="block text-xs font-medium text-content-muted mb-2">
            Public link
          </label>
          <div className="flex items-stretch gap-2">
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={inputValue}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              placeholder={inputPlaceholder}
              className="flex-1 min-w-0 px-3 py-2 bg-surface-secondary text-content text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 font-mono placeholder:text-content-muted placeholder:font-sans"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopy}
              disabled={!shareUrl || loading}
              className="flex items-center gap-1.5 flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
        </div>

        {/* Actions — ghost Close (no hover translate → no scrollbar jitter),
            primary Open link gives a clear CTA. Extra bottom padding keeps
            the drop shadow from clipping against the modal edge. */}
        <div className="flex items-center justify-end gap-2 pt-4 pb-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleOpen}
            disabled={!shareUrl || loading}
            className="flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            Open link
          </Button>
        </div>
      </div>
    </Modal>
  );
}
