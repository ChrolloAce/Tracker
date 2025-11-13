import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  OrganizationSubscription, 
  PlanTier, 
  PlanLimits, 
  UsageLimit,
  SUBSCRIPTION_PLANS 
} from '../types/subscription';
import AdminService from './AdminService';

/**
 * Subscription and billing management service
 */
class SubscriptionService {
  
  /**
   * Get organization's subscription
   */
  static async getSubscription(orgId: string): Promise<OrganizationSubscription | null> {
    console.log('🔍 Fetching subscription for org:', orgId);
    const subDoc = await getDoc(doc(db, 'organizations', orgId, 'billing', 'subscription'));
    
    if (subDoc.exists()) {
      const data = subDoc.data();
      console.log('✅ Subscription found:', data);
      return {
        ...data,
        currentPeriodStart: data.currentPeriodStart.toDate(),
        currentPeriodEnd: data.currentPeriodEnd.toDate(),
        trialEnd: data.trialEnd?.toDate(),
        usage: {
          ...data.usage,
          lastReset: data.usage.lastReset.toDate(),
        },
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as OrganizationSubscription;
    }
    
    console.warn('⚠️ No subscription document found for org:', orgId);
    console.warn('   Expected path:', `organizations/${orgId}/billing/subscription`);
    console.warn('   This organization needs a subscription document created.');
    return null;
  }

  /**
   * Get current plan tier for organization
   */
  static async getPlanTier(orgId: string): Promise<PlanTier> {
    const subscription = await this.getSubscription(orgId);
    return subscription?.planTier || 'free'; // Default to free
  }

  /**
   * Check if subscription is expired or needs renewal
   */
  static async isSubscriptionExpired(orgId: string): Promise<boolean> {
    const subscription = await this.getSubscription(orgId);
    
    if (!subscription) return true; // No subscription = expired
    
    // If subscription is canceled or past_due, it's expired
    if (subscription.status === 'canceled' || subscription.status === 'past_due') {
      return true;
    }
    
    // Check if current period has ended
    const now = new Date();
    if (subscription.currentPeriodEnd < now) {
      return true;
    }
    
    return false;
  }

  /**
   * Get subscription status with expiration info
   */
  static async getSubscriptionStatus(orgId: string): Promise<{
    planTier: PlanTier;
    isActive: boolean;
    isExpired: boolean;
    expiresAt: Date | null;
    daysUntilExpiry: number | null;
    needsRenewal: boolean;
  }> {
    const subscription = await this.getSubscription(orgId);
    
    if (!subscription) {
      return {
        planTier: 'free',
        isActive: false,
        isExpired: true,
        expiresAt: null,
        daysUntilExpiry: null,
        needsRenewal: true,
      };
    }

    const now = new Date();
    const expiresAt = subscription.currentPeriodEnd;
    const isExpired = expiresAt < now || subscription.status !== 'active';
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      planTier: subscription.planTier,
      isActive: subscription.status === 'active',
      isExpired,
      expiresAt,
      daysUntilExpiry: isExpired ? null : daysUntilExpiry,
      needsRenewal: isExpired || subscription.cancelAtPeriodEnd,
    };
  }

  /**
   * Check if organization can perform action based on plan limits
   * Admin users bypass all limits
   */
  static async canPerformAction(
    orgId: string,
    action: 'addAccount' | 'addVideo' | 'addTeamMember' | 'makeMCPCall' | 'addLink' | 'refreshOnDemand',
    userId?: string
  ): Promise<{ allowed: boolean; reason?: string; limit?: number; current?: number }> {
    // Check if user is admin - admins bypass all limits
    if (userId && await AdminService.shouldBypassLimits(userId)) {
      console.log(`🔓 Admin user ${userId} bypassing ${action} limit check`);
      return { allowed: true, limit: -1, current: 0 };
    }
    
    const subscription = await this.getSubscription(orgId);
    
    if (!subscription) {
      return { allowed: false, reason: 'No active subscription' };
    }

    const plan = SUBSCRIPTION_PLANS[subscription.planTier];
    
    switch (action) {
      case 'addAccount':
        if (plan.features.maxAccounts === -1) return { allowed: true };
        if (subscription.usage.accounts >= plan.features.maxAccounts) {
          return {
            allowed: false,
            reason: `Account limit reached (${plan.features.maxAccounts})`,
            limit: plan.features.maxAccounts,
            current: subscription.usage.accounts,
          };
        }
        return { allowed: true };

      case 'addVideo':
        if (plan.features.maxVideos === -1) return { allowed: true };
        if (subscription.usage.videos >= plan.features.maxVideos) {
          return {
            allowed: false,
            reason: `Video limit reached (${plan.features.maxVideos})`,
            limit: plan.features.maxVideos,
            current: subscription.usage.videos,
          };
        }
        return { allowed: true };

      case 'addTeamMember':
        if (plan.features.teamSeats === -1) return { allowed: true };
        if (subscription.usage.teamMembers >= plan.features.teamSeats) {
          return {
            allowed: false,
            reason: `Team seat limit reached (${plan.features.teamSeats})`,
            limit: plan.features.teamSeats,
            current: subscription.usage.teamMembers,
          };
        }
        return { allowed: true };

      case 'makeMCPCall':
        if (plan.features.mcpCallsPerMonth === -1) return { allowed: true };
        if (subscription.usage.mcpCalls >= plan.features.mcpCallsPerMonth) {
          return {
            allowed: false,
            reason: `API call limit reached (${plan.features.mcpCallsPerMonth}/month)`,
            limit: plan.features.mcpCallsPerMonth,
            current: subscription.usage.mcpCalls,
          };
        }
        return { allowed: true };

      case 'addLink':
        if (plan.features.maxLinks === -1) return { allowed: true };
        if (subscription.usage.links >= plan.features.maxLinks) {
          return {
            allowed: false,
            reason: `Link limit reached (${plan.features.maxLinks})`,
            limit: plan.features.maxLinks,
            current: subscription.usage.links,
          };
        }
        return { allowed: true };

      case 'refreshOnDemand':
        if (!plan.features.refreshOnDemand) {
          return {
            allowed: false,
            reason: 'On-demand refresh not available in your plan',
          };
        }
        return { allowed: true };

      default:
        return { allowed: true };
    }
  }

  /**
   * Get plan limits with current usage
   */
  static async getPlanLimits(orgId: string): Promise<PlanLimits> {
    const subscription = await this.getSubscription(orgId);
    
    if (!subscription) {
      throw new Error('No active subscription');
    }

    const plan = SUBSCRIPTION_PLANS[subscription.planTier];
    
    const calculateLimit = (current: number, max: number): UsageLimit => {
      const isUnlimited = max === -1;
      const percentage = isUnlimited ? 0 : (current / max) * 100;
      return {
        current,
        limit: max,
        percentage,
        isOverLimit: !isUnlimited && current >= max,
      };
    };

    return {
      accounts: calculateLimit(subscription.usage.accounts, plan.features.maxAccounts),
      videos: calculateLimit(subscription.usage.videos, plan.features.maxVideos),
      teamSeats: calculateLimit(subscription.usage.teamMembers, plan.features.teamSeats),
      mcpCalls: calculateLimit(subscription.usage.mcpCalls, plan.features.mcpCallsPerMonth),
      links: calculateLimit(subscription.usage.links, plan.features.maxLinks),
    };
  }

  /**
   * Increment usage counter
   */
  static async incrementUsage(
    orgId: string,
    metric: 'accounts' | 'videos' | 'teamMembers' | 'mcpCalls' | 'links',
    amount: number = 1
  ): Promise<void> {
    const subRef = doc(db, 'organizations', orgId, 'billing', 'subscription');
    const subscription = await this.getSubscription(orgId);
    
    if (!subscription) {
      throw new Error('No active subscription');
    }

    await updateDoc(subRef, {
      [`usage.${metric}`]: subscription.usage[metric] + amount,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Decrement usage counter
   */
  static async decrementUsage(
    orgId: string,
    metric: 'accounts' | 'videos' | 'teamMembers' | 'mcpCalls' | 'links',
    amount: number = 1
  ): Promise<void> {
    const subRef = doc(db, 'organizations', orgId, 'billing', 'subscription');
    const subscription = await this.getSubscription(orgId);
    
    if (!subscription) {
      throw new Error('No active subscription');
    }

    const newValue = Math.max(0, subscription.usage[metric] - amount);
    
    await updateDoc(subRef, {
      [`usage.${metric}`]: newValue,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Reset monthly usage counters (called by cron job)
   */
  static async resetMonthlyUsage(orgId: string): Promise<void> {
    const subRef = doc(db, 'organizations', orgId, 'billing', 'subscription');
    
    await updateDoc(subRef, {
      'usage.mcpCalls': 0,
      'usage.lastReset': Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Create default subscription for new organization (free trial)
   */
  static async createDefaultSubscription(orgId: string): Promise<void> {
    const subRef = doc(db, 'organizations', orgId, 'billing', 'subscription');
    
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7); // 7-day trial
    
    const subscription: Omit<OrganizationSubscription, 'id'> = {
      orgId,
      planTier: 'free',
      status: 'trialing',
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripePriceId: '',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      trialEnd,
      usage: {
        accounts: 0,
        videos: 0,
        teamMembers: 1,
        mcpCalls: 0,
        links: 0,
        lastReset: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(subRef, {
      ...subscription,
      currentPeriodStart: Timestamp.fromDate(subscription.currentPeriodStart),
      currentPeriodEnd: Timestamp.fromDate(subscription.currentPeriodEnd),
      trialEnd: subscription.trialEnd ? Timestamp.fromDate(subscription.trialEnd) : null,
      usage: {
        ...subscription.usage,
        lastReset: Timestamp.fromDate(subscription.usage.lastReset),
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Check if feature is available in current plan
   */
  static async hasFeature(orgId: string, feature: keyof typeof SUBSCRIPTION_PLANS.basic.features): Promise<boolean> {
    const subscription = await this.getSubscription(orgId);
    if (!subscription) return false;
    
    const plan = SUBSCRIPTION_PLANS[subscription.planTier];
    const featureValue = plan.features[feature];
    
    // Handle boolean features
    if (typeof featureValue === 'boolean') {
      return featureValue;
    }
    
    // Handle numeric features (-1 means unlimited/available)
    if (typeof featureValue === 'number') {
      return featureValue !== 0;
    }
    
    return false;
  }
}

export default SubscriptionService;

