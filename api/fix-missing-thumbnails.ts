import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
// @ts-ignore
import convert from 'heic-convert';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');

if (!getApps().length) {
  initializeApp({ 
    credential: cert(serviceAccount as any),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app'
  });
}

const db = getFirestore();
const storage = getStorage();

/**
 * Download image and upload to Firebase Storage
 */
async function downloadAndUploadThumbnail(
  imageUrl: string,
  orgId: string,
  filename: string
): Promise<string | null> {
  try {
    const isTikTok = imageUrl.includes('tiktokcdn');
    const isInstagram = imageUrl.includes('cdninstagram') || imageUrl.includes('fbcdn');
    
    console.log(`📥 Downloading thumbnail: ${imageUrl.substring(0, 80)}...`);
    
    const fetchOptions: any = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/heic,image/heif,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      }
    };
    
    if (isTikTok) {
      fetchOptions.headers['Referer'] = 'https://www.tiktok.com/';
    }
    if (isInstagram) {
      fetchOptions.headers['Referer'] = 'https://www.instagram.com/';
    }
    
    const response = await fetch(imageUrl, fetchOptions);
    
    if (!response.ok) {
      console.error(`❌ Download failed: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 100) {
      console.error(`❌ Downloaded data too small: ${buffer.length} bytes`);
      return null;
    }
    
    let contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // HEIC Detection and Conversion
    const isHEIC = contentType.includes('heic') || 
                   contentType.includes('heif') || 
                   imageUrl.toLowerCase().includes('.heic');
    
    if (isHEIC) {
      console.log(`🔄 Converting HEIC to JPG...`);
      try {
        const outputBuffer = await convert({
          buffer: buffer,
          format: 'JPEG',
          quality: 0.9
        });
        buffer = Buffer.from(outputBuffer);
        contentType = 'image/jpeg';
        console.log(`✅ Converted HEIC to JPG (${buffer.length} bytes)`);
      } catch (conversionError) {
        console.error(`❌ HEIC conversion failed:`, conversionError);
      }
    }
    
    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'trackview-6a3a5.firebasestorage.app';
    const bucket = storage.bucket(bucketName);
    const storagePath = `organizations/${orgId}/thumbnails/${filename}`;
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          uploadedAt: new Date().toISOString(),
          fixedBy: 'fix-missing-thumbnails'
        }
      },
      public: true
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    console.log(`✅ Uploaded to Firebase Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`❌ Failed to process thumbnail:`, error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authorization
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { orgId, projectId, limit = 50 } = req.body || {};
  
  if (!orgId || !projectId) {
    return res.status(400).json({ error: 'Missing orgId or projectId' });
  }
  
  console.log(`🔧 Starting thumbnail fix for org: ${orgId}, project: ${projectId}`);
  
  try {
    // Get all videos in the project
    const videosRef = db.collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('videos');
    
    const videosSnap = await videosRef.get();
    
    let fixed = 0;
    let skipped = 0;
    let failed = 0;
    let alreadyFixed = 0;
    
    const videos = videosSnap.docs.slice(0, Number(limit));
    
    console.log(`📊 Processing ${videos.length} videos (limit: ${limit})`);
    
    for (const videoDoc of videos) {
      const video = videoDoc.data();
      const thumbnail = video.thumbnail;
      
      // Skip if already a Firebase Storage URL
      if (thumbnail && thumbnail.includes('storage.googleapis.com')) {
        alreadyFixed++;
        continue;
      }
      
      // Skip if no thumbnail or placeholder
      if (!thumbnail || thumbnail.includes('placeholder')) {
        skipped++;
        continue;
      }
      
      // Check if it's a CDN URL that needs fixing
      const needsFix = thumbnail.includes('tiktokcdn') || 
                       thumbnail.includes('cdninstagram') || 
                       thumbnail.includes('fbcdn') ||
                       thumbnail.includes('twimg');
      
      if (!needsFix) {
        skipped++;
        continue;
      }
      
      console.log(`\n🔧 Fixing video: ${video.videoId || videoDoc.id}`);
      
      const filename = `${video.platform}_${video.videoId || videoDoc.id}_thumb.jpg`;
      const newUrl = await downloadAndUploadThumbnail(thumbnail, orgId, filename);
      
      if (newUrl) {
        // Update the video document
        await videoDoc.ref.update({ 
          thumbnail: newUrl,
          thumbnailFixedAt: new Date().toISOString()
        });
        fixed++;
        console.log(`✅ Fixed video ${videoDoc.id}`);
      } else {
        failed++;
        console.log(`❌ Failed to fix video ${videoDoc.id}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const summary = {
      success: true,
      processed: videos.length,
      fixed,
      alreadyFixed,
      skipped,
      failed
    };
    
    console.log(`\n📊 Summary:`, summary);
    
    return res.status(200).json(summary);
  } catch (error: any) {
    console.error('❌ Error fixing thumbnails:', error);
    return res.status(500).json({ 
      error: 'Failed to fix thumbnails',
      message: error.message 
    });
  }
}

