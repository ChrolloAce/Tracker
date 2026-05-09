import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { PlatformIcon } from '../components/ui/PlatformIcon';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

interface FormFieldsSpec {
  name: { required: boolean };
  email: { required: boolean };
  phone: { required: boolean };
  notes: { required: boolean };
  handles: Record<Platform, { enabled: boolean; required: boolean }>;
}

interface FormSpec {
  project: { name: string; icon?: string; color?: string };
  welcomeMessage?: string;
  fields: FormFieldsSpec;
}

/**
 * Public Creator Signup Page — no auth required, anyone with the link can
 * fill it out. Renders dynamically from the per-project form spec returned
 * by /api/creator-signup. On submit it POSTs the same endpoint which creates
 * the creator profile + linked tracked accounts via firebase-admin.
 *
 * Success screen confirms the account was created and tells the creator
 * the admin will share their portal link separately (per discussion in the
 * spec — auto-issuing a portal token at signup is a separate decision).
 */
const CreatorSignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [spec, setSpec] = useState<FormSpec | null>(null);

  // Form state — every field is optional in shape; required-ness is enforced
  // server-side using the spec, so the client just collects whatever the
  // form asks for.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [handles, setHandles] = useState<Record<Platform, string>>({
    instagram: '',
    tiktok: '',
    youtube: '',
    twitter: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Portal URL returned by the API after a successful signup. The success
  // screen offers a "Go to your dashboard" button that opens this link
  // (the creator's own scoped public dashboard at /c/:token).
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('Missing signup link.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/creator-signup?token=${encodeURIComponent(token)}`);
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(json?.error || 'Could not load this signup form.');
        } else {
          setSpec(json.data);
        }
      } catch (e) {
        if (!cancelled) setLoadError('Network error loading the signup form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spec || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/creator-signup?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, notes, handles }),
      });
      const json = await r.json();
      if (!r.ok) {
        setSubmitError(json?.error || 'Could not submit the form.');
      } else {
        setPortalUrl(json?.data?.portalUrl || null);
        setSuccess(true);
        // Auto-redirect to the creator's portal after a brief success beat
        // so they don't have to click — same intent as the user's request
        // ("take me to their dashboard"). The CTA below is the fallback.
        const url = json?.data?.portalUrl;
        if (url) {
          setTimeout(() => { window.location.href = url; }, 1200);
        }
      }
    } catch {
      setSubmitError('Network error submitting the form.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-content">
        <Loader2 className="w-6 h-6 animate-spin text-content-muted" />
      </div>
    );
  }

  if (loadError || !spec) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-content p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold">Form unavailable</h1>
          <p className="text-sm text-content-muted">{loadError || 'Form not found.'}</p>
          <Link to="/" className="inline-block text-sm text-orange-500 hover:text-orange-400 font-semibold">
            Back to ViewTrack
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-content p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Your account has been created</h1>
          <p className="text-sm text-content-muted leading-relaxed">
            Thanks for signing up to <span className="font-semibold text-content">{spec.project.name}</span>.
            We've added you as a creator and started tracking the accounts you submitted.
            {portalUrl
              ? ' Taking you to your dashboard now…'
              : ' The team will share your portal link with you shortly.'}
          </p>
          {portalUrl ? (
            <a
              href={portalUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] active:translate-y-0.5 transition-all"
            >
              Go to your dashboard
              <ArrowRight className="w-4 h-4" />
            </a>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] active:translate-y-0.5 transition-all"
            >
              Go to ViewTrack
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  const enabledPlatforms = (Object.keys(spec.fields.handles) as Platform[])
    .filter(p => spec.fields.handles[p].enabled);

  return (
    <div className="min-h-screen bg-surface text-content py-12 px-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-lg mx-auto bg-surface-secondary border border-border rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
            {spec.project.name}
          </p>
          <h1 className="text-xl font-bold mt-1">Join as a creator</h1>
          {spec.welcomeMessage && (
            <p className="text-sm text-content-secondary mt-3 leading-relaxed whitespace-pre-line">
              {spec.welcomeMessage}
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field
            label="Name"
            required={spec.fields.name.required}
            value={name}
            onChange={setName}
          />
          <Field
            label="Email"
            type="email"
            required={spec.fields.email.required}
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Phone"
            type="tel"
            required={spec.fields.phone.required}
            value={phone}
            onChange={setPhone}
          />

          {enabledPlatforms.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-content-muted mb-2">
                Your social handles
              </div>
              <div className="space-y-2.5">
                {enabledPlatforms.map(p => (
                  <HandleField
                    key={p}
                    platform={p}
                    required={spec.fields.handles[p].required}
                    value={handles[p]}
                    onChange={(v) => setHandles(prev => ({ ...prev, [p]: v }))}
                  />
                ))}
              </div>
              <p className="text-[10px] text-content-muted mt-2">
                Paste your @handle or the full URL — we'll clean it up.
              </p>
            </div>
          )}

          {spec.fields.notes && (
            <Field
              label="Anything else?"
              required={spec.fields.notes.required}
              value={notes}
              onChange={setNotes}
              multiline
            />
          )}

          {submitError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{submitError}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-bold shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] active:shadow-[0_0_0_0_#c2410c] active:translate-y-0.5 transition-all"
          >
            {submitting ? 'Submitting…' : 'Create my account'}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}> = ({ label, value, onChange, type = 'text', required, multiline }) => (
  <div>
    <label className="block text-[11px] font-semibold text-content-muted mb-1.5">
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={3}
        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-border-strong"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-border-strong"
      />
    )}
  </div>
);

const HandleField: React.FC<{
  platform: Platform;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}> = ({ platform, value, onChange, required }) => {
  const placeholder = {
    instagram: '@yourhandle',
    tiktok: '@yourhandle',
    youtube: '@yourchannel',
    twitter: '@yourhandle',
  }[platform];
  const label = platform[0].toUpperCase() + platform.slice(1);
  return (
    <label className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg focus-within:border-border-strong">
      <PlatformIcon platform={platform} className="w-4 h-4 flex-shrink-0" />
      <span className="text-xs font-semibold text-content-muted w-16 flex-shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-content placeholder:text-content-muted focus:outline-none"
      />
      {required && <span className="text-red-400 text-xs">*</span>}
    </label>
  );
};

export default CreatorSignupPage;
