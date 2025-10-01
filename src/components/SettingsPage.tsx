import React, { useState } from 'react';
import { Settings, Moon, Bell, Lock, User, Globe, Palette } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * SettingsPage Component
 * 
 * Purpose: Application settings and preferences
 * Features: App always in dark mode, notifications, account settings
 */
const SettingsPage: React.FC = () => {

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your preferences and account settings
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        
        {/* Appearance Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Appearance
            </h2>
          </div>
          <div className="p-6">
            {/* Dark Mode Info (Always On) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center">
                  <Moon className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    Dark Mode
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Always enabled for optimal viewing
                  </p>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Active</span>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                💡 <strong>Tip:</strong> ViewTrack is designed exclusively for dark mode to reduce eye strain and provide the best viewing experience for video analytics.
              </p>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Notifications
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <NotificationToggle
              label="Video Performance Alerts"
              description="Get notified when videos reach milestones"
              defaultChecked={true}
            />
            <NotificationToggle
              label="Daily Summary"
              description="Receive daily analytics summary"
              defaultChecked={false}
            />
            <NotificationToggle
              label="Contract Reminders"
              description="Alerts for upcoming contract deadlines"
              defaultChecked={true}
            />
          </div>
        </div>

        {/* Account Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Account
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <SettingsItem icon={User} label="Profile Settings" />
            <SettingsItem icon={Lock} label="Privacy & Security" />
            <SettingsItem icon={Globe} label="Language & Region" />
          </div>
        </div>

        {/* About Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              VideoAnalytics Dashboard v1.0.0
            </p>
            <p className="text-xs text-gray-500 mt-1">
              © 2025 All rights reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * NotificationToggle Component
 * Purpose: Reusable toggle for notification settings
 */
interface NotificationToggleProps {
  label: string;
  description: string;
  defaultChecked: boolean;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({
  label,
  description,
  defaultChecked
}) => {
  const [isEnabled, setIsEnabled] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => setIsEnabled(!isEnabled)}
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
          isEnabled ? 'bg-blue-600' : 'bg-gray-300'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
            isEnabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
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
        <Icon className="w-5 h-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </div>
      <svg
        className="w-5 h-5 text-gray-400"
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
