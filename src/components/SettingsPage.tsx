import React from 'react';
import { Settings, Lock, User, Globe, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * SettingsPage Component
 * 
 * Purpose: Application settings and preferences
 * Features: App always in dark mode, notifications, account settings
 */
const SettingsPage: React.FC = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      try {
        await logout();
      } catch (error) {
        console.error('Failed to sign out:', error);
      }
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

      {/* Settings Sections */}
      <div className="space-y-6">
        
        {/* Account Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-gray-900 dark:text-white" />
              Account
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <SettingsItem icon={User} label="Profile Settings" />
            <SettingsItem icon={Lock} label="Privacy & Security" />
            <SettingsItem icon={Globe} label="Language & Region" />
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">Sign Out</span>
              </div>
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
    </div>
  );
};

/**
 * SettingsItem Component
 * Purpose: Clickable settings item with icon
 */
interface SettingsItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const SettingsItem: React.FC<SettingsItemProps> = ({ icon: Icon, label }) => {
  return (
    <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
      </div>
      <svg
        className="w-5 h-5 text-gray-400 dark:text-gray-500"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

export default SettingsPage;
