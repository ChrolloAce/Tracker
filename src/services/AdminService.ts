import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * AdminService
 * 
 * Manages admin privileges and checks.
 * Admin users bypass all usage limits (accounts, videos, links, team members, etc.)
 */
class AdminService {
  
  // Cache for admin status to avoid repeated Firestore reads
  private static adminCache = new Map<string, { isAdmin: boolean; timestamp: number }>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Check if a user is an admin
   * Uses caching to avoid repeated Firestore reads
   */
  static async isAdmin(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }
    
    try {
      // Check cache first
      const cached = this.adminCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.isAdmin;
      }
      
      // Fetch from Firestore
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.warn(`User ${userId} not found in database`);
        this.adminCache.set(userId, { isAdmin: false, timestamp: Date.now() });
        return false;
      }
      
      const userData = userSnap.data();
      const isAdmin = userData.isAdmin === true;
      
      // Update cache
      this.adminCache.set(userId, { isAdmin, timestamp: Date.now() });
      
      if (isAdmin) {
        console.log(`✅ Admin user detected: ${userId} (${userData.email})`);
      }
      
      return isAdmin;
      
    } catch (error) {
      console.error('Failed to check admin status:', error);
      return false;
    }
  }
  
  /**
   * Clear admin cache for a specific user
   * Useful after updating admin status
   */
  static clearCache(userId?: string): void {
    if (userId) {
      this.adminCache.delete(userId);
    } else {
      this.adminCache.clear();
    }
  }
  
  /**
   * Check if user should bypass limits
   * This is the main method other services should use
   * Admins can toggle this off to see the experience as a normal user
   * Demo accounts ALWAYS bypass limits
   */
  static async shouldBypassLimits(userId: string): Promise<boolean> {
    if (!userId) {
      console.log('⚠️ [shouldBypassLimits] No userId provided');
      return false;
    }
    
    try {
      // DEMO ACCOUNT: Always bypass limits for demo account
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const userEmail = userData.email?.toLowerCase() || '';
        
        console.log(`🔍 [shouldBypassLimits] Checking user: ${userEmail}`);
        
        // Demo account ALWAYS bypasses all limits
        if (userEmail === '001ernestolopez@gmail.com') {
          console.log(`🎭 Demo account detected (${userEmail}) - bypassing ALL limits`);
          return true;
        }
      } else {
        console.log(`⚠️ [shouldBypassLimits] User document not found for userId: ${userId}`);
      }
      
      // Regular admin check
      const isAdmin = await this.isAdmin(userId);
      
      if (!isAdmin) {
        return false;
      }
      
      // Check if admin has toggled bypass off (to view as normal user)
      const bypassDisabled = localStorage.getItem(`admin_bypass_disabled_${userId}`) === 'true';
      
      if (bypassDisabled) {
        console.log(`🔒 Admin ${userId} viewing as normal user (bypass disabled)`);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Failed to check bypass limits:', error);
      return false;
    }
  }
  
  /**
   * Toggle admin bypass on/off
   * Allows admins to view the app as a normal user would
   */
  static toggleBypass(userId: string, enabled: boolean): void {
    if (enabled) {
      localStorage.removeItem(`admin_bypass_disabled_${userId}`);
      console.log(`🔓 Admin bypass enabled for ${userId}`);
    } else {
      localStorage.setItem(`admin_bypass_disabled_${userId}`, 'true');
      console.log(`🔒 Admin bypass disabled for ${userId} - viewing as normal user`);
    }
  }
  
  /**
   * Check if admin bypass is currently enabled
   */
  static isBypassEnabled(userId: string): boolean {
    return localStorage.getItem(`admin_bypass_disabled_${userId}`) !== 'true';
  }
}

export default AdminService;

