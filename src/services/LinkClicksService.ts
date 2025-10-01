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
   * Get all link clicks for an organization
   */
  static async getOrgLinkClicks(orgId: string): Promise<LinkClick[]> {
    try {
      const clicks: LinkClick[] = [];
      
      // Get all links for the organization
      const linksSnapshot = await getDocs(
        collection(db, 'organizations', orgId, 'links')
      );
      
      // For each link, get its clicks
      for (const linkDoc of linksSnapshot.docs) {
        const linkData = linkDoc.data();
        
        const clicksSnapshot = await getDocs(
          query(
            collection(db, 'organizations', orgId, 'links', linkDoc.id, 'clicks'),
            orderBy('timestamp', 'desc')
          )
        );
        
        clicksSnapshot.docs.forEach(clickDoc => {
          const clickData = clickDoc.data();
          clicks.push({
            id: clickDoc.id,
            linkId: linkDoc.id,
            linkTitle: linkData.title || 'Untitled Link',
            linkUrl: linkData.url || '',
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
      
      // Sort by timestamp descending
      clicks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      return clicks;
    } catch (error) {
      console.error('Failed to fetch link clicks:', error);
      return [];
    }
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

