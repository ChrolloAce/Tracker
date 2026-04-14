import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Camera, ArrowLeft } from 'lucide-react';
import ViralContentService from '../services/ViralContentService';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';
import { db } from '../services/firebase';

const CreateOrganizationPage: React.FC = () => {
  const { user, signInWithGoogle, switchOrganization } = useAuth();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [yourName, setYourName] = useState(user?.displayName || '');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    ViralContentService.fetchFirst(40).then(videos => {
      setThumbnails(videos.map(v => (v as any).thumbnailUrl || (v as any).thumbnail || '').filter(Boolean));
    }).catch(() => {});
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setError('');
  };

  const handleContinue = async () => {
    if (!orgName.trim()) { setError('Give your workspace a name'); return; }
    if (!yourName.trim()) { setError('We need your name'); return; }
    setError('');

    if (user) {
      await handleDirectCreate();
    } else {
      setStep(2);
    }
  };

  const handleDirectCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const newOrgId = await OrganizationService.createOrganization(user.uid, {
        name: orgName.trim(),
        email: user.email || undefined,
        displayName: yourName.trim(),
      });

      const newProjectId = await ProjectService.createProject(newOrgId, user.uid, {
        name: orgName.trim(),
      });

      if (logoPreview) {
        try {
          const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
          const { storage } = await import('../services/firebase');
          const logoRef = ref(storage, `users/${user.uid}/org-logos/${newOrgId}.jpg`);
          await uploadString(logoRef, logoPreview, 'data_url');
          const logoUrl = await getDownloadURL(logoRef);
          await setDoc(doc(db, 'organizations', newOrgId), { logoUrl }, { merge: true });
        } catch (logoErr) {
          console.error('Logo upload failed (non-critical):', logoErr);
        }
      }

      switchOrganization(newOrgId);
      await ProjectService.setActiveProject(newOrgId, user.uid, newProjectId).catch(() => {});

      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      // Store org info (no image — too large for localStorage)
      try { localStorage.removeItem('pendingOrg'); } catch {}
      localStorage.setItem('pendingOrg', JSON.stringify({
        orgName: orgName.trim(),
        yourName: yourName.trim(),
      }));
      // Store image separately in sessionStorage (larger quota, survives redirect)
      if (logoPreview) {
        try { sessionStorage.setItem('pendingOrgLogo', logoPreview); } catch { /* too large, skip */ }
      }
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F8F9FB] flex transition-opacity duration-500 ease-out"
      style={{ opacity: mounted ? 1 : 0 }}
    >
      {/* Left side — Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="max-w-md w-full mx-auto">

          {/* Step 1: Workspace info */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-snug">Track any account across all socials in <span className="text-orange-500">one synced dashboard</span> without logging in.</h1>
              <p className="text-gray-500 text-sm mb-10">Create your workspace to get started</p>

              {/* Workspace name with logo upload */}
              <div className="mb-5">
                <label className="block text-gray-700 text-sm font-medium mb-2">Workspace</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border-2 border-dashed border-gray-300 hover:border-orange-500 transition-colors flex items-center justify-center bg-gray-50 group"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </button>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => { setOrgName(e.target.value); setError(''); }}
                    placeholder="e.g. My Agency, Brand Name"
                    className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* Your name */}
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">Your name</label>
                <input
                  type="text"
                  value={yourName}
                  onChange={(e) => { setYourName(e.target.value); setError(''); }}
                  placeholder="e.g. John Smith"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                />
              </div>

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

              <button
                onClick={handleContinue}
                disabled={loading}
                className="group w-full py-3.5 bg-orange-500 text-white rounded-lg font-semibold shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {user ? 'Create Workspace' : 'Continue'}
                    <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {!user && (
                <p className="text-center text-gray-400 text-xs mt-6">
                  Already have an account? <a href="/login" className="text-orange-500 hover:underline">Sign in</a>
                </p>
              )}
            </>
          )}

          {/* Step 2: Google sign-in */}
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-sm mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="flex items-center gap-4 mb-8 p-4 bg-white rounded-xl border border-gray-200">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-11 h-11 rounded-xl object-cover" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
                    {orgName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-gray-900 font-semibold text-sm">{orgName}</p>
                  <p className="text-gray-400 text-xs">{yourName}</p>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in to continue</h1>
              <p className="text-gray-500 text-sm mb-8">Connect your Google account to create your workspace</p>

              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all text-sm flex items-center justify-center gap-3 disabled:opacity-50 border border-gray-200 shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign up with Google
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right side — Scrolling video grid */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden">
        {/* Scrolling thumbnail grid */}
        <div className="absolute inset-0">
          <style>{`
            @keyframes scrollUp { from { transform: translateY(0); } to { transform: translateY(-50%); } }
            @keyframes scrollDown { from { transform: translateY(-50%); } to { transform: translateY(0); } }
          `}</style>
          <div className="flex gap-2 h-full">
            {[0, 1, 2, 3, 4].map(col => {
              const colThumbs = thumbnails.slice(col * 8, col * 8 + 8);
              const doubled = [...colThumbs, ...colThumbs];
              const direction = col % 2 === 0 ? 'scrollUp' : 'scrollDown';
              const duration = 25 + col * 5;
              return (
                <div key={col} className="flex-1 overflow-hidden">
                  <div
                    className="flex flex-col gap-2"
                    style={{ animation: `${direction} ${duration}s linear infinite` }}
                  >
                    {doubled.map((thumb, i) => (
                      <div key={i} className="aspect-[9/16] rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                        <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />

        {/* No text on right — just the vibe */}
      </div>
    </div>
  );
};

export default CreateOrganizationPage;
