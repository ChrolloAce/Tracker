import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export class MarkAsReadService {
  /**
   * Mark all videos in a project as read
   */
  static async markVideosAsRead(orgId: string, projectId: string): Promise<void> {
    try {
      const videosRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'videoSubmissions'
      );

      const unreadQuery = query(
        videosRef,
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(unreadQuery);
      
      if (snapshot.empty) {
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { isRead: true });
      });

      await batch.commit();
      console.log(`✅ Marked ${snapshot.size} videos as read`);
    } catch (error) {
      console.error('Error marking videos as read:', error);
    }
  }

  /**
   * Mark all tracked accounts in a project as read
   */
  static async markAccountsAsRead(orgId: string, projectId: string): Promise<void> {
    try {
      const accountsRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'trackedAccounts'
      );

      const unreadQuery = query(
        accountsRef,
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(unreadQuery);
      
      if (snapshot.empty) {
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { isRead: true });
      });

      await batch.commit();
      console.log(`✅ Marked ${snapshot.size} accounts as read`);
    } catch (error) {
      console.error('Error marking accounts as read:', error);
    }
  }
}

