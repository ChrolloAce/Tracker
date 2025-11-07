import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { DateFilterType } from './DateRangeFilter';
import DateRangeFilter from './DateRangeFilter';
import DayVideosModal from './DayVideosModal';

interface MetricComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: VideoSubmission[];
  linkClicks: LinkClick[];
  dateFilter: DateFilterType;
  customRange?: { startDate: Date; endDate: Date };
  onDateFilterChange?: (filter: DateFilterType, customRange?: { startDate: Date; endDate: Date }) => void;
  initialMetric?: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts' | 'engagement' | 'engagementRate' | 'linkClicks';
  onVideoClick?: (video: VideoSubmission) => void;
}

type MetricType = 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts' | 'engagement' | 'engagementRate' | 'linkClicks';

interface MetricOption {
  id: MetricType;
  label: string;
  color: string;
}

const metricOptions: MetricOption[] = [
  { id: 'views', label: 'Views', color: '#FFFFFF' },
  { id: 'likes', label: 'Likes', color: '#FFFFFF' },
  { id: 'comments', label: 'Comments', color: '#FFFFFF' },
  { id: 'shares', label: 'Shares', color: '#FFFFFF' },
  { id: 'videos', label: 'Videos', color: '#FFFFFF' },
  { id: 'accounts', label: 'Accounts', color: '#FFFFFF' },
  { id: 'engagement', label: 'Engagement', color: '#FFFFFF' },
  { id: 'engagementRate', label: 'Engagement Rate', color: '#FFFFFF' },
  { id: 'linkClicks', label: 'Link Clicks', color: '#FFFFFF' },
];

const MetricComparisonModal: React.FC<MetricComparisonModalProps> = ({
  isOpen,
  onClose,
  submissions,
  linkClicks,
  dateFilter,
  customRange,
  onDateFilterChange,
  initialMetric = 'views',
  onVideoClick,
}) => {
  const [primaryMetric, setPrimaryMetric] = useState<MetricType>(initialMetric);
  const [secondaryMetric, setSecondaryMetric] = useState<MetricType | null>(null);
  const [tertiaryMetric, setTertiaryMetric] = useState<MetricType | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  
  // Day Videos Modal state
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayVideos, setSelectedDayVideos] = useState<VideoSubmission[]>([]);
  const [selectedDayClicks, setSelectedDayClicks] = useState<LinkClick[]>([]);

  // Update primary metric when initialMetric changes (when different KPI is clicked)
  useEffect(() => {
    setPrimaryMetric(initialMetric);
  }, [initialMetric]);

  // Handle clicking on a chart point to see videos
  const handleChartClick = (dataIndex: number, currentChartData: typeof chartData) => {
    if (dataIndex < 0 || dataIndex >= currentChartData.length) return;
    
    const clickedData = currentChartData[dataIndex];
    const clickedDate = clickedData.date;
    
    // Filter videos for this specific date
    const videosForDate = submissions.filter(video => {
      const videoDate = video.uploadDate || video.dateSubmitted;
      if (!videoDate) return false;
      const vDate = new Date(videoDate);
      vDate.setHours(0, 0, 0, 0);
      const cDate = new Date(clickedDate);
      cDate.setHours(0, 0, 0, 0);
      return vDate.getTime() === cDate.getTime();
    });
    
    // Filter link clicks for this date
    const clicksForDate = linkClicks.filter(click => {
      const clickDate = new Date(click.timestamp);
      clickDate.setHours(0, 0, 0, 0);
      const cDate = new Date(clickedDate);
      cDate.setHours(0, 0, 0, 0);
      return clickDate.getTime() === cDate.getTime();
    });
    
    console.log('📊 Clicked chart point:', {
      dataIndex,
      date: clickedDate,
      videosCount: videosForDate.length,
      clicksCount: clicksForDate.length
    });
    
    setSelectedDate(clickedDate);
    setSelectedDayVideos(videosForDate);
    setSelectedDayClicks(clicksForDate);
    setIsDayModalOpen(true);
  };

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
      case 'engagementRate':
        // Engagement rate = (likes + comments + shares) / views * 100
        const views = video.views || 0;
        if (views === 0) return 0;
        const totalEngagement = (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
        return (totalEngagement / views) * 100;
      case 'linkClicks':
        return 0; // Handled separately
      default:
        return 0;
    }
  }, []);

  const chartData = useMemo(() => {
    // Group submissions by date
    const dataByDate: { [key: string]: { primary: number; secondary: number; tertiary: number; viewsCount: number; engagementCount: number } } = {};

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

    // For "all time", always extend maxDate to today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Use actual dates without extending (prevents issues with large date ranges)
    const startDate = new Date(minDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = maxDate < today ? today : new Date(maxDate);
    endDate.setHours(23, 59, 59, 999);

    // Initialize all dates in range with 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dataByDate[dateKey] = { primary: 0, secondary: 0, tertiary: 0, viewsCount: 0, engagementCount: 0 };
    }

    // Aggregate video data
    submissions.forEach((video) => {
      const videoDate = video.uploadDate || video.dateSubmitted;
      if (!videoDate) return;

      const dateKey = new Date(videoDate).toISOString().split('T')[0];
      if (dataByDate[dateKey]) {
        // Track views and engagement for rate calculations
        dataByDate[dateKey].viewsCount += video.views || 0;
        dataByDate[dateKey].engagementCount += (video.likes || 0) + (video.comments || 0) + (video.shares || 0);
        
        const primaryValue = getMetricValue(video, primaryMetric);
        dataByDate[dateKey].primary += primaryValue;
        if (secondaryMetric) {
          const secondaryValue = getMetricValue(video, secondaryMetric);
          dataByDate[dateKey].secondary += secondaryValue;
        }
        if (tertiaryMetric) {
          const tertiaryValue = getMetricValue(video, tertiaryMetric);
          dataByDate[dateKey].tertiary += tertiaryValue;
        }
      }
    });

    // Aggregate link clicks data
    if (primaryMetric === 'linkClicks' || secondaryMetric === 'linkClicks' || tertiaryMetric === 'linkClicks') {
      linkClicks.forEach((click) => {
        const dateKey = new Date(click.timestamp).toISOString().split('T')[0];
        if (dataByDate[dateKey]) {
          if (primaryMetric === 'linkClicks') dataByDate[dateKey].primary += 1;
          if (secondaryMetric === 'linkClicks') dataByDate[dateKey].secondary += 1;
          if (tertiaryMetric === 'linkClicks') dataByDate[dateKey].tertiary += 1;
        }
      });
    }
    
    // Post-process engagement rate for aggregated data
    Object.keys(dataByDate).forEach(dateKey => {
      const data = dataByDate[dateKey];
      // If any metric is engagement rate, recalculate it from aggregated values
      if (primaryMetric === 'engagementRate' && data.viewsCount > 0) {
        data.primary = (data.engagementCount / data.viewsCount) * 100;
      }
      if (secondaryMetric === 'engagementRate' && data.viewsCount > 0) {
        data.secondary = (data.engagementCount / data.viewsCount) * 100;
      }
      if (tertiaryMetric === 'engagementRate' && data.viewsCount > 0) {
        data.tertiary = (data.engagementCount / data.viewsCount) * 100;
      }
    });

    // Convert to array and format
    return Object.entries(dataByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date: new Date(date),
        primary: values.primary,
        secondary: values.secondary,
        tertiary: values.tertiary,
      }));
  }, [submissions, linkClicks, primaryMetric, secondaryMetric, tertiaryMetric, getMetricValue]);

  const formatNumber = (num: number, metric?: MetricType): string => {
    // Format engagement rate as percentage
    if (metric === 'engagementRate') {
      return `${num.toFixed(2)}%`;
    }
    
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)} M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)} k`;
    return num.toFixed(0);
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

  const primaryColor = '#FFFFFF';
  const secondaryColor = '#A1A1AA';
  const tertiaryColor = '#71717A';

  const maxValue = Math.max(
    ...chartData.map(d => {
      const values = [d.primary];
      if (secondaryMetric) values.push(d.secondary);
      if (tertiaryMetric) values.push(d.tertiary);
      return Math.max(...values);
    }),
    1
  );

  // Generate Y-axis labels
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) => {
    const value = maxValue * (1 - i / (yAxisSteps - 1));
    // Check if any visible metric is engagement rate
    const isEngagementRate = 
      primaryMetric === 'engagementRate' || 
      secondaryMetric === 'engagementRate' || 
      tertiaryMetric === 'engagementRate';
    return formatNumber(value, isEngagementRate ? 'engagementRate' : primaryMetric);
  });

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0A0A0A] rounded-2xl sm:rounded-3xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-gray-800/50 shadow-2xl shadow-purple-900/20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b border-gray-800/30">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Metrics</h2>
          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            {onDateFilterChange && (
              <div className="transform scale-75 sm:scale-90 origin-left sm:origin-center">
                <DateRangeFilter
                  selectedFilter={dateFilter}
                  customRange={customRange}
                  onFilterChange={onDateFilterChange}
                />
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800/50 rounded-xl transition-all duration-200"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Metric Selectors */}
        <div className="flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 flex-wrap gap-y-2 sm:gap-y-3">
          {/* Primary Metric */}
          <div className="relative">
            <div className="flex items-center space-x-2 bg-gray-900/50 border border-white/20 rounded-xl px-4 py-2.5 backdrop-blur-sm">
              <div className="w-3 h-3 rounded-sm bg-white shadow-lg shadow-white/50" />
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
                <div className="w-3 h-3 rounded-sm bg-zinc-400 shadow-lg shadow-gray-400/30" />
              )}
              <select
                value={secondaryMetric || ''}
                onChange={(e) => setSecondaryMetric(e.target.value as MetricType || null)}
                className="appearance-none bg-transparent text-gray-400 font-medium text-sm cursor-pointer focus:outline-none pr-6"
              >
                <option value="" className="bg-gray-900">Add 2nd metric</option>
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

          {/* Tertiary Metric Selector */}
          <div className="relative">
            <div className="flex items-center space-x-2 bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2.5 backdrop-blur-sm">
              {tertiaryMetric && (
                <div className="w-3 h-3 rounded-sm bg-zinc-600 shadow-lg shadow-gray-600/30" />
              )}
              <select
                value={tertiaryMetric || ''}
                onChange={(e) => setTertiaryMetric(e.target.value as MetricType || null)}
                className="appearance-none bg-transparent text-gray-400 font-medium text-sm cursor-pointer focus:outline-none pr-6"
              >
                <option value="" className="bg-gray-900">Add 3rd metric</option>
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
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6">
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#080808] rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 relative border border-gray-800/30 shadow-inner">
            {/* Y-axis labels */}
            <div className="absolute left-2 sm:left-4 top-4 sm:top-8 bottom-12 sm:bottom-16 flex flex-col justify-between text-[10px] sm:text-xs font-medium text-gray-500">
              {yAxisLabels.map((label, i) => (
                <span key={i} className="text-right w-8 sm:w-12">{label}</span>
              ))}
            </div>

            {/* Chart area with grid */}
            <div className="ml-10 sm:ml-16 mr-2 sm:mr-4 relative h-[300px] sm:h-[420px]">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {yAxisLabels.map((_, i) => (
                  <div key={i} className="w-full border-t border-gray-800/30" />
                ))}
              </div>

              {/* SVG Chart */}
              <svg 
                viewBox="0 0 1000 400" 
                className="w-full h-full cursor-pointer focus:outline-none" 
                preserveAspectRatio="none"
                style={{ outline: 'none' }}
                onMouseMove={(e) => {
                  const svg = e.currentTarget;
                  const rect = svg.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 1000;
                  
                  // Find nearest data point
                  let nearestIndex = 0;
                  let minDistance = Infinity;
                  
                  chartData.forEach((_, i) => {
                    const pointX = (i / (chartData.length - 1)) * 1000;
                    const distance = Math.abs(x - pointX);
                    if (distance < minDistance) {
                      minDistance = distance;
                      nearestIndex = i;
                    }
                  });
                  
                  setHoveredPoint(nearestIndex);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const svg = e.currentTarget;
                  const rect = svg.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 1000;
                  
                  // Find nearest data point
                  let nearestIndex = 0;
                  let minDistance = Infinity;
                  
                  chartData.forEach((_, i) => {
                    const pointX = (i / (chartData.length - 1)) * 1000;
                    const distance = Math.abs(x - pointX);
                    if (distance < minDistance) {
                      minDistance = distance;
                      nearestIndex = i;
                    }
                  });
                  
                  handleChartClick(nearestIndex, chartData);
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              >
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
                  
                  {/* Gradient for tertiary fill */}
                  <linearGradient id="tertiaryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={tertiaryColor} stopOpacity="0.6" />
                    <stop offset="50%" stopColor={tertiaryColor} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={tertiaryColor} stopOpacity="0.05" />
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

                {/* Tertiary metric area and line */}
                {tertiaryMetric && chartData.length > 0 && (
                  <>
                    {/* Area fill */}
                    <path
                      d={`${createSmoothPath(chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 400 - (d.tertiary / maxValue) * 380
                      })))} L ${1000},400 L 0,400 Z`}
                      fill="url(#tertiaryGradient)"
                      opacity="0.5"
                    />
                    
                    {/* Glow line */}
                    <path
                      d={createSmoothPath(chartData.map((d, i) => ({
                        x: (i / (chartData.length - 1)) * 1000,
                        y: 400 - (d.tertiary / maxValue) * 380
                      })))}
                      fill="none"
                      stroke={tertiaryColor}
                      strokeWidth="2.5"
                      filter="url(#glow)"
                      opacity="0.75"
                    />
                  </>
                )}

                {/* Vertical crosshair line */}
                {hoveredPoint !== null && chartData[hoveredPoint] && (
                  <line
                    x1={(hoveredPoint / (chartData.length - 1)) * 1000}
                    y1="0"
                    x2={(hoveredPoint / (chartData.length - 1)) * 1000}
                    y2="400"
                    stroke={primaryColor}
                    strokeWidth="2"
                    opacity="0.4"
                    className="transition-all duration-150"
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(180, 124, 255, 0.5))'
                    }}
                  />
                )}

                {/* Interactive data points */}
                {chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 1000;
                  const yPrimary = 400 - (d.primary / maxValue) * 380;
                  const ySecondary = secondaryMetric ? 400 - (d.secondary / maxValue) * 380 : 0;
                  const yTertiary = tertiaryMetric ? 400 - (d.tertiary / maxValue) * 380 : 0;
                  
                  return (
                    <g key={i}>
                      {/* Primary metric point */}
                      <circle
                        cx={x}
                        cy={yPrimary}
                        r={hoveredPoint === i ? "8" : "0"}
                        fill={primaryColor}
                        className="transition-all duration-150"
                        opacity="1"
                        style={{
                          filter: hoveredPoint === i ? 'drop-shadow(0 0 6px rgba(180, 124, 255, 0.8))' : 'none'
                        }}
                      />
                      {hoveredPoint === i && (
                        <circle
                          cx={x}
                          cy={yPrimary}
                          r="12"
                          fill="none"
                          stroke={primaryColor}
                          strokeWidth="2"
                          opacity="0.3"
                          className="animate-ping"
                        />
                      )}
                      
                      {/* Secondary metric point */}
                      {secondaryMetric && (
                        <>
                          <circle
                            cx={x}
                            cy={ySecondary}
                            r={hoveredPoint === i ? "8" : "0"}
                            fill={secondaryColor}
                            className="transition-all duration-150"
                            opacity="1"
                            style={{
                              filter: hoveredPoint === i ? 'drop-shadow(0 0 6px rgba(124, 58, 237, 0.8))' : 'none'
                            }}
                          />
                          {hoveredPoint === i && (
                            <circle
                              cx={x}
                              cy={ySecondary}
                              r="12"
                              fill="none"
                              stroke={secondaryColor}
                              strokeWidth="2"
                              opacity="0.3"
                              className="animate-ping"
                            />
                          )}
                        </>
                      )}
                      
                      {/* Tertiary metric point */}
                      {tertiaryMetric && (
                        <>
                          <circle
                            cx={x}
                            cy={yTertiary}
                            r={hoveredPoint === i ? "8" : "0"}
                            fill={tertiaryColor}
                            className="transition-all duration-150"
                            opacity="1"
                            style={{
                              filter: hoveredPoint === i ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.8))' : 'none'
                            }}
                          />
                          {hoveredPoint === i && (
                            <circle
                              cx={x}
                              cy={yTertiary}
                              r="12"
                              fill="none"
                              stroke={tertiaryColor}
                              strokeWidth="2"
                              opacity="0.3"
                              className="animate-ping"
                            />
                          )}
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Hover tooltip */}
              {hoveredPoint !== null && chartData[hoveredPoint] && (
                <div 
                  className="absolute bg-gray-900/95 backdrop-blur-sm border border-purple-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-purple-500/20 pointer-events-none z-20 min-w-[200px]"
                  style={{
                    left: `${((hoveredPoint / (chartData.length - 1)) * 100)}%`,
                    top: '-10px',
                    transform: hoveredPoint > chartData.length / 2 ? 'translateX(-100%)' : 'translateX(0)',
                  }}
                >
                  <div className="text-xs font-bold text-white mb-2">
                    {formatDate(chartData[hoveredPoint].date)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/50" />
                        <span className="text-xs font-medium text-gray-400">
                          {metricOptions.find(m => m.id === primaryMetric)?.label}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {formatNumber(chartData[hoveredPoint].primary, primaryMetric)}
                      </span>
                    </div>
                    {secondaryMetric && (
                      <div className="flex items-center justify-between space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-purple-300 to-indigo-500 shadow-lg shadow-indigo-400/30" />
                          <span className="text-xs font-medium text-gray-400">
                            {metricOptions.find(m => m.id === secondaryMetric)?.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-white">
                          {formatNumber(chartData[hoveredPoint].secondary, secondaryMetric)}
                        </span>
                      </div>
                    )}
                    {tertiaryMetric && (
                      <div className="flex items-center justify-between space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-400/30" />
                          <span className="text-xs font-medium text-gray-400">
                            {metricOptions.find(m => m.id === tertiaryMetric)?.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-white">
                          {formatNumber(chartData[hoveredPoint].tertiary, tertiaryMetric)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Click to expand hint */}
                  <div className="mt-3 pt-3 border-t border-white/10 text-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Click to see videos
                    </span>
                  </div>
                </div>
              )}

              {/* X-axis labels */}
              <div className="flex justify-between mt-4 px-1 overflow-x-auto">
                {chartData.filter((_, i) => {
                  const step = Math.max(1, Math.ceil(chartData.length / (window.innerWidth < 640 ? 5 : 10)));
                  return i % step === 0 || i === chartData.length - 1;
                }).map((data, index) => (
                  <span key={index} className="text-[10px] sm:text-xs font-medium text-gray-500 whitespace-nowrap">
                    {formatDate(data.date)}
                  </span>
                ))}
              </div>
            </div>

            {/* Watermark */}
            <div className="absolute bottom-4 right-6 flex items-center space-x-2 opacity-10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-white to-gray-500" />
              <span className="text-lg font-bold text-white">viral.app</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day Videos Modal */}
      {selectedDate && (
        <DayVideosModal
          isOpen={isDayModalOpen}
          onClose={() => {
            setIsDayModalOpen(false);
            setSelectedDate(null);
            setSelectedDayVideos([]);
            setSelectedDayClicks([]);
          }}
          date={selectedDate}
          videos={selectedDayVideos}
          metricLabel={primaryMetric.charAt(0).toUpperCase() + primaryMetric.slice(1)}
          onVideoClick={onVideoClick}
          linkClicks={selectedDayClicks}
        />
      )}
    </div>
  );
};

export default MetricComparisonModal;

