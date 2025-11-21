import { getStorage } from 'firebase-admin/storage';
// @ts-ignore - heic-convert has no types
import convert from 'heic-convert';

/**
 * ImageUploadService
 * 
 * Purpose: Handle image downloads and uploads to Firebase Storage
 * Responsibilities:
 * - Download images from CDN URLs with proper headers
 * - Convert HEIC images to JPEG
 * - Upload to Firebase Storage
 * - Return public URLs
 */
export class ImageUploadService {
  private static get storage() {
    return getStorage();
  }
  
  /**
   * Download image from URL and upload to Firebase Storage
   */
  static async downloadAndUpload(
    imageUrl: string, 
    orgId: string, 
    filename: string,
    folder: string = 'profile'
  ): Promise<string> {
    try {
      const isInstagram = imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn');
      console.log(`📥 Downloading ${isInstagram ? 'Instagram' : 'image'} from: ${imageUrl.substring(0, 150)}...`);
      
      const isTikTok = imageUrl.includes('tiktokcdn');
      
      const fetchOptions: any = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/heic,image/heif,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'image',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'cross-site'
        }
      };
      
      if (isInstagram) {
        fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
      }
      
      if (isTikTok) {
        fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
      }
      
      const response = await fetch(imageUrl, fetchOptions);
      
      if (!response.ok) {
        console.error(`❌ Image download failed with status ${response.status}`);
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);
      
      console.log(`📦 Downloaded ${buffer.length} bytes`);
      
      if (buffer.length < 100) {
        throw new Error(`Downloaded data too small (${buffer.length} bytes), likely not an image`);
      }
      
      let contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // HEIC Detection and Conversion
      const isHEIC = contentType.includes('heic') || 
                     contentType.includes('heif') || 
                     imageUrl.toLowerCase().includes('.heic') ||
                     imageUrl.toLowerCase().includes('.heif') ||
                     (buffer.length > 12 && 
                      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 && 
                      buffer[8] === 0x68 && buffer[9] === 0x65 && buffer[10] === 0x69 && buffer[11] === 0x63);
      
      if (isHEIC) {
        console.log(`🔄 [HEIC] Converting HEIC image to JPG...`);
        try {
          const outputBuffer = await convert({
            buffer: buffer,
            format: 'JPEG',
            quality: 0.9
          });
          
          buffer = Buffer.from(outputBuffer);
          contentType = 'image/jpeg';
          filename = filename.replace(/\.(heic|heif)$/i, '.jpg');
          console.log(`✅ [HEIC] Successfully converted HEIC to JPG (${buffer.length} bytes)`);
        } catch (conversionError) {
          console.error(`❌ [HEIC] Conversion failed:`, conversionError);
          console.warn(`⚠️ [HEIC] Will upload as-is - may not display properly in browsers`);
        }
      }
      
      // Upload to Firebase Storage
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
      const bucket = this.storage.bucket(bucketName);
      const storagePath = `organizations/${orgId}/${folder}/${filename}`;
      const file = bucket.file(storagePath);
      
      console.log(`☁️ Uploading ${buffer.length} bytes to Firebase Storage at: ${storagePath}`);
      
      await file.save(buffer, {
        metadata: {
          contentType: contentType,
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalUrl: imageUrl,
            fileFormat: contentType.split('/')[1] || 'unknown',
            convertedFromHEIC: isHEIC ? 'true' : 'false'
          }
        },
        public: true
      });
      
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      
      console.log(`✅ Uploaded image to Firebase Storage: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('❌ Failed to download/upload image:', error);
      
      // For Instagram and TikTok, throw error (URLs expire quickly)
      if (imageUrl.includes('cdninstagram') || 
          imageUrl.includes('fbcdn') || 
          imageUrl.includes('tiktokcdn')) {
        console.log(`🚫 Instagram/TikTok CDN URL detected, throwing error (URLs expire quickly)`);
        throw error;
      }
      
      // For other platforms, return original URL as fallback
      console.log(`📷 Using original URL as fallback for non-CDN platform`);
      return imageUrl;
    }
  }
}

