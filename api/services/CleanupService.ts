import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin (same as other API endpoints)
if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    initializeApp({ credential: cert(serviceAccount as any) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin for CleanupService:', error);
  }
}

const db = getFirestore();

interface CleanupStats {
  videosDeleted: number;
  accountsDeleted: number;
  snapshotsDeleted: number;
  errors: string[];
}

export class CleanupService {
  /**
   * Check if a video is invalid (failed sync, no data)
   */
  static isInvalidVideo(video: any): boolean {
    // Video is invalid if:
    // 1. No username or username is 'unknown'
    // 2. No stats (views, likes, etc. all 0)
    // 3. No caption/title
    // 4. Video is older than 1 hour (to allow time for initial sync)
    
    const hasUsername = video.username && video.username !== 'unknown' && video.username !== '@unknown';
    const hasStats = (video.views || 0) > 0 || (video.likes || 0) > 0 || (video.comments || 0) > 0;
    const hasCaption = video.caption && video.caption.trim() !== '' && video.caption !== '(No caption)';
    const hasTitle = video.title && video.title.trim() !== '' && video.title !== '(No caption)';
    
    // Check if video is older than 1 hour (grace period for sync)
    const isOldEnough = video.dateAdded && 
      (Date.now() - video.dateAdded.toMillis()) > (60 * 60 * 1000); // 1 hour in ms
    
    // Video is invalid if it's old enough AND has no username AND no stats AND no caption/title
    return isOldEnough && !hasUsername && !hasStats && !hasCaption && !hasTitle;
  }

  /**
   * Check if an account is invalid (failed sync, no data)
   */
  static isInvalidAccount(account: any): boolean {
    // Account is invalid if:
    // 1. No username or username is 'unknown'
    // 2. No profile picture
    // 3. No follower count
    // 4. Account is older than 1 hour (to allow time for initial sync)
    
    const hasUsername = account.username && account.username !== 'unknown' && account.username !== '@unknown';
    const hasProfilePic = account.profilePicture && account.profilePicture.trim() !== '';
    const hasFollowers = (account.followerCount || 0) > 0;
    
    // Check if account is older than 1 hour (grace period for sync)
    const isOldEnough = account.dateAdded && 
      (Date.now() - account.dateAdded.toMillis()) > (60 * 60 * 1000); // 1 hour in ms
    
    // Account is invalid if it's old enough AND has no username AND no profile pic AND no followers
    return isOldEnough && !hasUsername && !hasProfilePic && !hasFollowers;
  }

  /**
   * Clean up invalid videos for a specific organization/project
   */
  static async cleanupInvalidVideos(orgId: string, projectId: string): Promise<CleanupStats> {
    const stats: CleanupStats = {
      videosDeleted: 0,
      accountsDeleted: 0,
      snapshotsDeleted: 0,
      errors: []
    };

    try {
      console.log(`🧹 [CLEANUP] Starting video cleanup for org: ${orgId}, project: ${projectId}`);

      // Get all videos
      const videosRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('videos');

      const videosSnapshot = await videosRef.get();
      console.log(`🔍 [CLEANUP] Found ${videosSnapshot.size} videos to check`);

      const batch = db.batch();
      let batchCount = 0;

      for (const videoDoc of videosSnapshot.docs) {
        const video = videoDoc.data();

        if (this.isInvalidVideo(video)) {
          console.log(`❌ [CLEANUP] Deleting invalid video: ${videoDoc.id} (username: ${video.username || 'none'}, views: ${video.views || 0})`);

          // Delete the video document
          batch.delete(videoDoc.ref);
          batchCount++;
          stats.videosDeleted++;

          // Delete snapshots subcollection
          try {
            const snapshotsSnapshot = await videoDoc.ref.collection('snapshots').get();
            for (const snapshotDoc of snapshotsSnapshot.docs) {
              batch.delete(snapshotDoc.ref);
              batchCount++;
              stats.snapshotsDeleted++;
            }
          } catch (snapshotError) {
            console.warn(`⚠️ [CLEANUP] Failed to delete snapshots for video ${videoDoc.id}:`, snapshotError);
            stats.errors.push(`Failed to delete snapshots for video ${videoDoc.id}`);
          }

          // Commit batch if it's getting large (500 operations max)
          if (batchCount >= 450) {
            await batch.commit();
            console.log(`✅ [CLEANUP] Committed batch of ${batchCount} deletions`);
            batchCount = 0;
          }
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ [CLEANUP] Committed final batch of ${batchCount} deletions`);
      }

      console.log(`✅ [CLEANUP] Video cleanup complete: ${stats.videosDeleted} videos deleted, ${stats.snapshotsDeleted} snapshots deleted`);
    } catch (error) {
      console.error(`❌ [CLEANUP] Video cleanup failed:`, error);
      stats.errors.push(error instanceof Error ? error.message : String(error));
    }

    return stats;
  }

  /**
   * Clean up invalid accounts for a specific organization/project
   */
  static async cleanupInvalidAccounts(orgId: string, projectId: string): Promise<CleanupStats> {
    const stats: CleanupStats = {
      videosDeleted: 0,
      accountsDeleted: 0,
      snapshotsDeleted: 0,
      errors: []
    };

    try {
      console.log(`🧹 [CLEANUP] Starting account cleanup for org: ${orgId}, project: ${projectId}`);

      // Get all tracked accounts
      const accountsRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts');

      const accountsSnapshot = await accountsRef.get();
      console.log(`🔍 [CLEANUP] Found ${accountsSnapshot.size} accounts to check`);

      const batch = db.batch();
      let batchCount = 0;

      for (const accountDoc of accountsSnapshot.docs) {
        const account = accountDoc.data();

        if (this.isInvalidAccount(account)) {
          console.log(`❌ [CLEANUP] Deleting invalid account: ${accountDoc.id} (username: ${account.username || 'none'}, followers: ${account.followerCount || 0})`);

          // Delete the account document
          batch.delete(accountDoc.ref);
          batchCount++;
          stats.accountsDeleted++;

          // Delete videos subcollection
          try {
            const videosSnapshot = await accountDoc.ref.collection('videos').get();
            for (const videoDoc of videosSnapshot.docs) {
              batch.delete(videoDoc.ref);
              batchCount++;
              stats.videosDeleted++;
            }
          } catch (videoError) {
            console.warn(`⚠️ [CLEANUP] Failed to delete videos for account ${accountDoc.id}:`, videoError);
            stats.errors.push(`Failed to delete videos for account ${accountDoc.id}`);
          }

          // Commit batch if it's getting large (500 operations max)
          if (batchCount >= 450) {
            await batch.commit();
            console.log(`✅ [CLEANUP] Committed batch of ${batchCount} deletions`);
            batchCount = 0;
          }
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`✅ [CLEANUP] Committed final batch of ${batchCount} deletions`);
      }

      console.log(`✅ [CLEANUP] Account cleanup complete: ${stats.accountsDeleted} accounts deleted, ${stats.videosDeleted} videos deleted`);
    } catch (error) {
      console.error(`❌ [CLEANUP] Account cleanup failed:`, error);
      stats.errors.push(error instanceof Error ? error.message : String(error));
    }

    return stats;
  }

  /**
   * Run full cleanup (videos + accounts)
   */
  static async runFullCleanup(orgId: string, projectId: string): Promise<CleanupStats> {
    console.log(`🧹 [CLEANUP] Starting full cleanup for org: ${orgId}, project: ${projectId}`);

    const videoStats = await this.cleanupInvalidVideos(orgId, projectId);
    const accountStats = await this.cleanupInvalidAccounts(orgId, projectId);

    const totalStats: CleanupStats = {
      videosDeleted: videoStats.videosDeleted + accountStats.videosDeleted,
      accountsDeleted: accountStats.accountsDeleted,
      snapshotsDeleted: videoStats.snapshotsDeleted,
      errors: [...videoStats.errors, ...accountStats.errors]
    };

    console.log(`✅ [CLEANUP] Full cleanup complete:`);
    console.log(`   - Videos deleted: ${totalStats.videosDeleted}`);
    console.log(`   - Accounts deleted: ${totalStats.accountsDeleted}`);
    console.log(`   - Snapshots deleted: ${totalStats.snapshotsDeleted}`);
    console.log(`   - Errors: ${totalStats.errors.length}`);

    return totalStats;
  }
}

