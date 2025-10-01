import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * One-time fix: Update video platforms from 'youtube' to 'tiktok'
 * Run this in the browser console after loading the app
 */
export async function fixVideoPlatforms(orgId: string, accountId: string, correctPlatform: 'instagram' | 'tiktok' | 'youtube') {
  try {
    console.log(`🔧 Fixing video platforms for account ${accountId}...`);
    
    const videosRef = collection(db, 'organizations', orgId, 'videos');
    const snapshot = await getDocs(videosRef);
    
    let fixedCount = 0;
    
    for (const videoDoc of snapshot.docs) {
      const data = videoDoc.data();
      
      // Only fix videos belonging to this account
      if (data.trackedAccountId === accountId && data.platform !== correctPlatform) {
        await updateDoc(doc(db, 'organizations', orgId, 'videos', videoDoc.id), {
          platform: correctPlatform
        });
        fixedCount++;
        console.log(`✅ Fixed video ${videoDoc.id}: ${data.platform} → ${correctPlatform}`);
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} videos`);
    return fixedCount;
  } catch (error) {
    console.error('❌ Failed to fix video platforms:', error);
    throw error;
  }
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).fixVideoPlatforms = fixVideoPlatforms;
}

