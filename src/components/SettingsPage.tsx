import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, Crown, Upload, Camera, Mail, Send, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import EmailService from '../services/EmailService';
import OrganizationService from '../services/OrganizationService';
import DeleteOrganizationModal from './DeleteOrganizationModal';

/**
 * SettingsPage Component
 * 
 * Purpose: Application settings and preferences
 * Features: Profile settings, photo upload, subscription management
 */
const SettingsPage: React.FC = () => {
  const { logout, user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Organization management
  const [currentOrganization, setCurrentOrganization] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Load current organization
  useEffect(() => {
    const loadOrganization = async () => {
      console.log('🔍 Settings: Loading organization...', { hasUser: !!user });
      
      if (!user) {
        console.log('⚠️ Settings: No user found');
        return;
      }
      
      const currentOrgId = localStorage.getItem('currentOrganizationId');
      console.log('🔍 Settings: Current org ID from localStorage:', currentOrgId);
      
      if (!currentOrgId) {
        console.log('⚠️ Settings: No organization ID in localStorage');
        return;
      }

      try {
        const orgs = await OrganizationService.getUserOrganizations(user.uid);
        console.log('🔍 Settings: User organizations:', orgs);
        
        const org = orgs.find(o => o.id === currentOrgId);
        console.log('🔍 Settings: Found current org:', org);
        
        setCurrentOrganization(org || null);
        
        if (org) {
          const ownerStatus = await OrganizationService.isOrgOwner(org.id, user.uid);
          console.log('🔍 Settings: Is owner?', ownerStatus);
          setIsOwner(ownerStatus);
        }
      } catch (error) {
        console.error('❌ Settings: Failed to load organization:', error);
      }
    };

    loadOrganization();
  }, [user]);

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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Update user profile
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

  const handleSendTestEmail = async () => {
    if (!user?.email) {
      alert('No email address found for your account.');
      return;
    }

    if (!window.confirm(`Send a test email to ${user.email}?`)) {
      return;
    }

    setSendingEmail(true);
    try {
      const result = await EmailService.sendTestEmail(user.email);
      
      if (result.success) {
        alert(`✅ Test email sent successfully to ${user.email}!\n\nCheck your inbox (and spam folder) to verify.`);
      } else {
        alert(`❌ Failed to send test email:\n${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      alert('Failed to send test email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeleteOrganization = async (organizationId: string) => {
    if (!user) return;
    
    try {
      await OrganizationService.deleteOrganization(organizationId, user.uid);
      
      // Clear local storage
      localStorage.removeItem('currentOrganizationId');
      localStorage.removeItem('currentProjectId');
      
      // Redirect to create organization page
      alert('✅ Organization deleted successfully!');
      window.location.href = '/';
    } catch (error: any) {
      console.error('Failed to delete organization:', error);
      throw error;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-gray-900 dark:text-white" />
          Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your preferences and account settings
        </p>
      </div>

      {/* DEBUG INFO - TEMPORARY */}
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-300 mb-2">🐛 Debug Info (temporary)</h3>
        <div className="text-xs font-mono text-yellow-700 dark:text-yellow-400 space-y-1">
          <p>User: {user?.email || 'Not loaded'}</p>
          <p>Current Org ID: {localStorage.getItem('currentOrganizationId') || 'None'}</p>
          <p>Current Org Name: {currentOrganization?.name || 'Not loaded'}</p>
          <p>Is Owner: {isOwner ? 'Yes ✅' : 'No ❌'}</p>
          <p>Should show delete section: {currentOrganization && isOwner ? 'Yes ✅' : 'No ❌'}</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        
        {/* Profile Settings */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Profile Settings
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Profile Photo */}
            <div className="flex items-center gap-6">
              <div className="relative">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center border-4 border-gray-200 dark:border-gray-700">
                    <span className="text-3xl font-bold text-white">
                      {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 transition-colors disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                  Profile Photo
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Upload a photo to personalize your account
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email cannot be changed
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={saving || !displayName}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Upgrade Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-gray-900 dark:text-white" />
              Subscription
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                  Upgrade Your Plan
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Unlock advanced features and unlimited tracking
                </p>
              </div>
              <button 
                onClick={() => window.location.href = '#subscription'}
                className="px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700"
              >
                View Plans
              </button>
            </div>
          </div>
        </div>

        {/* Email Testing Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-900 dark:text-white" />
              Email Testing
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                  Test Email Integration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Send a test email to verify your email service is working
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Will send to: <span className="font-mono">{user?.email || 'No email found'}</span>
                </p>
              </div>
              <button 
                onClick={handleSendTestEmail}
                disabled={sendingEmail || !user?.email}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendingEmail ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone - Delete Organization */}
        {currentOrganization && isOwner && (
          <div className="bg-white dark:bg-[#161616] rounded-xl border-2 border-red-200 dark:border-red-900/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                    Delete Organization
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permanently delete "{currentOrganization.name}" and all its data
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                    ⚠️ This action cannot be undone. All projects, videos, and analytics will be lost.
                  </p>
                </div>
                <button 
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Actions */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
            >
              <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Sign Out</span>
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              VideoAnalytics Dashboard v1.0.0
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              © 2025 All rights reserved
            </p>
          </div>
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
