import React, { useEffect, useState } from 'react';
import { X, Copy, Link as LinkIcon, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../services/firebase';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

interface FormFieldsSpec {
  name: { required: boolean };
  email: { required: boolean };
  phone: { required: boolean };
  notes: { required: boolean };
  handles: Record<Platform, { enabled: boolean; required: boolean }>;
}

interface SignupFormConfig {
  enabled: boolean;
  fields: FormFieldsSpec;
  welcomeMessage: string;
  token: string | null;
  shareUrl: string | null;
  submitCount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_FIELDS: FormFieldsSpec = {
  name: { required: true },
  email: { required: false },
  phone: { required: false },
  notes: { required: false },
  handles: {
    instagram: { enabled: true, required: false },
    tiktok: { enabled: true, required: false },
    youtube: { enabled: true, required: false },
    twitter: { enabled: false, required: false },
  },
};

/**
 * Admin modal for the per-project Creator Signup form.
 *
 * Owns the configuration document at
 * /organizations/{orgId}/projects/{projectId}/creatorSignupForms/default
 * via /api/creator-signup-config (GET on open, POST on save). Toggles which
 * fields the public form requests, mints a public token on first enable,
 * and surfaces a copy-link CTA. The public submission endpoint
 * /api/creator-signup is rendered by CreatorSignupPage at /creator-signup?t=…
 */
export const CreatorSignupFormModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SignupFormConfig | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentOrgId || !currentProjectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(
          `/api/creator-signup-config?orgId=${encodeURIComponent(currentOrgId)}&projectId=${encodeURIComponent(currentProjectId)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          console.error('Failed to load signup form config', json);
          alert(json?.error || 'Failed to load form config');
        } else {
          setConfig(json.data);
        }
      } catch (e) {
        console.error('Failed to load signup form config', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, currentOrgId, currentProjectId]);

  const save = async (patch: Partial<SignupFormConfig>) => {
    if (!currentOrgId || !currentProjectId) return;
    const next: SignupFormConfig = {
      ...(config || { enabled: false, fields: DEFAULT_FIELDS, welcomeMessage: '', token: null, shareUrl: null, submitCount: 0 }),
      ...patch,
    };
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch('/api/creator-signup-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orgId: currentOrgId,
          projectId: currentProjectId,
          enabled: next.enabled,
          fields: next.fields,
          welcomeMessage: next.welcomeMessage,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        alert(json?.error || 'Failed to save form');
      } else {
        setConfig({ ...next, ...json.data });
      }
    } catch (e: any) {
      console.error('Failed to save signup form', e);
      alert(`Failed to save: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!config?.shareUrl) return;
    await navigator.clipboard.writeText(config.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-content">Creator signup form</h2>
            <p className="text-xs text-content-muted mt-0.5">
              Share one public link — anyone who fills it out becomes a creator with linked accounts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !config ? (
          <div className="p-10 text-center text-sm text-content-muted">Loading…</div>
        ) : (
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Enable toggle */}
            <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-surface-secondary">
              <div className="min-w-0">
                <div className="text-sm font-bold text-content">Form enabled</div>
                <p className="text-[11px] text-content-muted mt-0.5">
                  When off, the public link returns "form disabled". Re-enabling reuses the same URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => save({ enabled: !config.enabled })}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                  config.enabled ? 'bg-emerald-500' : 'bg-surface-tertiary'
                }`}
                aria-pressed={config.enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    config.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Share URL */}
            {config.shareUrl && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider">
                  Public link
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface-secondary border border-border rounded-lg text-xs font-mono text-content-secondary truncate">
                    <LinkIcon className="w-3.5 h-3.5 flex-shrink-0 text-content-muted" />
                    <span className="truncate">{config.shareUrl}</span>
                  </div>
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={config.shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg border border-border hover:bg-surface-hover text-content-muted hover:text-content"
                    title="Open form in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                {config.submitCount > 0 && (
                  <p className="text-[11px] text-content-muted">
                    {config.submitCount} creator{config.submitCount === 1 ? '' : 's'} signed up via this form
                  </p>
                )}
              </div>
            )}

            {/* Welcome message */}
            <div>
              <label className="block text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-1.5">
                Welcome message (optional)
              </label>
              <textarea
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                onBlur={() => save({ welcomeMessage: config.welcomeMessage })}
                rows={3}
                placeholder="Tell creators what they're signing up for…"
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-border-strong"
              />
            </div>

            {/* Field requireds */}
            <div>
              <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                Fields
              </div>
              <div className="space-y-1.5">
                {([
                  { key: 'name',  label: 'Name',  alwaysShown: true  },
                  { key: 'email', label: 'Email', alwaysShown: false },
                  { key: 'phone', label: 'Phone', alwaysShown: false },
                  { key: 'notes', label: 'Notes', alwaysShown: false },
                ] as const).map(f => (
                  <FieldToggleRow
                    key={f.key}
                    label={f.label}
                    required={config.fields[f.key].required}
                    canDisable={!f.alwaysShown}
                    onChangeRequired={(req) => {
                      const nextFields: FormFieldsSpec = {
                        ...config.fields,
                        [f.key]: { required: req },
                      };
                      setConfig({ ...config, fields: nextFields });
                      save({ fields: nextFields });
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Platform handles */}
            <div>
              <div className="text-[11px] font-semibold text-content-muted uppercase tracking-wider mb-2">
                Social handles to ask for
              </div>
              <div className="space-y-1.5">
                {(['instagram', 'tiktok', 'youtube', 'twitter'] as Platform[]).map(p => (
                  <HandleToggleRow
                    key={p}
                    platform={p}
                    enabled={config.fields.handles[p].enabled}
                    required={config.fields.handles[p].required}
                    onChange={(enabled, required) => {
                      const nextFields: FormFieldsSpec = {
                        ...config.fields,
                        handles: {
                          ...config.fields.handles,
                          [p]: { enabled, required: enabled ? required : false },
                        },
                      };
                      setConfig({ ...config, fields: nextFields });
                      save({ fields: nextFields });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FieldToggleRow: React.FC<{
  label: string;
  required: boolean;
  canDisable: boolean;
  onChangeRequired: (required: boolean) => void;
}> = ({ label, required, canDisable, onChangeRequired }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-secondary border border-border-subtle">
    <span className="text-sm text-content">{label}</span>
    <label className="inline-flex items-center gap-1.5 text-[11px] text-content-muted cursor-pointer">
      <input
        type="checkbox"
        checked={required}
        onChange={(e) => onChangeRequired(e.target.checked)}
        className="w-3.5 h-3.5 accent-orange-500"
      />
      Required
    </label>
    {!canDisable && null}
  </div>
);

const HandleToggleRow: React.FC<{
  platform: Platform;
  enabled: boolean;
  required: boolean;
  onChange: (enabled: boolean, required: boolean) => void;
}> = ({ platform, enabled, required, onChange }) => {
  const label = platform[0].toUpperCase() + platform.slice(1);
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${enabled ? 'bg-surface-secondary border-border-subtle' : 'bg-surface-tertiary/40 border-border-subtle opacity-60'}`}>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked, required)}
          className="w-3.5 h-3.5 accent-orange-500"
        />
        <span className="text-sm text-content">{label}</span>
      </label>
      <label className={`inline-flex items-center gap-1.5 text-[11px] text-content-muted ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
        <input
          type="checkbox"
          checked={required}
          disabled={!enabled}
          onChange={(e) => onChange(enabled, e.target.checked)}
          className="w-3.5 h-3.5 accent-orange-500"
        />
        Required
      </label>
    </div>
  );
};

export default CreatorSignupFormModal;
