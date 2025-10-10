import React, { useState } from 'react';
import { Home, Users, MessageSquare, Upload, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ProjectService from '../services/ProjectService';
import FirebaseStorageService from '../services/FirebaseStorageService';
import { clsx } from 'clsx';

interface ProjectCreationFlowProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ProjectData {
  name: string;
  slug: string;
  website: string;
  imageFile: File | null;
  imagePreview: string | null;
  teamEmails: string[];
  businessType: string;
  referralSource: string;
}

const ProjectCreationFlow: React.FC<ProjectCreationFlowProps> = ({ onClose, onSuccess }) => {
  const { user, currentOrgId, switchProject } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [data, setData] = useState<ProjectData>({
    name: '',
    slug: '',
    website: '',
    imageFile: null,
    imagePreview: null,
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

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          imageFile: file,
          imagePreview: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setData({
      ...data,
      imageFile: null,
      imagePreview: null
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
      return data.name.trim().length > 0;
    }
    return true; // Steps 2 and 3 are optional
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
    if (!user || !currentOrgId) return;

    setLoading(true);
    setError(null);

    try {
      // Upload image if provided
      let imageUrl: string | undefined;
      if (data.imageFile) {
        imageUrl = await FirebaseStorageService.uploadProjectImage(currentOrgId, data.imageFile);
      }

      // Create project
      const projectId = await ProjectService.createProject(currentOrgId, user.uid, {
        name: data.name,
        imageUrl: imageUrl,
        description: data.website || undefined,
      });

      console.log('✅ Project created:', projectId);

      // Show success toast
      setShowSuccess(true);
      
      // Wait a moment to show success
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Switch to the new project
      await switchProject(projectId);

      // Call success callback
      onSuccess();
      
      // Reload to refresh data
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to create project:', error);
      setError(error.message || 'Failed to create project');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#0A0A0A] flex overflow-x-hidden">
      <div className="w-full flex">
        {/* Left side - Form */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {/* Header */}
          <div className="p-8 border-b border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
                  {step === 1 && <Home className="w-6 h-6 text-purple-400" />}
                  {step === 2 && <Users className="w-6 h-6 text-purple-400" />}
                  {step === 3 && <MessageSquare className="w-6 h-6 text-purple-400" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {step === 1 && 'Create a Project'}
                    {step === 2 && 'Invite your Team'}
                    {step === 3 && 'Almost Done!'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {step === 1 && 'Set up your space to get started'}
                    {step === 2 && 'Collaborate with your team members'}
                    {step === 3 && "Let's personalize your experience"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center space-x-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={clsx(
                    'h-1 rounded-full transition-all duration-300 flex-1',
                    s <= step ? 'bg-gray-900 dark:bg-white' : 'bg-gray-800'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Success Toast */}
          {showSuccess && (
            <div className="absolute top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in z-50">
              <Check className="w-5 h-5" />
              <span>Project created successfully</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* Step 1: Project Details */}
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
                    className="w-full px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-900 dark:border-white transition-colors"
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
                    className="w-full px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-900 dark:border-white transition-colors"
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
                    Slug
                  </label>
                  <input
                    type="text"
                    value={data.slug}
                    onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="acme-inc"
                    className="w-full px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-900 dark:border-white transition-colors"
                    maxLength={50}
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
                  <div className="border-2 border-dashed border-gray-800 rounded-lg p-8 text-center hover:border-gray-700 transition-colors">
                    {data.imagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={data.imagePreview}
                          alt="Logo preview"
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-700">
                          <Upload className="w-8 h-8 text-purple-400" />
                        </div>
                        <p className="text-gray-300 mb-1">Drag and drop or click to select an image.</p>
                        <p className="text-xs text-gray-500">Maximum size: 2 MB</p>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif"
                          onChange={handleImageChange}
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
                <div className="flex items-center space-x-3">
                  <input
                    type="email"
                    value={currentEmail}
                    onChange={(e) => setCurrentEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
                    placeholder="email@example.com"
                    className="flex-1 px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-900 dark:border-white transition-colors"
                  />
                  <select
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    className="px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-gray-900 dark:border-white transition-colors"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button
                  onClick={handleAddTeamMember}
                  disabled={!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)}
                  className="w-full px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg text-white hover:border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
                        className="flex items-center justify-between px-4 py-3 bg-[#161616] border border-gray-800 rounded-lg"
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
                          'px-4 py-3 rounded-lg border transition-all text-left',
                          data.businessType === type.id
                            ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white'
                            : 'bg-[#161616] border-gray-800 text-gray-300 hover:border-gray-700'
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
                          'px-4 py-3 rounded-lg border transition-all text-left',
                          data.referralSource === source.id
                            ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white'
                            : 'bg-[#161616] border-gray-800 text-gray-300 hover:border-gray-700'
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
          </div>

          {/* Footer Actions */}
          <div className="p-8 border-t border-gray-800">
            <div className="flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
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
                      className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={loading || !canProceed()}
                    className="px-8 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
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

        {/* Right side - Decorative grid pattern */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0A0A0A] via-purple-900/5 to-pink-900/5 relative overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'rotate(-12deg) scale(1.5)',
            transformOrigin: 'center'
          }} />
          {/* Floating decorative elements */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-gray-900 dark:bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-40 right-40 w-40 h-40 bg-pink-600/10 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
};

export default ProjectCreationFlow;

