import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Upload, X, Check, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import FirebaseStorageService from '../services/FirebaseStorageService';
import { clsx } from 'clsx';

interface OnboardingData {
  name: string;
  website: string;
  slug: string;
  logoFile: File | null;
  logoPreview: string | null;
  teamEmails: string[];
  businessType: string;
  referralSource: string;
}

const OrganizationOnboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [data, setData] = useState<OnboardingData>({
    name: '',
    website: '',
    slug: '',
    logoFile: null,
    logoPreview: null,
    teamEmails: [],
    businessType: '',
    referralSource: ''
  });

  const [currentEmail, setCurrentEmail] = useState('');
  const [currentRole, setCurrentRole] = useState('member');

  const totalSteps = 3;

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setData({
      ...data,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    });
  };

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setData({
          ...data,
          logoFile: file,
          logoPreview: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setData({
      ...data,
      logoFile: null,
      logoPreview: null
    });
  };

  // Team member management
  const handleAddTeamMember = () => {
    if (currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      setData({
        ...data,
        teamEmails: [...data.teamEmails, currentEmail]
      });
      setCurrentEmail('');
    }
  };

  const handleRemoveTeamMember = (email: string) => {
    setData({
      ...data,
      teamEmails: data.teamEmails.filter(e => e !== email)
    });
  };

  // Business type options
  const businessTypes = [
    { id: 'mobile-app', label: 'Mobile App', icon: '📱' },
    { id: 'marketing-agency', label: 'Marketing Agency', icon: '🏢' },
    { id: 'ecommerce', label: 'Ecommerce Brand', icon: '🛍️' },
    { id: 'saas', label: 'SaaS', icon: '💻' },
    { id: 'content-creator', label: 'Content Creator', icon: '🎬' },
    { id: 'other', label: 'Other', icon: '✨' }
  ];

  // Referral sources
  const referralSources = [
    { id: 'twitter', label: 'Twitter', icon: '𝕏' },
    { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { id: 'google', label: 'Google', icon: '🔍' },
    { id: 'friend', label: 'Friend or Colleague', icon: '👥' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'other', label: 'Other', icon: '💡' }
  ];

  // Validate current step
  const canProceed = () => {
    if (step === 1) {
      return data.name.trim().length > 0 && data.slug.trim().length > 0;
    }
    if (step === 2) {
      return true; // Team invites are optional
    }
    if (step === 3) {
      return true; // Personalization is optional
    }
    return false;
  };

  const handleNext = () => {
    if (canProceed() && step < totalSteps) {
      setStep(step + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Upload logo if provided
      let logoUrl: string | undefined;
      if (data.logoFile) {
        logoUrl = await FirebaseStorageService.uploadOrganizationLogo(user.uid, data.logoFile);
      }

      // Build organization data (only include defined fields)
      const orgData: any = {
        name: data.name,
        slug: data.slug
      };
      
      if (data.website && data.website.trim()) {
        orgData.website = data.website;
      }
      
      if (logoUrl) {
        orgData.logoUrl = logoUrl;
      }
      
      // Build metadata (only include defined fields)
      const metadata: any = {
        onboardingCompletedAt: new Date().toISOString()
      };
      
      if (data.businessType && data.businessType.trim()) {
        metadata.businessType = data.businessType;
      }
      
      if (data.referralSource && data.referralSource.trim()) {
        metadata.referralSource = data.referralSource;
      }
      
      orgData.metadata = metadata;
      orgData.email = user.email;
      orgData.displayName = user.displayName;

      // Create organization
      await OrganizationService.createOrganization(user.uid, orgData);

      // TODO: Send team invites if any
      if (data.teamEmails.length > 0) {
        // Implement team invite logic here
      }

      // Navigate to create project page (context will update via Firebase listeners)
      navigate('/create-project');
    } catch (error: any) {
      console.error('Failed to create organization:', error);
      setError(error.message || 'Failed to create organization');
      setLoading(false);
    }
  };

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left Panel - Gradient Branding */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-8">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            {step === 1 && 'Create Your Organization'}
            {step === 2 && 'Build Your Team'}
            {step === 3 && 'Personalize Your Workspace'}
          </h2>
          <p className="text-white/80 text-lg mb-8">
            {step === 1 && 'Set up your workspace and start tracking social media analytics'}
            {step === 2 && 'Invite team members to collaborate on campaigns and content'}
            {step === 3 && 'Tell us about your business to get personalized recommendations'}
          </p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Step {step} of {totalSteps}</span>
              <span className="text-white/70">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
                </div>
          </div>
        </div>

        {/* Bottom Feature List */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span>Track unlimited social accounts</span>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span>Real-time analytics and insights</span>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span>Team collaboration tools</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form Content */}
      <div className="w-full lg:w-7/12 xl:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-2xl">
          {/* Mobile Header (hidden on desktop) */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Create Organization</h1>
            <div className="flex items-center justify-center gap-2 mt-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className={clsx(
                  "h-2 rounded-full transition-all duration-300",
                  s === step ? "w-12 bg-emerald-500" : s < step ? "w-8 bg-gray-600" : "w-8 bg-gray-800"
                )} />
              ))}
            </div>
        </div>

          {/* Form Card */}
          <div className="bg-[#161616] rounded-2xl border border-gray-800/50 p-8 shadow-2xl">
          {/* Step 1: Organization Details */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website <span className="text-gray-500">Optional</span>
                </label>
                <input
                  type="url"
                  value={data.website}
                  onChange={(e) => setData({ ...data, website: e.target.value })}
                  placeholder="https://acme.com"
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your project's website URL to automatically fill in details.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is the name that will be displayed to your team members.
                </p>
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.slug}
                  onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="acme-inc"
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used in shared and public links.
                </p>
              </div>

              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Logo
                </label>
                <div className="border-2 border-dashed border-gray-800 rounded-lg p-6 text-center hover:border-gray-700 transition-colors">
                  {data.logoPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={data.logoPreview}
                        alt="Logo preview"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="w-20 h-20 mx-auto mb-4 bg-[#0A0A0A] rounded-lg flex items-center justify-center">
                        <Upload className="w-8 h-8 text-gray-600" />
                      </div>
                      <p className="text-gray-400 mb-1">Drag and drop or click to select an image.</p>
                      <p className="text-xs text-gray-600">Maximum size: 2 MB</p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team Invites */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-6">
                <input
                  type="email"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
                  placeholder="email@example.com"
                  className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors"
                />
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  className="px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-white transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                onClick={handleAddTeamMember}
                disabled={!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)}
                className="w-full px-4 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
              >
                <Users className="w-5 h-5" />
                <span>Add member</span>
              </button>

              {/* Team members list */}
              {data.teamEmails.length > 0 && (
                <div className="space-y-2 mt-6">
                  {data.teamEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg"
                    >
                      <span className="text-white">{email}</span>
                      <button
                        onClick={() => handleRemoveTeamMember(email)}
                        className="text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Personalization */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Business Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  What describes your business best?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {businessTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setData({ ...data, businessType: type.id })}
                      className={clsx(
                        'px-4 py-3 rounded-lg border-2 transition-all font-medium',
                        data.businessType === type.id
                          ? 'bg-white border-white text-black'
                          : 'bg-[#0A0A0A] border-gray-800 text-gray-300 hover:border-gray-600'
                      )}
                    >
                      <span className="mr-2">{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Referral Source */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  How did you hear about us?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {referralSources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => setData({ ...data, referralSource: source.id })}
                      className={clsx(
                        'px-4 py-3 rounded-lg border-2 transition-all font-medium',
                        data.referralSource === source.id
                          ? 'bg-white border-white text-black'
                          : 'bg-[#0A0A0A] border-gray-800 text-gray-300 hover:border-gray-600'
                      )}
                    >
                      <span className="mr-2">{source.icon}</span>
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
              <div className="mt-6 px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                <X className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800/50">
            {step > 1 ? (
              <button
                onClick={handleBack}
                disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50 font-medium"
              >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                Back
              </button>
            ) : (
              <div />
            )}

              <div className="flex items-center gap-3">
              {step < totalSteps ? (
                <>
                  <button
                    onClick={() => setStep(totalSteps)}
                    className="px-6 py-3 text-gray-400 hover:text-white transition-colors font-medium"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                      className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-emerald-600/20"
                  >
                    Continue
                      <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading || !canProceed()}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg shadow-emerald-600/20"
                >
                  {loading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating Organization...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                        <span>Create Organization</span>
                    </>
                  )}
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationOnboarding;

