/**
 * NotificationPreferencesService
 * 
 * Manages user notification preferences across email and in-app channels
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationPreferences {
  // Email Notifications
  email: {
    errorAlerts: boolean;              // Account sync/video processing failures
    weeklyDigest: boolean;              // Weekly analytics summary
    dailyDigest: boolean;               // Daily updates
    accountSyncIssues: boolean;         // When account sync fails
    videoProcessingIssues: boolean;     // When video processing fails
    billingAlerts: boolean;             // Payment and subscription notifications
    usageLimitWarnings: boolean;        // When nearing usage limits
    newVideosDetected: boolean;         // When new videos are found during sync
    performanceAnomalies: boolean;      // Unusual drops/spikes in metrics
    teamActivity: boolean;              // Team member actions
  };
  
  // In-App Notifications
  inApp: {
    teamUpdates: boolean;               // Team member activity
    mentions: boolean;                  // @mentions
    reports: boolean;                   // Generated reports
    syncCompletions: boolean;           // When account syncs complete
    videoAdded: boolean;                // When new videos are added
  };
  
  // Notification Delivery Preferences
  delivery: {
    emailAddress: string;               // Override default email
    quietHoursEnabled: boolean;         // Enable quiet hours
    quietHoursStart: string;            // e.g., "22:00"
    quietHoursEnd: string;              // e.g., "08:00"
    timezone: string;                   // User timezone
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    errorAlerts: true,
    weeklyDigest: true,
    dailyDigest: false,
    accountSyncIssues: true,
    videoProcessingIssues: true,
    billingAlerts: true,
    usageLimitWarnings: true,
    newVideosDetected: false,
    performanceAnomalies: false,
    teamActivity: false,
  },
  inApp: {
    teamUpdates: true,
    mentions: true,
    reports: true,
    syncCompletions: false,
    videoAdded: true,
  },
  delivery: {
    emailAddress: '',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
};

export const NOTIFICATION_TYPES_INFO = {
  email: {
    errorAlerts: {
      label: 'Error Alerts',
      description: 'Critical system errors and failures requiring immediate attention',
      category: 'System',
    },
    weeklyDigest: {
      label: 'Weekly Analytics Digest',
      description: 'Summary of your performance metrics, top videos, and insights',
      category: 'Analytics',
    },
    dailyDigest: {
      label: 'Daily Summary',
      description: 'Daily overview of views, engagement, and new content',
      category: 'Analytics',
    },
    accountSyncIssues: {
      label: 'Account Sync Failures',
      description: 'Alerts when automatic account synchronization fails',
      category: 'Sync',
    },
    videoProcessingIssues: {
      label: 'Video Processing Failures',
      description: 'Notifications when video data extraction fails',
      category: 'Sync',
    },
    billingAlerts: {
      label: 'Billing & Payments',
      description: 'Payment confirmations, failed charges, and subscription updates',
      category: 'Billing',
    },
    usageLimitWarnings: {
      label: 'Usage Limit Warnings',
      description: 'Alerts when approaching your plan limits',
      category: 'Usage',
    },
    newVideosDetected: {
      label: 'New Videos Detected',
      description: 'Notifications when new videos are found during account sync',
      category: 'Content',
    },
    performanceAnomalies: {
      label: 'Performance Anomalies',
      description: 'Unusual spikes or drops in video performance metrics',
      category: 'Analytics',
    },
    teamActivity: {
      label: 'Team Activity',
      description: 'Updates when team members add content or make changes',
      category: 'Team',
    },
  },
  inApp: {
    teamUpdates: {
      label: 'Team Updates',
      description: 'Activity from your team members',
      category: 'Team',
    },
    mentions: {
      label: 'Mentions',
      description: 'When someone @mentions you in comments or notes',
      category: 'Social',
    },
    reports: {
      label: 'Reports Ready',
      description: 'When scheduled reports are generated',
      category: 'Analytics',
    },
    syncCompletions: {
      label: 'Sync Completions',
      description: 'When account synchronization finishes',
      category: 'Sync',
    },
    videoAdded: {
      label: 'Videos Added',
      description: 'When new videos are added to your dashboard',
      category: 'Content',
    },
  },
};

class NotificationPreferencesService {
  /**
   * Get notification preferences for a user in an organization
   */
  async getPreferences(orgId: string, userId: string): Promise<NotificationPreferences> {
    try {
      const prefRef = doc(db, `organizations/${orgId}/userPreferences/${userId}`);
      const prefDoc = await getDoc(prefRef);
      
      if (prefDoc.exists()) {
        const data = prefDoc.data();
        // Merge with defaults in case new preferences were added
        return {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...data,
          email: { ...DEFAULT_NOTIFICATION_PREFERENCES.email, ...(data.email || {}) },
          inApp: { ...DEFAULT_NOTIFICATION_PREFERENCES.inApp, ...(data.inApp || {}) },
          delivery: { ...DEFAULT_NOTIFICATION_PREFERENCES.delivery, ...(data.delivery || {}) },
        } as NotificationPreferences;
      }
      
      return DEFAULT_NOTIFICATION_PREFERENCES;
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
  }

  /**
   * Save notification preferences for a user
   */
  async savePreferences(
    orgId: string,
    userId: string,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      const prefRef = doc(db, `organizations/${orgId}/userPreferences/${userId}`);
      await setDoc(prefRef, {
        ...preferences,
        updatedAt: new Date(),
      }, { merge: true });
      
      console.log('✅ Notification preferences saved');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update specific preference
   */
  async updatePreference(
    orgId: string,
    userId: string,
    path: string,
    value: boolean
  ): Promise<void> {
    try {
      const prefRef = doc(db, `organizations/${orgId}/userPreferences/${userId}`);
      await updateDoc(prefRef, {
        [path]: value,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to update preference:', error);
      throw error;
    }
  }

  /**
   * Check if user should receive a specific type of notification
   */
  async shouldNotify(
    orgId: string,
    userId: string,
    notificationType: 'email' | 'inApp',
    category: string
  ): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(orgId, userId);
      
      // Check if notification type is enabled
      const typePrefs = notificationType === 'email' ? prefs.email : prefs.inApp;
      const isEnabled = (typePrefs as any)[category];
      
      if (!isEnabled) {
        return false;
      }
      
      // Check quiet hours for email notifications
      if (notificationType === 'email' && prefs.delivery.quietHoursEnabled) {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: prefs.delivery.timezone
        });
        
        const start = prefs.delivery.quietHoursStart;
        const end = prefs.delivery.quietHoursEnd;
        
        // Check if current time is within quiet hours
        if (start > end) {
          // Quiet hours span midnight (e.g., 22:00 to 08:00)
          if (currentTime >= start || currentTime <= end) {
            console.log(`🔕 Quiet hours active - skipping email notification`);
            return false;
          }
        } else {
          // Normal quiet hours (e.g., 01:00 to 06:00)
          if (currentTime >= start && currentTime <= end) {
            console.log(`🔕 Quiet hours active - skipping email notification`);
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking notification preference:', error);
      // Default to sending if we can't check
      return true;
    }
  }

  /**
   * Get notification email address (custom or default)
   */
  async getNotificationEmail(orgId: string, userId: string, defaultEmail: string): Promise<string> {
    try {
      const prefs = await this.getPreferences(orgId, userId);
      return prefs.delivery.emailAddress || defaultEmail;
    } catch (error) {
      console.error('Error getting notification email:', error);
      return defaultEmail;
    }
  }
}

export default new NotificationPreferencesService();

