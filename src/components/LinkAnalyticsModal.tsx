import React, { useEffect, useState } from 'react';
import { X, Globe, Monitor, Smartphone, Tablet, ExternalLink } from 'lucide-react';
import { TrackedLink } from '../types/firestore';
import { LinkAnalytics } from '../types/trackedLinks';
import TrackedLinksService from '../services/TrackedLinksService';
import { useAuth } from '../contexts/AuthContext';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface LinkAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: TrackedLink;
}

const LinkAnalyticsModal: React.FC<LinkAnalyticsModalProps> = ({ isOpen, onClose, link }) => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (isOpen && link && currentOrgId && currentProjectId) {
        setLoading(true);
        try {
          const data = await TrackedLinksService.getLinkAnalyticsFromFirestore(currentOrgId, currentProjectId, link.id, period);
          setAnalytics(data);
        } catch (error) {
          console.error('Failed to load analytics:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadAnalytics();
  }, [isOpen, link, period, currentOrgId, currentProjectId]);

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
      <div className="bg-surface-secondary rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-content">Link Analytics</h2>
              <p className="text-sm text-content-muted mt-1">{link.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-content-muted" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Period Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-content-muted">Period:</span>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  period === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-tertiary text-content-secondary hover:bg-surface-hover'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {days} days
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-border border-t-blue-600"></div>
            </div>
          ) : !analytics ? (
            <div className="text-center py-12 text-content-muted">
              No analytics data available
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-tertiary rounded-lg p-4">
                  <p className="text-sm text-content-muted">Total Clicks</p>
                  <p className="text-2xl font-bold text-content">{analytics.clicks}</p>
                </div>
                <div className="bg-surface-tertiary rounded-lg p-4">
                  <p className="text-sm text-content-muted">Unique Clicks</p>
                  <p className="text-2xl font-bold text-content">{analytics.uniqueClicks}</p>
                </div>
                <div className="bg-surface-tertiary rounded-lg p-4">
                  <p className="text-sm text-content-muted">Click Rate</p>
                  <p className="text-2xl font-bold text-content">
                    {analytics.uniqueClicks > 0 
                      ? `${((analytics.uniqueClicks / analytics.clicks) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </p>
                </div>
                <div className="bg-surface-tertiary rounded-lg p-4">
                  <p className="text-sm text-content-muted">Avg Daily</p>
                  <p className="text-2xl font-bold text-content">
                    {Math.round(analytics.clicks / period)}
                  </p>
                </div>
              </div>

          {/* Click Trend Chart */}
          <div className="bg-surface-tertiary rounded-lg p-4">
            <h3 className="text-sm font-medium text-content-secondary mb-4">Click Trend</h3>
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
                          <div className="bg-surface-secondary p-2 border border-border rounded-lg shadow-lg">
                            <p className="text-sm font-medium text-content">
                              {payload[0].value} clicks
                            </p>
                            <p className="text-xs text-content-muted">
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
              <div className="bg-surface-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium text-content-secondary mb-4">Devices</h3>
                <div className="space-y-3">
                  {deviceData.map((device) => (
                    <div key={device.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <device.icon className="w-4 h-4 text-content-muted" />
                        <span className="text-sm text-content-secondary">{device.name}</span>
                      </div>
                      <span className="text-sm font-medium text-content">
                        {device.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Countries */}
            {topCountries.length > 0 && (
              <div className="bg-surface-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium text-content-secondary mb-4">Top Countries</h3>
                <div className="space-y-3">
                  {topCountries.map(([country, clicks]) => (
                    <div key={country} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-4 h-4 text-content-muted" />
                        <span className="text-sm text-content-secondary">{country}</span>
                      </div>
                      <span className="text-sm font-medium text-content">
                        {clicks}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Referrers */}
            {topReferrers.length > 0 && (
              <div className="bg-surface-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium text-content-secondary mb-4">Top Referrers</h3>
                <div className="space-y-3">
                  {topReferrers.map(([referrer, clicks]) => (
                    <div key={referrer} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ExternalLink className="w-4 h-4 text-content-muted" />
                        <span className="text-sm text-content-secondary truncate">
                          {referrer}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-content">
                        {clicks}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

              {/* Link Details */}
              <div className="bg-surface-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium text-content-secondary mb-3">Link Details</h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <span className="text-sm text-content-muted">Tracking Link:</span>
                <code className="text-sm font-mono bg-surface-tertiary px-2 py-0.5 rounded">
                  {TrackedLinksService.getTrackingUrl(link.shortCode)}
                </code>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-sm text-content-muted">Destination:</span>
                <a 
                  href={link.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate max-w-md"
                >
                  {link.originalUrl}
                </a>
              </div>
            </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsModal;
