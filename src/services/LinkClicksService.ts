import { 
  collection, 
  query, 
  getDocs, 
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';

export interface LinkClick {
  id: string;
  linkId: string;
  linkTitle: string;
  linkUrl: string;
  shortCode: string;
  timestamp: Date;
  userAgent: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
  referrer: string;
}

/**
 * Service for fetching and managing link click analytics
 */
class LinkClicksService {
  
  /**
   * Get all link clicks for a project
   * Reads from BOTH old (subcollection) and new (project-level) locations for backward compatibility
   */
  static async getProjectLinkClicks(orgId: string, projectId: string): Promise<LinkClick[]> {
    try {
      const clicks: LinkClick[] = [];
      
      // 1. Read from NEW project-level linkClicks collection
      try {
        const newClicksSnapshot = await getDocs(
          query(
            collection(db, 'organizations', orgId, 'projects', projectId, 'linkClicks'),
            orderBy('timestamp', 'desc')
          )
        );
        
        newClicksSnapshot.docs.forEach(clickDoc => {
          const clickData = clickDoc.data();
          clicks.push({
            id: clickDoc.id,
            linkId: clickData.linkId || '',
            linkTitle: clickData.linkTitle || 'Untitled Link',
            linkUrl: clickData.linkUrl || '',
            shortCode: clickData.shortCode || '',
            timestamp: clickData.timestamp?.toDate() || new Date(),
            userAgent: clickData.userAgent || 'Unknown',
            deviceType: clickData.deviceType || 'desktop',
            browser: clickData.browser || 'Unknown',
            os: clickData.os || 'Unknown',
            referrer: clickData.referrer || 'Direct',
          });
        });
      } catch (error) {
        console.error('Error loading from new location:', error);
      }
      
      // 2. Read from OLD subcollection location (for backward compatibility)
      try {
        const linksSnapshot = await getDocs(
          collection(db, 'organizations', orgId, 'projects', projectId, 'links')
        );
        
        for (const linkDoc of linksSnapshot.docs) {
          const linkData = linkDoc.data();
          
          const oldClicksSnapshot = await getDocs(
            query(
              collection(db, 'organizations', orgId, 'projects', projectId, 'links', linkDoc.id, 'clicks'),
              orderBy('timestamp', 'desc')
            )
          );
          
          oldClicksSnapshot.docs.forEach(clickDoc => {
            const clickData = clickDoc.data();
            clicks.push({
              id: `old_${clickDoc.id}`, // Prefix to avoid ID collisions
              linkId: linkDoc.id,
              linkTitle: linkData.title || 'Untitled Link',
              linkUrl: linkData.originalUrl || '',
              shortCode: linkData.shortCode || '',
              timestamp: clickData.timestamp?.toDate() || new Date(),
              userAgent: clickData.userAgent || 'Unknown',
              deviceType: clickData.deviceType || 'desktop',
              browser: clickData.browser || 'Unknown',
              os: clickData.os || 'Unknown',
              referrer: clickData.referrer || 'Direct',
            });
          });
        }
      } catch (error) {
        console.error('Error loading from old location:', error);
      }
      
      // Sort by timestamp descending
      clicks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return clicks;
    } catch (error) {
      console.error('Failed to fetch link clicks:', error);
      return [];
    }
  }
  
  /**
   * Get all link clicks for an organization (legacy - searches all projects)
   * @deprecated Use getProjectLinkClicks instead
   */
  static async getOrgLinkClicks(_orgId: string): Promise<LinkClick[]> {
    // For backward compatibility, this now returns empty array
    // Use getProjectLinkClicks instead
    console.warn('getOrgLinkClicks is deprecated, use getProjectLinkClicks instead');
    return [];
  }
  
  /**
   * Get recent link clicks (last N clicks)
   */
  static async getRecentLinkClicks(orgId: string, limitCount: number = 50): Promise<LinkClick[]> {
    const allClicks = await this.getOrgLinkClicks(orgId);
    return allClicks.slice(0, limitCount);
  }
  
  /**
   * Filter clicks by date range
   */
  static filterClicksByDateRange(
    clicks: LinkClick[],
    startDate: Date,
    endDate: Date
  ): LinkClick[] {
    return clicks.filter(click => {
      const clickDate = click.timestamp;
      return clickDate >= startDate && clickDate <= endDate;
    });
  }
  
  /**
   * Get click stats
   */
  static getClickStats(clicks: LinkClick[]) {
    const totalClicks = clicks.length;
    
    const uniqueClicks = new Set(
      clicks.map(c => `${c.userAgent}-${c.deviceType}`)
    ).size;
    
    const deviceBreakdown = clicks.reduce((acc, click) => {
      acc[click.deviceType] = (acc[click.deviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const browserBreakdown = clicks.reduce((acc, click) => {
      acc[click.browser] = (acc[click.browser] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalClicks,
      uniqueClicks,
      deviceBreakdown,
      browserBreakdown,
    };
  }
}

export default LinkClicksService;

