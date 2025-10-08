import { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import Lottie from 'lottie-react';
import { Plus, Copy, ExternalLink, Trash2, BarChart, Edit2, ArrowUp, ArrowDown } from 'lucide-react';
import { TrackedLink, TrackedAccount } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import CreateLinkModal from './CreateLinkModal';
import LinkAnalyticsModal from './LinkAnalyticsModal';
import { DateFilterType } from './DateRangeFilter';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import Pagination from './ui/Pagination';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { LinkClick } from '../services/LinkClicksService';
import websiteStatsAnimation from '../../public/lottie/Website Statistics Infographic.json';

export interface TrackedLinksPageRef {
  openCreateModal: () => void;
}

interface TrackedLinksPageProps {
  searchQuery: string;
  linkClicks?: LinkClick[];
  dateFilter: DateFilterType;
  customDateRange?: { startDate: Date; endDate: Date };
}

const TrackedLinksPage = forwardRef<TrackedLinksPageRef, TrackedLinksPageProps>(({ searchQuery, linkClicks = [], dateFilter, customDateRange }, ref) => {
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
  
  // Expose openCreateModal to parent component
  useImperativeHandle(ref, () => ({
    openCreateModal: () => setIsCreateModalOpen(true)
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
      console.log('🔗 Loading tracked links...');
      const allLinks = await FirestoreDataService.getLinks(currentOrgId, currentProjectId);
      console.log(`✅ Loaded ${allLinks.length} links with click data:`, 
        allLinks.map(l => ({ title: l.title, clicks: l.totalClicks || 0 }))
      );
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
      const clickDate = click.timestamp;
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
        
        const clicksInPeriod = filteredClicks.filter(click => 
          click.timestamp >= pointDate && click.timestamp < nextPointDate
        );
        
        let value = 0;
        if (metric === 'total') {
          value = clicksInPeriod.length;
        } else if (metric === 'unique') {
          value = new Set(clicksInPeriod.map(c => `${c.userAgent}-${c.deviceType}`)).size;
        } else if (metric === 'ctr') {
          const uniqueClicks = new Set(clicksInPeriod.map(c => `${c.userAgent}-${c.deviceType}`)).size;
          value = uniqueClicks;
        }
        
        data.push({ value, timestamp: pointDate.getTime() });
      }
      
      return data;
    };
    
    return {
      total: generateData('total'),
      unique: generateData('unique'),
      ctr: generateData('ctr')
    };
  }, [filteredClicks, dateFilter]);

  // Calculate stats from filtered clicks
  const stats = useMemo(() => {
    const totalClicks = filteredClicks.length;
    const uniqueClicks = new Set(
      filteredClicks.map(c => `${c.userAgent}-${c.deviceType}`)
    ).size;
    const avgCTR = links.length > 0 
      ? ((uniqueClicks / links.length) * 0.1).toFixed(1) 
      : '0.0';
    
    return { totalClicks, uniqueClicks, avgCTR };
  }, [filteredClicks, links]);

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
        <div className="bg-zinc-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
              <BarChart className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs text-gray-400">Live</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Total Clicks</p>
            <p className="text-3xl font-bold text-white mb-2">
              {formatNumber(stats.totalClicks)}
            </p>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-gray-500">
                {dateFilter === 'all' ? 'All time clicks' : 
                 dateFilter === 'today' ? 'Today' :
                 dateFilter === 'last7days' ? 'Last 7 days' :
                 dateFilter === 'last30days' ? 'Last 30 days' :
                 dateFilter === 'last90days' ? 'Last 90 days' : 'Selected period'}
              </span>
            </div>
            {/* Sparkline */}
            <div className="h-12 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData.total}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const value = data.value;
                        const timestamp = data.timestamp;
                        
                        const formatDate = (ts: number) => {
                          const date = new Date(ts);
                          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                          return `${months[date.getMonth()]} ${date.getDate()}`;
                        };
                        
                        const formatNumber = (num: number): string => {
                          if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                          if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                          return num.toLocaleString();
                        };
                        
                        return (
                          <div className="bg-gray-900/80 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-xl text-sm space-y-1.5 min-w-[220px] border border-white/10">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                              total: {stats.totalClicks.toLocaleString()} CLICKS
                            </p>
                            <p className="text-sm text-gray-200 font-medium">
                              {formatDate(timestamp)}: <span className="text-white font-semibold">{formatNumber(value)} clicks</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#totalGradient)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Unique Clicks Card */}
        <div className="bg-zinc-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
              <BarChart className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs text-gray-400">Live</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Unique Clicks</p>
            <p className="text-3xl font-bold text-white mb-2">
              {formatNumber(stats.uniqueClicks)}
            </p>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-gray-500">Unique visitors</span>
            </div>
            {/* Sparkline */}
            <div className="h-12 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData.unique}>
                  <defs>
                    <linearGradient id="uniqueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const value = data.value;
                        const timestamp = data.timestamp;
                        
                        const formatDate = (ts: number) => {
                          const date = new Date(ts);
                          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                          return `${months[date.getMonth()]} ${date.getDate()}`;
                        };
                        
                        const formatNumber = (num: number): string => {
                          if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                          if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                          return num.toLocaleString();
                        };
                        
                        return (
                          <div className="bg-gray-900/80 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-xl text-sm space-y-1.5 min-w-[220px] border border-white/10">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                              total: {stats.uniqueClicks.toLocaleString()} UNIQUE CLICKS
                            </p>
                            <p className="text-sm text-gray-200 font-medium">
                              {formatDate(timestamp)}: <span className="text-white font-semibold">{formatNumber(value)} unique</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#A855F7', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#A855F7"
                    strokeWidth={2}
                    fill="url(#uniqueGradient)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Avg CTR Card */}
        <div className="bg-zinc-900/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-orange-500/10 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
              <BarChart className="w-6 h-6 text-orange-400" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs text-gray-400">Live</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400 mb-1">Avg CTR</p>
            <p className="text-3xl font-bold text-white mb-2">
              {stats.avgCTR}%
            </p>
            <div className="flex items-center gap-2 text-xs mb-3">
              <span className="text-gray-500">Click-through rate</span>
            </div>
            {/* Sparkline */}
            <div className="h-12 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData.ctr}>
                  <defs>
                    <linearGradient id="ctrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const value = data.value;
                        const timestamp = data.timestamp;
                        
                        const formatDate = (ts: number) => {
                          const date = new Date(ts);
                          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                          return `${months[date.getMonth()]} ${date.getDate()}`;
                        };
                        
                        const formatNumber = (num: number): string => {
                          if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                          if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                          return num.toLocaleString();
                        };
                        
                        return (
                          <div className="bg-gray-900/80 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-xl text-sm space-y-1.5 min-w-[220px] border border-white/10">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                              avg: {stats.avgCTR}% CTR
                            </p>
                            <p className="text-sm text-gray-200 font-medium">
                              {formatDate(timestamp)}: <span className="text-white font-semibold">{formatNumber(value)} unique</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#F97316', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#F97316"
                    strokeWidth={2}
                    fill="url(#ctrGradient)"
                    animationDuration={300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
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
            {!searchQuery && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Link
              </button>
            )}
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
                                <span className="text-xs text-blue-600 dark:text-blue-400 mr-2">
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
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="View Analytics"
                        >
                          <BarChart className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingLink(link);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
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
    </div>
  );
});

export default TrackedLinksPage;
