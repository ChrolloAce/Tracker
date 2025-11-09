import { useState, useEffect, useRef } from 'react';
import heic2any from 'heic2any';

/**
 * Custom hook to handle HEIC images by converting them to JPG on the client side
 * @param imageUrl - The URL of the image (may be HEIC)
 * @returns The converted image URL (or original if not HEIC)
 */
export function useHeicImage(imageUrl: string | undefined): string {
  const [convertedUrl, setConvertedUrl] = useState<string>(imageUrl || '');
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setConvertedUrl('');
      return;
    }

    // Check if image URL suggests HEIC format
    const maybeHeic = imageUrl.toLowerCase().includes('.heic') || 
                      imageUrl.toLowerCase().includes('.heif');

    if (!maybeHeic) {
      // Not HEIC based on URL, use original
      setConvertedUrl(imageUrl);
      return;
    }

    // Convert HEIC to JPG
    let cancelled = false;
    
    const convertHeic = async () => {
      try {
        console.log('🔄 Attempting to convert HEIC image:', imageUrl.substring(0, 100) + '...');
        
        // Fetch the HEIC image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('📦 Fetched blob, type:', blob.type, 'size:', blob.size);
        
        // Check if blob is actually HEIC
        const isActuallyHeic = blob.type.includes('heic') || 
                               blob.type.includes('heif') ||
                               blob.type === '' || // Sometimes HEIC has no type
                               blob.type === 'application/octet-stream';
        
        if (!isActuallyHeic && blob.type.startsWith('image/')) {
          // It's already a standard image format, use original URL
          console.log('ℹ️ Image is already in standard format:', blob.type);
          if (!cancelled) setConvertedUrl(imageUrl);
          return;
        }
        
        // Convert to JPG using heic2any
        console.log('🔄 Converting HEIC to JPEG...');
        const convertedBlob = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: 0.85
        });
        
        if (cancelled) return;
        
        // Create object URL from converted blob
        const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        const objectUrl = URL.createObjectURL(blobToUse);
        
        // Store blob URL for cleanup
        blobUrlRef.current = objectUrl;
        
        setConvertedUrl(objectUrl);
        console.log('✅ Successfully converted HEIC to JPEG');
      } catch (error) {
        console.error('❌ Failed to convert HEIC image:', error);
        // Fallback to original URL if conversion fails
        if (!cancelled) setConvertedUrl(imageUrl);
      }
    };

    convertHeic();

    // Cleanup: revoke object URL when component unmounts or URL changes
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [imageUrl]);

  return convertedUrl;
}

