import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Globe, Smartphone, Package, X, ShoppingBag, Plus, Instagram } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';
import FirestoreDataService from '../services/FirestoreDataService';
import blackLogo from '../components/blacklogo.png';
import { clsx } from 'clsx';

interface OnboardingData {
  userName: string;
  businessType: 'app' | 'website' | 'digital-product' | 'nothing' | 'other' | '';
  companyWebsite: string;
  teamEmails: string[];
  socialAccounts: { platform: 'instagram' | 'tiktok'; url: string }[];
}

const UserOnboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [data, setData] = useState<OnboardingData>({
    userName: '',
    businessType: '',
    companyWebsite: '',
    teamEmails: [],
    socialAccounts: []
  });

  const [currentEmail, setCurrentEmail] = useState('');
  const [currentSocialUrl, setCurrentSocialUrl] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState<'instagram' | 'tiktok'>('instagram');

  const totalSteps = 5;

  const businessOptions = [
    { id: 'app', label: 'An app', icon: Smartphone, description: 'Mobile or web application' },
    { id: 'website', label: 'A website', icon: Globe, description: 'Business or personal website' },
    { id: 'digital-product', label: 'A digital product', icon: Package, description: 'Course, ebook, template, etc.' },
    { id: 'nothing', label: "I don't sell anything", icon: X, description: 'Just tracking content' },
    { id: 'other', label: 'Other', icon: ShoppingBag, description: 'Something else' }
  ];

  const shouldShowWebsiteStep = () => {
    return data.businessType && data.businessType !== 'nothing';
  };

  const handleNext = () => {
    setError(null);
    
    // Validation for each step
    if (step === 1 && !data.userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (step === 2 && !data.businessType) {
      setError('Please select an option');
      return;
    }

    // Skip step 3 if they don't sell anything
    if (step === 2 && !shouldShowWebsiteStep()) {
      setStep(4);
      return;
    }
    
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    // Skip step 3 when going back if they don't sell anything
    if (step === 4 && !shouldShowWebsiteStep()) {
      setStep(2);
      return;
    }
    setStep(step - 1);
  };

  const handleSkip = () => {
    setError(null);
    setStep(step + 1);
  };

  const addTeamEmail = () => {
    if (currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      if (!data.teamEmails.includes(currentEmail)) {
        setData({ ...data, teamEmails: [...data.teamEmails, currentEmail] });
        setCurrentEmail('');
        setError(null);
      }
    } else {
      setError('Please enter a valid email');
    }
  };

  const removeTeamEmail = (email: string) => {
    setData({ ...data, teamEmails: data.teamEmails.filter(e => e !== email) });
  };

  const addSocialAccount = () => {
    if (!currentSocialUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(currentSocialUrl);
      setData({
        ...data,
        socialAccounts: [...data.socialAccounts, { platform: currentPlatform, url: currentSocialUrl }]
      });
      setCurrentSocialUrl('');
      setError(null);
    } catch {
      setError('Please enter a valid URL');
    }
  };

  const removeSocialAccount = (index: number) => {
    setData({
      ...data,
      socialAccounts: data.socialAccounts.filter((_, i) => i !== index)
    });
  };

  const handleFinish = async () => {
    if (data.socialAccounts.length === 0) {
      setError('Please add at least one social account to track');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error('No user found');

      // Create organization
      const orgName = data.userName ? `${data.userName}'s Workspace` : 'My Workspace';
      const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const orgData: any = {
        name: orgName,
        slug: orgSlug
      };
      
      // Only add website if it exists
      if (data.companyWebsite && data.companyWebsite.trim()) {
        orgData.website = data.companyWebsite;
      }
      
      orgData.email = user.email;
      orgData.displayName = user.displayName;
      
      const orgId = await OrganizationService.createOrganization(user.uid, orgData);

      // Create default project
      const projectId = await ProjectService.createProject(orgId, user.uid, {
        name: 'Default Project',
        description: 'Your first project',
        color: '#3B82F6'
      });

      // Add social accounts to track
      for (const account of data.socialAccounts) {
        const username = extractUsernameFromUrl(account.url);
        if (username) {
          await FirestoreDataService.addTrackedAccount(
            orgId,
            projectId,
            user.uid,
            {
              username,
              platform: account.platform,
              accountType: 'my',
              isActive: true,
              displayName: username,
              profilePicture: '',
              followerCount: 0,
              followingCount: 0,
              postCount: 0,
              bio: '',
              isVerified: false
            }
          );
        }
      }

      // Note: Team invitations would require email sending functionality
      // For now, we'll skip this feature

      // Navigate to dashboard (context will update via Firebase listeners)
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const extractUsernameFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(s => s);
      return segments[0] || null;
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-6xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2">
        
        {/* Left Column - Black Panel */}
        <div className="bg-black p-12 flex flex-col justify-between">
          {/* Logo & Branding */}
          <div>
            <img src={blackLogo} alt="ViewTrack" className="h-10 w-auto mb-12 brightness-0 invert" />
            
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              A few clicks away from setting up your workspace.
            </h1>
            <p className="text-gray-400 text-lg">
              Answer a few quick questions to personalize your experience.
            </p>
          </div>

          {/* Minimal Illustration */}
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl flex items-center justify-center shadow-xl border border-gray-700">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-white rounded-full"></div>
              </div>
            </div>
            {/* Progress indicator */}
            <div className="mt-8">
              <div className="flex items-center gap-2">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      i + 1 <= step ? 'bg-white' : 'bg-gray-700'
                    )}
                  />
                ))}
              </div>
              <p className="text-gray-500 text-sm mt-2">
                Step {step} of {totalSteps}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Onboarding Form */}
        <div className="p-12 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
            )}
            <div className="flex-1"></div>
            <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Need help?
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Step Content */}
          <div className="flex-1">
            {/* Step 1: Name */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your name?</h2>
                <p className="text-gray-500 mb-6">This helps us personalize your experience.</p>
                
                <input
                  type="text"
                  value={data.userName}
                  onChange={(e) => setData({ ...data, userName: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                  autoFocus
                />
              </div>
            )}

            {/* Step 2: Business Type */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Do you sell or own…</h2>
                <p className="text-gray-500 mb-6">Choose the option that best fits your work.</p>
                
                <div className="space-y-3">
                  {businessOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setData({ ...data, businessType: option.id as any })}
                      className={clsx(
                        'w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left',
                        data.businessType === option.id
                          ? 'border-black bg-black/5'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className={clsx(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        data.businessType === option.id ? 'bg-black' : 'bg-gray-100'
                      )}>
                        <option.icon className={clsx(
                          'w-6 h-6',
                          data.businessType === option.id ? 'text-white' : 'text-gray-600'
                        )} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{option.label}</p>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Company Website */}
            {step === 3 && shouldShowWebsiteStep() && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Add your company website</h2>
                <p className="text-gray-500 mb-6">Help us understand your business better.</p>
                
                <input
                  type="url"
                  value={data.companyWebsite}
                  onChange={(e) => setData({ ...data, companyWebsite: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                />

                <button
                  onClick={handleSkip}
                  className="mt-4 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* Step 4: Invite Team */}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Invite your team members</h2>
                <p className="text-gray-500 mb-6">Collaborate with your team on ViewTrack.</p>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="email"
                    value={currentEmail}
                    onChange={(e) => setCurrentEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTeamEmail()}
                    placeholder="email@example.com"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                  />
                  <button
                    onClick={addTeamEmail}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5 text-gray-700" />
                  </button>
                </div>

                {data.teamEmails.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {data.teamEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-700">{email}</span>
                        <button
                          onClick={() => removeTeamEmail(email)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleSkip}
                  className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* Step 5: Social Accounts */}
            {step === 5 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect your accounts</h2>
                <p className="text-gray-500 mb-6">Add Instagram or TikTok URLs to start tracking.</p>
                
                {/* Platform selector */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setCurrentPlatform('instagram')}
                    className={clsx(
                      'flex-1 px-4 py-3 rounded-lg font-medium transition-all',
                      currentPlatform === 'instagram'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    Instagram
                  </button>
                  <button
                    onClick={() => setCurrentPlatform('tiktok')}
                    className={clsx(
                      'flex-1 px-4 py-3 rounded-lg font-medium transition-all',
                      currentPlatform === 'tiktok'
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    TikTok
                  </button>
                </div>

                <div className="flex gap-2 mb-4">
                  <input
                    type="url"
                    value={currentSocialUrl}
                    onChange={(e) => setCurrentSocialUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSocialAccount()}
                    placeholder={`Paste your ${currentPlatform} link`}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900 placeholder-gray-400 bg-white"
                  />
                  <button
                    onClick={addSocialAccount}
                    className="px-4 py-3 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {data.socialAccounts.length > 0 && (
                  <div className="space-y-2">
                    {data.socialAccounts.map((account, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            account.platform === 'instagram'
                              ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                              : 'bg-black'
                          )}>
                            <Instagram className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 capitalize">{account.platform}</p>
                            <p className="text-sm text-gray-700 font-medium">{account.url}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeSocialAccount(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-8">
            {step < 5 && (
              <button
                onClick={handleNext}
                disabled={loading}
                className="w-full bg-black hover:bg-gray-800 text-white py-3.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}

            {step === 5 && (
              <button
                onClick={handleFinish}
                disabled={loading || data.socialAccounts.length === 0}
                className="w-full bg-black hover:bg-gray-800 text-white py-3.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Setting up...' : 'Finish Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserOnboarding;

