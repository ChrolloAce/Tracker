import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Bell, Lock, User, Globe, Palette } from 'lucide-react';
import ThemeService, { ThemeMode } from '../services/ThemeService';
import { clsx } from 'clsx';

/**
 * SettingsPage Component
 * 
 * Purpose: Application settings and preferences
 * Features: Theme toggle, notifications, account settings
 */
const SettingsPage: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(ThemeService.getCurrentTheme());

  useEffect(() => {
    // Initialize theme on mount
    ThemeService.applyTheme(currentTheme);
  }, []);

  const handleThemeToggle = () => {
    const newTheme = ThemeService.toggleTheme();
    setCurrentTheme(newTheme);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" />
          Settings
        </h1>
        <p className="mt-2 text-gray-600">
          Manage your preferences and account settings
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        
        {/* Appearance Section */}
        <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1A1A1A]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-blue-600" />
              Appearance
            </h2>
          </div>
          <div className="p-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'w-12 h-12 rounded-lg flex items-center justify-center',
                  currentTheme === 'dark' ? 'bg-gray-800' : 'bg-blue-50'
                )}>
                  {currentTheme === 'dark' ? (
                    <Moon className="w-6 h-6 text-blue-400" />
                  ) : (
                    <Sun className="w-6 h-6 text-yellow-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Theme Mode
                  </h3>
                  <p className="text-sm text-gray-600">
                    Current: <span className="font-medium capitalize">{currentTheme} Mode</span>
                  </p>
                </div>
              </div>
              
              {/* Toggle Switch */}
              <button
                onClick={handleThemeToggle}
                className={clsx(
                  'relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300',
                  currentTheme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-lg',
                    currentTheme === 'dark' ? 'translate-x-9' : 'translate-x-1'
                  )}
                >
                  {currentTheme === 'dark' ? (
                    <Moon className="w-4 h-4 text-blue-600 m-1" />
                  ) : (
                    <Sun className="w-4 h-4 text-yellow-500 m-1" />
                  )}
                </span>
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Dark mode reduces eye strain in low-light environments and can help save battery on OLED screens.
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
