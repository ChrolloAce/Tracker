import React, { useState, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
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
  { id: 'views', label: 'Views', color: '#B47CFF' },
  { id: 'likes', label: 'Likes', color: '#B47CFF' },
  { id: 'comments', label: 'Comments', color: '#B47CFF' },
  { id: 'shares', label: 'Shares', color: '#B47CFF' },
  { id: 'videos', label: 'Videos', color: '#B47CFF' },
  { id: 'accounts', label: 'Accounts', color: '#B47CFF' },
  { id: 'engagement', label: 'Engagement', color: '#B47CFF' },
  { id: 'linkClicks', label: 'Link Clicks', color: '#B47CFF' },
];

const MetricComparisonModal: React.FC<MetricComparisonModalProps> = ({
  isOpen,
  onClose,
  submissions,
  linkClicks,
  initialMetric = 'views',
}) => {
  const [primaryMetric, setPrimaryMetric] = useState<MetricType>(initialMetric);
  const [secondaryMetric, setSecondaryMetric] = useState<MetricType | null>(null);

  // Helper function to get metric value from video
  const getMetricValue = useCallback((video: VideoSubmission, metric: MetricType): number => {
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
  }, []);

  const chartData = useMemo(() => {
    // Group submissions by date
    const dataByDate: { [key: string]: { primary: number; secondary: number } } = {};

    // Find actual date range from data
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // Get date range from submissions
    submissions.forEach((video) => {
      const videoDate = video.uploadDate || video.dateSubmitted;
      if (!videoDate) return;
      const date = new Date(videoDate);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    // Get date range from link clicks
    linkClicks.forEach((click) => {
      const date = new Date(click.timestamp);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    // If no data, use last 30 days
    if (!minDate || !maxDate) {
      maxDate = new Date();
      minDate = new Date();
      minDate.setDate(minDate.getDate() - 30);
    }

    // Extend range slightly for padding
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(maxDate);
    endDate.setDate(endDate.getDate() + 1);

    // Initialize all dates in range with 0
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
        dataByDate[dateKey].primary += primaryValue;
        if (secondaryMetric) {
          const secondaryValue = getMetricValue(video, secondaryMetric);
          dataByDate[dateKey].secondary += secondaryValue;
        }
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
  }, [submissions, linkClicks, primaryMetric, secondaryMetric, getMetricValue]);

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

  // Create smooth bezier curve path with proper tension
  const createSmoothPath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    
    let path = `M ${points[0].x},${points[0].y}`;
    
    // Use cubic bezier curves for smooth, flowing lines
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      
      // Control points for smooth curve (tension factor)
      const tension = 0.3;
      const dx = next.x - curr.x;
      
      const cp1x = curr.x + dx * tension;
      const cp1y = curr.y;
      const cp2x = next.x - dx * tension;
      const cp2y = next.y;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
    }
    
    return path;
  };

  const primaryColor = '#B47CFF';
  const secondaryColor = '#7C3AED';

  const maxValue = Math.max(...chartData.map(d => secondaryMetric ? Math.max(d.primary, d.secondary) : d.primary), 1);
  const totalPrimary = chartData.reduce((sum, d) => sum + d.primary, 0);
  const totalSecondary = secondaryMetric ? chartData.reduce((sum, d) => sum + d.secondary, 0) : 0;

  // Generate Y-axis labels
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) => {
    return formatNumber(maxValue * (1 - i / (yAxisSteps - 1)));
  });

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0A0A0A] rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-800/50 shadow-2xl shadow-purple-900/20">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800/30">
          <h2 className="text-2xl font-bold text-white tracking-tight">Metrics</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800/50 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Metric Selectors */}
        <div className="flex items-center space-x-3 px-8 pt-6">
          {/* Primary Metric */}
          <div className="relative">
            <div className="flex items-center space-x-2 bg-gray-900/50 border border-purple-500/30 rounded-xl px-4 py-2.5 backdrop-blur-sm">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/50" />
              <select
                value={primaryMetric}
                onChange={(e) => setPrimaryMetric(e.target.value as MetricType)}
                className="appearance-none bg-transparent text-white font-medium text-sm cursor-pointer focus:outline-none pr-6"
              >
                {metricOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-gray-900">
                    {option.label}
                  </option>
                ))}
              </select>
              <svg className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Secondary Metric Selector */}
          <div className="relative">
            <div className="flex items-center space-x-2 bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2.5 backdrop-blur-sm">
              {secondaryMetric && (
                <div className="w-3 h-3 rounded-sm bg-gradient-to-br from-purple-300 to-indigo-500 shadow-lg shadow-purple-400/30" />
              )}
              <select
                value={secondaryMetric || ''}
                onChange={(e) => setSecondaryMetric(e.target.value as MetricType || null)}
                className="appearance-none bg-transparent text-gray-400 font-medium text-sm cursor-pointer focus:outline-none pr-6"
              >
                <option value="" className="bg-gray-900">Add secondary</option>
                {metricOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-gray-900 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
              <svg className="w-4 h-4 text-gray-400 absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-8 py-6">
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#080808] rounded-2xl p-8 relative border border-gray-800/30 shadow-inner">
            {/* Y-axis labels */}
            <div className="absolute left-4 top-8 bottom-16 flex flex-col justify-between text-xs font-medium text-gray-500">
              {yAxisLabels.map((label, i) => (
                <span key={i} className="text-right w-12">{label}</span>
              ))}
            </div>

            {/* Chart area with grid */}
            <div className="ml-16 mr-4 relative" style={{ height: '420px' }}>
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {yAxisLabels.map((_, i) => (
                  <div key={i} className="w-full border-t border-gray-800/30" />
                ))}
              </div>

              {/* SVG Chart */}
              <svg viewBox="0 0 1000 400" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  {/* Gradient for primary fill */}
                  <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={primaryColor} stopOpacity="0.8" />
                    <stop offset="50%" stopColor={primaryColor} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={primaryColor} stopOpacity="0.05" />
                  </linearGradient>
                  
                  {/* Gradient for secondary fill */}
                  <linearGradient id="secondaryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.7" />
                    <stop offset="50%" stopColor={secondaryColor} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.05" />
                  </linearGradient>

                  {/* Glow filter for the line */}
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Primary metric area and line */}
                {chartData.length > 0 && (
                  <>
                    {/* Area fill */}
                    <path
                      d={`${createSmoothPath(chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 400 - (d.primary / maxValue) * 380
                      })))} L ${1000},400 L 0,400 Z`}
                      fill="url(#primaryGradient)"
                      opacity="0.9"
                    />
                    
                    {/* Glow line */}
                    <path
                      d={createSmoothPath(chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 400 - (d.primary / maxValue) * 380
                      })))}
                      fill="none"
                      stroke={primaryColor}
                      strokeWidth="2.5"
                      filter="url(#glow)"
                      opacity="0.95"
                    />
                  </>
                )}

                {/* Secondary metric area and line */}
                {secondaryMetric && chartData.length > 0 && (
                  <>
                    {/* Area fill */}
                    <path
                      d={`${createSmoothPath(chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 400 - (d.secondary / maxValue) * 380
                      })))} L ${1000},400 L 0,400 Z`}
                      fill="url(#secondaryGradient)"
                      opacity="0.6"
                    />
                    
                    {/* Glow line */}
                    <path
                      d={createSmoothPath(chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 400 - (d.secondary / maxValue) * 380
                      })))}
                      fill="none"
                      stroke={secondaryColor}
                      strokeWidth="2.5"
                      filter="url(#glow)"
                      opacity="0.85"
                    />
                  </>
                )}
              </svg>

              {/* X-axis labels */}
              <div className="flex justify-between mt-4 px-1">
                {chartData.filter((_, i) => {
                  const step = Math.max(1, Math.ceil(chartData.length / 10));
                  return i % step === 0 || i === chartData.length - 1;
                }).map((data, index) => (
                  <span key={index} className="text-xs font-medium text-gray-500">
                    {formatDate(data.date)}
                  </span>
                ))}
              </div>
            </div>

            {/* Watermark */}
            <div className="absolute bottom-4 right-6 flex items-center space-x-2 opacity-10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
              <span className="text-lg font-bold text-white">viral.app</span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className={`grid ${secondaryMetric ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mt-6`}>
            <div className="bg-gradient-to-br from-gray-900/50 to-gray-900/30 rounded-xl p-5 border border-purple-500/20 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center border border-purple-500/30">
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/50" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {metricOptions.find(m => m.id === primaryMetric)?.label}
                  </p>
                  <p className="text-2xl font-bold text-white mt-0.5">{formatNumber(totalPrimary)}</p>
                </div>
              </div>
            </div>

            {secondaryMetric && (
              <div className="bg-gradient-to-br from-gray-900/50 to-gray-900/30 rounded-xl p-5 border border-indigo-500/20 backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center border border-indigo-500/30">
                    <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-300 to-indigo-500 shadow-lg shadow-indigo-400/30" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {metricOptions.find(m => m.id === secondaryMetric)?.label}
                    </p>
                    <p className="text-2xl font-bold text-white mt-0.5">{formatNumber(totalSecondary)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricComparisonModal;

