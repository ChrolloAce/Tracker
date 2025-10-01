/**
 * ThemeService
 * 
 * Purpose: Enforce dark mode permanently
 * The app is always in dark mode - no light mode support
 */

export type ThemeMode = 'dark';

class ThemeService {
  private static readonly DARK_CLASS = 'dark';

  /**
   * Always returns dark mode
   */
  static getCurrentTheme(): ThemeMode {
    return 'dark';
  }

  /**
   * Initialize theme - always dark mode
   */
  static initializeTheme(): ThemeMode {
    const root = document.documentElement;
    root.classList.add(this.DARK_CLASS);
    console.log('🎨 Dark mode enabled (permanent)');
    return 'dark';
  }
}

export default ThemeService;
