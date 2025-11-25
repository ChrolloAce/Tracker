/**
 * URL Parser Service
 * Detects social media platforms from URLs and extracts video/account information
 */

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'twitter';

export interface ParsedUrl {
  platform: Platform | null;
  url: string;
  isValid: boolean;
}

export class UrlParserService {
  /**
   * Detect platform from URL
   */
  static detectPlatform(url: string): Platform | null {
    if (!url) return null;

    const urlLower = url.toLowerCase();

    // Instagram
    if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
      return 'instagram';
    }

    // TikTok
    if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com') || urlLower.includes('vt.tiktok.com')) {
      return 'tiktok';
    }

    // YouTube
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'youtube';
    }

    // Twitter/X
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return 'twitter';
    }

    return null;
  }

  /**
   * Parse URL and extract platform information
   */
  static parseUrl(url: string): ParsedUrl {
    const trimmedUrl = url.trim();
    const platform = this.detectPlatform(trimmedUrl);

    return {
      platform,
      url: trimmedUrl,
      isValid: platform !== null && this.isValidUrl(trimmedUrl)
    };
  }

  /**
   * Check if string is a valid URL
   */
  static isValidUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      // Try adding https:// if missing
      try {
        new URL(`https://${str}`);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Read text from clipboard
   */
  static async readClipboard(): Promise<string | null> {
    try {
      // Check if Clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        console.log('📋 Clipboard API not available');
        return null;
      }

      const text = await navigator.clipboard.readText();
      console.log('📋 Read from clipboard:', text);
      return text;
    } catch (error) {
      // User may have denied clipboard permissions
      console.log('📋 Could not read clipboard (permission denied or not available)');
      return null;
    }
  }

  /**
   * Try to auto-detect and fill URL from clipboard
   * Returns parsed URL if found and valid
   */
  static async autoDetectFromClipboard(): Promise<ParsedUrl | null> {
    const clipboardText = await this.readClipboard();
    
    if (!clipboardText) {
      return null;
    }

    const parsed = this.parseUrl(clipboardText);
    
    if (parsed.isValid && parsed.platform) {
      console.log('✅ Valid social media URL detected:', parsed.platform);
      return parsed;
    }

    console.log('❌ No valid social media URL in clipboard');
    return null;
  }

  /**
   * Normalize URL (add https:// if missing)
   */
  static normalizeUrl(url: string): string {
    const trimmed = url.trim();
    
    if (!trimmed) return '';
    
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    return `https://${trimmed}`;
  }

  /**
   * Extract username from social media URL
   */
  static extractUsername(url: string, platform: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Remove trailing slash
      const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      
      if (platform === 'instagram') {
        // Instagram: Extract first path segment (username), ignore extras like /reels/, /p/, /reel/
        const match = cleanPath.match(/^\/([^\/]+)/);
        return match ? match[1] : null;
      }
      
      if (platform === 'tiktok') {
        // TikTok: Extract @username from first segment
        const match = cleanPath.match(/^\/@?([^\/]+)/);
        return match ? match[1] : null;
      }
      
      if (platform === 'youtube') {
        // YouTube: https://www.youtube.com/@username or /c/username or /user/username
        const match = cleanPath.match(/^\/@?([^\/]+)/) || 
                     cleanPath.match(/^\/c\/([^\/]+)/) ||
                     cleanPath.match(/^\/user\/([^\/]+)/);
        return match ? match[1] : null;
      }
      
      if (platform === 'twitter') {
        // Twitter/X: Extract username from first segment
        const match = cleanPath.match(/^\/([^\/]+)/);
        return match ? match[1] : null;
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

