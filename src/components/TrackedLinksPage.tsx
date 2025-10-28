import { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import Lottie from 'lottie-react';
import { Copy, ExternalLink, Trash2, BarChart, Edit2, ArrowUp, ArrowDown, MousePointer, Users, TrendingUp } from 'lucide-react';
import { TrackedLink, TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import CreateLinkModal from './CreateLinkModal';
import LinkAnalyticsModal from './LinkAnalyticsModal';
import { DateFilterType } from './DateRangeFilter';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import Pagination from './ui/Pagination';
import { LinkClick } from '../services/LinkClicksService';
import websiteStatsAnimation from '../../public/lottie/Website Statistics Infographic.json';
import { TrackedLinksKPICard } from './TrackedLinksKPICard';
import DayClicksModal from './DayClicksModal';

export interface TrackedLinksPageRef {
  openCreateModal: () => void;
  refreshData?: () => Promise<void>;
}

interface TrackedLinksPageProps {
  searchQuery: string;
  linkClicks?: LinkClick[];
  dateFilter: DateFilterType;
  customDateRange?: { startDate: Date; endDate: Date };
}

const TrackedLinksPage = forwardRef<TrackedLinksPageRef, TrackedLinksPageProps>(
  ({ searchQuery, linkClicks = [], dateFilter, customDateRange }, ref) => {
  const { currentOrgId, currentProjectId, user } = useAuth();
  const [links, setLinks] = useState<TrackedLink[]>([]);
  const [accounts, setAccounts] = useState<Map<string, TrackedAccount>>(new Map());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null);
  const [editingLink, setEditingLink] = useState<TrackedLink | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'createdAt' | 'totalClicks' | 'uniqueClicks' | 'title'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Day Clicks Modal state
  const [isDayClicksModalOpen, setIsDayClicksModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayClicks, setSelectedDayClicks] = useState<LinkClick[]>([]);
  
  // Expose openCreateModal to parent component
  // Refresh data function for parent to call
  const refreshData = async () => {
    await loadLinks();
    await loadAccounts();
  };

  useImperativeHandle(ref, () => ({
    openCreateModal: () => setIsCreateModalOpen(true),
    refreshData
  }), []);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('trackedLinks_itemsPerPage');
    return saved ? Number(saved) : 10;
  });

  // Save items per page preference
  useEffect(() => {
    localStorage.setItem('trackedLinks_itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  useEffect(() => {
    if (currentOrgId && currentProjectId) {
      loadLinks();
      loadAccounts();
      
      // Set up auto-refresh every 60 seconds to update click counts (less aggressive)
      const interval = setInterval(() => {
        loadLinks();
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [currentOrgId, currentProjectId]);

  const loadAccounts = async () => {
    if (!currentOrgId || !currentProjectId) return;
    try {
      const accountsData = await FirestoreDataService.getTrackedAccounts(currentOrgId, currentProjectId);
      const accountsMap = new Map(accountsData.map(acc => [acc.id, acc]));
      setAccounts(accountsMap);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadLinks = async () => {
    if (!currentOrgId || !currentProjectId) {
      return;
    }
    
    // Only show loading skeleton on initial load
    if (links.length === 0) {
      setLoading(true);
    }
    
    try {
      const allLinks = await FirestoreDataService.getLinks(currentOrgId, currentProjectId);
      setLinks(allLinks);
    } catch (error) {
      console.error('❌ Failed to load links:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string) => {
    if (!currentOrgId || !currentProjectId || !user) return;
    
    try {
      if (editingLink) {
        // Update existing link - filter out undefined values
        const updateData: any = {
          originalUrl,
          title,
        };
        
        if (description !== undefined) updateData.description = description;
        if (tags !== undefined) updateData.tags = tags;
        if (linkedAccountId !== undefined) updateData.linkedAccountId = linkedAccountId;
        
        await FirestoreDataService.updateLink(currentOrgId, currentProjectId, editingLink.id, updateData);
      } else {
        // Create new link
        const shortCode = generateShortCode();
        
        const createData: any = {
          shortCode,
          originalUrl,
          title,
          isActive: true
        };
        
        if (description !== undefined) createData.description = description;
        if (tags !== undefined) createData.tags = tags;
        if (linkedAccountId !== undefined) createData.linkedAccountId = linkedAccountId;
        
        await FirestoreDataService.createLink(currentOrgId, currentProjectId, user.uid, createData);
      }
      
      await loadLinks();
      setIsCreateModalOpen(false);
      setEditingLink(null);
    } catch (error) {
      console.error(`Failed to ${editingLink ? 'update' : 'create'} link:`, error);
      alert(`Failed to ${editingLink ? 'update' : 'create'} link. Please try again.`);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!currentOrgId || !currentProjectId || !window.confirm('Are you sure you want to delete this link?')) return;
    
    try {
      await FirestoreDataService.deleteLink(currentOrgId, currentProjectId, linkId);
      await loadLinks();
    } catch (error) {
      console.error('Failed to delete link:', error);
      alert('Failed to delete link. Please try again.');
    }
  };

  // Helper to generate short code
  const generateShortCode = (length: number = 6): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCopyLink = (shortCode: string) => {
    const url = `${window.location.origin}/l/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(shortCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleViewAnalytics = (link: TrackedLink) => {
    setSelectedLink(link);
    setIsAnalyticsModalOpen(true);
  };

  const filteredLinks = links.filter(link => 
    link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    link.originalUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
    link.shortCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorted links
  const sortedLinks = [...filteredLinks].sort((a, b) => {
    let aValue: any;
    let bValue: any;
    
    switch (sortField) {
      case 'createdAt':
        aValue = a.createdAt?.toDate?.()?.getTime() || 0;
        bValue = b.createdAt?.toDate?.()?.getTime() || 0;
        break;
      case 'totalClicks':
        aValue = a.totalClicks || 0;
        bValue = b.totalClicks || 0;
        break;
      case 'uniqueClicks':
        aValue = a.uniqueClicks || 0;
        bValue = b.uniqueClicks || 0;
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedLinks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLinks = sortedLinks.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleSort = (field: 'createdAt' | 'totalClicks' | 'uniqueClicks' | 'title') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc for numbers, asc for text
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  // Filter clicks by date range
  const filteredClicks = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        startDate = customDateRange?.startDate || new Date(0);
        break;
      case 'all':
      default:
        return linkClicks;
    }
    
    const endDate = dateFilter === 'custom' && customDateRange?.endDate 
      ? customDateRange.endDate 
      : new Date();
    
    return linkClicks.filter(click => {
      // Convert Firestore Timestamp to Date if necessary
      const clickDate = click.timestamp instanceof Date 
        ? click.timestamp 
        : (click.timestamp as any)?.toDate?.() || new Date(click.timestamp);
      return clickDate >= startDate && clickDate <= endDate;
    });
  }, [linkClicks, dateFilter, customDateRange]);

  // Generate sparkline data for the cards
  const sparklineData = useMemo(() => {
    const generateData = (metric: 'total' | 'unique' | 'ctr') => {
      let numPoints = 30;
      let intervalMs = 24 * 60 * 60 * 1000; // 1 day
      
      if (dateFilter === 'today') {
        numPoints = 24;
        intervalMs = 60 * 60 * 1000; // 1 hour
      } else if (dateFilter === 'last7days') {
        numPoints = 7;
      } else if (dateFilter === 'last30days') {
        numPoints = 30;
      } else if (dateFilter === 'last90days') {
        numPoints = 90;
      }
      
      const data = [];
      const now = new Date();
      
      for (let i = numPoints - 1; i >= 0; i--) {
        const pointDate = new Date(now.getTime() - i * intervalMs);
        const nextPointDate = new Date(pointDate.getTime() + intervalMs);
        
        const clicksInPeriod = filteredClicks.filter(click => {
          // Convert Firestore Timestamp to Date if necessary
          const clickDate = click.timestamp instanceof Date 
            ? click.timestamp 
            : (click.timestamp as any)?.toDate?.() || new Date(click.timestamp);
          return clickDate >= pointDate && clickDate < nextPointDate;
        });
        
        let value = 0;
        if (metric === 'total') {
          value = clicksInPeriod.length;
        } else if (metric === 'unique') {
          value = new Set(clicksInPeriod.map(c => `${c.userAgent}-${c.deviceType}`)).size;
        } else if (metric === 'ctr') {
          const uniqueClicks = new Set(clicksInPeriod.map(c => `${c.userAgent}-${c.deviceType}`)).size;
          value = uniqueClicks;
        }
        
        data.push({ 
          value, 
          timestamp: pointDate.getTime(),
          clicks: clicksInPeriod // Include clicks for tooltip
        });
      }
      
      return data;
    };
    
    return {
      total: generateData('total'),
      unique: generateData('unique'),
      ctr: generateData('ctr')
    };
  }, [filteredClicks, dateFilter]);

  // Calculate stats from filtered clicks with PP comparison
  const stats = useMemo(() => {
    const now = new Date();
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date = new Date();
    let ppDateRangeStart: Date | null = null;
    let ppDateRangeEnd: Date | null = null;
    
    // Calculate date ranges based on filter
    if (dateFilter === 'today') {
      dateRangeStart = new Date(now);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = yesterday
      ppDateRangeStart = new Date(dateRangeStart);
      ppDateRangeStart.setDate(ppDateRangeStart.getDate() - 1);
      ppDateRangeEnd = new Date(ppDateRangeStart);
      ppDateRangeEnd.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'last7days') {
      dateRangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // PP = previous 7 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last30days') {
      dateRangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // PP = previous 30 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'last90days') {
      dateRangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      
      // PP = previous 90 days
      ppDateRangeStart = new Date(dateRangeStart.getTime() - 90 * 24 * 60 * 60 * 1000);
      ppDateRangeEnd = new Date(dateRangeStart);
    } else if (dateFilter === 'custom' && customDateRange) {
      dateRangeStart = new Date(customDateRange.startDate);
      dateRangeStart.setHours(0, 0, 0, 0);
      dateRangeEnd = new Date(customDateRange.endDate);
      dateRangeEnd.setHours(23, 59, 59, 999);
      
      // PP = same duration before start date
      const duration = dateRangeEnd.getTime() - dateRangeStart.getTime();
      ppDateRangeEnd = new Date(dateRangeStart);
      ppDateRangeStart = new Date(dateRangeStart.getTime() - duration);
    }
    
    // Current Period (CP) clicks
    const totalClicks = filteredClicks.length;
    const uniqueClicks = new Set(
      filteredClicks.map(c => `${c.userAgent}-${c.deviceType}`)
    ).size;
    
    // Previous Period (PP) clicks
    let ppTotalClicks = 0;
    let ppUniqueClicks = 0;
    
    if (ppDateRangeStart && ppDateRangeEnd) {
      const ppClicks = linkClicks.filter(click => {
        const clickDate = new Date(click.timestamp);
        return clickDate >= ppDateRangeStart! && clickDate <= ppDateRangeEnd!;
      });
      
      ppTotalClicks = ppClicks.length;
      ppUniqueClicks = new Set(
        ppClicks.map(c => `${c.userAgent}-${c.deviceType}`)
      ).size;
    }
    
    const avgCTR = links.length > 0 
      ? ((uniqueClicks / links.length) * 0.1).toFixed(1) 
      : '0.0';
    
    // Calculate deltas
    const totalClicksGrowth = ppTotalClicks === 0 ? totalClicks : totalClicks - ppTotalClicks;
    const uniqueClicksGrowth = ppUniqueClicks === 0 ? uniqueClicks : uniqueClicks - ppUniqueClicks;
    
    return { 
      totalClicks, 
      uniqueClicks, 
      avgCTR,
      totalClicksGrowth,
      uniqueClicksGrowth,
      isTotalIncreasing: totalClicksGrowth >= 0,
      isUniqueIncreasing: uniqueClicksGrowth >= 0
    };
  }, [filteredClicks, links, linkClicks, dateFilter, customDateRange]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (loading) {
    return <PageLoadingSkeleton type="links" />;
  }

  return (
    <div className="space-y-6">

      {/* Stats Overview - Dashboard Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Clicks Card */}
        <TrackedLinksKPICard
          label="Total Clicks"
          value={formatNumber(stats.totalClicks)}
          growth={dateFilter !== 'all' ? stats.totalClicksGrowth : undefined}
          isIncreasing={stats.isTotalIncreasing}
          icon={MousePointer}
          sparklineData={sparklineData.total}
          onClick={(date, clicks) => {
            // Open modal showing all clicks for this day
            setSelectedDayDate(date);
            setSelectedDayClicks(clicks);
            setIsDayClicksModalOpen(true);
          }}
          onLinkClick={(shortCode) => {
            // When clicking on a specific link in the tooltip, open its analytics modal
            const link = links.find(l => l.shortCode === shortCode);
            if (link) {
              handleViewAnalytics(link);
            }
          }}
        />

        {/* Unique Clicks Card */}
        <TrackedLinksKPICard
          label="Unique Clicks"
          value={formatNumber(stats.uniqueClicks)}
          growth={dateFilter !== 'all' ? stats.uniqueClicksGrowth : undefined}
          isIncreasing={stats.isUniqueIncreasing}
          icon={Users}
          sparklineData={sparklineData.unique}
          onClick={(date, clicks) => {
            setSelectedDayDate(date);
            setSelectedDayClicks(clicks);
            setIsDayClicksModalOpen(true);
          }}
          onLinkClick={(shortCode) => {
            const link = links.find(l => l.shortCode === shortCode);
            if (link) {
              handleViewAnalytics(link);
            }
          }}
        />

        {/* Avg CTR Card */}
        <TrackedLinksKPICard
          label="Avg CTR"
          value={`${stats.avgCTR}%`}
          isIncreasing={stats.isTotalIncreasing}
          icon={TrendingUp}
          sparklineData={sparklineData.ctr}
          onClick={(date, clicks) => {
            setSelectedDayDate(date);
            setSelectedDayClicks(clicks);
            setIsDayClicksModalOpen(true);
          }}
          onLinkClick={(shortCode) => {
            const link = links.find(l => l.shortCode === shortCode);
            if (link) {
              handleViewAnalytics(link);
            }
          }}
        />
      </div>

      {/* Links Table */}
      <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
        {paginatedLinks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-64 h-64 mx-auto mb-4">
              <Lottie animationData={websiteStatsAnimation} loop={true} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Links Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery ? 'No links found matching your search' : 'Create your first tracked link to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-zinc-900/40 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-2">
                        Link Details
                        {sortField === 'title' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      Short URL
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('totalClicks')}
                    >
                      <div className="flex items-center gap-2">
                        Clicks
                        {sortField === 'totalClicks' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-2">
                        Created
                        {sortField === 'createdAt' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900/60 divide-y divide-gray-200 dark:divide-white/5">
              {paginatedLinks.length > 0 ? (
                paginatedLinks.map((link) => {
                  const linkedAccount = link.linkedAccountId ? accounts.get(link.linkedAccountId) : null;
                  
                  return (
                    <tr key={link.id} className="hover:bg-white/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {linkedAccount && (
                            <div className="flex-shrink-0">
                              {linkedAccount.profilePicture ? (
                                <img
                                  src={linkedAccount.profilePicture}
                                  alt={linkedAccount.username}
                                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {linkedAccount.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {link.title}
                            </p>
                            <div className="flex items-center space-x-1 mt-1">
                              {linkedAccount && (
                                <span className="text-xs text-gray-900 dark:text-white mr-2">
                                  @{linkedAccount.username}
                                </span>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {link.originalUrl}
                              </p>
                              <a
                                href={link.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            {link.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {link.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          /{link.shortCode}
                        </code>
                        <button
                          onClick={() => handleCopyLink(link.shortCode)}
                          className={clsx(
                            "p-1 rounded transition-colors",
                            copiedCode === link.shortCode
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          )}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatNumber(link.totalClicks || 0)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(link.uniqueClicks || 0)} unique
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {link.createdAt.toDate().toLocaleDateString()}
                      </p>
                      {link.lastClickedAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Last: {link.lastClickedAt.toDate().toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewAnalytics(link)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-gray-900 dark:text-white transition-colors"
                          title="View Analytics"
                        >
                          <BarChart className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingLink(link);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          title="Edit Link"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete Link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              ) : null}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filteredLinks.length}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
          </>
        )}
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateLinkModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingLink(null);
          }}
          onCreate={handleCreateLink}
          editingLink={editingLink}
        />
      )}

      {isAnalyticsModalOpen && selectedLink && (
        <LinkAnalyticsModal
          isOpen={isAnalyticsModalOpen}
          onClose={() => {
            setIsAnalyticsModalOpen(false);
            setSelectedLink(null);
          }}
          link={selectedLink}
        />
      )}

      {/* Day Clicks Modal */}
      {isDayClicksModalOpen && selectedDayDate && (
        <DayClicksModal
          isOpen={isDayClicksModalOpen}
          onClose={() => {
            setIsDayClicksModalOpen(false);
            setSelectedDayDate(null);
            setSelectedDayClicks([]);
          }}
          date={selectedDayDate}
          clicks={selectedDayClicks}
          links={links}
          onLinkClick={(link) => {
            // Close day modal and open link analytics
            setIsDayClicksModalOpen(false);
            handleViewAnalytics(link);
          }}
        />
      )}
    </div>
  );
});

export default TrackedLinksPage;
