import FirestoreDataService from './FirestoreDataService';
import OutlierDetectionService from './OutlierDetectionService';
import { Timestamp } from 'firebase/firestore';

/**
 * AccountAnalyticsService
 * 
 * Responsibilities:
 * - Calculate and update aggregated stats for accounts (views, likes, etc.)
 * - Run outlier detection on account videos
 * - Update account documents with fresh analytics
 */
export class AccountAnalyticsService {
  
  /**
   * Update aggregated stats and outlier analysis for a tracked account
   * Fetches ALL videos to ensure accuracy
   */
  static async updateAccountStats(
    orgId: string, 
    projectId: string, 
    accountId: string, 
    username: string
  ): Promise<void> {
    try {
      // 1. Get all videos for the account to ensure accurate totals
      const videos = await FirestoreDataService.getAccountVideos(orgId, projectId, accountId);
      
      if (videos.length === 0) {
        console.log(`⚠️ No videos found for @${username}, skipping stats update`);
        return;
      }
      
      // 2. Calculate totals
      const totalVideos = videos.length;
      const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalComments = videos.reduce((sum, v) => sum + (v.comments || 0), 0);
      const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);
      
      // 3. Detect Outliers
      const outlierAnalysis = OutlierDetectionService.detectOutliers(
        videos,
        accountId,
        username
      );
      
      console.log(`📊 Outlier Analysis for @${username}:`);
      console.log(`   - Top performers: ${outlierAnalysis.topPerformers.length}`);
      console.log(`   - Underperformers: ${outlierAnalysis.underperformers.length}`);
      
      // 4. Update Account Document
      await FirestoreDataService.updateTrackedAccount(orgId, projectId, accountId, {
        totalVideos,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        lastSynced: Timestamp.now() as any,
        outlierAnalysis: {
          topPerformersCount: outlierAnalysis.topPerformers.length,
          underperformersCount: outlierAnalysis.underperformers.length,
          lastCalculated: Timestamp.fromDate(outlierAnalysis.lastCalculated)
        }
      });
      
      console.log(`✅ Stats updated for @${username}: ${totalVideos} videos, ${totalViews.toLocaleString()} views`);
      
    } catch (error) {
      console.error(`❌ Failed to update stats for account ${accountId}:`, error);
      // Don't throw, this is a background maintenance task
    }
  }
}

