import React from 'react';
import { useHeicImage } from '../hooks/useHeicImage';
import { ProxiedImage } from './ProxiedImage';

interface HeicImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Image component that automatically converts HEIC images to JPG on the client side
 * Falls back to ProxiedImage for other formats
 */
export const HeicImage: React.FC<HeicImageProps> = ({ 
  src, 
  alt, 
  className, 
  onError 
}) => {
  const convertedSrc = useHeicImage(src);

  return (
    <ProxiedImage
      src={convertedSrc}
      alt={alt}
      className={className}
      onError={onError}
    />
  );
};

