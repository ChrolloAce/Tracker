import { TrackedLink, LinkClick, LinkAnalytics } from '../types/trackedLinks';

class TrackedLinksService {
  private readonly LINKS_KEY = 'tracked_links';
  private readonly CLICKS_KEY = 'link_clicks';

  /**
   * Generate a unique short code for the link
   */
  private generateShortCode(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create a new tracked link
   */
  createLink(originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string): TrackedLink {
    const links = this.getAllLinks();
    
    // Generate unique short code
    let shortCode = this.generateShortCode();
    while (links.some(link => link.shortCode === shortCode)) {
      shortCode = this.generateShortCode();
    }

    const newLink: TrackedLink = {
      id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shortCode,
      originalUrl,
      title,
      description,
      tags,
      linkedAccountId,
      createdAt: new Date(),
      totalClicks: 0,
      uniqueClicks: 0,
      isActive: true
    };

    links.push(newLink);
    this.saveLinks(links);
    
    console.log('✅ Created tracked link:', shortCode, '→', originalUrl, linkedAccountId ? `(linked to ${linkedAccountId})` : '');
    return newLink;
  }

  /**
   * Get all tracked links
   */
  getAllLinks(): TrackedLink[] {
    try {
      const data = localStorage.getItem(this.LINKS_KEY);
      if (!data) return [];
      
      const links = JSON.parse(data, (key, value) => {
        if ((key === 'createdAt' || key === 'lastClickedAt' || key === 'expiresAt') && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      });
      
      return links;
    } catch (error) {
      console.error('Error loading tracked links:', error);
      return [];
    }
  }

  /**
   * Get a link by short code
   */
  getLinkByShortCode(shortCode: string): TrackedLink | null {
    const links = this.getAllLinks();
    return links.find(link => link.shortCode === shortCode && link.isActive) || null;
  }

  /**
   * Get a link by ID
   */
  getLinkById(id: string): TrackedLink | null {
    const links = this.getAllLinks();
    return links.find(link => link.id === id) || null;
  }

  /**
   * Update a link
   */
  updateLink(id: string, updates: Partial<TrackedLink>): boolean {
    const links = this.getAllLinks();
    const index = links.findIndex(link => link.id === id);
    
    if (index === -1) return false;
    
    links[index] = { ...links[index], ...updates };
    this.saveLinks(links);
    
    console.log('✅ Updated link:', links[index].shortCode);
    return true;
  }

  /**
   * Delete a link (soft delete - just marks as inactive)
   */
  deleteLink(id: string): boolean {
    return this.updateLink(id, { isActive: false });
  }

  /**
   * Record a click on a link
   */
  recordClick(linkId: string, clickData?: Partial<LinkClick>): void {
    // Update link stats
    const links = this.getAllLinks();
    const linkIndex = links.findIndex(link => link.id === linkId);
    
    if (linkIndex !== -1) {
      links[linkIndex].totalClicks++;
      links[linkIndex].lastClickedAt = new Date();
      
      // Check if unique click (simplified - in production you'd check IP/session)
      const recentClicks = this.getClicksForLink(linkId);
      const isUnique = !recentClicks.some(click => {
        const clickTime = new Date(click.clickedAt).getTime();
        const now = Date.now();
        return (now - clickTime) < 24 * 60 * 60 * 1000; // 24 hours
      });
      
      if (isUnique) {
        links[linkIndex].uniqueClicks++;
      }
      
      this.saveLinks(links);
    }

    // Record click details
    const clicks = this.getAllClicks();
    const newClick: LinkClick = {
      id: `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      linkId,
      clickedAt: new Date(),
      ...clickData
    };
    
    clicks.push(newClick);
    this.saveClicks(clicks);
    
    console.log('📊 Recorded click for link:', linkId);
  }

  /**
   * Get all clicks
   */
  private getAllClicks(): LinkClick[] {
    try {
      const data = localStorage.getItem(this.CLICKS_KEY);
      if (!data) return [];
      
      const clicks = JSON.parse(data, (key, value) => {
        if (key === 'clickedAt' && typeof value === 'string') {
          return new Date(value);
        }
        return value;
      });
      
      return clicks;
    } catch (error) {
      console.error('Error loading clicks:', error);
      return [];
    }
  }

  /**
   * Get clicks for a specific link
   */
  getClicksForLink(linkId: string): LinkClick[] {
    const allClicks = this.getAllClicks();
    return allClicks.filter(click => click.linkId === linkId);
  }

  /**
   * Get analytics for a link
   */
  getLinkAnalytics(linkId: string, days: number = 30): LinkAnalytics {
    const clicks = this.getClicksForLink(linkId);
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Filter clicks within the period
    const periodClicks = clicks.filter(click => 
      new Date(click.clickedAt) >= startDate
    );

    // Calculate device breakdown
    const deviceBreakdown = {
      mobile: 0,
      tablet: 0,
      desktop: 0
    };
    
    periodClicks.forEach(click => {
      if (click.deviceType) {
        deviceBreakdown[click.deviceType]++;
      }
    });

    // Calculate country breakdown
    const countryBreakdown: Record<string, number> = {};
    periodClicks.forEach(click => {
      if (click.country) {
        countryBreakdown[click.country] = (countryBreakdown[click.country] || 0) + 1;
      }
    });

    // Calculate referrer breakdown
    const referrerBreakdown: Record<string, number> = {};
    periodClicks.forEach(click => {
      const referrer = click.referrer || 'Direct';
      referrerBreakdown[referrer] = (referrerBreakdown[referrer] || 0) + 1;
    });

    // Calculate clicks by day
    const clicksByDay: Array<{ date: Date; clicks: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);
      
      const dayClicks = periodClicks.filter(click => {
        const clickDate = new Date(click.clickedAt);
        clickDate.setHours(0, 0, 0, 0);
        return clickDate.getTime() === date.getTime();
      });
      
      clicksByDay.unshift({ date, clicks: dayClicks.length });
    }

    // Calculate unique clicks (simplified)
    const uniqueIPs = new Set(periodClicks.map(c => c.ipAddress).filter(Boolean));

    return {
      linkId,
      period: `Last ${days} days`,
      clicks: periodClicks.length,
      uniqueClicks: uniqueIPs.size || periodClicks.length,
      deviceBreakdown,
      countryBreakdown,
      referrerBreakdown,
      clicksByDay
    };
  }

  /**
   * Save links to localStorage
   */
  private saveLinks(links: TrackedLink[]): void {
    localStorage.setItem(this.LINKS_KEY, JSON.stringify(links));
  }

  /**
   * Save clicks to localStorage
   */
  private saveClicks(clicks: LinkClick[]): void {
    // Keep only last 10000 clicks to avoid storage issues
    const recentClicks = clicks.slice(-10000);
    localStorage.setItem(this.CLICKS_KEY, JSON.stringify(recentClicks));
  }

  /**
   * Get the full tracking URL for a short code
   */
  getTrackingUrl(shortCode: string): string {
    // In production, this would be your actual domain
    const baseUrl = window.location.origin;
    return `${baseUrl}/l/${shortCode}`;
  }

  /**
   * Export links as CSV
   */
  exportLinksAsCSV(): string {
    const links = this.getAllLinks();
    const headers = ['Short Code', 'Title', 'Original URL', 'Total Clicks', 'Unique Clicks', 'Created At', 'Status'];
    
    const rows = links.map(link => [
      link.shortCode,
      link.title,
      link.originalUrl,
      link.totalClicks.toString(),
      link.uniqueClicks.toString(),
      link.createdAt.toISOString(),
      link.isActive ? 'Active' : 'Inactive'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }
}

export default new TrackedLinksService();
