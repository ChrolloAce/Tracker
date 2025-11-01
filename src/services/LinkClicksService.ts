import { 
  collection, 
  query, 
  getDocs, 
  orderBy,
  limit
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
  browserVersion?: string;
  os: string;
  osVersion?: string;
  referrer: string;
  referrerDomain?: string;
  accountHandle?: string;
  accountProfilePicture?: string;
  accountPlatform?: string;
  
  // Enhanced tracking
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  isp?: string;
  organization?: string;
  platform?: string;
  isBot?: boolean;
  botType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  queryParams?: Record<string, string>;
  language?: string;
  timezone?: string;
}

/**
 * Service for fetching and managing link click analytics
 */
class LinkClicksService {
  
  /**
   * Get all link clicks for a project
   * Optimized to only check old location if new location is empty (for backward compatibility)
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param maxClicks - Maximum number of clicks to fetch (default: 5000, set to 0 for unlimited)
   */
  static async getProjectLinkClicks(orgId: string, projectId: string, maxClicks: number = 5000): Promise<LinkClick[]> {
    try {
      console.time('⚡ LinkClicks fetch');
      const clicks: LinkClick[] = [];
      
      // 1. Read from NEW project-level linkClicks collection (FAST)
      try {
        const clicksQuery = maxClicks > 0
          ? query(
              collection(db, 'organizations', orgId, 'projects', projectId, 'linkClicks'),
              orderBy('timestamp', 'desc'),
              limit(maxClicks)
            )
          : query(
              collection(db, 'organizations', orgId, 'projects', projectId, 'linkClicks'),
              orderBy('timestamp', 'desc')
            );
            
        const newClicksSnapshot = await getDocs(clicksQuery);
        
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
            browserVersion: clickData.browserVersion,
            os: clickData.os || 'Unknown',
            osVersion: clickData.osVersion,
            referrer: clickData.referrer || 'Direct',
            referrerDomain: clickData.referrerDomain,
            accountHandle: clickData.accountHandle,
            accountProfilePicture: clickData.accountProfilePicture,
            accountPlatform: clickData.accountPlatform,
            // Enhanced tracking
            country: clickData.country,
            countryCode: clickData.countryCode,
            city: clickData.city,
            region: clickData.region,
            isp: clickData.isp,
            organization: clickData.organization,
            platform: clickData.platform,
            isBot: clickData.isBot,
            botType: clickData.botType,
            utmSource: clickData.utmSource,
            utmMedium: clickData.utmMedium,
            utmCampaign: clickData.utmCampaign,
            utmTerm: clickData.utmTerm,
            utmContent: clickData.utmContent,
            queryParams: clickData.queryParams,
            language: clickData.language,
            timezone: clickData.timezone,
          });
        });
        
        console.log(`✅ Loaded ${clicks.length} clicks from new location`);
      } catch (error) {
        console.error('Error loading from new location:', error);
      }
      
      // 2. ONLY check OLD location if new location is empty (backward compatibility)
      // This prevents the expensive N+1 query problem
      if (clicks.length === 0) {
        console.log('⚠️ No clicks in new location, checking old location (slow)...');
        try {
          const linksSnapshot = await getDocs(
            collection(db, 'organizations', orgId, 'projects', projectId, 'links')
          );
          
          // Process old clicks in parallel instead of sequentially
          const oldClicksPromises = linksSnapshot.docs.map(async (linkDoc) => {
            const linkData = linkDoc.data();
            
            const oldClicksQuery = maxClicks > 0
              ? query(
                  collection(db, 'organizations', orgId, 'projects', projectId, 'links', linkDoc.id, 'clicks'),
                  orderBy('timestamp', 'desc'),
                  limit(Math.ceil(maxClicks / linksSnapshot.docs.length))
                )
              : query(
                  collection(db, 'organizations', orgId, 'projects', projectId, 'links', linkDoc.id, 'clicks'),
                  orderBy('timestamp', 'desc')
                );
                
            const oldClicksSnapshot = await getDocs(oldClicksQuery);
            
            return oldClicksSnapshot.docs.map(clickDoc => {
              const clickData = clickDoc.data();
              return {
                id: `old_${clickDoc.id}`, // Prefix to avoid ID collisions
                linkId: linkDoc.id,
                linkTitle: linkData.title || 'Untitled Link',
                linkUrl: linkData.originalUrl || '',
                shortCode: linkData.shortCode || '',
                timestamp: clickData.timestamp?.toDate() || new Date(),
                userAgent: clickData.userAgent || 'Unknown',
                deviceType: clickData.deviceType || 'desktop',
                browser: clickData.browser || 'Unknown',
                browserVersion: clickData.browserVersion,
                os: clickData.os || 'Unknown',
                osVersion: clickData.osVersion,
                referrer: clickData.referrer || 'Direct',
                referrerDomain: clickData.referrerDomain,
                accountHandle: clickData.accountHandle,
                accountProfilePicture: clickData.accountProfilePicture,
                accountPlatform: clickData.accountPlatform,
                // Enhanced tracking
                country: clickData.country,
                countryCode: clickData.countryCode,
                city: clickData.city,
                region: clickData.region,
                isp: clickData.isp,
                organization: clickData.organization,
                platform: clickData.platform,
                isBot: clickData.isBot,
                botType: clickData.botType,
                utmSource: clickData.utmSource,
                utmMedium: clickData.utmMedium,
                utmCampaign: clickData.utmCampaign,
                utmTerm: clickData.utmTerm,
                utmContent: clickData.utmContent,
                queryParams: clickData.queryParams,
                language: clickData.language,
                timezone: clickData.timezone,
              } as LinkClick;
            });
          });
          
          const oldClicksArrays = await Promise.all(oldClicksPromises);
          oldClicksArrays.forEach(clicksArray => {
            clicks.push(...clicksArray);
          });
          
          console.log(`✅ Loaded ${clicks.length} clicks from old location`);
        } catch (error) {
          console.error('Error loading from old location:', error);
        }
      } else {
        console.log('⚡ Skipping old location check (new location has data)');
      }
      
      // Sort by timestamp descending
      clicks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      console.timeEnd('⚡ LinkClicks fetch');
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

  /**
   * Export link clicks as CSV
   */
  static exportClicksAsCSV(clicks: LinkClick[]): string {
    const headers = [
      'Timestamp',
      'Link',
      'Short Code',
      'Country',
      'City',
      'Platform',
      'Referrer',
      'Device Type',
      'Browser',
      'OS',
      'ISP',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'Is Bot',
      'Language'
    ];
    
    const rows = clicks.map(click => [
      click.timestamp.toISOString(),
      click.linkTitle,
      click.shortCode,
      click.country || '-',
      click.city || '-',
      click.platform || '-',
      click.referrerDomain || click.referrer || 'Direct',
      click.deviceType,
      `${click.browser}${click.browserVersion ? ' ' + click.browserVersion : ''}`,
      `${click.os}${click.osVersion ? ' ' + click.osVersion : ''}`,
      click.isp || '-',
      click.utmSource || '-',
      click.utmMedium || '-',
      click.utmCampaign || '-',
      click.isBot ? 'Yes' : 'No',
      click.language || '-'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }

  /**
   * Export link clicks as JSON
   */
  static exportClicksAsJSON(clicks: LinkClick[]): string {
    const exportData = clicks.map(click => ({
      timestamp: click.timestamp.toISOString(),
      link: {
        id: click.linkId,
        title: click.linkTitle,
        shortCode: click.shortCode,
        url: click.linkUrl,
      },
      location: {
        country: click.country,
        countryCode: click.countryCode,
        city: click.city,
        region: click.region,
      },
      device: {
        type: click.deviceType,
        browser: click.browser,
        browserVersion: click.browserVersion,
        os: click.os,
        osVersion: click.osVersion,
        userAgent: click.userAgent,
      },
      traffic: {
        referrer: click.referrer,
        referrerDomain: click.referrerDomain,
        platform: click.platform,
      },
      network: {
        isp: click.isp,
        organization: click.organization,
      },
      campaign: {
        utmSource: click.utmSource,
        utmMedium: click.utmMedium,
        utmCampaign: click.utmCampaign,
        utmTerm: click.utmTerm,
        utmContent: click.utmContent,
        queryParams: click.queryParams,
      },
      metadata: {
        isBot: click.isBot,
        botType: click.botType,
        language: click.language,
        timezone: click.timezone,
      },
      account: click.accountHandle ? {
        handle: click.accountHandle,
        platform: click.accountPlatform,
        profilePicture: click.accountProfilePicture,
      } : undefined,
    }));
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Download clicks as a file
   */
  static downloadClicks(clicks: LinkClick[], format: 'csv' | 'json', filename?: string) {
    const content = format === 'csv' 
      ? this.exportClicksAsCSV(clicks)
      : this.exportClicksAsJSON(clicks);
    
    const blob = new Blob([content], { 
      type: format === 'csv' ? 'text/csv' : 'application/json' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `link-clicks-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export default LinkClicksService;


