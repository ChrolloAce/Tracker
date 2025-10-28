import React, { useState, useEffect } from 'react';

interface ProxiedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onError?: () => void;
}

/**
 * Image component that automatically routes Instagram/TikTok URLs through the image proxy
 * to bypass 403 hotlinking errors
 */
export const ProxiedImage: React.FC<ProxiedImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  fallback,
  onError 
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if URL needs proxying (Instagram, TikTok CDN URLs)
  const needsProxy = (url: string): boolean => {
    if (!url) return false;
    return (
      url.includes('cdninstagram.com') ||
      url.includes('scontent') ||
      url.includes('tiktokcdn.com') ||
      url.includes('twimg.com')
    );
  };

  // Reset when src changes
  useEffect(() => {
    setImageSrc(src);
    setImageError(false);
    setIsLoading(false);
  }, [src]);

  const handleImageError = async () => {
    // If already tried proxy or doesn't need proxy, show fallback
    if (imageError || !needsProxy(src)) {
      setImageError(true);
      onError?.();
      return;
    }

    // Try loading through image proxy
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: src,
          identifier: alt || 'thumbnail'
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.dataUrl) {
        setImageSrc(data.dataUrl);
        setImageError(false);
      } else {
        throw new Error('No data URL returned');
      }
    } catch (error) {
      setImageError(true);
      onError?.();
    } finally {
      setIsLoading(false);
    }
  };

  // Show fallback if error and fallback provided
  if (imageError && fallback) {
    return <>{fallback}</>;
  }

  // Show fallback if error and no custom fallback
  if (imageError) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <svg 
          className="w-5 h-5 text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  // Show image
  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleImageError}
      loading="lazy"
    />
  );
};

