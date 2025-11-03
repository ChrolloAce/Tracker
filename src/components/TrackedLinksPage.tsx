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
    }, [orgId, projId, timeframe]);

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
      setTotalLinks(linksData.length);
      setTotalClicks(clicksData.length);

      // Calculate unique visitors (unique user agents)
      const uniqueIPs = new Set(clicksData.map(click => click.userAgent)).size;
      setUniqueVisitors(uniqueIPs);

      // Calculate average clicks per link
      const avgClicks = linksData.length > 0 ? clicksData.length / linksData.length : 0;
      setAvgClicksPerLink(Math.round(avgClicks * 10) / 10);

      // Calculate click-through rate (mock for now - would need impressions data)
      const ctr = linksData.length > 0 ? (clicksData.length / (linksData.length * 100)) * 100 : 0;
      setClickThroughRate(Math.round(ctr * 100) / 100);

      // Find top performing link
      if (linksData.length > 0) {
        const linkClickCounts = linksData.map(link => ({
          title: link.title,
          clicks: clicksData.filter(click => click.linkId === link.id).length
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

    // Calculate link performance data
    const linkPerformance = links.slice(0, 10).map(link => {
      const linkClicksData = linkClicks.filter(click => click.linkId === link.id);
      return {
        title: link.title || link.shortCode,
        clicks: linkClicksData.length,
        shortCode: link.shortCode
      };
    }).sort((a, b) => b.clicks - a.clicks);

    // Calculate clicks by country
    const clicksByCountry = linkClicks.reduce((acc: { [key: string]: number }, click) => {
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
      const hourClicks = linkClicks.filter(click => {
        if (!click.timestamp) return false;
        const clickDate = click.timestamp.toDate ? click.timestamp.toDate() : new Date(click.timestamp);
        
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
        'United Kingdom': '🇬🇧',
        'Canada': '🇨🇦',
        'Australia': '🇦🇺',
        'Germany': '🇩🇪',
        'France': '🇫🇷',
        'Spain': '🇪🇸',
        'Italy': '🇮🇹',
        'Japan': '🇯🇵',
        'China': '🇨🇳',
        'India': '🇮🇳',
        'Brazil': '🇧🇷',
        'Mexico': '🇲🇽',
        'Israel': '🇮🇱',
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
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Link</span>
            </button>
      </div>

          <div className="flex items-center gap-3">
            {/* Timeframe Selector */}
            <div className="flex items-center bg-black/40 rounded-lg border border-white/10 p-1">
              <button
                onClick={() => setTimeframe('today')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === 'today'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeframe('all-time')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === 'all-time'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All time
              </button>
              </div>

            {/* Interval Selector */}
            <div className="flex items-center bg-black/40 rounded-lg border border-white/10 p-1">
              <button
                onClick={() => setInterval('hourly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  interval === 'hourly'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Hourly
              </button>
              <button
                onClick={() => setInterval('monthly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  interval === 'monthly'
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
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
          <h3 className="text-lg font-semibold text-white mb-4">Clicks Over Time</h3>
          <div className="h-64 flex items-end gap-1">
            {clicksByHour.map((data, index) => {
              const maxClicks = Math.max(...clicksByHour.map(d => d.clicks), 1);
              const height = (data.clicks / maxClicks) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full">
                    {data.clicks > 0 && (
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {data.clicks} clicks
                      </div>
                    )}
                    <div
                      className="w-full bg-gradient-to-t from-blue-500/50 to-blue-400 rounded-t hover:from-blue-400 hover:to-blue-300 transition-colors"
                      style={{ height: `${height}%`, minHeight: data.clicks > 0 ? '4px' : '2px' }}
                    ></div>
                      </div>
                  {(index % 2 === 0 || index === 23) && (
                    <span className="text-xs text-gray-500">{data.hour}</span>
                  )}
                      </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing Links */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top Performing Links</h3>
            <div className="space-y-3">
              {linkPerformance.length > 0 ? (
                linkPerformance.map((link, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 px-3 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{link.title}</div>
                      <div className="text-xs text-gray-500">/{link.shortCode}</div>
                    </div>
                    <div className="flex items-center gap-3">
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
            <div className="space-y-3">
              {topCountries.length > 0 ? (
                topCountries.map((country, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 px-3 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{country.flag}</span>
                      <span className="text-sm font-medium text-gray-300">{country.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white">{country.clicks}</span>
                      <span className="text-xs text-gray-400">clicks</span>
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
