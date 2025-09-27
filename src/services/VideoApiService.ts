import InstagramApiService from './InstagramApiService';
import TikTokApiService from './TikTokApiService';
import { InstagramVideoData } from '../types';

class VideoApiService {
  
  async fetchVideoData(url: string): Promise<{data: InstagramVideoData, platform: 'instagram' | 'tiktok'}> {
    console.log('🎯 Determining platform for URL:', url);
    
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided. URL cannot be empty or undefined.');
    }
    
    const platform = this.detectPlatform(url);
    console.log('📱 Detected platform:', platform);

    if (platform === 'instagram') {
      console.log('📸 Using Instagram API service...');
      const data = await InstagramApiService.fetchVideoData(url);
      return { data, platform: 'instagram' };
    } else if (platform === 'tiktok') {
      console.log('🎵 Using TikTok API service...');
      const data = await TikTokApiService.fetchVideoData(url);
      return { data, platform: 'tiktok' };
    } else {
      throw new Error('Unsupported platform. Please provide an Instagram or TikTok URL.');
    }
  }

  private detectPlatform(url: string): 'instagram' | 'tiktok' | 'unknown' {
    if (!url || typeof url !== 'string') {
      return 'unknown';
    }

    // Instagram URL patterns
    const instagramPatterns = [
      /instagram\.com\/p\/[A-Za-z0-9_-]+/,
      /instagram\.com\/reel\/[A-Za-z0-9_-]+/,
      /instagram\.com\/tv\/[A-Za-z0-9_-]+/
    ];

    // TikTok URL patterns  
    const tiktokPatterns = [
      /tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /vm\.tiktok\.com\/[A-Za-z0-9]+/,
      /tiktok\.com\/t\/[A-Za-z0-9]+/
    ];

    // Check Instagram patterns
    for (const pattern of instagramPatterns) {
      if (pattern.test(url)) {
        return 'instagram';
      }
    }

    // Check TikTok patterns
    for (const pattern of tiktokPatterns) {
      if (pattern.test(url)) {
        return 'tiktok';
      }
    }

    return 'unknown';
  }

  isValidUrl(url: string): boolean {
    return this.detectPlatform(url) !== 'unknown';
  }

  getSupportedPlatforms(): string[] {
    return ['Instagram', 'TikTok'];
  }

  getUrlExamples(): { platform: string; example: string }[] {
    return [
      { platform: 'Instagram', example: 'https://www.instagram.com/p/ABC123/' },
      { platform: 'Instagram Reel', example: 'https://www.instagram.com/reel/XYZ789/' },
      { platform: 'TikTok', example: 'https://www.tiktok.com/@username/video/1234567890' },
      { platform: 'TikTok Short', example: 'https://vm.tiktok.com/ABC123/' }
    ];
  }
}

export default new VideoApiService();
