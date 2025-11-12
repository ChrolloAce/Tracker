import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface DashboardPreferences {
  userId: string;
  orgId: string;
  
  // KPI Card preferences
  kpiCardOrder: string[];
  kpiCardVisibility: Record<string, boolean>;
  
  // Dashboard section preferences
  dashboardSectionOrder: string[];
  dashboardSectionVisibility: Record<string, boolean>;
  
  // Top Performers subsection preferences
  topPerformersSubsectionOrder: string[];
  topPerformersSubsectionVisibility: Record<string, boolean>;
  
  // Metadata
  updatedAt: Date;
  inheritedFromUserId?: string; // Track if layout was inherited from admin
}

/**
 * Service for managing user-specific dashboard layout preferences
 * Each user can have their own custom dashboard layout
 */
class DashboardPreferencesService {
  
  /**
   * Get user's dashboard preferences for an organization
   * If user has no preferences, inherit from organization owner/admin
   */
  static async getUserPreferences(
    orgId: string,
    userId: string
  ): Promise<DashboardPreferences | null> {
    try {
      const prefsRef = doc(db, 'organizations', orgId, 'users', userId, 'settings', 'dashboard');
      const prefsDoc = await getDoc(prefsRef);
      
      if (prefsDoc.exists()) {
        return {
          userId,
          orgId,
          ...prefsDoc.data(),
          updatedAt: prefsDoc.data().updatedAt?.toDate() || new Date()
        } as DashboardPreferences;
      }
      
      // No preferences found - inherit from admin
      return await this.inheritAdminLayout(orgId, userId);
    } catch (error) {
      // Silently fail - user just doesn't have preferences yet
      console.log('No custom dashboard preferences found, using defaults');
      return null;
    }
  }
  
  /**
   * Inherit dashboard layout from organization owner or first admin
   */
  static async inheritAdminLayout(
    orgId: string,
    userId: string
  ): Promise<DashboardPreferences | null> {
    try {
      // Find org owner or first admin
      const membersRef = collection(db, 'organizations', orgId, 'members');
      
      // Try to find owner first
      const ownerQuery = query(membersRef, where('role', '==', 'owner'), limit(1));
      const ownerSnapshot = await getDocs(ownerQuery);
      
      let adminUserId: string | null = null;
      
      if (!ownerSnapshot.empty) {
        adminUserId = ownerSnapshot.docs[0].data().userId;
      } else {
        // No owner, try to find an admin
        const adminQuery = query(membersRef, where('role', '==', 'admin'), limit(1));
        const adminSnapshot = await getDocs(adminQuery);
        
        if (!adminSnapshot.empty) {
          adminUserId = adminSnapshot.docs[0].data().userId;
        }
      }
      
      if (!adminUserId) {
        // No admin found - return default layout
        return this.getDefaultPreferences(userId, orgId);
      }
      
      // Load admin's preferences
      const adminPrefsRef = doc(db, 'organizations', orgId, 'users', adminUserId, 'settings', 'dashboard');
      const adminPrefsDoc = await getDoc(adminPrefsRef);
      
      if (adminPrefsDoc.exists()) {
        // Return admin's layout but mark it as inherited
        const adminPrefs = adminPrefsDoc.data();
        return {
          userId,
          orgId,
          kpiCardOrder: adminPrefs.kpiCardOrder || [],
          kpiCardVisibility: adminPrefs.kpiCardVisibility || {},
          dashboardSectionOrder: adminPrefs.dashboardSectionOrder || [],
          dashboardSectionVisibility: adminPrefs.dashboardSectionVisibility || {},
          topPerformersSubsectionOrder: adminPrefs.topPerformersSubsectionOrder || [],
          topPerformersSubsectionVisibility: adminPrefs.topPerformersSubsectionVisibility || {},
          updatedAt: new Date(),
          inheritedFromUserId: adminUserId
        };
      }
      
      // Admin has no preferences either - return defaults
      return this.getDefaultPreferences(userId, orgId);
    } catch (error) {
      console.error('Failed to inherit admin layout:', error);
      return this.getDefaultPreferences(userId, orgId);
    }
  }
  
  /**
   * Get default dashboard preferences
   */
  static getDefaultPreferences(userId: string, orgId: string): DashboardPreferences {
    return {
      userId,
      orgId,
      kpiCardOrder: [],
      kpiCardVisibility: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        videos: true,
        accounts: true,
        engagementRate: true,
        revenue: false,
        downloads: false,
        'link-clicks': true
      },
      dashboardSectionOrder: ['kpi-cards', 'posting-activity', 'top-performers', 'top-platforms', 'videos-table', 'tracked-accounts'],
      dashboardSectionVisibility: {
        'kpi-cards': true,
        'posting-activity': true,
        'top-performers': true,
        'top-platforms': true,
        'videos-table': true,
        'tracked-accounts': true
      },
      topPerformersSubsectionOrder: ['top-videos', 'top-accounts', 'top-gainers', 'top-creators', 'posting-times', 'top-platforms', 'comparison'],
      topPerformersSubsectionVisibility: {
        'top-videos': true,
        'top-accounts': true,
        'top-gainers': true,
        'top-creators': true,
        'posting-times': true,
        'top-platforms': true,
        'comparison': true
      },
      updatedAt: new Date()
    };
  }
  
  /**
   * Save user's dashboard preferences
   */
  static async saveUserPreferences(
    orgId: string,
    userId: string,
    preferences: Partial<DashboardPreferences>
  ): Promise<void> {
    try {
      const prefsRef = doc(db, 'organizations', orgId, 'users', userId, 'settings', 'dashboard');
      
      await setDoc(prefsRef, {
        ...preferences,
        userId,
        orgId,
        updatedAt: new Date()
      }, { merge: true });
      
      console.log('✅ Dashboard preferences saved to Firebase');
    } catch (error) {
      console.error('Failed to save dashboard preferences:', error);
      throw error;
    }
  }
  
  /**
   * Reset user's preferences to admin's layout
   */
  static async resetToAdminLayout(
    orgId: string,
    userId: string
  ): Promise<DashboardPreferences | null> {
    try {
      const adminLayout = await this.inheritAdminLayout(orgId, userId);
      
      if (adminLayout) {
        await this.saveUserPreferences(orgId, userId, adminLayout);
      }
      
      return adminLayout;
    } catch (error) {
      console.error('Failed to reset to admin layout:', error);
      return null;
    }
  }
}

export default DashboardPreferencesService;

