export interface TrackedLink {
  id: string;
  shortCode: string; // e.g., "abc123" for yoursite.com/l/abc123
  originalUrl: string; // The destination URL
  title: string;
  description?: string;
  createdAt: Date;
  createdBy?: string;
  tags?: string[];
  
  // Analytics
  totalClicks: number;
  uniqueClicks: number;
  lastClickedAt?: Date;
  
  // Associations
  linkedVideoId?: string;
  linkedAccountId?: string;
  
  // Optional metadata
  qrCodeUrl?: string;
  isActive: boolean;
  expiresAt?: Date;
}

export interface LinkClick {
  id: string;
  linkId: string;
  clickedAt: Date;
  
  // User info
  ipAddress?: string;
  userAgent?: string;
  
  // Location info
  country?: string;
  city?: string;
  
  // Referrer info
  referrer?: string;
  
  // Device info
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
}

export interface LinkAnalytics {
  linkId: string;
  period: string;
  clicks: number;
  uniqueClicks: number;
  
  // Breakdown
  deviceBreakdown: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  
  countryBreakdown: Record<string, number>;
  referrerBreakdown: Record<string, number>;
  
  // Time series data
  clicksByDay: Array<{
    date: Date;
    clicks: number;
  }>;
}
