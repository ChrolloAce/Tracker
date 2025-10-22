/**
 * Lightning-fast dashboard data caching service
 * Provides instant load times using localStorage
 */

export interface DashboardCache {
  accounts: any[];
  submissions: any[];
  rules: any[];
  selectedRuleIds: string[];
  timestamp: number;
}

export class DashboardCacheService {
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cache key for a specific org/project
   */
  private static getCacheKey(orgId: string, projectId: string): string {
    return `dashboard_cache_${orgId}_${projectId}`;
  }

  /**
   * Load cached dashboard data (instant!)
   */
  static loadCache(orgId: string, projectId: string): DashboardCache | null {
    try {
      const cacheKey = this.getCacheKey(orgId, projectId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        console.log('📭 No cache found');
        return null;
      }

      const data: DashboardCache = JSON.parse(cached);
      const cacheAge = Date.now() - data.timestamp;

      if (cacheAge > this.CACHE_DURATION) {
        console.log(`🕐 Cache expired (${Math.round(cacheAge / 1000)}s old)`);
        this.clearCache(orgId, projectId);
        return null;
      }

      console.log(`⚡ Cache loaded! Age: ${Math.round(cacheAge / 1000)}s`);
      return data;
    } catch (error) {
      console.error('❌ Failed to load cache:', error);
      return null;
    }
  }

  /**
   * Save dashboard data to cache
   */
  static saveCache(
    orgId: string,
    projectId: string,
    data: Omit<DashboardCache, 'timestamp'>
  ): boolean {
    try {
      const cacheKey = this.getCacheKey(orgId, projectId);
      const cacheData: DashboardCache = {
        ...data,
        timestamp: Date.now()
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('💾 Dashboard data cached successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to save cache:', error);
      
      // If quota exceeded, try clearing old caches
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.log('🧹 Clearing old caches...');
        this.clearAllCaches();
        
        // Try one more time
        try {
          localStorage.setItem(
            this.getCacheKey(orgId, projectId),
            JSON.stringify({ ...data, timestamp: Date.now() })
          );
          return true;
        } catch {
          return false;
        }
      }
      
      return false;
    }
  }

  /**
   * Clear cache for specific org/project
   */
  static clearCache(orgId: string, projectId: string): void {
    try {
      const cacheKey = this.getCacheKey(orgId, projectId);
      localStorage.removeItem(cacheKey);
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Clear all dashboard caches
   */
  static clearAllCaches(): void {
    try {
      const keys = Object.keys(localStorage);
      const dashboardKeys = keys.filter(key => key.startsWith('dashboard_cache_'));
      
      dashboardKeys.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ Cleared ${dashboardKeys.length} dashboard caches`);
    } catch (error) {
      console.error('Failed to clear all caches:', error);
    }
  }
}

