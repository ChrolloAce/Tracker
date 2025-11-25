import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * LockService
 * 
 * Purpose: Manage job-level locking to prevent concurrent syncs
 * Responsibilities:
 * - Acquire locks on accounts
 * - Release locks after sync completion
 * - Check lock validity
 * - Clean up stale locks
 */
export class LockService {
  /**
   * Generate a unique lock ID
   */
  static generateLockId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
  
  /**
   * Check if a lock is still valid
   * @param lockTimestamp - The timestamp when the lock was acquired
   * @param maxAgeMinutes - Maximum age of the lock in minutes (default: 5)
   * @returns true if lock is valid, false if expired
   */
  static isLockValid(
    lockTimestamp: Timestamp | undefined | null,
    maxAgeMinutes: number = 5
  ): boolean {
    if (!lockTimestamp) {
      return false;
    }
    
    const lockAge = Date.now() - lockTimestamp.toMillis();
    const maxAge = maxAgeMinutes * 60 * 1000;
    
    return lockAge < maxAge;
  }
  
  /**
   * Get lock age in seconds
   */
  static getLockAgeSeconds(lockTimestamp: Timestamp | undefined | null): number {
    if (!lockTimestamp) {
      return 0;
    }
    
    return Math.round((Date.now() - lockTimestamp.toMillis()) / 1000);
  }
  
  /**
   * Attempt to acquire a lock on an account
   * @returns { acquired: boolean, reason?: string, lockAge?: number }
   */
  static async acquireLock(
    accountRef: FirebaseFirestore.DocumentReference,
    lockId: string,
    maxAgeMinutes: number = 5
  ): Promise<{ acquired: boolean; reason?: string; lockAge?: number }> {
    // Get current account data
    const accountDoc = await accountRef.get();
    const accountData = accountDoc.data();
    
    if (!accountData) {
      return { acquired: false, reason: 'Account not found' };
    }
    
    // Check if there's an existing lock
    if (accountData.syncLockId && accountData.syncLockTimestamp) {
      // ✅ ALLOW REENTRY: If we already own the lock, refresh it and proceed
      if (accountData.syncLockId === lockId) {
        await accountRef.update({ syncLockTimestamp: Timestamp.now() });
        return { acquired: true };
      }

      const isValid = this.isLockValid(accountData.syncLockTimestamp, maxAgeMinutes);
      
      if (isValid) {
        const lockAge = this.getLockAgeSeconds(accountData.syncLockTimestamp);
        return {
          acquired: false,
          reason: 'Account locked by another sync job',
          lockAge
        };
      }
      
      // Lock expired, we can proceed
      console.log(`   🔓 Lock expired (${this.getLockAgeSeconds(accountData.syncLockTimestamp)}s old), acquiring new lock`);
    }
    
    // Acquire lock
    await accountRef.update({
      syncLockId: lockId,
      syncLockTimestamp: Timestamp.now()
    });
    
    return { acquired: true };
  }
  
  /**
   * Release a lock on an account
   */
  static async releaseLock(
    accountRef: FirebaseFirestore.DocumentReference,
    lockId: string
  ): Promise<void> {
    // Verify we own the lock before releasing
    const accountDoc = await accountRef.get();
    const accountData = accountDoc.data();
    
    if (accountData?.syncLockId === lockId) {
      await accountRef.update({
        syncLockId: FieldValue.delete(),
        syncLockTimestamp: FieldValue.delete()
      });
    } else {
      console.warn(`   ⚠️  Attempted to release lock ${lockId} but current lock is ${accountData?.syncLockId}`);
    }
  }
  
  /**
   * Clean up stale locks (expired locks)
   * Useful for maintenance operations
   */
  static async cleanupStaleLocks(
    accountRef: FirebaseFirestore.DocumentReference,
    maxAgeMinutes: number = 5
  ): Promise<boolean> {
    const accountDoc = await accountRef.get();
    const accountData = accountDoc.data();
    
    if (!accountData?.syncLockTimestamp) {
      return false; // No lock to clean up
    }
    
    const isValid = this.isLockValid(accountData.syncLockTimestamp, maxAgeMinutes);
    
    if (!isValid) {
      // Lock is stale, remove it
      await accountRef.update({
        syncLockId: FieldValue.delete(),
        syncLockTimestamp: FieldValue.delete()
      });
      return true;
    }
    
    return false; // Lock is still valid
  }
}

