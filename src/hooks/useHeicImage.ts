import { useState, useEffect } from 'react';
import heic2any from 'heic2any';

/**
 * Custom hook to handle HEIC images by converting them to JPG on the client side
 * @param imageUrl - The URL of the image (may be HEIC)
 * @returns The converted image URL (or original if not HEIC)
 */
export function useHeicImage(imageUrl: string | undefined): string {
  const [convertedUrl, setConvertedUrl] = useState<string>(imageUrl || '');
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setConvertedUrl('');
      return;
    }

    // Check if image is HEIC by URL or content-type
    const isHeic = imageUrl.includes('.heic') || 
                   imageUrl.includes('.heif') || 
                   imageUrl.includes('image/heic') ||
                   imageUrl.includes('image/heif');

    if (!isHeic) {
      // Not HEIC, use original URL
      setConvertedUrl(imageUrl);
      return;
    }

    // Convert HEIC to JPG
    const convertHeic = async () => {
      if (isConverting) return;
      
      setIsConverting(true);
      
      try {
        // Fetch the HEIC image
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Convert to JPG using heic2any
        const convertedBlob = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: 0.8
        });
        
        // Create object URL from converted blob
        const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const objectUrl = URL.createObjectURL(blobToUse);
        
        setConvertedUrl(objectUrl);
        console.log('✅ Converted HEIC image to JPG in browser');
      } catch (error) {
        console.error('❌ Failed to convert HEIC image:', error);
        // Fallback to original URL if conversion fails
        setConvertedUrl(imageUrl);
      } finally {
        setIsConverting(false);
      }
    };

    convertHeic();

    // Cleanup: revoke object URL when component unmounts
    return () => {
      if (convertedUrl && convertedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(convertedUrl);
      }
    };
  }, [imageUrl]);

  return convertedUrl;
}

