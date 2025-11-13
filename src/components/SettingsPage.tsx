import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Mail, Trash2, AlertTriangle, CreditCard, Bell, User as UserIcon, X, TrendingUp, RefreshCw, CheckCircle, Building2, Video, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import OrganizationService from '../services/OrganizationService';
import DeleteOrganizationModal from './DeleteOrganizationModal';
import OrganizationSwitcher from './OrganizationSwitcher';
import SubscriptionService from '../services/SubscriptionService';
import StripeService from '../services/StripeService';
import { PlanTier, SUBSCRIPTION_PLANS } from '../types/subscription';
import { ProxiedImage } from './ProxiedImage';
import NotificationPreferencesService, { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_TYPES_INFO } from '../services/NotificationPreferencesService';
import DeletedVideosManager from './DeletedVideosManager';

type TabType = 'billing' | 'notifications' | 'organization' | 'profile' | 'revenue' | 'videos';

/**
 * BillingTabContent Component
 * Beautiful usage indicators and subscription details
 */
const BillingTabContent: React.FC = () => {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('free');
  const [subscription, setSubscription] = useState<any>(null);
  const [usageStatus, setUsageStatus] = useState<any[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    
    const loadData = async () => {
      // Check for success parameter once
      const urlParams = new URLSearchParams(window.location.search);
      const hasSuccess = urlParams.get('success') === 'true';
      
      if (hasSuccess) {
        setShowSuccessMessage(true);
        // Remove the parameter from URL
        urlParams.delete('success');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
        
        // Wait for webhook to complete
        console.log('⏳ Waiting for webhook to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    
    setLoading(true);
    try {
      const [tier, sub, usage] = await Promise.all([
        SubscriptionService.getPlanTier(currentOrgId),
        SubscriptionService.getSubscription(currentOrgId),
        (async () => {
          const { default: UsageTrackingService } = await import('../services/UsageTrackingService');
          return UsageTrackingService.getUsageStatus(currentOrgId);
        })()
      ]);
      
      setCurrentPlan(tier);
      setSubscription(sub);
      setUsageStatus(usage);
    } catch (error) {
      console.error('Failed to load billing info:', error);
    } finally {
      setLoading(false);
    }
  };
    
    loadData();
  }, [currentOrgId]); // Only re-run when org changes

  // Auto-dismiss success message after 5 seconds - MUST be before any returns!
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => setShowSuccessMessage(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  const handleManageSubscription = async () => {
    if (!currentOrgId) return;
    
    setLoadingPortal(true);
    try {
      await StripeService.createPortalSession(currentOrgId);
    } catch (error) {
      console.error('Failed to open portal:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setLoadingPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  const planDetails = SUBSCRIPTION_PLANS[currentPlan];
  
  // Format dates - handle both Timestamp objects and Date objects
  const startDate = subscription?.createdAt 
    ? (() => {
        try {
          // If it's a Firestore Timestamp
          if (subscription.createdAt.seconds) {
            return new Date(subscription.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          }
          // If it's already a Date object
          if (subscription.createdAt.toDate) {
            return subscription.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          }
          // If it's a plain Date
          return new Date(subscription.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } catch (error) {
          console.error('Error formatting start date:', error, subscription.createdAt);
          return 'N/A';
        }
      })()
    : 'N/A';
  
  const nextBillingDate = subscription?.currentPeriodEnd
    ? (() => {
        try {
          // If it's a Firestore Timestamp
          if (subscription.currentPeriodEnd.seconds) {
            return new Date(subscription.currentPeriodEnd.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          }
          // If it's already a Date object
          if (subscription.currentPeriodEnd.toDate) {
            return subscription.currentPeriodEnd.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          }
          // If it's a plain Date
          return new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } catch (error) {
          console.error('Error formatting next billing date:', error, subscription.currentPeriodEnd);
          return 'N/A';
        }
      })()
    : 'N/A';

  // Usage card data
  const usageCards = [
    {
      label: 'Tracked Videos',
      status: usageStatus.find((s: any) => s.resource === 'Tracked Videos'),
      available: true
    },
    {
      label: 'Tracked Accounts',
      status: usageStatus.find((s: any) => s.resource === 'Tracked Accounts'),
      available: true
    },
    {
      label: 'Manual Refreshes',
      status: null,
      available: planDetails.features.refreshOnDemand
    },
    {
      label: 'Team Seats',
      status: usageStatus.find((s: any) => s.resource === 'Team Members'),
      available: true
    },
    {
      label: 'MCP Calls',
      status: usageStatus.find((s: any) => s.resource === 'MCP Calls'),
      available: planDetails.features.mcpCallsPerMonth > 0
    }
  ];

  const UsageCard = ({ label, status, available }: any) => {
    if (!available) {
      return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-600">—</span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 text-center">{label}</p>
          <p className="text-xs text-gray-600 text-center mt-1">Not available</p>
        </div>
      );
    }

    if (!status) {
      return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-400">0%</span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-400 text-center">{label}</p>
          <p className="text-xs text-gray-500 text-center mt-1">0 of 0 used</p>
        </div>
      );
    }

    const percentage = status.isUnlimited ? 0 : status.percentage;
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    const getColor = () => {
      if (status.isUnlimited) return 'text-emerald-400';
      if (status.isOverLimit) return 'text-red-400';
      if (status.isNearLimit) return 'text-yellow-400';
      return 'text-emerald-400';
    };

    return (
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-black/60 transition-colors">
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className={getColor()} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${getColor()}`}>
              {status.isUnlimited ? '∞' : `${Math.round(percentage)}%`}
            </span>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-300 text-center">{label}</p>
        <p className="text-xs text-gray-500 text-center mt-1">
          {status.current} of {status.isUnlimited ? '∞' : status.limit} used
        </p>
      </div>
    );
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-500/20 rounded-full flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-emerald-300 mb-1">
              Subscription Updated Successfully!
            </h3>
            <p className="text-sm text-emerald-300/80">
              Your subscription has been upgraded. Your new plan features and limits are now active. Refresh the page if you don't see updates.
            </p>
          </div>
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="text-emerald-400 hover:text-emerald-300 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your Subscription</h2>
        <p className="text-gray-600 dark:text-gray-400">Manage your organization's subscription and billing information.</p>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {usageCards.map((card, index) => (
          <UsageCard key={index} {...card} />
        ))}
      </div>

      {/* Subscription Details */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Subscription Details</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Compare all plans on our{' '}
          <a href="/subscription" className="text-emerald-400 hover:text-emerald-300 underline">
            pricing page
          </a>
          . If you have specific needs,{' '}
          <a href="mailto:support@viewtrack.app" className="text-emerald-400 hover:text-emerald-300 underline">
            talk to us
          </a>
          .
        </p>

        <div className="bg-black/40 dark:bg-black/40 border border-white/10 rounded-xl p-6">
          <div className="space-y-4">
            <DetailRow label="Active Plan" value={planDetails.displayName + ' Plan'} />
            <DetailRow label="Billing Cycle" value={subscription?.interval === 'year' ? 'Yearly' : 'Monthly'} />
            <DetailRow label="Auto-Renew" value={subscription?.cancelAtPeriodEnd ? 'Cancelled - Expires at period end' : 'Active'} />
            <DetailRow label="Started On" value={startDate} />
            <DetailRow label={subscription?.interval === 'year' ? 'Yearly Price' : 'Monthly Price'} value={`$${subscription?.interval === 'year' ? planDetails.yearlyPrice.toFixed(2) : planDetails.monthlyPrice.toFixed(2)}`} />
            <DetailRow label="Next Billing Date" value={subscription?.cancelAtPeriodEnd ? `Expires: ${nextBillingDate}` : nextBillingDate} />
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              {currentPlan !== 'free' && subscription?.stripeCustomerId && (
                <>
                  <button
                    onClick={handleManageSubscription}
                    disabled={loadingPortal}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg font-medium transition-colors text-white disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {loadingPortal ? 'Loading...' : 'Manage Subscription'}
                  </button>
                  <button
                    onClick={handleManageSubscription}
                    disabled={loadingPortal}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      subscription?.cancelAtPeriodEnd
                        ? 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20'
                        : 'text-red-400 hover:bg-red-500/10 border-red-500/20'
                    }`}
                  >
                    {subscription?.cancelAtPeriodEnd ? (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Reactivate Subscription
                      </>
                    ) : (
                      <>
                    <X className="w-4 h-4" />
                    Cancel Subscription
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => navigate('/subscription')}
              className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg font-medium transition-colors text-white"
            >
              <TrendingUp className="w-4 h-4" />
              {currentPlan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * SettingsPage Component
 * 
 * Purpose: Modern tabbed settings interface
 * Features: Billing, Notifications, Organization, Profile management
 */
const SettingsPage: React.FC<{ initialTab?: string }> = ({ initialTab: initialTabProp }) => {
  const { user, currentOrgId, userRole, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Use initialTab from URL if provided
    if (initialTabProp && ['profile', 'organization', 'billing', 'notifications', 'videos'].includes(initialTabProp)) {
      return initialTabProp as TabType;
    }
    return 'profile';
  });
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Organization management
  const [currentOrganization, setCurrentOrganization] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Notification settings
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load current organization and members
  useEffect(() => {
    const loadOrganization = async () => {
      if (!user || !currentOrgId) return;

      try {
        const orgs = await OrganizationService.getUserOrganizations(user.uid);
        const org = orgs.find(o => o.id === currentOrgId);
        setCurrentOrganization(org || null);
        
        if (org) {
          const ownerStatus = await OrganizationService.isOrgOwner(org.id, user.uid);
          setIsOwner(ownerStatus);
        }
      } catch (error) {
        console.error('Failed to load organization:', error);
      }
    };

    loadOrganization();
  }, [user, currentOrgId]);

  // Load notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user || !currentOrgId) return;
      
      setLoadingPreferences(true);
      try {
        const prefs = await NotificationPreferencesService.getPreferences(currentOrgId, user.uid);
        setNotificationPreferences(prefs);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadPreferences();
  }, [user, currentOrgId]);

  // Auto-save preferences with debounce
  useEffect(() => {
    if (!user || !currentOrgId || loadingPreferences) return;

    const timeoutId = setTimeout(async () => {
      setSavingPreferences(true);
      try {
        await NotificationPreferencesService.savePreferences(
          currentOrgId,
          user.uid,
          notificationPreferences
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (error) {
        console.error('Failed to save notification preferences:', error);
      } finally {
        setSavingPreferences(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notificationPreferences, user, currentOrgId, loadingPreferences]);

  // Helper to update email notification preference
  const toggleEmailNotification = (key: keyof typeof notificationPreferences.email) => {
    setNotificationPreferences(prev => ({
      ...prev,
      email: {
        ...prev.email,
        [key]: !prev.email[key],
      },
    }));
  };

  // Helper to update in-app notification preference
  const toggleInAppNotification = (key: keyof typeof notificationPreferences.inApp) => {
    setNotificationPreferences(prev => ({
      ...prev,
      inApp: {
        ...prev.inApp,
        [key]: !prev.inApp[key],
      },
    }));
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL });
      
      alert('Profile photo updated successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Auto-save display name when it changes (debounced)
  useEffect(() => {
    if (!user || !displayName || displayName === user.displayName) return;

    const timeoutId = setTimeout(async () => {
    setSaving(true);
    try {
      await updateProfile(user, { displayName });
        console.log('✅ Profile auto-saved');
    } catch (error) {
        console.error('Failed to auto-save profile:', error);
    } finally {
      setSaving(false);
    }
    }, 1000); // Wait 1 second after user stops typing
    
    return () => clearTimeout(timeoutId);
  }, [displayName, user]);

  const handleDeleteOrganization = async (organizationId: string) => {
    if (!user) return;
    
    try {
      await OrganizationService.deleteOrganization(organizationId, user.uid);
      
      alert('✅ Organization deleted successfully! Redirecting...');
      
      window.location.href = '/';
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to delete organization:', error);
      throw error;
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-white/10">
          <nav className="flex space-x-8">
            {[
              { id: 'profile', label: 'Profile', icon: UserIcon },
              { id: 'organization', label: 'Organization', icon: Building2 },
              { id: 'billing', label: 'Billing', icon: CreditCard },
              { id: 'videos', label: 'Videos', icon: Video },
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ]
            .filter(tab => {
              // Hide billing tab for creators
              if (userRole === 'creator' && tab.id === 'billing') {
                return false;
              }
              return true;
            })
            .map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabType);
                    navigate(`/settings/${tab.id}`);
                  }}
                  className={`
                    flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                    ${isActive 
                      ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-8 pb-12">
          {/* Billing Tab */}
          {activeTab === 'billing' && <BillingTabContent />}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Notifications</h2>
                  <p className="text-gray-600 dark:text-gray-400">Configure how you receive updates and alerts</p>
                </div>
                {(savingPreferences || saveSuccess) && (
                  <div className="flex items-center gap-2 text-sm">
                    {savingPreferences ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-gray-400">Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Saved!</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {loadingPreferences ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                </div>
              ) : (
                <>
                  {/* Email Notifications */}
                  <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Mail className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">Email Notifications</h3>
                        <p className="text-sm text-gray-500">Receive updates via email at {user?.email}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {Object.entries(NOTIFICATION_TYPES_INFO.email).map(([key, info]) => {
                        const isEnabled = notificationPreferences.email[key as keyof typeof notificationPreferences.email];
                        return (
                          <div 
                            key={key} 
                            className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white text-sm">{info.label}</p>
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-white/5 text-gray-500">
                                  {info.category}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {info.description}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleEmailNotification(key as keyof typeof notificationPreferences.email)}
                              className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4
                                ${isEnabled ? 'bg-emerald-600' : 'bg-gray-700'}
                              `}
                            >
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                  ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* In-App Notifications */}
                  <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Bell className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">In-App Notifications</h3>
                        <p className="text-sm text-gray-500">Notifications within the application</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {Object.entries(NOTIFICATION_TYPES_INFO.inApp).map(([key, info]) => {
                        const isEnabled = notificationPreferences.inApp[key as keyof typeof notificationPreferences.inApp];
                        return (
                          <div 
                            key={key} 
                            className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white text-sm">{info.label}</p>
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-white/5 text-gray-500">
                                  {info.category}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {info.description}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleInAppNotification(key as keyof typeof notificationPreferences.inApp)}
                              className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4
                                ${isEnabled ? 'bg-emerald-600' : 'bg-gray-700'}
                              `}
                            >
                              <span
                                className={`
                                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                  ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                                `}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notification Email Settings */}
                  <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Delivery Settings</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Notification Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={notificationPreferences.delivery.emailAddress}
                          onChange={(e) => setNotificationPreferences(prev => ({
                            ...prev,
                            delivery: { ...prev.delivery, emailAddress: e.target.value }
                          }))}
                          placeholder={user?.email || 'Use account email'}
                          className="w-full px-4 py-3 bg-zinc-800 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to use your account email ({user?.email})
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Organization Tab */}
          {activeTab === 'organization' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Organization</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your organization settings and switch between organizations.</p>
              </div>

              {/* Organization Switcher */}
              <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Current Organization</h3>
                <OrganizationSwitcher />
              </div>

              {/* Organization Info */}
              {currentOrganization && (
                <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Organization Details</h3>
                
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={currentOrganization.name}
                        disabled
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {currentOrganization.createdAt?.toDate().toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Your Role</p>
                        <p className="font-medium text-gray-900 dark:text-white mt-1 capitalize">
                          {isOwner ? 'Owner' : 'Member'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Danger Zone - Delete Organization */}
              {isOwner && currentOrganization && (
                <div className="bg-black/40 rounded-xl border border-red-500/30 p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Permanently delete "{currentOrganization.name}" and all its data
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        This action cannot be undone. All projects, videos, and analytics will be lost.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Organization
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h2>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30">
                      <Shield className="w-3.5 h-3.5" />
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-gray-600 dark:text-gray-400">Manage your personal information and account settings.</p>
          </div>

            {/* Profile Photo */}
              <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Profile Photo</h3>
                
            <div className="flex items-center gap-6">
              <div className="relative">
                {user?.photoURL ? (
                  <ProxiedImage 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 dark:border-zinc-800"
                    fallback={
                      <div className="w-20 h-20 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center border-4 border-gray-200 dark:border-zinc-800">
                        <span className="text-2xl font-bold text-white dark:text-gray-900">
                          {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    }
                  />
                ) : (
                      <div className="w-20 h-20 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center border-4 border-gray-200 dark:border-zinc-800">
                        <span className="text-2xl font-bold text-white dark:text-gray-900">
                      {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                  </div>
                  
                  <div className="flex-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                      <Camera className="w-4 h-4" />
                      {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      JPG, PNG or GIF. Max size 5MB.
                    </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-black/40 rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Personal Information</h3>

                <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email cannot be changed
              </p>
            </div>
          </div>
        </div>
        
              {/* Auto-save indicator */}
              {saving && (
                <div className="flex items-center justify-end gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
        </div>
              )}

              {/* App Version */}
              <div className="text-center pt-6 border-t border-gray-200 dark:border-white/10">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              VideoAnalytics Dashboard v1.0.0
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              © 2025 All rights reserved
            </p>
          </div>
            </div>
          )}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <div className="space-y-6">
              <DeletedVideosManager />
                </div>
          )}

        </div>
      </div>

      {/* Delete Organization Modal */}
      {currentOrganization && (
        <DeleteOrganizationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          organizationName={currentOrganization.name}
          organizationId={currentOrganization.id}
          onConfirmDelete={handleDeleteOrganization}
        />
      )}
    </div>
  );
};

export default SettingsPage;
