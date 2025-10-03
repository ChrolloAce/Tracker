import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Upload, X, Check } from 'lucide-react';
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

      // Create organization
      const orgId = await OrganizationService.createOrganization(user.uid, {
        name: data.name,
        slug: data.slug,
        website: data.website || undefined,
        logoUrl: logoUrl,
        metadata: {
          businessType: data.businessType || undefined,
          referralSource: data.referralSource || undefined,
          onboardingCompletedAt: new Date().toISOString()
        }
      });

      console.log('✅ Organization created:', orgId);

      // TODO: Send team invites if any
      if (data.teamEmails.length > 0) {
        console.log('📧 Team invites to send:', data.teamEmails);
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {step === 1 && 'Create an Organization'}
            {step === 2 && 'Invite your Team'}
            {step === 3 && 'Almost Done!'}
          </h1>
          <p className="text-gray-400">
            {step === 1 && 'Set up your space to get started'}
            {step === 2 && 'Collaborate with your team members'}
            {step === 3 && "Let's personalize your experience"}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={clsx(
                  'h-1 rounded-full transition-all duration-300',
                  s === 1 ? 'w-32' : 'w-24',
                  s <= step ? 'bg-blue-600' : 'bg-gray-800'
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-[#161616] rounded-2xl border border-gray-800 p-8">
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
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
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
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
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
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
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
                  className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
                />
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  className="px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-600 transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                onClick={handleAddTeamMember}
                disabled={!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)}
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white hover:border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
                        'px-4 py-3 rounded-lg border transition-all',
                        data.businessType === type.id
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-[#0A0A0A] border-gray-800 text-gray-300 hover:border-gray-700'
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
                        'px-4 py-3 rounded-lg border transition-all',
                        data.referralSource === source.id
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-[#0A0A0A] border-gray-800 text-gray-300 hover:border-gray-700'
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
            <div className="mt-6 px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
            {step > 1 ? (
              <button
                onClick={handleBack}
                disabled={loading}
                className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-3">
              {step < totalSteps ? (
                <>
                  <button
                    onClick={() => setStep(totalSteps)}
                    className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading || !canProceed()}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Complete</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationOnboarding;

