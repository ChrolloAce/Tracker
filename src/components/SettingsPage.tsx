import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Crown, Camera, Mail, Trash2, AlertTriangle, CreditCard, Bell, Building2, User as UserIcon, Download, X, Users, DollarSign } from 'lucide-react';
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

type TabType = 'billing' | 'notifications' | 'organization' | 'profile' | 'team' | 'revenue';

/**
 * SettingsPage Component
 * 
 * Purpose: Modern tabbed settings interface
 * Features: Billing, Notifications, Organization, Profile management
 */
const SettingsPage: React.FC = () => {
  const { logout, user, currentOrgId, currentProjectId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Organization management
  const [currentOrganization, setCurrentOrganization] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  
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
          
          // Load organization members
          const members = await OrganizationService.getOrgMembers(org.id);
          setOrgMembers(members);
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

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateProfile(user, { displayName });
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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

  const getRoleBadge = (role: string) => {
    const styles = {
      owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      admin: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      member: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      creator: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return styles[role as keyof typeof styles] || styles.member;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 pt-8">

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-white/10">
          <nav className="flex space-x-8">
            {[
              { id: 'billing', label: 'Billing', icon: CreditCard },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'revenue', label: 'Revenue', icon: DollarSign },
              { id: 'organization', label: 'Organization', icon: Building2 },
              { id: 'profile', label: 'Profile', icon: UserIcon },
              { id: 'team', label: 'Team', icon: Users },
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
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Billing</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your plan, payments, and invoices.</p>
              </div>

              {/* Plan Details Card */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Current Plan</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Your subscription details</p>
                  </div>
                  <Crown className="w-8 h-8 text-yellow-500" />
                </div>
                
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">Pro Plan</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Renews on March 15, 2025</p>
                    </div>
                    <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg transition-colors font-medium">
                      Change plan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Price</p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">$49/month</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Billing cycle</p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">Monthly</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                    <p className="font-semibold text-green-600 dark:text-green-400 mt-1">Active</p>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Card number
                    </label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Expiry date
                      </label>
                      <input
                        type="text"
                        placeholder="MM / YY"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        CVC
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Billing address
                    </label>
                <input
                      type="text"
                      placeholder="123 Main St, City, State, ZIP"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent"
                    />
                  </div>
                </div>

                <button className="mt-4 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-900 dark:text-white rounded-lg transition-colors font-medium">
                  Update payment method
                </button>
              </div>

              {/* Invoice History */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice History</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-white/10">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { date: 'Feb 15, 2025', amount: '$49.00', status: 'Paid' },
                        { date: 'Jan 15, 2025', amount: '$49.00', status: 'Paid' },
                        { date: 'Dec 15, 2024', amount: '$49.00', status: 'Paid' },
                      ].map((invoice, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-white/5">
                          <td className="py-4 px-4 text-sm text-gray-900 dark:text-white">{invoice.date}</td>
                          <td className="py-4 px-4 text-sm text-gray-900 dark:text-white font-medium">{invoice.amount}</td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button className="text-gray-900 hover:text-gray-700 dark:text-white dark:hover:text-gray-300 text-sm font-medium inline-flex items-center gap-1">
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

          {/* Organization Tab */}
          {activeTab === 'organization' && (
      <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Organization</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your teams and permissions.</p>
              </div>

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

              {/* Team Members */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {orgMembers.length} member{orgMembers.length !== 1 ? 's' : ''} in your organization
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg transition-colors font-medium inline-flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Invite member
                  </button>
                </div>

                <div className="space-y-3">
                  {orgMembers.map((member) => (
                    <div key={member.userId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.displayName || ''} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-white dark:text-gray-900 font-semibold">
                              {member.displayName?.charAt(0) || member.email?.charAt(0) || 'U'}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {member.displayName || 'Unknown'}
                            {member.userId === user?.uid && (
                              <span className="ml-2 text-xs text-gray-500">(You)</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{member.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(member.role)}`}>
                          {member.role}
                        </span>
                        {member.userId !== user?.uid && isOwner && (
                          <button className="text-gray-400 hover:text-red-600 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
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
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profile</h2>
                <p className="text-gray-600 dark:text-gray-400">Manage your personal information.</p>
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
        
              {/* Account Actions */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Account Actions</h3>
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 p-3 rounded-lg border-2 border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="font-medium text-red-600 dark:text-red-400">Sign Out</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button className="px-6 py-2.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-white rounded-lg transition-colors font-medium">
                  Cancel
                </button>
            <button 
                  onClick={handleSaveProfile}
                  disabled={saving || !displayName}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
                  {saving ? 'Saving...' : 'Save changes'}
            </button>
        </div>

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
