import React from 'react';
import { clsx } from 'clsx';

interface PlatformIconProps {
  platform: 'instagram' | 'tiktok';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ 
  platform, 
  size = 'sm', 
  className 
}) => {
  const sizeClasses = {
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
      ) : (
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
      )}
    </div>
  );
};
