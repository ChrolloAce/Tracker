/**
 * LockService
 * 
 * Purpose: Handle job-level locking to prevent concurrent syncs
 * Responsibilities:
 * - Generate unique lock IDs
 * - Check if account is locked
 * - Validate lock age
 * 
 * Note: Frontend version is a placeholder. Real locking happens in backend.
 * This exists for architectural consistency and potential future use.
 */
export class LockService {
  
  /**
   * Generate a unique lock ID
   */
  static generateLockId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
  
  /**
   * Check if a lock is still valid (not expired)
   * @param lockTimestamp - The lock timestamp (milliseconds)
   * @param maxAgeMinutes - Maximum lock age in minutes (default: 5)
   */
  static isLockValid(lockTimestamp: number | null | undefined, maxAgeMinutes: number = 5): boolean {
    if (!lockTimestamp) {
      return false;
    }
    
    const lockAge = Date.now() - lockTimestamp;
    const maxAge = maxAgeMinutes * 60 * 1000;
    
    return lockAge < maxAge;
  }
  
  /**
   * Get lock age in seconds
   */
  static getLockAgeSeconds(lockTimestamp: number): number {
    return Math.round((Date.now() - lockTimestamp) / 1000);
  }
}

