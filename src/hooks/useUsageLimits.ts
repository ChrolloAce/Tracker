import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UsageTrackingService from '../services/UsageTrackingService';

/**
 * Custom hook for checking and enforcing usage limits
 * 
 * Usage:
 * ```tsx
 * const { checkLimit, UpgradeModal } = useUsageLimits();
 * 
 * const handleAddAccount = async () => {
 *   if (!(await checkLimit('account'))) {
 *     return; // Upgrade modal shown automatically
 *   }
 *   // Proceed with adding account
 * };
 * ```
 */
export function useUsageLimits() {
  const { currentOrgId, currentUser } = useAuth();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{
    resourceType: 'account' | 'video' | 'link' | 'team' | 'mcp';
    currentLimit: number;
    currentUsage: number;
  } | null>(null);

  /**
   * Check if an action is allowed
   * Returns true if allowed, false if limit reached (and shows upgrade modal)
   * Admin users bypass all limits
   */
  const checkLimit = useCallback(async (
    resource: 'account' | 'video' | 'link' | 'team' | 'mcp'
  ): Promise<boolean> => {
    if (!currentOrgId) {
      console.error('No organization ID found');
      return false;
    }

    try {
      const result = await UsageTrackingService.canPerformAction(
        currentOrgId, 
        resource,
        currentUser?.uid // Pass userId for admin check
      );
      
      if (!result.allowed) {
        // Show upgrade modal
        setLimitInfo({
          resourceType: resource,
          currentLimit: result.limit,
          currentUsage: result.current
        });
        setIsUpgradeModalOpen(true);
        
        // Optional: Show toast notification
        console.warn(`❌ ${result.reason}`);
      }
      
      return result.allowed;
    } catch (error) {
      console.error('Failed to check usage limit:', error);
      return false;
    }
  }, [currentOrgId, currentUser]);

  /**
   * Increment usage after successful action
   */
  const incrementUsage = useCallback(async (
    resource: 'trackedAccounts' | 'trackedVideos' | 'trackedLinks' | 'teamMembers' | 'manualVideos' | 'manualCreators' | 'mcpCallsThisMonth',
    amount: number = 1
  ): Promise<void> => {
    if (!currentOrgId) {
      console.error('No organization ID found');
      return;
    }

    try {
      await UsageTrackingService.incrementUsage(currentOrgId, resource, amount);
    } catch (error) {
      console.error('Failed to increment usage:', error);
    }
  }, [currentOrgId]);

  /**
   * Decrement usage after deletion
   */
  const decrementUsage = useCallback(async (
    resource: 'trackedAccounts' | 'trackedVideos' | 'trackedLinks' | 'teamMembers',
    amount: number = 1
  ): Promise<void> => {
    if (!currentOrgId) {
      console.error('No organization ID found');
      return;
    }

    try {
      await UsageTrackingService.decrementUsage(currentOrgId, resource, amount);
    } catch (error) {
      console.error('Failed to decrement usage:', error);
    }
  }, [currentOrgId]);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setLimitInfo(null);
  }, []);

  return {
    checkLimit,
    incrementUsage,
    decrementUsage,
    isUpgradeModalOpen,
    closeUpgradeModal,
    limitInfo
  };
}

