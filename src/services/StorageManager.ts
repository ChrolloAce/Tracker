/**
 * StorageManager
 * 
 * Purpose: Intelligently manage localStorage quota and prevent storage errors
 * Responsibilities:
 * - Monitor storage usage
 * - Implement LRU (Least Recently Used) cache eviction
 * - Compress data when possible
 * - Provide fallback strategies when quota is exceeded
 */

interface StorageItem {
  key: string;
  size: number;
  lastAccessed: number;
}

class StorageManager {
  private static readonly MAX_STORAGE_MB = 8; // Conservative limit (localStorage is typically 5-10MB)
  private static readonly MAX_BYTES = StorageManager.MAX_STORAGE_MB * 1024 * 1024;
  private static readonly WARNING_THRESHOLD = 0.8; // Warn at 80% usage

  /**
   * Calculate current storage usage
   */
  static getStorageUsage(): { usedBytes: number; usedMB: number; percentUsed: number } {
    let usedBytes = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          usedBytes += key.length + value.length;
        }
      }
    }

    const usedMB = usedBytes / (1024 * 1024);
    const percentUsed = (usedBytes / this.MAX_BYTES) * 100;

    return { usedBytes, usedMB, percentUsed };
  }

  /**
   * Check if there's enough space for new data
   */
  static hasSpace(dataSize: number): boolean {
    const { usedBytes } = this.getStorageUsage();
    return (usedBytes + dataSize) < this.MAX_BYTES;
  }

  /**
   * Get all storage items with metadata
   */
  private static getStorageItems(): StorageItem[] {
    const items: StorageItem[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          // Try to get lastAccessed from metadata
          let lastAccessed = Date.now();
          try {
            const parsed = JSON.parse(value);
            if (parsed._metadata?.lastAccessed) {
              lastAccessed = parsed._metadata.lastAccessed;
            }
          } catch {
            // Not JSON or no metadata, use current time
          }

          items.push({
            key,
            size: key.length + value.length,
            lastAccessed
          });
        }
      }
    }

    return items;
  }

  /**
   * Clean up old account videos to free space (LRU eviction)
   */
  static cleanupAccountVideos(bytesNeeded: number): boolean {
    console.log('🧹 Starting cleanup to free', (bytesNeeded / 1024).toFixed(2), 'KB');
    
    // Get all account_videos_ keys
    const accountVideoKeys: StorageItem[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('account_videos_')) {
        const value = localStorage.getItem(key);
        if (value) {
          let lastAccessed = 0;
          try {
            const parsed = JSON.parse(value);
            lastAccessed = parsed._metadata?.lastAccessed || 0;
          } catch {
            // Couldn't parse, consider it oldest
          }

          accountVideoKeys.push({
            key,
            size: key.length + value.length,
            lastAccessed
          });
        }
      }
    }

    // Sort by lastAccessed (oldest first)
    accountVideoKeys.sort((a, b) => a.lastAccessed - b.lastAccessed);

    let freedBytes = 0;
    const keysToRemove = [];

    // Remove oldest items until we have enough space
    for (const item of accountVideoKeys) {
      keysToRemove.push(item.key);
      freedBytes += item.size;
      
      if (freedBytes >= bytesNeeded) {
        break;
      }
    }

    // Actually remove the items
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('  🗑️ Removed:', key, 'to free space');
    });

    console.log('✅ Freed', (freedBytes / 1024).toFixed(2), 'KB');
    return freedBytes >= bytesNeeded;
  }

  /**
   * Safely set item with quota management
   */
  static safeSetItem(key: string, value: string, options: { isAccountVideos?: boolean } = {}): boolean {
    try {
      const dataSize = key.length + value.length;
      const { usedBytes, percentUsed } = this.getStorageUsage();

      // Check if we're approaching the limit
      if (percentUsed > this.WARNING_THRESHOLD * 100) {
        console.warn('⚠️ Storage usage high:', percentUsed.toFixed(1), '%');
      }

      // Try to set the item
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error: any) {
        // QuotaExceededError
        if (error.name === 'QuotaExceededError') {
          console.warn('💾 Storage quota exceeded, attempting cleanup...');
          
          // For account videos, try to free up space
          if (options.isAccountVideos) {
            const bytesNeeded = dataSize - (this.MAX_BYTES - usedBytes) + (1024 * 200); // Add 200KB buffer
            
            // First attempt: Clean up other account videos
            let cleanedUp = this.cleanupAccountVideos(bytesNeeded);
            
            // Second attempt: If still not enough, clear ALL account videos and try fresh
            if (!cleanedUp) {
              console.warn('🧹 Aggressive cleanup: Clearing all account videos to make space');
              this.clearAllAccountVideos();
              cleanedUp = true; // We cleared everything, should have space now
            }
            
            if (cleanedUp) {
              // Try again after cleanup
              try {
                localStorage.setItem(key, value);
                console.log('✅ Saved after cleanup');
                return true;
              } catch (retryError) {
                console.error('❌ Still failed after cleanup:', retryError);
                // Last resort: The data itself might be too large
                console.error('💥 Data is too large even with empty storage. Size:', (dataSize / 1024).toFixed(2), 'KB');
                return false;
              }
            }
          }
          
          console.error('❌ Could not free enough space');
          return false;
        }
        
        throw error; // Re-throw if it's not a quota error
      }
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
      return false;
    }
  }

  /**
   * Limit account videos to most recent N items and strip unnecessary data
   */
  static limitAccountVideos(videos: any[], maxVideos: number = 20): any[] {
    console.log(`📦 Processing ${videos.length} videos for storage optimization...`);
    
    // Sort by upload date (newest first)
    const sorted = [...videos].sort((a, b) => {
      const dateA = new Date(a.uploadDate || a.timestamp || 0).getTime();
      const dateB = new Date(b.uploadDate || b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    // Take only the most recent videos
    const limited = sorted.slice(0, maxVideos);
    
    // Strip out unnecessary fields to reduce size
    const optimized = limited.map(video => ({
      id: video.id,
      url: video.url,
      thumbnail: video.thumbnail ? this.compressUrl(video.thumbnail) : video.thumbnail,
      caption: video.caption ? video.caption.substring(0, 200) : video.caption, // Limit caption length
      likesCount: video.likesCount,
      commentsCount: video.commentsCount,
      viewsCount: video.viewsCount,
      playsCount: video.playsCount,
      sharesCount: video.sharesCount,
      uploadDate: video.uploadDate,
      timestamp: video.timestamp,
      // Remove large fields like full HTML, detailed metadata, etc.
    }));

    console.log(`✂️ Trimmed from ${videos.length} to ${optimized.length} videos and removed unnecessary fields`);
    
    return optimized;
  }

  /**
   * Compress URLs by removing query parameters if too long
   */
  private static compressUrl(url: string): string {
    if (url.length < 200) return url;
    
    try {
      const urlObj = new URL(url);
      // Keep only essential query params for Instagram/TikTok
      const essentialParams = ['_nc_ht', '_nc_cat', 'stp'];
      const newParams = new URLSearchParams();
      
      essentialParams.forEach(param => {
        const value = urlObj.searchParams.get(param);
        if (value) newParams.set(param, value);
      });
      
      urlObj.search = newParams.toString();
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Add metadata to track when data was last accessed
   */
  static wrapWithMetadata(data: any): any {
    // If data is an array, wrap it properly
    if (Array.isArray(data)) {
      return {
        data: data,
        _metadata: {
          lastAccessed: Date.now(),
          version: 1
        }
      };
    }
    
    // If data is an object, spread it
    return {
      ...data,
      _metadata: {
        lastAccessed: Date.now(),
        version: 1
      }
    };
  }

  /**
   * Log storage statistics
   */
  static logStorageStats(): void {
    const { usedMB, percentUsed } = this.getStorageUsage();
    const items = this.getStorageItems();
    
    // Group by prefix
    const groups: Record<string, { count: number; size: number }> = {};
    
    items.forEach(item => {
      const prefix = item.key.split('_')[0] || 'other';
      if (!groups[prefix]) {
        groups[prefix] = { count: 0, size: 0 };
      }
      groups[prefix].count++;
      groups[prefix].size += item.size;
    });

    console.log('📊 Storage Statistics:');
    console.log(`  Total: ${usedMB.toFixed(2)} MB (${percentUsed.toFixed(1)}%)`);
    console.log('  Breakdown:');
    Object.entries(groups).forEach(([prefix, data]) => {
      const sizeMB = (data.size / (1024 * 1024)).toFixed(2);
      console.log(`    ${prefix}: ${data.count} items, ${sizeMB} MB`);
    });
  }

  /**
   * Clear old thumbnails if storage is getting full
   */
  static cleanupThumbnails(keepCount: number = 20): void {
    const thumbnails = this.getStorageItems()
      .filter(item => item.key.startsWith('thumbnail_'))
      .sort((a, b) => a.lastAccessed - b.lastAccessed); // Oldest first

    if (thumbnails.length > keepCount) {
      const toRemove = thumbnails.slice(0, thumbnails.length - keepCount);
      toRemove.forEach(item => {
        localStorage.removeItem(item.key);
        console.log('🗑️ Removed old thumbnail:', item.key);
      });
    }
  }

  /**
   * Clear all account videos (emergency cleanup)
   */
  static clearAllAccountVideos(): void {
    console.log('🧹 Clearing all account_videos_ entries...');
    let count = 0;
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('account_videos_')) {
        localStorage.removeItem(key);
        count++;
      }
    }
    
    console.log(`✅ Cleared ${count} account video entries`);
  }
}

export default StorageManager;
