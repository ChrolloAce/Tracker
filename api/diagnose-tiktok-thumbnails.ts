import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', 'base64').toString('utf-8')
  );

  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'viewtrack-25d71.appspot.com'
  });
}

const db = getFirestore();
const storage = getStorage();

/**
 * Diagnostic endpoint to check TikTok thumbnail status
 * 
 * Usage: GET /api/diagnose-tiktok-thumbnails?orgId=XXX&projectId=YYY
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, projectId } = req.query;

  if (!orgId || !projectId) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['orgId', 'projectId']
    });
  }

  console.log(`🔍 Diagnosing TikTok thumbnails for org ${orgId}, project ${projectId}...`);

  try {
    // Get all TikTok videos
    const videosRef = db
      .collection('organizations')
      .doc(orgId as string)
      .collection('projects')
      .doc(projectId as string)
      .collection('videos');

    const tiktokQuery = videosRef.where('platform', '==', 'tiktok').limit(50);
    const snapshot = await tiktokQuery.get();

    console.log(`📊 Found ${snapshot.size} TikTok videos`);

    const diagnostics = {
      totalVideos: snapshot.size,
      withThumbnails: 0,
      withoutThumbnails: 0,
      withPlaceholders: 0,
      withFirebaseStorage: 0,
      withExternalUrls: 0,
      withEmptyThumbnails: 0,
      brokenThumbnails: 0,
      samples: [] as any[]
    };

    // Check storage for thumbnail files
    const bucket = storage.bucket();
    const thumbnailsPath = `organizations/${orgId}/thumbnails/`;
    
    let storageFiles: string[] = [];
    try {
      const [files] = await bucket.getFiles({ prefix: thumbnailsPath });
      storageFiles = files.map(f => f.name);
      console.log(`📁 Found ${storageFiles.length} thumbnail files in storage`);
    } catch (error) {
      console.error('Failed to list storage files:', error);
    }

    for (const doc of snapshot.docs) {
      const video = doc.data();
      const thumbnail = video.thumbnail || '';

      if (!thumbnail) {
        diagnostics.withoutThumbnails++;
        diagnostics.withEmptyThumbnails++;
      } else if (thumbnail.includes('placeholder')) {
        diagnostics.withPlaceholders++;
      } else if (thumbnail.includes('storage.googleapis.com') || thumbnail.includes('firebasestorage')) {
        diagnostics.withThumbnails++;
        diagnostics.withFirebaseStorage++;
        
        // Check if file actually exists
        const urlMatch = thumbnail.match(/thumbnails\/([^?]+)/);
        if (urlMatch) {
          const filename = urlMatch[1];
          const fullPath = `organizations/${orgId}/thumbnails/${filename}`;
          
          if (!storageFiles.includes(fullPath)) {
            diagnostics.brokenThumbnails++;
          }
        }
      } else {
        diagnostics.withThumbnails++;
        diagnostics.withExternalUrls++;
      }

      // Add samples
      if (diagnostics.samples.length < 10) {
        diagnostics.samples.push({
          videoId: video.videoId,
          url: video.url,
          thumbnail: thumbnail.substring(0, 100) + (thumbnail.length > 100 ? '...' : ''),
          thumbnailType: !thumbnail ? 'empty' :
                        thumbnail.includes('placeholder') ? 'placeholder' :
                        thumbnail.includes('storage.googleapis.com') ? 'firebase-storage' :
                        thumbnail.includes('firebasestorage') ? 'firebase-storage' : 'external',
          uploadDate: video.uploadDate?.toDate?.() || video.uploadDate,
          lastRefreshed: video.lastRefreshed?.toDate?.() || video.lastRefreshed
        });
      }
    }

    console.log('📊 Diagnostics complete:', diagnostics);

    return res.status(200).json({
      success: true,
      diagnostics,
      storageInfo: {
        totalThumbnailFiles: storageFiles.length,
        path: thumbnailsPath
      },
      recommendations: [
        diagnostics.withoutThumbnails > 0 ? `⚠️ ${diagnostics.withoutThumbnails} videos have no thumbnail at all` : null,
        diagnostics.withPlaceholders > 0 ? `⚠️ ${diagnostics.withPlaceholders} videos are using placeholder images` : null,
        diagnostics.brokenThumbnails > 0 ? `⚠️ ${diagnostics.brokenThumbnails} videos have Firebase URLs but files don't exist` : null,
        diagnostics.withExternalUrls > 0 ? `ℹ️ ${diagnostics.withExternalUrls} videos still using external URLs (TikTok CDN)` : null,
        diagnostics.withFirebaseStorage > diagnostics.totalVideos / 2 ? '✅ Most thumbnails are properly stored in Firebase' : '⚠️ Consider re-syncing to upload thumbnails to Firebase'
      ].filter(Boolean)
    });

  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Diagnostic failed',
      message: error.message
    });
  }
}

