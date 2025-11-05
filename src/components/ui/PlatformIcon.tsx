import React from 'react';
import { clsx } from 'clsx';

interface PlatformIconProps {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ 
  platform, 
  size = 'sm', 
  className 
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div className={clsx(sizeClasses[size], className)}>
      {platform === 'instagram' ? (
        <img 
          src="/Instagram_icon.png" 
          alt="Instagram" 
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback to inline SVG if image fails to load
            const target = e.target as HTMLImageElement;
            target.outerHTML = `
              <div class="${clsx(sizeClasses[size], 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg flex items-center justify-center')}">
                <span class="text-white text-xs font-bold">IG</span>
              </div>
            `;
          }}
        />
      ) : platform === 'tiktok' ? (
        <img 
          src="/TiktokLogo.png" 
          alt="TikTok" 
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback to inline SVG if image fails to load
            const target = e.target as HTMLImageElement;
            target.outerHTML = `
              <div class="${clsx(sizeClasses[size], 'bg-black rounded-lg flex items-center justify-center')}">
                <span class="text-white text-xs font-bold">TT</span>
              </div>
            `;
          }}
        />
      ) : platform === 'twitter' ? (
        <img 
          src="/twitter-x-logo.png" 
          alt="X (Twitter)" 
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback to inline SVG if image fails to load
            const target = e.target as HTMLImageElement;
            target.outerHTML = `
              <div class="${clsx(sizeClasses[size], 'bg-black rounded-lg flex items-center justify-center')}">
                <svg class="w-3/4 h-3/4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </div>
            `;
          }}
        />
      ) : (
        <img 
          src="/Youtube_shorts_icon.svg.png" 
          alt="YouTube" 
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback to inline SVG if image fails to load
            const target = e.target as HTMLImageElement;
            target.outerHTML = `
              <div class="${clsx(sizeClasses[size], 'bg-red-600 rounded-lg flex items-center justify-center')}">
                <span class="text-white text-xs font-bold">YT</span>
              </div>
            `;
          }}
        />
      )}
    </div>
  );
};
