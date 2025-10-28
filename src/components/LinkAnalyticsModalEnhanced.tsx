import React, { useEffect, useState, useMemo } from 'react';
import { X, Globe, Monitor, Smartphone, Tablet, ExternalLink, Download, Network, Tag, Bot, Languages } from 'lucide-react';
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

type TabType = 'overview' | 'details' | 'raw';

const LinkAnalyticsModalEnhanced: React.FC<LinkAnalyticsModalEnhancedProps> = ({ isOpen, onClose, link }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [rawClicks, setRawClicks] = useState<any[]>([]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#161616] rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Link Analytics</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{link.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Export Buttons */}
              <button
                onClick={() => handleExport('csv')}
                disabled={loading || rawClicks.length === 0}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Export as CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={loading || rawClicks.length === 0}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Export as JSON"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'details', label: 'Detailed Analytics' },
              { id: 'raw', label: 'Raw Data' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Period Selector */}
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-sm text-gray-600 dark:text-gray-400">Period:</span>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  period === days
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {days} days
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 dark:border-t-blue-500"></div>
            </div>
          ) : !analytics ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No analytics data available
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Clicks</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.clicks}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Unique Clicks</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.uniqueClicks}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Click Rate</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {analytics.uniqueClicks > 0 
                          ? `${((analytics.uniqueClicks / analytics.clicks) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Avg Daily</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {Math.round(analytics.clicks / period)}
                      </p>
                    </div>
                  </div>

                  {/* Click Trend Chart */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Click Trend</h3>
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
                                  <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {payload[0].value} clicks
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
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
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Devices</h3>
                        <div className="space-y-3">
                          {deviceData.map((device) => (
                            <div key={device.name} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <device.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{device.name}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {device.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Countries */}
                    {topCountries.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Top Countries</h3>
                        <div className="space-y-3">
                          {topCountries.map(([country, clicks]) => (
                            <div key={country} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{country}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {clicks}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top Referrers */}
                    {topReferrers.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Top Referrers</h3>
                        <div className="space-y-3">
                          {topReferrers.map(([referrer, clicks]) => (
                            <div key={referrer} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 min-w-0">
                                <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                  {referrer}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white flex-shrink-0 ml-2">
                                {clicks}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Link Details */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Link Details</h3>
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">Short URL:</span>
                        <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {TrackedLinksService.getTrackingUrl(link.shortCode)}
                        </code>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[100px]">Destination:</span>
                        <a 
                          href={link.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {link.originalUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Platforms */}
                    {platformBreakdown.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Network className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Top Platforms</h3>
                        </div>
                        <div className="space-y-3">
                          {platformBreakdown.map(([platform, count]) => (
                            <div key={platform} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{platform}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ISPs */}
                    {ispBreakdown.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Network className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Top ISPs</h3>
                        </div>
                        <div className="space-y-3">
                          {ispBreakdown.map(([isp, count]) => (
                            <div key={isp} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{isp}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white flex-shrink-0 ml-2">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UTM Campaigns */}
                    {utmCampaigns.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">UTM Campaigns</h3>
                        </div>
                        <div className="space-y-3">
                          {utmCampaigns.map(([campaign, count]) => (
                            <div key={campaign} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{campaign}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white flex-shrink-0 ml-2">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bot Detection */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Bot className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Bot Detection</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Human Clicks</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{rawClicks.length - botClicks}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Bot Clicks (Filtered)</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{botClicks}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Data Tab */}
              {activeTab === 'raw' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Showing {rawClicks.length} click{rawClicks.length !== 1 ? 's' : ''} for this link
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Time</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Country</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Platform</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Referrer</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Device</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">Browser</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-700 dark:text-gray-300">ISP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawClicks.slice(0, 100).map((click, index) => (
                            <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                                {new Date(click.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                                {click.country || '-'}
                              </td>
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                                {click.platform || '-'}
                              </td>
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                                {click.referrerDomain || click.referrer || 'Direct'}
                              </td>
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400 capitalize">
                                {click.deviceType}
                              </td>
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400">
                                {click.browser}
                              </td>
                              <td className="py-2 px-2 text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                                {click.isp || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rawClicks.length > 100 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                          Showing first 100 clicks. Export to see all data.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsModalEnhanced;

