import React, { useState, useMemo } from 'react';
import { X, Info } from 'lucide-react';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { DateFilterType } from './DateRangeFilter';

interface MetricComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: VideoSubmission[];
  linkClicks: LinkClick[];
  dateFilter: DateFilterType;
  initialMetric?: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts' | 'engagement' | 'linkClicks';
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts' | 'engagement' | 'linkClicks';

interface MetricOption {
  id: MetricType;
  label: string;
  color: string;
}

const metricOptions: MetricOption[] = [
  { id: 'views', label: 'Views', color: '#F97316' },
  { id: 'likes', label: 'Likes', color: '#A855F7' },
  { id: 'comments', label: 'Comments', color: '#3B82F6' },
  { id: 'shares', label: 'Shares', color: '#F59E0B' },
  { id: 'videos', label: 'Videos', color: '#8B5CF6' },
  { id: 'accounts', label: 'Accounts', color: '#14B8A6' },
  { id: 'engagement', label: 'Engagement', color: '#8B5CF6' },
  { id: 'linkClicks', label: 'Link Clicks', color: '#64748B' },
];

const MetricComparisonModal: React.FC<MetricComparisonModalProps> = ({
  isOpen,
  onClose,
  submissions,
  linkClicks,
  initialMetric = 'views',
}) => {
  const [primaryMetric, setPrimaryMetric] = useState<MetricType>(initialMetric);
  const [secondaryMetric, setSecondaryMetric] = useState<MetricType>('likes');

  const chartData = useMemo(() => {
    // Group submissions by date
    const dataByDate: { [key: string]: { primary: number; secondary: number } } = {};

    // Get date range for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Initialize all dates with 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dataByDate[dateKey] = { primary: 0, secondary: 0 };
    }

    // Aggregate video data
    submissions.forEach((video) => {
      const videoDate = video.uploadDate || video.dateSubmitted;
      if (!videoDate) return;

      const dateKey = new Date(videoDate).toISOString().split('T')[0];
      if (dataByDate[dateKey]) {
        const primaryValue = getMetricValue(video, primaryMetric);
        const secondaryValue = getMetricValue(video, secondaryMetric);
        dataByDate[dateKey].primary += primaryValue;
        dataByDate[dateKey].secondary += secondaryValue;
      }
    });

    // Aggregate link clicks data
    if (primaryMetric === 'linkClicks' || secondaryMetric === 'linkClicks') {
      linkClicks.forEach((click) => {
        const dateKey = new Date(click.timestamp).toISOString().split('T')[0];
        if (dataByDate[dateKey]) {
          if (primaryMetric === 'linkClicks') dataByDate[dateKey].primary += 1;
          if (secondaryMetric === 'linkClicks') dataByDate[dateKey].secondary += 1;
        }
      });
    }

    // Convert to array and format
    return Object.entries(dataByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date: new Date(date),
        primary: values.primary,
        secondary: values.secondary,
      }));
  }, [submissions, linkClicks, primaryMetric, secondaryMetric]);

  const getMetricValue = (video: VideoSubmission, metric: MetricType): number => {
    switch (metric) {
      case 'views':
        return video.views || 0;
      case 'likes':
        return video.likes || 0;
      case 'comments':
        return video.comments || 0;
      case 'shares':
        return video.shares || 0;
      case 'videos':
        return 1;
      case 'accounts':
        return 0; // Would need account tracking
      case 'engagement':
        return (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
      case 'linkClicks':
        return 0; // Handled separately
      default:
        return 0;
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)} k`;
    return num.toString();
  };

  const formatDate = (date: Date): string => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const primaryColor = metricOptions.find(m => m.id === primaryMetric)?.color || '#F97316';
  const secondaryColor = metricOptions.find(m => m.id === secondaryMetric)?.color || '#A855F7';

  const maxPrimary = Math.max(...chartData.map(d => d.primary), 1);
  const maxSecondary = Math.max(...chartData.map(d => d.secondary), 1);

  const totalPrimary = chartData.reduce((sum, d) => sum + d.primary, 0);
  const totalSecondary = chartData.reduce((sum, d) => sum + d.secondary, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-white">Metrics</h2>
            <button className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
              <Info className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Metric Selectors */}
        <div className="flex items-center justify-center space-x-4 p-6">
          {/* Primary Metric */}
          <div className="relative">
            <select
              value={primaryMetric}
              onChange={(e) => setPrimaryMetric(e.target.value as MetricType)}
              className="appearance-none bg-gray-900 border border-gray-700 rounded-xl px-6 py-3 pr-12 text-white font-medium cursor-pointer hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                backgroundImage: `linear-gradient(to right, ${primaryColor}20, transparent)`,
                borderColor: primaryColor 
              }}
            >
              {metricOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Secondary Metric */}
          <div className="relative">
            <select
              value={secondaryMetric}
              onChange={(e) => setSecondaryMetric(e.target.value as MetricType)}
              className="appearance-none bg-gray-900 border border-gray-700 rounded-xl px-6 py-3 pr-12 text-white font-medium cursor-pointer hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ 
                backgroundImage: `linear-gradient(to right, ${secondaryColor}20, transparent)`,
                borderColor: secondaryColor 
              }}
            >
              {metricOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="p-6">
          <div className="bg-black rounded-2xl p-8 relative" style={{ minHeight: '500px' }}>
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-sm text-gray-500 py-12">
              <span>{formatNumber(maxPrimary)}</span>
              <span>{formatNumber(maxPrimary * 0.75)}</span>
              <span>{formatNumber(maxPrimary * 0.5)}</span>
              <span>{formatNumber(maxPrimary * 0.25)}</span>
              <span>0</span>
            </div>

            {/* Chart area */}
            <div className="ml-16 mr-4 h-full relative">
              <div className="flex items-end justify-between h-96 space-x-1">
                {chartData.map((data, index) => {
                  const primaryHeight = (data.primary / maxPrimary) * 100;
                  const secondaryHeight = (data.secondary / maxSecondary) * 100;

                  return (
                    <div key={index} className="flex-1 flex items-end justify-center space-x-0.5 group">
                      {/* Primary bar */}
                      <div
                        className="w-full rounded-t transition-all duration-300 hover:opacity-80"
                        style={{
                          height: `${primaryHeight}%`,
                          backgroundColor: primaryColor,
                          minHeight: data.primary > 0 ? '2px' : '0px',
                        }}
                        title={`${metricOptions.find(m => m.id === primaryMetric)?.label}: ${formatNumber(data.primary)}`}
                      />
                      {/* Secondary bar */}
                      <div
                        className="w-full rounded-t transition-all duration-300 hover:opacity-80"
                        style={{
                          height: `${secondaryHeight}%`,
                          backgroundColor: secondaryColor,
                          minHeight: data.secondary > 0 ? '2px' : '0px',
                        }}
                        title={`${metricOptions.find(m => m.id === secondaryMetric)?.label}: ${formatNumber(data.secondary)}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between mt-4 text-xs text-gray-500">
                {chartData.filter((_, i) => i % 5 === 0).map((data, index) => (
                  <span key={index}>{formatDate(data.date)}</span>
                ))}
              </div>
            </div>

            {/* Watermark */}
            <div className="absolute bottom-8 right-8 flex items-center space-x-2 opacity-20">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
              <span className="text-2xl font-bold text-white">viral.app</span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }} />
                <div>
                  <p className="text-sm text-gray-400">{metricOptions.find(m => m.id === primaryMetric)?.label}</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(totalPrimary)}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: secondaryColor }} />
                <div>
                  <p className="text-sm text-gray-400">{metricOptions.find(m => m.id === secondaryMetric)?.label}</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(totalSecondary)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricComparisonModal;

