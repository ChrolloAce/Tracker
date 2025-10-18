/**
 * Service to manage column preferences for tables
 * Persists column visibility settings to localStorage
 */

interface ColumnPreferences {
  [key: string]: boolean;
}

interface TablePreferences {
  [tableName: string]: ColumnPreferences;
}

class ColumnPreferencesService {
  private static STORAGE_KEY = 'viewtrack_column_preferences';

  /**
   * Get column preferences for a specific table
   */
  static getPreferences(tableName: string): ColumnPreferences | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const allPreferences: TablePreferences = JSON.parse(stored);
      return allPreferences[tableName] || null;
    } catch (error) {
      console.error('Failed to load column preferences:', error);
      return null;
    }
  }

  /**
   * Save column preferences for a specific table
   */
  static savePreferences(tableName: string, preferences: ColumnPreferences): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const allPreferences: TablePreferences = stored ? JSON.parse(stored) : {};
      
      allPreferences[tableName] = preferences;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allPreferences));
      
      // console.log(`✅ Saved column preferences for ${tableName}`);
    } catch (error) {
      console.error('Failed to save column preferences:', error);
    }
  }

  /**
   * Clear preferences for a specific table
   */
  static clearPreferences(tableName: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const allPreferences: TablePreferences = JSON.parse(stored);
      delete allPreferences[tableName];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allPreferences));
      
      console.log(`✅ Cleared column preferences for ${tableName}`);
    } catch (error) {
      console.error('Failed to clear column preferences:', error);
    }
  }

  /**
   * Clear all preferences
   */
  static clearAllPreferences(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('✅ Cleared all column preferences');
    } catch (error) {
      console.error('Failed to clear all column preferences:', error);
    }
  }
}

export default ColumnPreferencesService;

