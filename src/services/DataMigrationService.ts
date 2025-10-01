import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import ProjectService from './ProjectService';

/**
 * Service for migrating data to the new projects structure
 */
class DataMigrationService {
  /**
   * Migrate all org data into a default project
   */
  static async migrateOrgToProjects(orgId: string, userId: string): Promise<void> {
    console.log(`🔄 Starting migration for org: ${orgId}`);
    
    try {
      // 1. Create or get default project
      let projectId: string;
      
      const projects = await ProjectService.getProjects(orgId, false);
      if (projects.length > 0) {
        projectId = projects[0].id;
        console.log(`📁 Using existing project: ${projectId}`);
      } else {
        projectId = await ProjectService.createDefaultProject(orgId, userId);
        console.log(`📁 Created default project: ${projectId}`);
      }

      // 2. Migrate tracked accounts
      await this.migrateTrackedAccounts(orgId, projectId);

      // 3. Migrate links
      await this.migrateLinks(orgId, projectId);

      // 4. Migrate videos
      await this.migrateVideos(orgId, projectId);

      // 5. Recalculate project stats
      await ProjectService.recalculateProjectStats(orgId, projectId);

      console.log(`✅ Migration complete for org: ${orgId}`);
      console.log(`📊 All data is now in project: ${projectId}`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate tracked accounts to project
   */
  private static async migrateTrackedAccounts(orgId: string, projectId: string): Promise<void> {
    console.log(`📦 Migrating tracked accounts...`);
    
    const oldAccountsRef = collection(db, 'organizations', orgId, 'trackedAccounts');
    const accountsSnapshot = await getDocs(oldAccountsRef);

    if (accountsSnapshot.empty) {
      console.log(`   ℹ️  No tracked accounts to migrate`);
      return;
    }

    let batch = writeBatch(db);
    let operationCount = 0;
    const BATCH_SIZE = 500;

    for (const accountDoc of accountsSnapshot.docs) {
      const accountData = accountDoc.data();
      
      // Write to new location
      const newAccountRef = doc(
        db,
        'organizations', orgId,
        'projects', projectId,
        'trackedAccounts', accountDoc.id
      );
      
      batch.set(newAccountRef, accountData);
      operationCount++;

      // Commit batch if we hit the limit
      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
        console.log(`   ✓ Committed batch of ${BATCH_SIZE} accounts`);
      }

      // Migrate account videos if they exist
      const videosRef = collection(db, 'organizations', orgId, 'trackedAccounts', accountDoc.id, 'videos');
      const videosSnapshot = await getDocs(videosRef);
      
      for (const videoDoc of videosSnapshot.docs) {
        const newVideoRef = doc(
          db,
          'organizations', orgId,
          'projects', projectId,
          'trackedAccounts', accountDoc.id,
          'videos', videoDoc.id
        );
        
        batch.set(newVideoRef, videoDoc.data());
        operationCount++;

        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
          console.log(`   ✓ Committed batch of ${BATCH_SIZE} videos`);
        }
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`   ✅ Migrated ${accountsSnapshot.size} tracked accounts`);
  }

  /**
   * Migrate links to project
   */
  private static async migrateLinks(orgId: string, projectId: string): Promise<void> {
    console.log(`📦 Migrating links...`);
    
    const oldLinksRef = collection(db, 'organizations', orgId, 'links');
    const linksSnapshot = await getDocs(oldLinksRef);

    if (linksSnapshot.empty) {
      console.log(`   ℹ️  No links to migrate`);
      return;
    }

    let batch = writeBatch(db);
    let operationCount = 0;
    const BATCH_SIZE = 500;

    for (const linkDoc of linksSnapshot.docs) {
      const linkData = linkDoc.data();
      
      // Write to new location
      const newLinkRef = doc(
        db,
        'organizations', orgId,
        'projects', projectId,
        'links', linkDoc.id
      );
      
      batch.set(newLinkRef, linkData);
      operationCount++;

      // Update publicLinks to include projectId
      if (linkData.shortCode) {
        const publicLinkRef = doc(db, 'publicLinks', linkData.shortCode);
        const publicLinkDoc = await getDoc(publicLinkRef);
        
        if (publicLinkDoc.exists()) {
          batch.update(publicLinkRef, { projectId });
          operationCount++;
        }
      }

      // Migrate clicks
      const clicksRef = collection(db, 'organizations', orgId, 'links', linkDoc.id, 'clicks');
      const clicksSnapshot = await getDocs(clicksRef);
      
      for (const clickDoc of clicksSnapshot.docs) {
        const newClickRef = doc(
          db,
          'organizations', orgId,
          'projects', projectId,
          'links', linkDoc.id,
          'clicks', clickDoc.id
        );
        
        batch.set(newClickRef, clickDoc.data());
        operationCount++;

        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
          console.log(`   ✓ Committed batch of ${BATCH_SIZE} operations`);
        }
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`   ✅ Migrated ${linksSnapshot.size} links`);
  }

  /**
   * Migrate videos to project
   */
  private static async migrateVideos(orgId: string, projectId: string): Promise<void> {
    console.log(`📦 Migrating videos...`);
    
    const oldVideosRef = collection(db, 'organizations', orgId, 'videos');
    const videosSnapshot = await getDocs(oldVideosRef);

    if (videosSnapshot.empty) {
      console.log(`   ℹ️  No videos to migrate`);
      return;
    }

    let batch = writeBatch(db);
    let operationCount = 0;
    const BATCH_SIZE = 500;

    for (const videoDoc of videosSnapshot.docs) {
      const videoData = videoDoc.data();
      
      // Write to new location
      const newVideoRef = doc(
        db,
        'organizations', orgId,
        'projects', projectId,
        'videos', videoDoc.id
      );
      
      batch.set(newVideoRef, videoData);
      operationCount++;

      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
        console.log(`   ✓ Committed batch of ${BATCH_SIZE} videos`);
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`   ✅ Migrated ${videosSnapshot.size} videos`);
  }

  /**
   * Check if migration is needed
   */
  static async needsMigration(orgId: string): Promise<boolean> {
    // Check if there's data in old location
    const oldAccountsRef = collection(db, 'organizations', orgId, 'trackedAccounts');
    const oldLinksRef = collection(db, 'organizations', orgId, 'links');
    const oldVideosRef = collection(db, 'organizations', orgId, 'videos');

    const [accountsSnap, linksSnap, videosSnap] = await Promise.all([
      getDocs(oldAccountsRef),
      getDocs(oldLinksRef),
      getDocs(oldVideosRef)
    ]);

    return !accountsSnap.empty || !linksSnap.empty || !videosSnap.empty;
  }
}

export default DataMigrationService;
