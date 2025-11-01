import React, { useEffect, useState, useMemo } from 'react';
import { X, Globe, Monitor, Smartphone, Tablet, ExternalLink, Network, Tag } from 'lucide-react';
import { TrackedLink } from '../types/firestore';
import { LinkAnalytics } from '../types/trackedLinks';
import TrackedLinksService from '../services/TrackedLinksService';
import LinkClicksService from '../services/LinkClicksService';
import { useAuth } from '../contexts/AuthContext';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Pagination from './ui/Pagination';

interface LinkAnalyticsModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  link: TrackedLink;
}

type TimeframeType = 'today' | 'last7days' | 'last30days' | 'last90days';
type GranularityType = 'hourly' | 'daily';

const LinkAnalyticsModalEnhanced: React.FC<LinkAnalyticsModalEnhancedProps> = ({ isOpen, onClose, link }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeType>('last7days');
  const [granularity, setGranularity] = useState<GranularityType>('daily');
  const [loading, setLoading] = useState(false);
  const [rawClicks, setRawClicks] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Convert timeframe to period days for API
  const period = useMemo(() => {
    switch (timeframe) {
      case 'today': return 1;
      case 'last7days': return 7;
      case 'last30days': return 30;
      case 'last90days': return 90;
      default: return 7;
    }
  }, [timeframe]);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (isOpen && link && currentOrgId && currentProjectId) {
        setLoading(true);
        try {
          const data = await TrackedLinksService.getLinkAnalyticsFromFirestore(currentOrgId, currentProjectId, link.id, period);
          setAnalytics(data);
          
          // Load raw clicks for the raw data tab
          const allClicks = await LinkClicksService.getProjectLinkClicks(currentOrgId, currentProjectId);
          const linkClicks = allClicks.filter(c => c.linkId === link.id);
          setRawClicks(linkClicks);
        } catch (error) {
          console.error('Failed to load analytics:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadAnalytics();
  }, [isOpen, link, period, currentOrgId, currentProjectId]);

  // Calculate additional breakdowns
  const platformBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    rawClicks.forEach(click => {
      if (click.platform) {
        breakdown[click.platform] = (breakdown[click.platform] || 0) + 1;
      }
    });
    return Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [rawClicks]);

  const ispBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    rawClicks.forEach(click => {
      if (click.isp) {
        breakdown[click.isp] = (breakdown[click.isp] || 0) + 1;
      }
    });
    return Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [rawClicks]);

  const utmCampaigns = useMemo(() => {
    const campaigns: Record<string, number> = {};
    rawClicks.forEach(click => {
      if (click.utmCampaign) {
        campaigns[click.utmCampaign] = (campaigns[click.utmCampaign] || 0) + 1;
      }
    });
    return Object.entries(campaigns).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [rawClicks]);

  if (!isOpen) return null;

  const deviceData = analytics ? [
    { name: 'Desktop', value: analytics.deviceBreakdown.desktop, icon: Monitor, color: '#3B82F6' },
    { name: 'Mobile', value: analytics.deviceBreakdown.mobile, icon: Smartphone, color: '#10B981' },
    { name: 'Tablet', value: analytics.deviceBreakdown.tablet, icon: Tablet, color: '#F59E0B' },
  ].filter(d => d.value > 0) : [];

  const topCountries = analytics ? Object.entries(analytics.countryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) : [];

  const topReferrers = analytics ? Object.entries(analytics.referrerBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div 
        className="rounded-xl shadow-2xl border border-white/10 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: '#121214' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Link Analytics</h2>
              <p className="text-sm text-gray-400 mt-1">{link.title}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Timeframe Selector */}
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as TimeframeType)}
                disabled={loading}
                className="px-3 py-2 text-sm bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="today">Today</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last90days">Last 90 Days</option>
              </select>

              {/* Granularity Selector */}
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as GranularityType)}
                disabled={loading || (timeframe !== 'today' && timeframe !== 'last7days' && granularity === 'hourly')}
                className="px-3 py-2 text-sm bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="hourly" disabled={timeframe !== 'today' && timeframe !== 'last7days'}>Hourly</option>
                <option value="daily">Daily</option>
              </select>

              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Link Details - Moved to Top */}
          <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Link Details</h3>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <span className="text-sm text-zinc-400 min-w-[100px]">Tracking Link:</span>
                    <code className="text-sm font-mono bg-zinc-800/50 px-2 py-0.5 rounded text-zinc-300">
                      {TrackedLinksService.getTrackingUrl(link.shortCode)}
                    </code>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-sm text-zinc-400 min-w-[100px]">Destination:</span>
                <a 
                  href={link.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-300 hover:text-white hover:underline break-all"
              >
                  {link.originalUrl}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/10 border-t-emerald-500"></div>
            </div>
          ) : !analytics ? (
            <div className="text-center py-12 text-zinc-400">
              No analytics data available
            </div>
          ) : (
                <div className="space-y-6">
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all">
                      <p className="text-xs font-medium text-zinc-400 tracking-wide mb-2">Total Clicks</p>
                      <p className="text-3xl font-bold text-white">{analytics.clicks}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all">
                      <p className="text-xs font-medium text-zinc-400 tracking-wide mb-2">Unique Clicks</p>
                      <p className="text-3xl font-bold text-white">{analytics.uniqueClicks}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all">
                      <p className="text-xs font-medium text-zinc-400 tracking-wide mb-2">Avg Daily</p>
                      <p className="text-3xl font-bold text-white">
                        {Math.round(analytics.clicks / period)}
                      </p>
                    </div>
                  </div>

                  {/* Click Trend Chart */}
                  <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                    <h3 className="text-sm font-medium text-zinc-300 mb-4">Click Trend</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.clicksByDay}>
                          <defs>
                            <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="date"
                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            stroke="#9CA3AF"
                            fontSize={12}
                          />
                          <YAxis hide />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white dark:bg-gray-800 p-2 border border-white/10 rounded-lg shadow-lg">
                                    <p className="text-sm font-medium text-white">
                                      {payload[0].value} clicks
                                    </p>
                                    <p className="text-xs text-zinc-400">
                                      {new Date(payload[0].payload.date).toLocaleDateString()}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="clicks"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#clickGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Device Breakdown */}
                    {deviceData.length > 0 && (
                      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                        <h3 className="text-sm font-medium text-zinc-300 mb-4">Devices</h3>
                        <div className="space-y-3">
                          {deviceData.map((device) => (
                            <div key={device.name} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <device.icon className="w-4 h-4 text-zinc-400" />
                                <span className="text-sm text-zinc-300">{device.name}</span>
                              </div>
                              <span className="text-sm font-medium text-white">
                                {device.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Countries */}
                    {topCountries.length > 0 && (
                      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                        <h3 className="text-sm font-medium text-zinc-300 mb-4">Top Countries</h3>
                        <div className="space-y-3">
                          {topCountries.map(([country, clicks]) => (
                            <div key={country} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Globe className="w-4 h-4 text-zinc-400" />
                                <span className="text-sm text-zinc-300">{country}</span>
                              </div>
                              <span className="text-sm font-medium text-white">
                                {clicks}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Referrers */}
                    {topReferrers.length > 0 && (
                      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                        <h3 className="text-sm font-medium text-zinc-300 mb-4">Top Referrers</h3>
                        <div className="space-y-3">
                          {topReferrers.map(([referrer, clicks]) => (
                            <div key={referrer} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 min-w-0">
                                <ExternalLink className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                <span className="text-sm text-zinc-300 truncate">
                                  {referrer}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-white flex-shrink-0 ml-2">
                                {clicks}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Analytics */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Platforms */}
                    {platformBreakdown.length > 0 && (
                      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Network className="w-4 h-4 text-zinc-400" />
                          <h3 className="text-sm font-medium text-zinc-300">Top Platforms</h3>
                        </div>
                        <div className="space-y-3">
                          {platformBreakdown.map(([platform, count]) => (
                            <div key={platform} className="flex items-center justify-between">
                              <span className="text-sm text-zinc-300">{platform}</span>
                              <span className="text-sm font-medium text-white">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ISPs */}
                    {ispBreakdown.length > 0 && (
                      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Network className="w-4 h-4 text-zinc-400" />
                          <h3 className="text-sm font-medium text-zinc-300">Top ISPs</h3>
                        </div>
                        <div className="space-y-3">
                          {ispBreakdown.map(([isp, count]) => (
                            <div key={isp} className="flex items-center justify-between">
                              <span className="text-sm text-zinc-300 truncate">{isp}</span>
                              <span className="text-sm font-medium text-white flex-shrink-0 ml-2">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UTM Campaigns */}
                    {utmCampaigns.length > 0 && (
                      <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Tag className="w-4 h-4 text-zinc-400" />
                          <h3 className="text-sm font-medium text-zinc-300">UTM Campaigns</h3>
                        </div>
                        <div className="space-y-3">
                          {utmCampaigns.map(([campaign, count]) => (
                            <div key={campaign} className="flex items-center justify-between">
                              <span className="text-sm text-zinc-300 truncate">{campaign}</span>
                              <span className="text-sm font-medium text-white flex-shrink-0 ml-2">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Link Clicks List */}
                <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                  <h3 className="text-sm font-medium text-zinc-300 mb-4">Recent Clicks</h3>
                  {rawClicks.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-8">No clicks recorded yet</p>
                  ) : (
                    <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-2 font-medium text-zinc-300">Time</th>
                              <th className="text-left py-3 px-2 font-medium text-zinc-300">Country</th>
                              <th className="text-left py-3 px-2 font-medium text-zinc-300">Device</th>
                              <th className="text-left py-3 px-2 font-medium text-zinc-300">Browser</th>
                              <th className="text-left py-3 px-2 font-medium text-zinc-300">Referrer</th>
                          </tr>
                        </thead>
                        <tbody>
                            {rawClicks
                              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                              .map((click, index) => (
                                <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="py-3 px-2 text-zinc-400">
                                    {new Date(click.timestamp).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                              </td>
                                  <td className="py-3 px-2 text-zinc-400">
                                {click.country || '-'}
                              </td>
                                  <td className="py-3 px-2 text-zinc-400 capitalize">
                                    {click.deviceType || '-'}
                                  </td>
                                  <td className="py-3 px-2 text-zinc-400">
                                    {click.browser || '-'}
                              </td>
                                  <td className="py-3 px-2 text-zinc-400 truncate max-w-[200px]">
                                {click.referrerDomain || click.referrer || 'Direct'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>

                      {/* Pagination */}
                      <Pagination
                        currentPage={currentPage}
                        totalPages={Math.ceil(rawClicks.length / itemsPerPage)}
                        totalItems={rawClicks.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={(page) => {
                          setCurrentPage(page);
                        }}
                        onItemsPerPageChange={(newItemsPerPage) => {
                          setItemsPerPage(newItemsPerPage);
                          setCurrentPage(1);
                        }}
                      />
            </>
                      )}
                    </div>
                  </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsModalEnhanced;

