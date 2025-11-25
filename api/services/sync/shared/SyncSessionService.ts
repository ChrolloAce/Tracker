import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { NotificationService } from './NotificationService.js';

/**
 * SyncSessionService
 * 
 * Responsibilities:
 * - Track progress of a "refresh session" (batch sync of multiple accounts)
 * - Aggregate stats (views, likes, etc.) for the session
 * - Detect when the session is complete ("last one out" pattern)
 * - Trigger summary notifications
 */
export class SyncSessionService {
  /**
   * Update session progress and check if this was the last account
   * If so, marks session as completed and sends summary email
   * 
   * @param sessionId - ID of the refresh session
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param accountId - Account ID that just finished
   * @param savedCount - Number of videos synced/saved in this run
   * @param account - The account object (for username/platform info)
   * @param db - Firestore instance
   */
  static async updateSessionProgress(
    sessionId: string,
    orgId: string,
    projectId: string,
    accountId: string,
    savedCount: number,
    account: any,
    db: FirebaseFirestore.Firestore
  ) {
    try {
      console.log(`📊 Updating session progress: ${sessionId}`);
      
      // Get account ref
      const accountRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .doc(projectId)
        .collection('trackedAccounts')
        .doc(accountId);
      
      // Get current account stats for aggregation
      const accountSnapshot = await accountRef.get();
      const accountData = accountSnapshot.data() as any;
      
      if (!accountData) {
        console.warn(`⚠️ Account data not found for ${accountId} - skipping session update`);
        return;
      }

      const currentViews = accountData?.totalViews || 0;
      const currentLikes = accountData?.totalLikes || 0;
      const currentComments = accountData?.totalComments || 0;
      const currentShares = accountData?.totalShares || 0;
      
      const sessionRef = db
        .collection('organizations')
        .doc(orgId)
        .collection('refreshSessions')
        .doc(sessionId);
      
      // Atomically increment completed count and add account stats
      await sessionRef.update({
        completedAccounts: FieldValue.increment(1),
        totalVideos: FieldValue.increment(savedCount),
        totalViews: FieldValue.increment(currentViews),
        totalLikes: FieldValue.increment(currentLikes),
        totalComments: FieldValue.increment(currentComments),
        totalShares: FieldValue.increment(currentShares),
        [`accountStats.${accountId}`]: {
          username: account.username,
          platform: account.platform,
          videosSynced: savedCount,
          views: currentViews,
          likes: currentLikes,
          comments: currentComments,
          shares: currentShares,
          displayName: accountData?.displayName || account.username,
          profilePicture: accountData?.profilePicture || ''
        }
      });
      
      // Check if this is the last account to complete ("last one out")
      const sessionSnapshot = await sessionRef.get();
      const session = sessionSnapshot.data() as any;
      
      if (session && session.completedAccounts >= session.totalAccounts) {
        console.log(`🎉 Last account completed! Sending summary email...`);
        
        // Mark session as completed
        await sessionRef.update({
          status: 'completed',
          completedAt: Timestamp.now()
        });
        
        // Send summary email
        await NotificationService.sendRefreshSummaryEmail(session, db);
        
        // Mark email as sent
        await sessionRef.update({
          emailSent: true,
          emailSentAt: Timestamp.now()
        });
        
        console.log(`✅ Summary email sent successfully`);
      } else {
        console.log(`⏳ Session progress: ${session?.completedAccounts || 0}/${session?.totalAccounts || 0} accounts`);
      }
      
    } catch (sessionError: any) {
      console.error('❌ Session tracking failed (non-critical):', sessionError.message);
      // Don't fail the request if session tracking fails
    }
  }
}

