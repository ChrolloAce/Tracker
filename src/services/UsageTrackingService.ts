import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { SUBSCRIPTION_PLANS, PlanTier } from '../types/subscription';

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
   * COUNTS ACTUAL RESOURCES - no separate tracking needed!
   */
  static async getUsage(orgId: string): Promise<UsageMetrics> {
    try {
      // Get all projects for this org
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      
      const projectsRef = collection(db, 'organizations', orgId, 'projects');
      const projectsSnapshot = await getDocs(projectsRef);
      
      let totalAccounts = 0;
      let totalVideos = 0;
      let totalLinks = 0;
      
      // Count across all projects
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        
        // Count active accounts
        const accountsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts');
        const accountsQuery = query(accountsRef, where('isActive', '==', true));
        const accountsSnapshot = await getDocs(accountsQuery);
        totalAccounts += accountsSnapshot.size;
        
        // Count videos
        const videosRef = collection(db, 'organizations', orgId, 'projects', projectId, 'videos');
        const videosSnapshot = await getDocs(videosRef);
        totalVideos += videosSnapshot.size;
        
        // Count active links
        const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'links');
        const linksQuery = query(linksRef, where('isActive', '==', true));
        const linksSnapshot = await getDocs(linksQuery);
        totalLinks += linksSnapshot.size;
      }
      
      // Count team members
      const membersRef = collection(db, 'organizations', orgId, 'members');
      const membersQuery = query(membersRef, where('status', '==', 'active'));
      const membersSnapshot = await getDocs(membersQuery);
      const teamMembers = membersSnapshot.size;
      
      // Get MCP calls from usage doc if it exists
      const usageRef = doc(db, 'organizations', orgId, 'billing', 'usage');
      const usageDoc = await getDoc(usageRef);
      const mcpCallsThisMonth = usageDoc.exists() ? (usageDoc.data()?.mcpCallsThisMonth || 0) : 0;
      
      console.log(`📊 Real-time usage for org ${orgId}: ${totalAccounts} accounts, ${totalVideos} videos, ${totalLinks} links, ${teamMembers} members`);
      
      return {
        trackedAccounts: totalAccounts,
        trackedVideos: totalVideos,
        trackedLinks: totalLinks,
        teamMembers: teamMembers,
        manualVideos: 0,
        manualCreators: 0,
        mcpCallsThisMonth,
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
   */
  static async canPerformAction(
    orgId: string, 
    resource: 'account' | 'video' | 'link' | 'team' | 'mcp'
  ): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
    try {
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

