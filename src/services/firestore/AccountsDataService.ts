import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { TrackedAccount } from '../../types/firestore';
import UsageTrackingService from '../UsageTrackingService';

/**
 * AccountsDataService
 * 
 * Handles all tracked account operations in Firestore.
 * Manages accounts within the project scope: organizations/{orgId}/projects/{projectId}/trackedAccounts
 */
export class AccountsDataService {
  
  /**
   * Add a tracked social media account to a project
   */
  static async addTrackedAccount(
    orgId: string,
    projectId: string,
    userId: string,
    accountData: Omit<TrackedAccount, 'id' | 'orgId' | 'dateAdded' | 'addedBy' | 'totalVideos' | 'totalViews' | 'totalLikes' | 'totalComments' | 'totalShares'>,
    skipSync: boolean = false
  ): Promise<string> {
    // ── Dedup check: return existing account ID if one already exists and is healthy ──
    if (accountData.username && accountData.platform) {
      const normalizedUsername = accountData.username.toLowerCase();
      const accountsCol = collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts');

      // 1) Check deterministic-ID doc first (instant, no query)
      const deterministicId = `${accountData.platform}_${normalizedUsername.replace(/[^a-z0-9_.-]/g, '_')}`;
      const deterministicRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', deterministicId);
      const deterministicSnap = await getDoc(deterministicRef);
      if (deterministicSnap.exists()) {
        const existing = deterministicSnap.data();
        // Only skip if account is healthy (has required fields and is active)
        if (existing?.username && existing?.platform && existing?.isActive !== false) {
          console.log(`⚠️ Account @${normalizedUsername} on ${accountData.platform} already exists (deterministic ID: ${deterministicId}) — skipping creation`);
          return deterministicId;
        }
        // Account doc exists but is broken/inactive — will be overwritten below
        console.log(`🔧 Account @${normalizedUsername} exists but is broken/inactive — re-creating`);
      }

      // 2) Fallback query for legacy random-ID accounts
      const existingQuery = query(
        accountsCol,
        where('username', '==', normalizedUsername),
        where('platform', '==', accountData.platform)
      );
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existing = existingDoc.data();
        if (existing?.username && existing?.platform && existing?.isActive !== false) {
          console.log(`⚠️ Account @${normalizedUsername} on ${accountData.platform} already exists (legacy ID: ${existingDoc.id}) — skipping creation`);
          return existingDoc.id;
        }
        console.log(`🔧 Legacy account @${normalizedUsername} exists but is broken/inactive — re-creating with deterministic ID`);
      }
    }

    const batch = writeBatch(db);
    
    // Use deterministic ID to prevent race-condition duplicates
    const normalizedUser = (accountData.username || 'unknown').toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    const deterministicAccountId = `${accountData.platform}_${normalizedUser}`;
    const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', deterministicAccountId);
    const fullAccountData: TrackedAccount = {
      ...accountData,
      id: deterministicAccountId,
      orgId,
      dateAdded: Timestamp.now(),
      addedBy: userId,
      isRead: false,
      totalVideos: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      // Background sync fields - set to 'completed' if skipping sync, 'idle' otherwise (queue will pick it up)
      syncStatus: skipSync ? 'completed' : 'idle',
      syncRequestedBy: userId,
      syncRequestedAt: Timestamp.now(),
      syncRetryCount: 0,
      maxRetries: 3,
      syncProgress: {
        current: skipSync ? 100 : 0,
        total: 100,
        message: skipSync ? 'Video added successfully' : 'Queued for sync...'
      }
    };
    
    batch.set(accountRef, fullAccountData);
    
    // Increment project account count
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    batch.update(projectRef, { 
      trackedAccountCount: increment(1),
      updatedAt: Timestamp.now()
    });
    
    await batch.commit();
    
    // Increment organization usage counter
    try {
      await UsageTrackingService.incrementUsage(orgId, 'trackedAccounts', 1);
      console.log(`✅ Incremented usage counter for org ${orgId}`);
    } catch (error) {
      console.error('⚠️ Failed to increment usage counter (non-critical):', error);
    }
    
    console.log(`✅ Added tracked account ${accountData.username} to project ${projectId} with sync status: ${skipSync ? 'completed' : 'pending'}`);
    console.log(`🔍 DEBUG: skipSync = ${skipSync}, will trigger immediate sync = ${!skipSync}`);
    
    if (!skipSync) {
      console.log(`⚡ [${accountData.platform?.toUpperCase()}] Triggering immediate sync for @${accountData.username}...`);
      console.log(`📋 DEBUG: Calling triggerImmediateSync with:`, { orgId, projectId, accountId: accountRef.id, platform: accountData.platform, username: accountData.username });
      
      // Trigger immediate sync (fire and forget)
      this.triggerImmediateSync(orgId, projectId, accountRef.id, accountData.platform, accountData.username).catch(err => {
        console.error(`❌ [${accountData.platform?.toUpperCase()}] Failed to trigger immediate sync for @${accountData.username}:`, err);
        console.error('Error details:', err.message, err.stack);
        // Non-critical - cron will pick it up anyway
      });
    } else {
      console.log(`⏭️ Skipping sync - account created for single video addition (status set to 'completed')`);
    }
    
    return accountRef.id;
  }

  /**
   * Queue high-priority sync for an account through the job queue
   * This provides instant feedback to users when they add accounts
   * Falls back to cron job if queueing fails
   */
  private static async triggerImmediateSync(
    orgId: string, 
    projectId: string, 
    accountId: string, 
    platform?: string, 
    username?: string
  ): Promise<void> {
    const platformLabel = platform?.toUpperCase() || 'UNKNOWN';
    const accountLabel = username ? `@${username}` : accountId;
    
    try {
      console.log(`🚀 [${platformLabel}] Queueing high-priority sync for ${accountLabel}...`);
      console.log(`📡 [${platformLabel}] Calling /api/queue-manual-account for ${accountLabel}...`);
      
      // Queue through the new priority-based system
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No auth token available');
      }
      
      const response = await fetch('/api/queue-manual-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId,
          projectId,
          accountId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log(`✅ [${platformLabel}] Account queued successfully for ${accountLabel}!`);
      console.log(`   Status: ${result.status || 'queued'}`);
      console.log(`   Priority: ${result.priority || 100}`);
      console.log(`   Job ID: ${result.jobId || 'unknown'}`);
    } catch (error: any) {
      console.error(`❌ [${platformLabel}] Failed to queue sync for ${accountLabel}:`, error);
      console.error(`   Error type: ${error.constructor.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Full error:`, error);
      // Non-critical error - cron will process it anyway
      throw error; // Re-throw so the outer catch can log it too
    }
  }

  /**
   * Get a single tracked account by ID
   */
  static async getTrackedAccount(orgId: string, projectId: string, accountId: string): Promise<TrackedAccount | null> {
    const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      return null;
    }
    
    return { id: accountSnap.id, ...accountSnap.data() } as TrackedAccount;
  }

  /**
   * Get all tracked accounts for a project
   */
  static async getTrackedAccounts(orgId: string, projectId: string, platform?: string): Promise<TrackedAccount[]> {
    let q = query(
      collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'),
      where('isActive', '==', true),
      orderBy('dateAdded', 'desc')
    );
    
    if (platform) {
      q = query(
        collection(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts'),
        where('platform', '==', platform),
        where('isActive', '==', true),
        orderBy('dateAdded', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackedAccount));
  }

  /**
   * Update tracked account in a project
   */
  static async updateTrackedAccount(orgId: string, projectId: string, accountId: string, updates: Partial<TrackedAccount>): Promise<void> {
    const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', accountId);
    await setDoc(accountRef, updates, { merge: true });
    console.log(`✅ Updated tracked account ${accountId}`);
  }

  /**
   * Delete tracked account from a project
   */
  static async deleteTrackedAccount(orgId: string, projectId: string, accountId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete account
    const accountRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackedAccounts', accountId);
    batch.delete(accountRef);
    
    // Decrement project count
    const projectRef = doc(db, 'organizations', orgId, 'projects', projectId);
    batch.update(projectRef, { 
      trackedAccountCount: increment(-1),
      updatedAt: Timestamp.now()
    });
    
    await batch.commit();
    
    // Decrement organization usage counter
    try {
      await UsageTrackingService.decrementUsage(orgId, 'trackedAccounts', 1);
      console.log(`✅ Decremented usage counter for org ${orgId}`);
    } catch (error) {
      console.error('⚠️ Failed to decrement usage counter (non-critical):', error);
    }
    
    console.log(`✅ Deleted tracked account ${accountId}`);
  }
}

