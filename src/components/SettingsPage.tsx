import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Camera, Mail, Trash2, AlertTriangle, CreditCard, Bell, User as UserIcon, X, Users, DollarSign, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import OrganizationService from '../services/OrganizationService';
import DeleteOrganizationModal from './DeleteOrganizationModal';
import TeamManagementPage from './TeamManagementPage';
import PendingInvitationsPage from './PendingInvitationsPage';
import { OrgMember } from '../types/firestore';
import { RevenueIntegrationsSettings } from './RevenueIntegrationsSettings';
import SubscriptionService from '../services/SubscriptionService';
import StripeService from '../services/StripeService';
import { PlanTier, SUBSCRIPTION_PLANS } from '../types/subscription';

type TabType = 'billing' | 'notifications' | 'organization' | 'profile' | 'team' | 'revenue';

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
            <DetailRow label="Started On" value={startDate} />
            <DetailRow label={subscription?.interval === 'year' ? 'Yearly Price' : 'Monthly Price'} value={`$${subscription?.interval === 'year' ? planDetails.yearlyPrice.toFixed(2) : planDetails.monthlyPrice.toFixed(2)}`} />
            <DetailRow label="Next Billing Date" value={nextBillingDate} />
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
                    className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel Subscription
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
const SettingsPage: React.FC = () => {
  const { logout, user, currentOrgId, currentProjectId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Check if we should open the revenue tab (e.g., from Setup button click)
    const savedTab = localStorage.getItem('settingsActiveTab');
    if (savedTab) {
      localStorage.removeItem('settingsActiveTab'); // Clear after reading
      return savedTab as TabType;
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
  const [emailNotifications, setEmailNotifications] = useState({
    weeklySummary: true,
    accountActivity: true,
    billingAlerts: true,
    newVideos: false,
  });
  
  const [inAppNotifications, setInAppNotifications] = useState({
    teamUpdates: true,
    mentions: true,
    reports: false,
  });

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

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        await logout();
      } catch (error) {
        console.error('Failed to sign out:', error);
      }
    }
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
        {/* Page Header with Sign Out */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Configure your preferences</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors border border-gray-200 dark:border-white/10"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-white/10">
          <nav className="flex space-x-8">
            {[
              { id: 'profile', label: 'Profile', icon: UserIcon },
              { id: 'billing', label: 'Billing', icon: CreditCard },
              { id: 'team', label: 'Team', icon: Users },
              { id: 'revenue', label: 'Revenue', icon: DollarSign },
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
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
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Notifications</h2>
                <p className="text-gray-600 dark:text-gray-400">Configure how you receive updates.</p>
              </div>

              {/* Email Notifications */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Mail className="w-6 h-6 text-gray-900 dark:text-white" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates via email</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(emailNotifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {key === 'weeklySummary' && 'Weekly Summary'}
                          {key === 'accountActivity' && 'Account Activity'}
                          {key === 'billingAlerts' && 'Billing Alerts'}
                          {key === 'newVideos' && 'New Videos'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {key === 'weeklySummary' && 'Get a weekly digest of your analytics'}
                          {key === 'accountActivity' && 'Alerts for important account changes'}
                          {key === 'billingAlerts' && 'Payment and subscription notifications'}
                          {key === 'newVideos' && 'Notifications when new videos are tracked'}
                        </p>
                      </div>
                      <button
                        onClick={() => setEmailNotifications(prev => ({ ...prev, [key]: !value }))}
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                          ${value ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-zinc-700'}
                        `}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${value ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* In-App Notifications */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Bell className="w-6 h-6 text-gray-900 dark:text-white" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">In-App Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Notifications within the application</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(inAppNotifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {key === 'teamUpdates' && 'Team Updates'}
                          {key === 'mentions' && 'Mentions'}
                          {key === 'reports' && 'Reports'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {key === 'teamUpdates' && 'Updates from your team members'}
                          {key === 'mentions' && 'When someone mentions you'}
                          {key === 'reports' && 'Weekly and monthly reports'}
        </p>
      </div>
                <button
                        onClick={() => setInAppNotifications(prev => ({ ...prev, [key]: !value }))}
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                          ${value ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-zinc-700'}
                        `}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${value ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button className="px-6 py-2.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-white rounded-lg transition-colors font-medium">
                  Cancel
                </button>
                <button className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg transition-colors font-medium">
                  Save changes
                </button>
              </div>
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Revenue Integrations</h2>
                <p className="text-gray-600 dark:text-gray-400">Connect RevenueCat, Superwall, or other revenue sources to track performance alongside your video metrics.</p>
              </div>

              {currentOrgId && currentProjectId ? (
                <RevenueIntegrationsSettings 
                  organizationId={currentOrgId}
                  projectId={currentProjectId}
                />
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-12 text-center">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Select an Organization and Project
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Please select an organization and project to manage revenue integrations.
                  </p>
                </div>
              )}
            </div>
          )}


          {/* Profile Tab (includes Organization) */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profile & Organization</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your personal information and organization settings.</p>
              </div>

              {/* Profile Photo */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile Photo</h3>
                
            <div className="flex items-center gap-6">
              <div className="relative">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                        className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 dark:border-zinc-800"
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
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Personal Information</h3>

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

              {/* Organization Info */}
              {currentOrganization && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Details</h3>
                  
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
                <div className="bg-white dark:bg-zinc-900 rounded-xl border-2 border-red-200 dark:border-red-900/50 p-6">
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

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Team Management</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your team members and pending invitations.</p>
              </div>

              {/* Team Members */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team Members</h3>
                <TeamManagementPage />
              </div>

              {/* Pending Invitations */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pending Invitations</h3>
                <PendingInvitationsPage />
              </div>
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
