import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import CreatorLinksService from '../services/CreatorLinksService';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import CreatorShareLinkService from '../services/CreatorShareLinkService';
import { UrlParserService } from '../services/UrlParserService';
import { PlatformIcon } from './ui/PlatformIcon';
import {
  X, Check, Mail, User as UserIcon, UserPlus,
  AlertCircle, Phone, FileText, Loader2, Copy, ExternalLink,
} from 'lucide-react';

interface CreateCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedAccount {
  url: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | null;
  username: string | null;
}

function parseAccountsFromText(text: string): ParsedAccount[] {
  if (!text.trim()) return [];
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  const out: ParsedAccount[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : line;
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    const parsed = UrlParserService.parseUrl(url);
    const username = parsed.platform ? UrlParserService.extractUsername(url, parsed.platform) : null;
    out.push({ url, platform: parsed.platform, username });
  }
  return out;
}

const CreateCreatorModal: React.FC<CreateCreatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Portal options (always on — every creator gets a portal link)
  const [acceptSubmissions, setAcceptSubmissions] = useState(true);
  const [accountsInput, setAccountsInput] = useState('');

  // Success state (shows copy-link after portal creation)
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    if (shareUrl) onSuccess();
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setAcceptSubmissions(true);
    setAccountsInput('');
    setShareUrl(null);
    setCopied(false);
    setProgress(null);
    setError(null);
    onClose();
  };

  const parsedAccounts = useMemo(() => parseAccountsFromText(accountsInput), [accountsInput]);
  const validAccounts = useMemo(() => parsedAccounts.filter(a => a.platform && a.username), [parsedAccounts]);
  const invalidAccounts = useMemo(() => parsedAccounts.filter(a => !a.platform || !a.username), [parsedAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrgId || !currentProjectId) {
      setError('Missing required information');
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (invalidAccounts.length > 0) {
      setError('Some account URLs could not be recognized. Fix or remove them.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      setProgress('Creating creator profile...');
      const creatorId = await CreatorLinksService.addCreatorProfile(
        currentOrgId,
        currentProjectId,
        user.uid,
        {
          name: name.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }
      );

      // Track accounts if any were provided
      if (validAccounts.length > 0) {
        const createdAccountIds: string[] = [];
        for (let i = 0; i < validAccounts.length; i++) {
          const acc = validAccounts[i];
          setProgress(`Tracking account ${i + 1} of ${validAccounts.length}: @${acc.username}`);
          try {
            const id = await AccountTrackingServiceFirebase.addAccount(
              currentOrgId, currentProjectId, user.uid,
              acc.username!, acc.platform!, 'my', 100
            );
            createdAccountIds.push(id);
          } catch (err: any) {
            console.warn(`Failed to add account @${acc.username}:`, err);
          }
        }
        if (createdAccountIds.length > 0) {
          setProgress('Linking accounts to creator...');
          await CreatorLinksService.linkCreatorToAccounts(
            currentOrgId, currentProjectId, creatorId, createdAccountIds, user.uid
          );
        }
      }

      // Always mint the share link — every creator gets a portal
      setProgress('Generating portal link...');
      const { shareUrl: newShareUrl } = await CreatorShareLinkService.create({
        orgId: currentOrgId,
        projectId: currentProjectId,
        creatorId,
        acceptSubmissions,
      });
      setShareUrl(newShareUrl);
      setProgress(null);
    } catch (error: any) {
      console.error('Failed to add creator:', error);
      setError(error.message || 'Failed to add creator');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

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

  const isSubmitDisabled = !name.trim() || loading || invalidAccounts.length > 0;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-secondary rounded-2xl border border-border w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-content rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-content-inverse" />
            </div>
            <h2 className="text-xl font-semibold text-content">
              {shareUrl ? 'Portal Link Ready' : 'Add Creator'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 text-content-muted hover:text-content hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {shareUrl ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-content mb-1">{name} is ready</h3>
              <p className="text-sm text-content-muted">
                Share this link with the creator. Anyone with it can see their dashboard.
              </p>
            </div>

            <div className="bg-surface-tertiary border border-border rounded-xl p-4 mb-4">
              <label className="block text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                Portal Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2.5 bg-surface-secondary border border-border rounded-lg text-content text-xs font-mono focus:outline-none focus:ring-2 focus:ring-border-strong"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2.5 bg-content text-content-inverse rounded-lg font-semibold text-sm hover:opacity-90 transition-all whitespace-nowrap"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-surface-tertiary border border-border rounded-lg text-sm font-medium text-content-secondary hover:text-content hover:bg-surface-hover transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Preview in new tab
            </a>

            <div className="mt-6 pt-5 border-t border-border">
              <button
                onClick={handleClose}
                className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-400">{error}</div>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Creator's full name"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Email <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="creator@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Phone <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-content mb-2">
                  Notes <span className="text-content-muted font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-content-muted" />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this creator..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 bg-surface-secondary border border-border rounded-xl text-content placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong focus:border-transparent transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Portal Options — always shown, every creator gets a link */}
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4 p-4 bg-surface-tertiary rounded-xl border border-border">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-content">Allow creator to submit videos</p>
                    <p className="text-[11px] text-content-muted mt-0.5">
                      Shows a "Submit Video" button on their portal page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcceptSubmissions(!acceptSubmissions)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
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

                <div>
                  <label className="block text-sm font-semibold text-content mb-2">
                    Accounts to Track <span className="text-content-muted font-normal">(Optional)</span>
                  </label>
                  <p className="text-[11px] text-content-muted mb-2">
                    Paste social media account URLs — one per line.
                  </p>
                  <textarea
                    value={accountsInput}
                    onChange={(e) => setAccountsInput(e.target.value)}
                    rows={3}
                    placeholder={'https://www.tiktok.com/@username\nhttps://www.instagram.com/username'}
                    className="w-full px-3 py-3 bg-surface-secondary border border-border rounded-xl text-content text-[13px] font-mono placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-border-strong transition-colors resize-none"
                  />
                  {parsedAccounts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {validAccounts.map((a) => (
                        <div key={a.url} className="flex items-center gap-2 text-[12px] text-content-secondary">
                          <PlatformIcon platform={a.platform as any} size="sm" />
                          <span className="font-mono truncate">@{a.username}</span>
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        </div>
                      ))}
                      {invalidAccounts.map((a) => (
                        <div key={a.url} className="flex items-center gap-2 text-[12px] text-red-400">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="font-mono truncate">{a.url}</span>
                          <span className="text-red-300">unrecognized</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {progress && (
                <div className="flex items-center gap-2 text-[12px] text-content-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progress}</span>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-border">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-surface-secondary text-content border border-border rounded-lg shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create & Get Link'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CreateCreatorModal;
