/**
 * ThemeService
 * 
 * Purpose: Manage application theme (dark/light mode)
 * Responsibilities:
 * - Load and save theme preference to localStorage
 * - Apply theme to document root
 * - Provide theme state management
 */

export type ThemeMode = 'light' | 'dark';

class ThemeService {
  private static readonly STORAGE_KEY = 'app_theme';
  private static readonly DARK_CLASS = 'dark';

  /**
   * Get the current theme from localStorage or default to dark mode
   */
  static getCurrentTheme(): ThemeMode {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY) as ThemeMode;
    
    if (savedTheme) {
      return savedTheme;
    }

    // Default to dark mode (best for video/media apps)
    return 'dark';
  }

  /**
   * Set and apply theme
   */
  static setTheme(theme: ThemeMode): void {
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.applyTheme(theme);
    console.log(`🎨 Theme changed to: ${theme}`);
  }

  /**
   * Toggle between light and dark mode
   */
  static toggleTheme(): ThemeMode {
    const currentTheme = this.getCurrentTheme();
    const newTheme: ThemeMode = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Apply theme to document
   */
  static applyTheme(theme: ThemeMode): void {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add(this.DARK_CLASS);
    } else {
      root.classList.remove(this.DARK_CLASS);
    }
  }

  /**
   * Initialize theme on app startup
   */
  static initializeTheme(): ThemeMode {
    const theme = this.getCurrentTheme();
    this.applyTheme(theme);
    console.log(`🎨 Theme initialized: ${theme}`);
    return theme;
  }

  /**
   * Listen for system theme changes
   */
  static watchSystemTheme(callback: (theme: ThemeMode) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handler = (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a preference
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        const theme: ThemeMode = e.matches ? 'dark' : 'light';
        this.applyTheme(theme);
        callback(theme);
      }
    };

    mediaQuery.addEventListener('change', handler);

    // Return cleanup function
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }
}

export default ThemeService;
