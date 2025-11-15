import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  setDoc
} from 'firebase/firestore';
import { SUBSCRIPTION_PLANS, PlanTier } from '../types/subscription';
import AdminService from './AdminService';

/**
 * Usage Tracking Service
 * Tracks and enforces subscription limits for all resources
 */

export interface UsageMetrics {
  // Tracked Resources
  trackedAccounts: number;
  trackedVideos: number;
  trackedLinks: number;
  
  // Team & Collaboration
  teamMembers: number;
  
  // Manual Additions
  manualVideos: number; // Videos added manually (not auto-tracked)
  manualCreators: number;
  
  // Monthly Reset Metrics
  mcpCallsThisMonth: number;
  
  // Metadata
  lastUpdated: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface UsageLimits {
  maxAccounts: number; // -1 = unlimited
  maxVideos: number;
  maxLinks: number;
  teamSeats: number;
  mcpCallsPerMonth: number;
}

export interface UsageStatus {
  resource: string;
  current: number;
  limit: number;
  percentage: number;
  isUnlimited: boolean;
  isOverLimit: boolean;
  isNearLimit: boolean; // > 80%
}

class UsageTrackingService {
  
  /**
   * Get current usage for an organization
   * Uses cached data from usage document, with fallback to real-time count
   */
  static async getUsage(orgId: string): Promise<UsageMetrics> {
    try {
      const usageRef = doc(db, 'organizations', orgId, 'billing', 'usage');
      const usageDoc = await getDoc(usageRef);
      
      // If we have recent cached data (< 5 minutes old), use it for speed
      if (usageDoc.exists()) {
        const data = usageDoc.data();
        const lastUpdated = data.lastUpdated?.toDate() || new Date(0);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        // Use cached data if it's recent
        if (lastUpdated > fiveMinutesAgo) {
          console.log(`⚡ Using cached usage data (updated ${Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago)`);
          return {
            trackedAccounts: data.trackedAccounts || 0,
            trackedVideos: data.trackedVideos || 0,
            trackedLinks: data.trackedLinks || 0,
            teamMembers: data.teamMembers || 1,
            manualVideos: data.manualVideos || 0,
            manualCreators: data.manualCreators || 0,
            mcpCallsThisMonth: data.mcpCallsThisMonth || 0,
            lastUpdated: lastUpdated,
            currentPeriodStart: data.currentPeriodStart?.toDate() || new Date(),
            currentPeriodEnd: data.currentPeriodEnd?.toDate() || this.getNextMonthDate()
        };
        }
      }
      
      console.log('🔄 Cache miss or stale - counting resources in background...');
      
      // Cache is stale or missing - count in background and update cache
      // But return approximate data immediately to avoid blocking
      this.updateUsageCache(orgId).catch(err => {
        // Silently fail if user doesn't have permission (e.g., creators)
        // Only log in development or if it's not a permission error
        if (err.code !== 'permission-denied') {
          console.error('Background cache update failed:', err);
        }
      });
      
      // Return current cached data or zeros while background update runs
      if (usageDoc.exists()) {
      const data = usageDoc.data();
      return {
        trackedAccounts: data.trackedAccounts || 0,
        trackedVideos: data.trackedVideos || 0,
        trackedLinks: data.trackedLinks || 0,
        teamMembers: data.teamMembers || 1,
        manualVideos: data.manualVideos || 0,
        manualCreators: data.manualCreators || 0,
        mcpCallsThisMonth: data.mcpCallsThisMonth || 0,
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        currentPeriodStart: data.currentPeriodStart?.toDate() || new Date(),
        currentPeriodEnd: data.currentPeriodEnd?.toDate() || this.getNextMonthDate()
        };
      }
      
      // No cache at all - return zeros and update in background
      return {
        trackedAccounts: 0,
        trackedVideos: 0,
        trackedLinks: 0,
        teamMembers: 1,
        manualVideos: 0,
        manualCreators: 0,
        mcpCallsThisMonth: 0,
        lastUpdated: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.getNextMonthDate()
      };
    } catch (error) {
      console.error('Failed to get usage:', error);
      throw error;
    }
  }
  
  /**
   * Update usage cache in background (non-blocking)
   */
  private static async updateUsageCache(orgId: string): Promise<void> {
    const projectsRef = collection(db, 'organizations', orgId, 'projects');
    const projectsSnapshot = await getDocs(projectsRef);
    
    let totalAccounts = 0;
    let totalVideos = 0;
    let totalLinks = 0;
    
    // Count across all projects in parallel
    const countPromises = projectsSnapshot.docs.map(async (projectDoc) => {
      const projectId = projectDoc.id;
      
      const [accountsSnap, videosSnap, linksSnap] = await Promise.all([
        getDocs(query(collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'), where('isActive', '==', true))),
        getDocs(collection(db, 'organizations', orgId, 'projects', projectId, 'videos')),
        getDocs(query(collection(db, 'organizations', orgId, 'projects', projectId, 'links'), where('isActive', '==', true)))
      ]);
      
      return {
        accounts: accountsSnap.size,
        videos: videosSnap.size,
        links: linksSnap.size
      };
    });
    
    const results = await Promise.all(countPromises);
    results.forEach(r => {
      totalAccounts += r.accounts;
      totalVideos += r.videos;
      totalLinks += r.links;
    });
    
    // Count team members
    const membersRef = collection(db, 'organizations', orgId, 'members');
    const membersQuery = query(membersRef, where('status', '==', 'active'));
    const membersSnapshot = await getDocs(membersQuery);
    
    // Update cache
    const usageRef = doc(db, 'organizations', orgId, 'billing', 'usage');
    await setDoc(usageRef, {
      trackedAccounts: totalAccounts,
      trackedVideos: totalVideos,
      trackedLinks: totalLinks,
      teamMembers: membersSnapshot.size,
      manualVideos: 0,
      manualCreators: 0,
      mcpCallsThisMonth: 0,
      lastUpdated: serverTimestamp(),
      currentPeriodStart: Timestamp.fromDate(new Date()),
      currentPeriodEnd: Timestamp.fromDate(this.getNextMonthDate())
    }, { merge: true });
    
    console.log(`✅ Usage cache updated: ${totalAccounts} accounts, ${totalVideos} videos, ${totalLinks} links`);
  }
  
  /**
   * Get limits for current subscription plan
   */
  static async getLimits(orgId: string): Promise<UsageLimits> {
    try {
      const subRef = doc(db, 'organizations', orgId, 'billing', 'subscription');
      const subDoc = await getDoc(subRef);
      
      const planTier: PlanTier = subDoc.exists() 
        ? (subDoc.data().planTier || 'free') 
        : 'free';
      
      const plan = SUBSCRIPTION_PLANS[planTier];
      
      return {
        maxAccounts: plan.features.maxAccounts,
        maxVideos: plan.features.maxVideos,
        maxLinks: plan.features.maxLinks,
        teamSeats: plan.features.teamSeats,
        mcpCallsPerMonth: plan.features.mcpCallsPerMonth
      };
    } catch (error) {
      console.error('Failed to get limits:', error);
      // Default to free plan limits on error
      return {
        maxAccounts: 1,
        maxVideos: 5,
        maxLinks: 1,
        teamSeats: 1,
        mcpCallsPerMonth: 10
      };
    }
  }
  
  /**
   * Get usage status for all resources
   */
  static async getUsageStatus(orgId: string): Promise<UsageStatus[]> {
    const [usage, limits] = await Promise.all([
      this.getUsage(orgId),
      this.getLimits(orgId)
    ]);
    
    return [
      this.calculateStatus('Tracked Accounts', usage.trackedAccounts, limits.maxAccounts),
      this.calculateStatus('Tracked Videos', usage.trackedVideos, limits.maxVideos),
      this.calculateStatus('Tracked Links', usage.trackedLinks, limits.maxLinks),
      this.calculateStatus('Team Members', usage.teamMembers, limits.teamSeats),
      this.calculateStatus('MCP Calls', usage.mcpCallsThisMonth, limits.mcpCallsPerMonth),
    ];
  }
  
  /**
   * Check if action is allowed (within limits)
   * Admin users bypass all limits
   */
  static async canPerformAction(
    orgId: string, 
    resource: 'account' | 'video' | 'link' | 'team' | 'mcp',
    userId?: string
  ): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    try {
      // Check if user is admin - admins bypass all limits
      if (userId && await AdminService.shouldBypassLimits(userId)) {
        console.log(`🔓 Admin user ${userId} bypassing ${resource} limit check`);
        return { allowed: true, current: 0, limit: -1 };
      }
      
      const [usage, limits] = await Promise.all([
        this.getUsage(orgId),
        this.getLimits(orgId)
      ]);
      
      let current: number;
      let limit: number;
      let resourceName: string;
      
      switch (resource) {
        case 'account':
          current = usage.trackedAccounts;
          limit = limits.maxAccounts;
          resourceName = 'tracked accounts';
          break;
        case 'video':
          current = usage.trackedVideos;
          limit = limits.maxVideos;
          resourceName = 'tracked videos';
          break;
        case 'link':
          current = usage.trackedLinks;
          limit = limits.maxLinks;
          resourceName = 'tracked links';
          break;
        case 'team':
          current = usage.teamMembers;
          limit = limits.teamSeats;
          resourceName = 'team members';
          break;
        case 'mcp':
          current = usage.mcpCallsThisMonth;
          limit = limits.mcpCallsPerMonth;
          resourceName = 'MCP API calls';
          break;
        default:
          return { allowed: false, reason: 'Unknown resource', current: 0, limit: 0 };
      }
      
      // -1 means unlimited
      if (limit === -1) {
        return { allowed: true, current, limit: -1 };
      }
      
      if (current >= limit) {
        return { 
          allowed: false, 
          reason: `You've reached your limit of ${limit} ${resourceName}. Upgrade your plan to add more.`,
          current,
          limit
        };
      }
      
      return { allowed: true, current, limit };
    } catch (error) {
      console.error('Failed to check usage limits:', error);
      return { allowed: false, reason: 'Failed to verify usage limits', current: 0, limit: 0 };
    }
  }
  
  /**
   * Increment usage counter
   */
  static async incrementUsage(
    orgId: string, 
    resource: 'trackedAccounts' | 'trackedVideos' | 'trackedLinks' | 'teamMembers' | 'manualVideos' | 'manualCreators' | 'mcpCallsThisMonth',
    amount: number = 1
  ): Promise<void> {
    try {
      const usageRef = doc(db, 'organizations', orgId, 'billing', 'usage');
      await updateDoc(usageRef, {
        [resource]: increment(amount),
        lastUpdated: serverTimestamp()
      });
      
      console.log(`✅ Incremented ${resource} by ${amount} for org ${orgId}`);
    } catch (error) {
      console.error(`Failed to increment usage for ${resource}:`, error);
      throw error;
    }
  }
  
  /**
   * Decrement usage counter
   */
  static async decrementUsage(
    orgId: string, 
    resource: 'trackedAccounts' | 'trackedVideos' | 'trackedLinks' | 'teamMembers',
    amount: number = 1
  ): Promise<void> {
    try {
      const usageRef = doc(db, 'organizations', orgId, 'billing', 'usage');
      await updateDoc(usageRef, {
        [resource]: increment(-amount),
        lastUpdated: serverTimestamp()
      });
      
      console.log(`✅ Decremented ${resource} by ${amount} for org ${orgId}`);
    } catch (error) {
      console.error(`Failed to decrement usage for ${resource}:`, error);
      throw error;
    }
  }
  
  /**
   * Reset monthly usage (for MCP calls)
   */
  static async resetMonthlyUsage(orgId: string): Promise<void> {
    try {
      const usageRef = doc(db, 'organizations', orgId, 'billing', 'usage');
      const now = new Date();
      const nextMonth = this.getNextMonthDate();
      
      await updateDoc(usageRef, {
        mcpCallsThisMonth: 0,
        currentPeriodStart: Timestamp.fromDate(now),
        currentPeriodEnd: Timestamp.fromDate(nextMonth),
        lastUpdated: serverTimestamp()
      });
      
      console.log(`✅ Reset monthly usage for org ${orgId}`);
    } catch (error) {
      console.error('Failed to reset monthly usage:', error);
      throw error;
    }
  }
  
  // Helper methods
  
  private static calculateStatus(
    resource: string, 
    current: number, 
    limit: number
  ): UsageStatus {
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
    const isOverLimit = !isUnlimited && current >= limit;
    const isNearLimit = !isUnlimited && percentage >= 80;
    
    return {
      resource,
      current,
      limit,
      percentage,
      isUnlimited,
      isOverLimit,
      isNearLimit
    };
  }
  
  private static getNextMonthDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}

export default UsageTrackingService;

