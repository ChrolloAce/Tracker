import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Upload, X, Check, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';
import FirebaseStorageService from '../services/FirebaseStorageService';
import FirestoreDataService from '../services/FirestoreDataService';
import TeamInvitationService from '../services/TeamInvitationService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { clsx } from 'clsx';
import viewtrackLogo from '/vtlogo.png';
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

interface OnboardingData {
  name: string;
  website: string;
  slug: string;
  logoFile: File | null;
  logoPreview: string | null;
  projectName: string;
  projectIconFile: File | null;
  projectIconPreview: string | null;
  trackedAccounts: Array<{url: string; platform: string; videoCount?: number}>;
  videoCount: number;
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
    projectName: '',
    projectIconFile: null,
    projectIconPreview: null,
    trackedAccounts: [],
    videoCount: 100,
    teamEmails: [],
    businessType: '',
    referralSource: ''
  });

  const [currentEmail, setCurrentEmail] = useState('');
  const [currentRole, setCurrentRole] = useState('member');
  const [currentAccountUrl, setCurrentAccountUrl] = useState('');

  const totalSteps = 4;

  // Auto-generate unique slug from website + name + unique ID
  const generateUniqueSlug = (name: string, website: string) => {
    let slugParts: string[] = [];
    
    // Extract domain from website if provided
    if (website && website.trim()) {
      try {
        const url = new URL(website.startsWith('http') ? website : `https://${website}`);
        const domain = url.hostname.replace('www.', '').split('.')[0];
        if (domain) slugParts.push(domain);
      } catch {
        // If URL parsing fails, skip domain
      }
    }
    
    // Add company name
    if (name && name.trim()) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      slugParts.push(cleanName);
    }
    
    // Add unique identifier (timestamp-based)
    const uniqueId = Date.now().toString(36).slice(-6);
    slugParts.push(uniqueId);
    
    return slugParts.join('-');
  };

  // Auto-generate slug from name and website
  const handleNameChange = (name: string) => {
    setData({
      ...data,
      name,
      slug: generateUniqueSlug(name, data.website)
    });
  };

  const handleWebsiteChange = (website: string) => {
    setData({
      ...data,
      website,
      slug: generateUniqueSlug(data.name, website)
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

  // Detect platform from URL
  const detectPlatform = (url: string): string => {
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return 'unknown';
  };

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return instagramIcon;
      case 'tiktok': return tiktokIcon;
      case 'youtube': return youtubeIcon;
      case 'twitter': return xLogo;
      default: return null;
    }
  };

  // Add tracked account
  const handleAddAccount = () => {
    if (currentAccountUrl && currentAccountUrl.trim().length > 0) {
      const platform = detectPlatform(currentAccountUrl);
      setData({
        ...data,
        trackedAccounts: [...data.trackedAccounts, { url: currentAccountUrl, platform }]
      });
      setCurrentAccountUrl('');
    }
  };

  const handleRemoveAccount = (index: number) => {
    setData({
      ...data,
      trackedAccounts: data.trackedAccounts.filter((_, i) => i !== index)
    });
  };

  // Handle project icon upload
  const handleProjectIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setData({
          ...data,
          projectIconFile: file,
          projectIconPreview: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProjectIcon = () => {
    setData({
      ...data,
      projectIconFile: null,
      projectIconPreview: null
    });
  };

  // Validate current step
  const canProceed = () => {
    if (step === 1) {
      return data.name.trim().length > 0 && data.slug.trim().length > 0;
    }
    if (step === 2) {
      return data.projectName.trim().length > 0; // Project name required
    }
    if (step === 3) {
      return true; // Team invites are optional
    }
    if (step === 4) {
      return data.businessType.trim().length > 0 && data.referralSource.trim().length > 0; // Both required
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

    // Final validation before submission
    if (!data.name.trim()) {
      setError('Organization name is required');
      return;
    }
    if (!data.projectName.trim()) {
      setError('Project name is required');
      return;
    }
    if (!data.businessType.trim() || !data.referralSource.trim()) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Starting onboarding completion...', {
        orgName: data.name,
        projectName: data.projectName,
        accounts: data.trackedAccounts.length,
        teamInvites: data.teamEmails.length
      });

      // Upload organization logo if provided
      let logoUrl: string | undefined;
      if (data.logoFile) {
        console.log('📤 Uploading organization logo...');
        logoUrl = await FirebaseStorageService.uploadOrganizationLogo(user.uid, data.logoFile);
        console.log('✅ Logo uploaded:', logoUrl);
      }

      // Build organization data (only include defined fields)
      const orgData: any = {
        name: data.name.trim(),
        slug: data.slug.trim()
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
      
      // Mark as demo org if using demo email
      if (user.email === 'demo@viewtrack.app') {
        metadata.isDemo = true;
        console.log('🎭 Creating DEMO organization - will be publicly accessible');
      }
      
      orgData.metadata = metadata;
      orgData.email = user.email;
      orgData.displayName = user.displayName;

      // Create organization
      console.log('🏢 Creating organization:', orgData);
      const orgId = await OrganizationService.createOrganization(user.uid, orgData);
      
      // Set as default org for the user
      await OrganizationService.setDefaultOrg(user.uid, orgId);
      console.log('✅ Set as default organization');
      
      // Log demo org ID prominently
      if (user.email === 'demo@viewtrack.app') {
        console.log('');
        console.log('🎭🎭🎭 DEMO ORG CREATED 🎭🎭🎭');
        console.log('📋 Copy these IDs:');
        console.log('Org ID:', orgId);
        console.log('');
      } else {
        console.log('✅ Organization created:', orgId);
      }

      // Upload project icon if provided
      let projectIconUrl: string | undefined;
      if (data.projectIconFile) {
        console.log('📤 Uploading project icon...');
        projectIconUrl = await FirebaseStorageService.uploadOrganizationLogo(user.uid, data.projectIconFile);
        console.log('✅ Project icon uploaded:', projectIconUrl);
      }

      // Create project with name and icon
      const projectData: any = {
        name: data.projectName.trim(),
        description: 'Your first project',
        color: '#2282FF'
      };

      if (projectIconUrl) {
        projectData.iconUrl = projectIconUrl;
      }

      console.log('📁 Creating project:', projectData);
      const projectId = await ProjectService.createProject(orgId, user.uid, projectData);
      
      // Set as default project for the user in this org
      const userRef = doc(db, 'organizations', orgId, 'members', user.uid);
      await setDoc(userRef, { lastActiveProjectId: projectId }, { merge: true });
      console.log('✅ Set as default project');
      
      // Log demo project ID prominently
      if (user.email === 'demo@viewtrack.app') {
        console.log('Project ID:', projectId);
        console.log('');
        console.log('👉 Demo org is now fully set up!');
        console.log('📋 IDs saved:');
        console.log('- Org ID:', orgId);
        console.log('- Project ID:', projectId);
        console.log('🎭🎭🎭🎭🎭🎭🎭🎭🎭');
        console.log('');
      } else {
        console.log('✅ Project created:', projectId);
      }

      // Add tracked accounts with their video counts
      for (const account of data.trackedAccounts) {
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
          
          // Note: Video count (account.videoCount) is stored in the UI state
          // The actual video syncing logic will use this when fetching videos
          // You may want to store this in account metadata if needed
        }
      }

      // Send team invitations
      if (data.teamEmails.length > 0) {
        console.log('📧 Sending team invitations to:', data.teamEmails);
        for (const email of data.teamEmails) {
          try {
            await TeamInvitationService.createInvitation(
              orgId,
              email,
              'member',
              user.uid,
              user.displayName || 'Team Member',
              user.email || '',
              data.name.trim(),
              projectId
            );
            console.log('✅ Invitation sent to:', email);
          } catch (inviteError) {
            console.error('❌ Failed to send invitation to:', email, inviteError);
            // Continue with other invitations even if one fails
          }
        }
      }

      console.log('✅ Onboarding complete! Redirecting to dashboard...');
      
      // Wait a moment for Firebase to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to dashboard (force reload to pick up new context)
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Failed to create organization:', error);
      setError(error.message || 'Failed to create organization');
      setLoading(false);
    }
  };

  // Helper function to extract username from social media URL
  const extractUsernameFromUrl = (url: string): string => {
    try {
      const cleanUrl = url.trim();
      
      // Instagram
      if (cleanUrl.includes('instagram.com') || cleanUrl.includes('instagr.am')) {
        const match = cleanUrl.match(/instagram\.com\/([^/?]+)/);
        return match ? match[1] : '';
      }
      
      // TikTok
      if (cleanUrl.includes('tiktok.com')) {
        const match = cleanUrl.match(/tiktok\.com\/@?([^/?]+)/);
        return match ? match[1] : '';
      }
      
      // YouTube
      if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        const match = cleanUrl.match(/youtube\.com\/(@?[^/?]+)/);
        return match ? match[1] : '';
      }
      
      // Twitter/X
      if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
        const match = cleanUrl.match(/(?:twitter|x)\.com\/([^/?]+)/);
        return match ? match[1] : '';
      }
      
      return '';
    } catch (error) {
      return '';
    }
  };

  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex">
      {/* Left Panel - Dotted Black Grid */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-black relative overflow-hidden">
        {/* Dotted Background Pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, #FFFFFF 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* Right Panel - Form Content */}
      <div className="w-full lg:w-7/12 xl:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-2xl">
          {/* Mobile Header (hidden on desktop) */}
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto mb-4">
              <img src={viewtrackLogo} alt="ViewTrack" className="h-10 w-auto mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Organization</h1>
            <div className="flex items-center justify-center gap-2 mt-4">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={clsx(
                  "h-2 rounded-full transition-all duration-300",
                  s === step ? "w-12 bg-[#2282FF]" : s < step ? "w-8 bg-blue-300" : "w-8 bg-gray-300"
                )} />
              ))}
            </div>
        </div>

          {/* Form Card */}
          <div className="p-8">
          {/* Step 1: Organization Details */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Step Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Create Your Organization
                </h2>
                <p className="text-gray-600">
                  Set up your workspace and start tracking social media analytics
                </p>
              </div>
              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website <span className="text-gray-400">Optional</span>
                </label>
                <input
                  type="url"
                  value={data.website}
                  onChange={(e) => handleWebsiteChange(e.target.value)}
                  placeholder="https://acme.com"
                  className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2282FF] transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your website URL - it will help generate a unique slug.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-[#2282FF]">*</span>
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2282FF] transition-colors"
                  maxLength={50}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is the name that will be displayed to your team members.
                </p>
              </div>

              {/* Slug - Auto-generated */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unique Slug
                </label>
                <div className="w-full px-0 py-3 border-0 border-b border-gray-300 text-gray-500 bg-gray-50/50">
                  {data.slug || 'your-unique-slug'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Auto-generated from your website and organization name. Used in public links.
                </p>
              </div>

            </div>
          )}

          {/* Step 2: Create First Project */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Step Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Create Your First Project
                </h2>
                <p className="text-gray-600">
                  Add your first project and start tracking social accounts
                </p>
              </div>
              
              {/* Project Name & Icon - Horizontal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-[#2282FF]">*</span>
                </label>
                <div className="flex items-center gap-4">
                  {/* Project Icon */}
                  <div className="relative group">
                    {data.projectIconPreview ? (
                      <div className="relative">
                        <img
                          src={data.projectIconPreview}
                          alt="Project icon"
                          className="w-12 h-12 rounded-lg object-cover border border-gray-300"
                        />
                        <button
                          onClick={handleRemoveProjectIcon}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full items-center justify-center hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 hidden group-hover:flex"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer w-12 h-12 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-[#2282FF] transition-colors">
                        <Upload className="w-5 h-5 text-gray-400" />
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif"
                          onChange={handleProjectIconChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  
                  {/* Project Name Input */}
                  <input
                    type="text"
                    value={data.projectName}
                    onChange={(e) => setData({ ...data, projectName: e.target.value })}
                    placeholder="My First Campaign"
                    className="flex-1 px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2282FF] transition-colors"
                    maxLength={50}
                    required
                  />
                </div>
              </div>

              {/* Add Tracked Accounts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracked Accounts
                </label>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="url"
                    value={currentAccountUrl}
                    onChange={(e) => setCurrentAccountUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAccount()}
                    placeholder="https://instagram.com/username or https://tiktok.com/@username"
                    className="flex-1 px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2282FF] transition-colors"
                  />
                  <button
                    onClick={handleAddAccount}
                    disabled={!currentAccountUrl}
                    className="px-4 py-2 bg-[#2282FF] text-white rounded-lg hover:bg-[#1b6dd9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                
                {/* Tracked accounts list */}
                {data.trackedAccounts.length > 0 && (
                  <div className="space-y-2">
                    {data.trackedAccounts.map((account, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getPlatformIcon(account.platform) ? (
                            <img 
                              src={getPlatformIcon(account.platform)!} 
                              alt={account.platform}
                              className="w-6 h-6 object-contain"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-gray-600 uppercase">{account.platform}</span>
                          )}
                          <span className="text-sm text-gray-900 truncate">{account.url}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={account.videoCount || data.videoCount}
                            onChange={(e) => {
                              const updatedAccounts = [...data.trackedAccounts];
                              updatedAccounts[index] = {
                                ...updatedAccounts[index],
                                videoCount: parseInt(e.target.value)
                              };
                              setData({ ...data, trackedAccounts: updatedAccounts });
                            }}
                            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2282FF]"
                          >
                            <option value="10">10 videos</option>
                            <option value="20">20 videos</option>
                            <option value="50">50 videos</option>
                            <option value="100">100 videos</option>
                            <option value="200">200 videos</option>
                            <option value="500">500 videos</option>
                          </select>
                          <button
                            onClick={() => handleRemoveAccount(index)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Team Invites */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Step Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Build Your Team
                </h2>
                <p className="text-gray-600">
                  Invite team members to collaborate on campaigns and content
                </p>
              </div>
              
              <div className="flex items-center space-x-3 mb-6">
                <input
                  type="email"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
                  placeholder="email@example.com"
                  className="flex-1 px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2282FF] transition-colors"
                />
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  className="px-0 py-3 bg-transparent border-0 border-b border-gray-300 text-gray-900 focus:outline-none focus:border-[#2282FF] transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                onClick={handleAddTeamMember}
                disabled={!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)}
                className="w-full px-4 py-3 bg-[#2282FF] text-white rounded-lg hover:bg-[#1b6dd9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
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
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <span className="text-gray-900">{email}</span>
                      <button
                        onClick={() => handleRemoveTeamMember(email)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Personalization */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Step Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Personalize Your Workspace
                </h2>
                <p className="text-gray-600">
                  Tell us about your business to get personalized recommendations
                </p>
              </div>
              
              {/* Business Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What describes your business best? <span className="text-[#2282FF]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {businessTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setData({ ...data, businessType: type.id })}
                      className={clsx(
                        'px-4 py-3 rounded-lg border-2 transition-all font-medium',
                        data.businessType === type.id
                          ? 'bg-[#2282FF] border-[#2282FF] text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-[#2282FF]'
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
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How did you hear about us? <span className="text-[#2282FF]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {referralSources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => setData({ ...data, referralSource: source.id })}
                      className={clsx(
                        'px-4 py-3 rounded-lg border-2 transition-all font-medium',
                        data.referralSource === source.id
                          ? 'bg-[#2282FF] border-[#2282FF] text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-[#2282FF]'
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
              <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <X className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <button
                onClick={handleBack}
                disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50 font-medium"
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
                  {step === 3 && ( /* Only allow skip on Team step */
                    <button
                      onClick={() => setStep(totalSteps)}
                      className="px-6 py-3 text-gray-500 hover:text-gray-900 transition-colors font-medium"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                      className="flex items-center gap-2 px-8 py-3 bg-[#2282FF] text-white rounded-full hover:bg-[#1b6dd9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-[#2282FF]/20"
                  >
                    Continue
                      <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading || !canProceed()}
                    className="px-8 py-3 bg-[#2282FF] text-white rounded-full hover:bg-[#1b6dd9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg shadow-[#2282FF]/20"
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

