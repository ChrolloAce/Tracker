import React, { useEffect, useState, useMemo } from 'react';
import { X, Globe, Monitor, Smartphone, Tablet, ExternalLink, Download, Network, Tag, Bot } from 'lucide-react';
import { TrackedLink } from '../types/firestore';
import { LinkAnalytics } from '../types/trackedLinks';
import TrackedLinksService from '../services/TrackedLinksService';
import LinkClicksService from '../services/LinkClicksService';
import { useAuth } from '../contexts/AuthContext';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

  const handleExport = (format: 'csv' | 'json') => {
    if (rawClicks.length === 0) {
      alert('No data to export');
      return;
    }
    LinkClicksService.downloadClicks(rawClicks, format, `${link.shortCode}-analytics-${Date.now()}`);
  };

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

  const botClicks = useMemo(() => {
    return rawClicks.filter(c => c.isBot).length;
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
            <div className="flex items-center gap-2">
              {/* Export Buttons */}
              <button
                onClick={() => handleExport('csv')}
                disabled={loading || rawClicks.length === 0}
                className="px-4 py-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-emerald-500/30 hover:border-emerald-500/50"
                title="Export as CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={loading || rawClicks.length === 0}
                className="px-4 py-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-emerald-500/30 hover:border-emerald-500/50"
                title="Export as JSON"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Link Details - Moved to Top */}
          <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 mb-6">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Link Details</h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <span className="text-sm text-zinc-400 min-w-[100px]">Short URL:</span>
                <code className="text-sm font-mono bg-zinc-800/50 px-2 py-0.5 rounded text-emerald-400">
                  {TrackedLinksService.getTrackingUrl(link.shortCode)}
                </code>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-sm text-zinc-400 min-w-[100px]">Destination:</span>
                <a 
                  href={link.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline break-all"
                >
                  {link.originalUrl}
                </a>
              </div>
            </div>
          </div>

          {/* Timeframe & Granularity Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-zinc-400">Timeframe:</span>
              {[
                { value: 'today', label: 'Today' },
                { value: 'last7days', label: 'Last 7 Days' },
                { value: 'last30days', label: 'Last 30 Days' },
                { value: 'last90days', label: 'Last 90 Days' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeframe(option.value as TimeframeType)}
                  disabled={loading}
                  className={`px-4 py-2 text-sm rounded-full transition-all ${
                    timeframe === option.value
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Display:</span>
              {[
                { value: 'hourly', label: 'Hourly', available: timeframe === 'today' || timeframe === 'last7days' },
                { value: 'daily', label: 'Daily', available: true }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGranularity(option.value as GranularityType)}
                  disabled={loading || !option.available}
                  className={`px-4 py-2 text-sm rounded-full transition-all ${
                    granularity === option.value
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20'
                  } ${(loading || !option.available) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {option.label}
                </button>
              ))}
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all">
                      <p className="text-xs font-medium text-zinc-400 tracking-wide mb-2">Total Clicks</p>
                      <p className="text-3xl font-bold text-white">{analytics.clicks}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all">
                      <p className="text-xs font-medium text-zinc-400 tracking-wide mb-2">Unique Clicks</p>
                      <p className="text-3xl font-bold text-white">{analytics.uniqueClicks}</p>
                    </div>
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5 hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all group relative">
                      <p className="text-xs font-medium text-zinc-400 tracking-wide mb-2">Click Rate</p>
                      <p className="text-3xl font-bold text-white">
                        {analytics.uniqueClicks > 0 
                          ? `${((analytics.uniqueClicks / analytics.clicks) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </p>
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative">
                          <div className="bg-zinc-800 border border-white/20 rounded-lg p-3 text-xs text-zinc-300 w-64 shadow-xl">
                            <p className="font-semibold mb-1">Click Rate Formula:</p>
                            <p className="text-zinc-400">(Unique Clicks ÷ Total Clicks) × 100</p>
                            <p className="text-zinc-500 mt-2 text-[10px]">Shows what % of clicks came from unique visitors vs repeat clicks</p>
                          </div>
                        </div>
                      </div>
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

                    {/* Bot Detection */}
                    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Bot className="w-4 h-4 text-zinc-400" />
                        <h3 className="text-sm font-medium text-zinc-300">Bot Detection</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Human Clicks</span>
                          <span className="text-sm font-medium text-white">{rawClicks.length - botClicks}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300">Bot Clicks (Filtered)</span>
                          <span className="text-sm font-medium text-white">{botClicks}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsModalEnhanced;

