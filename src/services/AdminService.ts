import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
   */
  static async shouldBypassLimits(userId: string): Promise<boolean> {
    return await this.isAdmin(userId);
  }
}

export default AdminService;

