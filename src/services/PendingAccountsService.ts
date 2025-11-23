import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { AccountTrackingServiceFirebase } from './AccountTrackingServiceFirebase';

/**
 * PendingAccountsService
 * 
 * Purpose: Manage accounts added during onboarding BEFORE payment
 * Responsibilities:
 * - Store accounts in a temporary collection during onboarding
 * - Activate all pending accounts once user subscribes
 * - Clean up pending accounts after activation
 */

export interface PendingOnboardingAccount {
  id?: string;
  orgId: string;
  projectId: string;
  userId: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  accountType: 'my' | 'competitor';
  maxVideos: number;
  url: string;
  createdAt: Timestamp;
  status: 'pending' | 'activated' | 'failed';
}

class PendingAccountsService {
  
  /**
   * Add account to pending collection during onboarding
   * These accounts won't be synced until user pays
   */
  static async addPendingAccount(
    orgId: string,
    projectId: string,
    userId: string,
    username: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    accountType: 'my' | 'competitor' = 'my',
    maxVideos: number = 100,
    url: string
  ): Promise<string> {
    try {
      console.log(`📝 [PENDING] Adding account @${username} (${platform}) to pending collection`);
      console.log(`   Will sync ${maxVideos} videos once user subscribes`);
      
      const accountData: Omit<PendingOnboardingAccount, 'id'> = {
        orgId,
        projectId,
        userId,
        username,
        platform,
        accountType,
        maxVideos,
        url,
        createdAt: Timestamp.now(),
        status: 'pending'
      };
      
      const docRef = await addDoc(
        collection(db, 'pendingOnboardingAccounts'),
        accountData
      );
      
      console.log(`✅ [PENDING] Account saved with ID: ${docRef.id}`);
      return docRef.id;
      
    } catch (error) {
      console.error('❌ [PENDING] Failed to add pending account:', error);
      throw error;
    }
  }
  
  /**
   * Get all pending accounts for an organization
   */
  static async getPendingAccounts(orgId: string): Promise<PendingOnboardingAccount[]> {
    try {
      console.log(`📋 [PENDING] Fetching pending accounts for org: ${orgId}`);
      
      const q = query(
        collection(db, 'pendingOnboardingAccounts'),
        where('orgId', '==', orgId),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const accounts: PendingOnboardingAccount[] = [];
      
      snapshot.forEach((doc) => {
        accounts.push({
          id: doc.id,
          ...doc.data()
        } as PendingOnboardingAccount);
      });
      
      console.log(`✅ [PENDING] Found ${accounts.length} pending accounts`);
      return accounts;
      
    } catch (error) {
      console.error('❌ [PENDING] Failed to fetch pending accounts:', error);
      return [];
    }
  }
  
  /**
   * Activate all pending accounts after user subscribes
   * This will create the accounts in the main system and queue them for sync
   */
  static async activatePendingAccounts(orgId: string, projectId: string, userId: string): Promise<{
    activated: number;
    failed: number;
    errors: string[];
  }> {
    try {
      console.log('');
      console.log('🚀 [PENDING] ========================================');
      console.log('🚀 [PENDING] ACTIVATING PENDING ACCOUNTS');
      console.log('🚀 [PENDING] ========================================');
      console.log(`   Org: ${orgId}`);
      console.log(`   Project: ${projectId}`);
      console.log(`   User: ${userId}`);
      
      const pendingAccounts = await this.getPendingAccounts(orgId);
      
      if (pendingAccounts.length === 0) {
        console.log('ℹ️ [PENDING] No pending accounts to activate');
        return { activated: 0, failed: 0, errors: [] };
      }
      
      console.log(`📦 [PENDING] Activating ${pendingAccounts.length} accounts...`);
      
      let activated = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const account of pendingAccounts) {
        try {
          console.log(`\n🔄 [PENDING] Activating @${account.username} (${account.platform})`);
          console.log(`   Max videos: ${account.maxVideos}`);
          
          // Add account to the main tracking system
          // This will create the account and queue it for sync
          const accountId = await AccountTrackingServiceFirebase.addAccount(
            orgId,
            projectId,
            userId,
            account.username,
            account.platform,
            account.accountType,
            account.maxVideos
          );
          
          console.log(`✅ [PENDING] Account activated with ID: ${accountId}`);
          console.log(`   Status: Queued for background sync`);
          
          // Delete from pending collection
          if (account.id) {
            await deleteDoc(doc(db, 'pendingOnboardingAccounts', account.id));
            console.log(`🗑️ [PENDING] Removed from pending collection`);
          }
          
          activated++;
          
        } catch (error: any) {
          console.error(`❌ [PENDING] Failed to activate @${account.username}:`, error.message);
          failed++;
          errors.push(`Failed to activate @${account.username}: ${error.message}`);
        }
      }
      
      console.log('');
      console.log('✅ [PENDING] ========================================');
      console.log(`✅ [PENDING] ACTIVATION COMPLETE`);
      console.log(`   ✓ Activated: ${activated}`);
      console.log(`   ✗ Failed: ${failed}`);
      console.log('✅ [PENDING] ========================================');
      console.log('');
      
      return { activated, failed, errors };
      
    } catch (error) {
      console.error('❌ [PENDING] Failed to activate pending accounts:', error);
      throw error;
    }
  }
  
  /**
   * Get count of pending accounts for an organization
   */
  static async getPendingAccountsCount(orgId: string): Promise<number> {
    try {
      const accounts = await this.getPendingAccounts(orgId);
      return accounts.length;
    } catch (error) {
      console.error('❌ [PENDING] Failed to get pending accounts count:', error);
      return 0;
    }
  }
  
  /**
   * Clear all pending accounts for an organization
   * Use this if user abandons onboarding or after successful activation
   */
  static async clearPendingAccounts(orgId: string): Promise<void> {
    try {
      console.log(`🗑️ [PENDING] Clearing pending accounts for org: ${orgId}`);
      
      const q = query(
        collection(db, 'pendingOnboardingAccounts'),
        where('orgId', '==', orgId)
      );
      
      const snapshot = await getDocs(q);
      const deletePromises: Promise<void>[] = [];
      
      snapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      
      console.log(`✅ [PENDING] Cleared ${snapshot.size} pending accounts`);
      
    } catch (error) {
      console.error('❌ [PENDING] Failed to clear pending accounts:', error);
      throw error;
    }
  }
}

export default PendingAccountsService;

