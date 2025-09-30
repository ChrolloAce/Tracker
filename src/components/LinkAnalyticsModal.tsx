import React, { useEffect, useState } from 'react';
import { X, Globe, Monitor, Smartphone, Tablet, ExternalLink } from 'lucide-react';
import { TrackedLink, LinkAnalytics } from '../types/trackedLinks';
import TrackedLinksService from '../services/TrackedLinksService';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface LinkAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: TrackedLink;
}

const LinkAnalyticsModal: React.FC<LinkAnalyticsModalProps> = ({ isOpen, onClose, link }) => {
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (isOpen && link) {
      const data = TrackedLinksService.getLinkAnalytics(link.id, period);
      setAnalytics(data);
    }
  }, [isOpen, link, period]);

  if (!isOpen || !analytics) return null;

  const deviceData = [
    { name: 'Desktop', value: analytics.deviceBreakdown.desktop, icon: Monitor, color: '#3B82F6' },
    { name: 'Mobile', value: analytics.deviceBreakdown.mobile, icon: Smartphone, color: '#10B981' },
    { name: 'Tablet', value: analytics.deviceBreakdown.tablet, icon: Tablet, color: '#F59E0B' },
  ].filter(d => d.value > 0);

  const topCountries = Object.entries(analytics.countryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topReferrers = Object.entries(analytics.referrerBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#161616] rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Link Analytics</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{link.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Period Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Period:</span>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  period === days
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>

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
                      <div className="flex items-center space-x-2">
                        <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {referrer}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
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
                <span className="text-sm text-gray-500 dark:text-gray-400">Short URL:</span>
                <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {TrackedLinksService.getTrackingUrl(link.shortCode)}
                </code>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Destination:</span>
                <a 
                  href={link.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate max-w-md"
                >
                  {link.originalUrl}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsModal;
