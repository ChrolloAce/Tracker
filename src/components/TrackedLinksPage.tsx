import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw, ExternalLink, Plus, Copy, Trash2, Edit2, BarChart } from 'lucide-react';
import { DateFilterType } from './DateRangeFilter';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';
import LinkClicksService, { LinkClick } from '../services/LinkClicksService';
import { TrackedLink } from '../types/firestore';
import FirestoreDataService from '../services/FirestoreDataService';
import CreateLinkModal from './CreateLinkModal';
import DeleteLinkModal from './DeleteLinkModal';
import LinkAnalyticsModalEnhanced from './LinkAnalyticsModalEnhanced';

export interface TrackedLinksPageRef {
  openCreateModal: () => void;
  refreshData?: () => Promise<void>;
}

interface TrackedLinksPageProps {
  searchQuery?: string;
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  customDateRange?: { start: Date; end: Date } | { startDate: Date; endDate: Date };
  organizationId?: string;
  projectId?: string;
}

const TrackedLinksPage = forwardRef<TrackedLinksPageRef, TrackedLinksPageProps>(
  ({ organizationId, projectId }, ref) => {
    const { currentOrgId, currentProjectId, user } = useAuth();
  const [links, setLinks] = useState<TrackedLink[]>([]);
    const [linkClicks, setLinkClicks] = useState<LinkClick[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'today' | 'all-time'>('today');
    const [interval, setInterval] = useState<'hourly' | 'monthly'>('hourly');
    const [refreshing, setRefreshing] = useState(false);
    const [totalClicks, setTotalClicks] = useState(0);
    const [totalLinks, setTotalLinks] = useState(0);
    const [uniqueVisitors, setUniqueVisitors] = useState(0);
    const [clickThroughRate, setClickThroughRate] = useState(0);
    const [topPerformer, setTopPerformer] = useState<string>('-');
    const [avgClicksPerLink, setAvgClicksPerLink] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [editingLink, setEditingLink] = useState<TrackedLink | null>(null);
    const [linkFilter, setLinkFilter] = useState<string>('all'); // 'all' or link ID

    const orgId = organizationId || currentOrgId;
    const projId = projectId || currentProjectId;

  useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        setShowCreateModal(true);
      },
      refreshData: async () => {
        await loadData();
      }
    }));

  useEffect(() => {
      console.log('🎯 Effect triggered - loading data', { orgId, projId, timeframe });
      loadData();
    }, [orgId, projId]);

    // Recalculate metrics when timeframe or filter changes
    useEffect(() => {
      if (links.length > 0 || linkClicks.length > 0) {
        console.log('⏰ Timeframe or filter changed, recalculating metrics...', timeframe, linkFilter);
        calculateMetrics(links, linkClicks);
      }
    }, [timeframe, linkFilter]);

    const loadData = async () => {
      if (!orgId || !projId) {
        console.warn('Cannot load data: missing orgId or projId', { orgId, projId });
      return;
    }
    
      console.log('🔄 Loading links data...', { orgId, projId });
      setLoading(true);
    try {
        const [linksData, clicksData] = await Promise.all([
          FirestoreDataService.getLinks(orgId, projId),
          LinkClicksService.getProjectLinkClicks(orgId, projId)
        ]);

        console.log('✅ Loaded links:', linksData.length, 'links');
        console.log('✅ Loaded clicks:', clicksData.length, 'clicks');
        console.log('📊 Sample click data:', clicksData[0]);
        
        setLinks(linksData);
        setLinkClicks(clicksData); // Store clicks in state!
        calculateMetrics(linksData, clicksData);
    } catch (error) {
        console.error('❌ Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

    const calculateMetrics = (linksData: TrackedLink[], clicksData: LinkClick[]) => {
      // Filter clicks based on selected link
      const filteredClicks = linkFilter === 'all' 
        ? clicksData 
        : clicksData.filter(click => click.linkId === linkFilter);
      
      // Filter links if specific link is selected
      const filteredLinks = linkFilter === 'all'
        ? linksData
        : linksData.filter(link => link.id === linkFilter);

      setTotalLinks(filteredLinks.length);
      setTotalClicks(filteredClicks.length);

      // Calculate unique visitors (unique user agents)
      const uniqueIPs = new Set(filteredClicks.map(click => click.userAgent)).size;
      setUniqueVisitors(uniqueIPs);

      // Calculate average clicks per link
      const avgClicks = filteredLinks.length > 0 ? filteredClicks.length / filteredLinks.length : 0;
      setAvgClicksPerLink(Math.round(avgClicks * 10) / 10);

      // Calculate click-through rate (mock for now - would need impressions data)
      const ctr = filteredLinks.length > 0 ? (filteredClicks.length / (filteredLinks.length * 100)) * 100 : 0;
      setClickThroughRate(Math.round(ctr * 100) / 100);

      // Find top performing link
      if (filteredLinks.length > 0) {
        const linkClickCounts = filteredLinks.map(link => ({
          title: link.title,
          clicks: filteredClicks.filter(click => click.linkId === link.id).length
        }));
        const topLink = linkClickCounts.reduce((prev, current) => 
          current.clicks > prev.clicks ? current : prev
        , { title: '-', clicks: 0 });
        setTopPerformer(topLink.title || '-');
    }
  };

    const handleRefresh = async () => {
      setRefreshing(true);
      await loadData();
      setRefreshing(false);
  };

    // Filter clicks based on selected link
    const filteredLinkClicks = linkFilter === 'all' 
      ? linkClicks 
      : linkClicks.filter(click => click.linkId === linkFilter);
    
    // Filter links if specific link is selected
    const filteredLinks = linkFilter === 'all'
      ? links
      : links.filter(link => link.id === linkFilter);

    // Calculate link performance data
    const linkPerformance = filteredLinks.slice(0, 10).map(link => {
      const linkClicksData = filteredLinkClicks.filter(click => click.linkId === link.id);
      return {
        title: link.title || link.shortCode,
        clicks: linkClicksData.length,
        shortCode: link.shortCode
      };
    }).sort((a, b) => b.clicks - a.clicks);

    // Calculate clicks by country
    const clicksByCountry = filteredLinkClicks.reduce((acc: { [key: string]: number }, click) => {
      const country = click.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    const topCountries = Object.entries(clicksByCountry)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country, clicks]) => ({
        name: country,
        clicks,
        flag: getCountryFlag(country)
      }));

    // Calculate hourly traffic (for today)
    const clicksByHour = Array.from({ length: 24 }, (_, hour) => {
      const now = new Date();
      const hourClicks = filteredLinkClicks.filter(click => {
        if (!click.timestamp) return false;
        // Handle both Firestore Timestamp and Date objects
        const clickDate = (click.timestamp as any).toDate 
          ? (click.timestamp as any).toDate() 
          : new Date(click.timestamp as any);
 
        // Only count clicks from today for hourly view
        if (timeframe === 'today') {
          const isToday = clickDate.toDateString() === now.toDateString();
          return isToday && clickDate.getHours() === hour;
        }
        return clickDate.getHours() === hour;
      }).length;
      
      // Format hour properly (12-hour format with AM/PM)
      const period = hour < 12 ? 'am' : 'pm';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      
      return {
        hour: `${displayHour}${period}`,
        clicks: hourClicks
      };
    });

    function getCountryFlag(countryName: string): string {
      const flagMap: { [key: string]: string } = {
        'United States': '🇺🇸',
        'US': '🇺🇸',
        'USA': '🇺🇸',
        'United Kingdom': '🇬🇧',
        'UK': '🇬🇧',
        'GB': '🇬🇧',
        'Canada': '🇨🇦',
        'CA': '🇨🇦',
        'Australia': '🇦🇺',
        'AU': '🇦🇺',
        'Germany': '🇩🇪',
        'DE': '🇩🇪',
        'France': '🇫🇷',
        'FR': '🇫🇷',
        'Spain': '🇪🇸',
        'ES': '🇪🇸',
        'Italy': '🇮🇹',
        'IT': '🇮🇹',
        'Japan': '🇯🇵',
        'JP': '🇯🇵',
        'China': '🇨🇳',
        'CN': '🇨🇳',
        'India': '🇮🇳',
        'IN': '🇮🇳',
        'Brazil': '🇧🇷',
        'BR': '🇧🇷',
        'Mexico': '🇲🇽',
        'MX': '🇲🇽',
        'Israel': '🇮🇱',
        'IL': '🇮🇱',
        'Netherlands': '🇳🇱',
        'NL': '🇳🇱',
        'Sweden': '🇸🇪',
        'SE': '🇸🇪',
        'Norway': '🇳🇴',
        'NO': '🇳🇴',
        'Denmark': '🇩🇰',
        'DK': '🇩🇰',
        'Finland': '🇫🇮',
        'FI': '🇫🇮',
        'Switzerland': '🇨🇭',
        'CH': '🇨🇭',
        'Austria': '🇦🇹',
        'AT': '🇦🇹',
        'Belgium': '🇧🇪',
        'BE': '🇧🇪',
        'Poland': '🇵🇱',
        'PL': '🇵🇱',
        'Portugal': '🇵🇹',
        'PT': '🇵🇹',
        'Greece': '🇬🇷',
        'GR': '🇬🇷',
        'Czech Republic': '🇨🇿',
        'CZ': '🇨🇿',
        'Romania': '🇷🇴',
        'RO': '🇷🇴',
        'Hungary': '🇭🇺',
        'HU': '🇭🇺',
        'Ireland': '🇮🇪',
        'IE': '🇮🇪',
        'New Zealand': '🇳🇿',
        'NZ': '🇳🇿',
        'Singapore': '🇸🇬',
        'SG': '🇸🇬',
        'Hong Kong': '🇭🇰',
        'HK': '🇭🇰',
        'South Korea': '🇰🇷',
        'KR': '🇰🇷',
        'Taiwan': '🇹🇼',
        'TW': '🇹🇼',
        'Thailand': '🇹🇭',
        'TH': '🇹🇭',
        'Malaysia': '🇲🇾',
        'MY': '🇲🇾',
        'Indonesia': '🇮🇩',
        'ID': '🇮🇩',
        'Philippines': '🇵🇭',
        'PH': '🇵🇭',
        'Vietnam': '🇻🇳',
        'VN': '🇻🇳',
        'South Africa': '🇿🇦',
        'ZA': '🇿🇦',
        'Argentina': '🇦🇷',
        'AR': '🇦🇷',
        'Chile': '🇨🇱',
        'CL': '🇨🇱',
        'Colombia': '🇨🇴',
        'CO': '🇨🇴',
        'Peru': '🇵🇪',
        'PE': '🇵🇪',
        'Turkey': '🇹🇷',
        'TR': '🇹🇷',
        'Saudi Arabia': '🇸🇦',
        'SA': '🇸🇦',
        'UAE': '🇦🇪',
        'AE': '🇦🇪',
        'Egypt': '🇪🇬',
        'EG': '🇪🇬',
        'Russia': '🇷🇺',
        'RU': '🇷🇺',
        'Ukraine': '🇺🇦',
        'UA': '🇺🇦',
        'Unknown': '🌍'
      };
      return flagMap[countryName] || '🌍';
    }

    const handleCopyLink = (link: TrackedLink) => {
      const fullUrl = `${window.location.origin}/l/${link.shortCode}`;
      navigator.clipboard.writeText(fullUrl);
      console.log('📋 Copied link to clipboard:', fullUrl);
      // You can add a toast notification here if needed
    };

    const handleDeleteLink = async () => {
      if (!selectedLink || !orgId || !projId) return;
      try {
        await FirestoreDataService.deleteLink(orgId, projId, selectedLink.id);
        setShowDeleteModal(false);
        setSelectedLink(null);
        await loadData();
      } catch (error) {
        console.error('Failed to delete link:', error);
      }
    };

    const handleEditLink = (link: TrackedLink) => {
      setEditingLink(link);
      setShowCreateModal(true);
    };

    if (loading) {
    return <PageLoadingSkeleton type="links" />;
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 rounded-lg border border-white/10">
              <ExternalLink className="w-4 h-4 text-gray-400" />
              <span className="text-white font-medium">Link Analytics</span>
            </div>
            
            {/* Link Filter Dropdown */}
            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              className="px-4 py-2 bg-black/40 text-white rounded-lg border border-white/10 hover:bg-black/60 transition-colors text-sm font-medium focus:outline-none focus:border-white/30 cursor-pointer"
            >
              <option value="all">All Links ({links.length})</option>
              {links.map(link => (
                <option key={link.id} value={link.id}>
                  {link.title || link.shortCode}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Link</span>
            </button>
      </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Links */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-sm text-gray-400 font-medium">Total Links</span>
            </div>
            <div className="text-3xl font-bold text-white">{totalLinks}</div>
          </div>

          {/* Total Clicks */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span className="text-sm text-gray-400 font-medium">Total Clicks</span>
            </div>
            <div className="text-3xl font-bold text-white">{totalClicks}</div>
          </div>

          {/* Unique Visitors */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span className="text-sm text-gray-400 font-medium">Unique Visitors</span>
            </div>
            <div className="text-3xl font-bold text-white">{uniqueVisitors}</div>
          </div>

          {/* Avg Clicks/Link */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors">
            <div className="text-sm text-gray-400 font-medium mb-2">Avg Clicks/Link</div>
            <div className="text-3xl font-bold text-white">{avgClicksPerLink}</div>
          </div>

          {/* Click-Through Rate */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors">
            <div className="text-sm text-gray-400 font-medium mb-2">CTR</div>
            <div className="text-3xl font-bold text-white">{clickThroughRate}%</div>
          </div>

          {/* Top Performer */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400 font-medium">Top Performer</span>
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            </div>
            <div className="text-lg font-bold text-white truncate" title={topPerformer}>
              {topPerformer}
            </div>
          </div>
        </div>

        {/* Clicks Trend Chart */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Clicks Over Time</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeframe('today')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeframe === 'today' 
                    ? 'bg-black dark:bg-white text-white dark:text-black' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeframe('all-time')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeframe === 'all-time' 
                    ? 'bg-black dark:bg-white text-white dark:text-black' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                }`}
              >
                All Time
              </button>
            </div>
          </div>
          <div className="h-64 flex items-end gap-1">
            {clicksByHour.map((data, index) => {
              const maxClicks = Math.max(...clicksByHour.map(d => d.clicks), 1);
              const heightPercent = maxClicks > 0 ? (data.clicks / maxClicks) * 100 : 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                  {data.clicks > 0 && (
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {data.clicks} {data.clicks === 1 ? 'click' : 'clicks'}
                    </div>
                  )}
                  <div
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-600 hover:to-blue-500 transition-all"
                    style={{ 
                      height: `${heightPercent}%`,
                      minHeight: data.clicks > 0 ? '4px' : '2px',
                      opacity: data.clicks > 0 ? 1 : 0.15
                    }}
                  ></div>
                  {(index % 3 === 0 || index === 23) && (
                    <span className="text-xs text-gray-500 absolute -bottom-6">{data.hour}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Analytics Grid - 4 sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing Links */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Performing Links</h3>
            <div className="space-y-2">
              {linkPerformance.length > 0 ? (
                linkPerformance.map((link, index) => (
                  <div key={index} className="flex items-center justify-between py-3 px-3 hover:bg-white/5 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{link.title}</div>
                      <div className="text-xs text-gray-500">/{link.shortCode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{link.clicks}</span>
                      <span className="text-xs text-gray-400">clicks</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No link data available yet</p>
                  <p className="text-sm mt-2">Create links to see performance</p>
                </div>
              )}
            </div>
          </div>

          {/* Geographic Distribution */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Clicks by Country</h3>
            <div className="space-y-2">
              {topCountries.length > 0 ? (
                topCountries.map((country, index) => (
                  <div key={index} className="flex items-center justify-between py-3 px-3 hover:bg-white/5 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{country.flag}</span>
                      <span className="text-sm font-medium text-white">{country.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{country.clicks}</span>
                      <span className="text-xs text-gray-400">{country.clicks === 1 ? 'click' : 'clicks'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No geographic data available yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Channel Breakdown - Traffic Sources */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Traffic Sources</h3>
            {(() => {
              const sourceCounts = linkClicks.reduce((acc: { [key: string]: number }, click) => {
                let source = 'Direct';
                const referrer = click.referrer || click.referrerDomain || '';
                
                if (referrer && referrer !== 'Direct') {
                  const ref = referrer.toLowerCase();
                  if (ref.includes('twitter') || ref.includes('x.com') || ref.includes('t.co')) {
                    source = 'X/Twitter';
                  } else if (ref.includes('facebook') || ref.includes('fb.com')) {
                    source = 'Facebook';
                  } else if (ref.includes('instagram') || ref.includes('ig.com')) {
                    source = 'Instagram';
                  } else if (ref.includes('linkedin')) {
                    source = 'LinkedIn';
                  } else if (ref.includes('youtube')) {
                    source = 'YouTube';
                  } else if (ref.includes('tiktok')) {
                    source = 'TikTok';
                  } else if (ref.includes('google') || ref.includes('bing') || ref.includes('yahoo')) {
                    source = 'Search';
                  } else {
                    source = 'Referral';
                  }
                }
                
                acc[source] = (acc[source] || 0) + 1;
                return acc;
              }, {});
              
              const sourceData = Object.entries(sourceCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);

              const totalClicks = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

              const getSourceIcon = (source: string) => {
                if (source === 'Direct') return '🔗';
                if (source === 'X/Twitter') return '🐦';
                if (source === 'Facebook') return '👥';
                if (source === 'Instagram') return '📸';
                if (source === 'LinkedIn') return '💼';
                if (source === 'YouTube') return '📺';
                if (source === 'TikTok') return '🎵';
                if (source === 'Reddit') return '🤖';
                if (source === 'Search') return '🔍';
                if (source === 'Referral') return '↗️';
                return '🌐';
              };

              return sourceData.length > 0 ? (
                <div className="flex flex-col items-center">
                  {/* Donut Chart */}
                  <div className="relative w-48 h-48 mb-6">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      {(() => {
                        let currentAngle = 0;
                        const colors = ['#5B8DEF', '#7BA5F3', '#9BBDF7', '#BBD5FB', '#DBEAFE'];
                        return sourceData.map(([source, clicks], index) => {
                          const percentage = (clicks / totalClicks) * 100;
                          const angle = (percentage / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;
                          
                          const radius = 42;
                          const innerRadius = 30;
                          const startRad = (startAngle - 90) * (Math.PI / 180);
                          const endRad = (startAngle + angle - 90) * (Math.PI / 180);
                          
                          const x1 = 50 + radius * Math.cos(startRad);
                          const y1 = 50 + radius * Math.sin(startRad);
                          const x2 = 50 + radius * Math.cos(endRad);
                          const y2 = 50 + radius * Math.sin(endRad);
                          
                          const x3 = 50 + innerRadius * Math.cos(endRad);
                          const y3 = 50 + innerRadius * Math.sin(endRad);
                          const x4 = 50 + innerRadius * Math.cos(startRad);
                          const y4 = 50 + innerRadius * Math.sin(startRad);
                          
                          const largeArc = angle > 180 ? 1 : 0;
                          
                          return (
                            <path
                              key={source}
                              d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`}
                              fill={colors[index % colors.length]}
                              className="transition-opacity"
                            />
                          );
                        });
                      })()}
                    </svg>
                  </div>
                  
                  {/* Sources List */}
                  <div className="space-y-3 w-full">
                    {sourceData.map(([source, clicks], index) => {
                      const percentage = Math.round((clicks / totalClicks) * 100);
                      const colors = ['#5B8DEF', '#7BA5F3', '#9BBDF7', '#BBD5FB', '#DBEAFE'];
                      return (
                        <div key={source} className="flex items-center gap-3">
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: colors[index % colors.length] }}
                          ></div>
                          <div className="flex items-center justify-between flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getSourceIcon(source)}</span>
                              <span className="text-sm text-gray-300">{source}:</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-white">{percentage}%</span>
                              <span className="text-sm text-gray-400">{clicks}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No traffic data available yet</p>
                </div>
              );
            })()}
          </div>

          {/* Device Breakdown */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Device Breakdown</h3>
              <div className="flex gap-1 bg-black/40 rounded-lg border border-white/10 p-1">
                <button
                  onClick={() => setInterval('hourly')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    interval === 'hourly'
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Device
                </button>
                <button
                  onClick={() => setInterval('monthly')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    interval === 'monthly'
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Browser
                </button>
              </div>
      </div>

            {interval === 'hourly' ? (
              // Device View
              <div className="space-y-2">
                {(() => {
                  const deviceCounts = linkClicks.reduce((acc: { [key: string]: number }, click) => {
                    const device = click.deviceType || 'Unknown';
                    acc[device] = (acc[device] || 0) + 1;
                    return acc;
                  }, {});
                  
                  const deviceData = Object.entries(deviceCounts)
                    .sort(([, a], [, b]) => b - a);

                  const getDeviceIcon = (device: string) => {
                    const d = device.toLowerCase();
                    if (d === 'mobile') return '📱';
                    if (d === 'desktop') return '💻';
                    if (d === 'tablet') return '📲';
                    return '🖥️';
                  };

                  return deviceData.length > 0 ? (
                    deviceData.map(([device, clicks], index) => (
                      <div key={index} className="flex items-center justify-between py-3 px-3 hover:bg-white/5 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getDeviceIcon(device)}</span>
                          <span className="text-sm font-medium text-white capitalize">{device}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{clicks}</span>
                          <span className="text-xs text-gray-400">{clicks === 1 ? 'click' : 'clicks'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No device data available yet</p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Browser View
              <div className="space-y-2">
                {(() => {
                  const browserCounts = linkClicks.reduce((acc: { [key: string]: number }, click) => {
                    const browser = click.browser || 'Unknown';
                    acc[browser] = (acc[browser] || 0) + 1;
                    return acc;
                  }, {});
                  
                  const browserData = Object.entries(browserCounts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);

                  const getBrowserIcon = (browser: string) => {
                    const b = browser.toLowerCase();
                    if (b.includes('chrome')) return '🌐';
                    if (b.includes('safari')) return '🧭';
                    if (b.includes('firefox')) return '🦊';
                    if (b.includes('edge')) return '🔷';
                    if (b.includes('samsung')) return '📱';
                    return '🌍';
                  };

                  return browserData.length > 0 ? (
                    browserData.map(([browser, clicks], index) => (
                      <div key={index} className="flex items-center justify-between py-3 px-3 hover:bg-white/5 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getBrowserIcon(browser)}</span>
                          <span className="text-sm font-medium text-white">{browser}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{clicks}</span>
                          <span className="text-xs text-gray-400">{clicks === 1 ? 'click' : 'clicks'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No browser data available yet</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* All Links Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">All Tracked Links</h3>
            <p className="text-sm text-gray-400 mt-1">Manage and monitor your short links</p>
              </div>
          
          {links.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔗</div>
              <p className="text-gray-400 mb-2">No links created yet</p>
              <p className="text-sm text-gray-500">Click "Create Link" to get started</p>
              <p className="text-xs text-gray-600 mt-2">Loaded {links.length} links from database</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/20 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Link
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Short URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Clicks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {links.map((link) => {
                    const clicks = linkClicks.filter(click => click.linkId === link.id).length;
                    const shortUrl = `${window.location.origin}/l/${link.shortCode}`;
                  
                  return (
                      <tr key={link.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">{link.title}</span>
                            <span className="text-xs text-gray-500 truncate max-w-xs" title={link.originalUrl}>
                              {link.originalUrl}
                                </span>
                        </div>
                      </td>
                    <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:text-blue-300 font-mono underline decoration-dotted flex items-center gap-1"
                              title="Open link in new tab"
                            >
                          /{link.shortCode}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                        <button
                              onClick={() => handleCopyLink(link)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              title="Copy full link"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-gray-200" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-white">{clicks}</span>
                    </td>
                    <td className="px-6 py-4">
                          <span className="text-sm text-gray-400">
                            {link.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                          </span>
                    </td>
                    <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                        <button
                              onClick={() => {
                                setSelectedLink(link);
                                setShowAnalyticsModal(true);
                              }}
                              className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors"
                          title="View Analytics"
                        >
                          <BarChart className="w-4 h-4" />
                        </button>
                        <button
                              onClick={() => handleEditLink(link)}
                              className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-colors"
                              title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                              onClick={() => {
                                setSelectedLink(link);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                              title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                  })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modals */}
        
        {/* Create/Edit Link Modal */}
        {showCreateModal && (
        <CreateLinkModal
            isOpen={showCreateModal}
          onClose={() => {
              setShowCreateModal(false);
            setEditingLink(null);
          }}
          editingLink={editingLink}
            onCreate={async (originalUrl: string, title: string, description?: string, tags?: string[], linkedAccountId?: string) => {
              if (!orgId || !projId || !user) {
                console.error('Cannot create link: missing required data', { orgId, projId, hasUser: !!user });
                alert('Missing required data to create link. Please try logging in again.');
                return;
              }
              
              console.log('💾 Saving link...', { originalUrl, title, orgId, projId, userId: user.uid });
              
              try {
                if (editingLink) {
                  // Update existing link
                  console.log('✏️ Updating link:', editingLink.id);
                  await FirestoreDataService.updateLink(
                    orgId,
                    projId,
                    editingLink.id,
                    { originalUrl, title, description, tags }
                  );
                  console.log('✅ Link updated successfully');
                } else {
                  // Create new link
                  console.log('➕ Creating new link...');
                  
                  // Generate unique short code
                  const shortCode = Math.random().toString(36).substring(2, 8);
                  
                  const linkId = await FirestoreDataService.createLink(
                    orgId,
                    projId,
                    user.uid,
                    {
                      shortCode,
                      originalUrl,
                      title,
                      description,
                      tags,
                      linkedAccountId,
                      isActive: true
                    }
                  );
                  console.log('✅ Link created successfully with ID:', linkId);
                }
                
                // Close modal first
                setShowCreateModal(false);
                setEditingLink(null);
                
                // Wait a moment for Firestore to propagate
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Reload data
                console.log('🔄 Reloading data after link creation...');
                await loadData();
                console.log('✅ Data reloaded');
              } catch (error) {
                console.error('❌ Failed to save link:', error);
                alert('Failed to save link: ' + (error as Error).message);
              }
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedLink && (
          <DeleteLinkModal
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedLink(null);
            }}
            onConfirm={handleDeleteLink}
            link={selectedLink}
          />
        )}

        {/* Analytics Modal */}
        {showAnalyticsModal && selectedLink && (
        <LinkAnalyticsModalEnhanced
            isOpen={showAnalyticsModal}
          onClose={() => {
              setShowAnalyticsModal(false);
            setSelectedLink(null);
          }}
          link={selectedLink}
        />
      )}
    </div>
  );
  }
);

TrackedLinksPage.displayName = 'TrackedLinksPage';

export default TrackedLinksPage;
