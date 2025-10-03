import React, { useMemo, useState } from 'react';
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Activity, 
  AtSign, 
  Video, 
  Share2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Link as LinkIcon
} from 'lucide-react';
import { VideoSubmission } from '../types';
import { LinkClick } from '../services/LinkClicksService';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { DateFilterType } from './DateRangeFilter';
import { TimePeriodType } from './TimePeriodSelector';
import MetricComparisonModal from './MetricComparisonModal';

interface KPICardsProps {
  submissions: VideoSubmission[];
  linkClicks?: LinkClick[];
  dateFilter?: DateFilterType;
  timePeriod?: TimePeriodType;
}

interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'emerald' | 'pink' | 'blue' | 'violet' | 'teal' | 'orange' | 'slate';
  delta?: { value: number; isPositive: boolean };
  period?: string;
  sparklineData?: Array<{ value: number; timestamp?: number; previousValue?: number }>;
  isEmpty?: boolean;
  ctaText?: string;
}

const KPICards: React.FC<KPICardsProps> = ({ submissions, linkClicks = [], dateFilter = 'all', timePeriod = 'weeks' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts' | 'engagement' | 'linkClicks'>('views');

  const handleCardClick = (metricId: string) => {
    setSelectedMetric(metricId as any);
    setIsModalOpen(true);
  };

  const kpiData = useMemo(() => {
    // For filtered date ranges, calculate growth during that period using snapshots
    // For "all time", show total current metrics
    const isFilteredPeriod = dateFilter !== 'all';
    
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    
    if (isFilteredPeriod) {
      // Calculate delta (growth) for the filtered period using snapshots
      submissions.forEach(video => {
        if (!video.snapshots || video.snapshots.length === 0) {
          // No snapshots: count full current metrics (newly added video)
          totalViews += video.views || 0;
          totalLikes += video.likes || 0;
          totalComments += video.comments || 0;
          totalShares += video.shares || 0;
        } else {
          // Has snapshots: find the earliest snapshot in the period and calculate delta
          const sortedSnapshots = [...video.snapshots].sort((a, b) => 
            new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
          );
          
          // Find the first snapshot at or before the period start
          const periodStartSnapshot = sortedSnapshots[0];
          
          // Calculate growth since that snapshot
          const viewsDelta = Math.max(0, (video.views || 0) - (periodStartSnapshot?.views || 0));
          const likesDelta = Math.max(0, (video.likes || 0) - (periodStartSnapshot?.likes || 0));
          const commentsDelta = Math.max(0, (video.comments || 0) - (periodStartSnapshot?.comments || 0));
          const sharesDelta = Math.max(0, (video.shares || 0) - (periodStartSnapshot?.shares || 0));
          
          totalViews += viewsDelta;
          totalLikes += likesDelta;
          totalComments += commentsDelta;
          totalShares += sharesDelta;
        }
      });
    } else {
      // "All time": show total current metrics
      totalViews = submissions.reduce((sum, v) => sum + (v.views || 0), 0);
      totalLikes = submissions.reduce((sum, v) => sum + (v.likes || 0), 0);
      totalComments = submissions.reduce((sum, v) => sum + (v.comments || 0), 0);
      totalShares = submissions.reduce((sum, v) => sum + (v.shares || 0), 0);
    }
    
    const activeAccounts = new Set(submissions.map(v => v.uploaderHandle)).size;
    const publishedVideos = submissions.length;
    
    const totalEngagement = totalLikes + totalComments;
    const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    // Calculate growth (last 7 days vs previous 7 days)
    const now = new Date();
    const last7Days = submissions.filter(v => {
      const uploadDate = new Date(v.uploadDate);
      const daysDiff = (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });
    
    const previous7Days = submissions.filter(v => {
      const uploadDate = new Date(v.uploadDate);
      const daysDiff = (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 7 && daysDiff <= 14;
    });

    const last7DaysViews = last7Days.reduce((sum, v) => sum + (v.views || 0), 0);
    const previous7DaysViews = previous7Days.reduce((sum, v) => sum + (v.views || 0), 0);
    const viewsGrowth = previous7DaysViews > 0 
      ? ((last7DaysViews - previous7DaysViews) / previous7DaysViews) * 100 
      : 0;

    // Generate sparkline data based on date filter and metric type
    const generateSparklineData = (metric: 'views' | 'likes' | 'comments' | 'shares' | 'videos' | 'accounts') => {
      const data = [];
      
      // Determine number of data points based on dateFilter
      let numPoints = 30;
      let intervalMs = 24 * 60 * 60 * 1000; // 1 day
      
      // Match the number of points to the actual filtered range
      if (dateFilter === 'today') {
        numPoints = 24;
        intervalMs = 60 * 60 * 1000; // 1 hour
      } else if (dateFilter === 'last7days') {
        numPoints = 7;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
      } else if (dateFilter === 'last30days') {
        numPoints = 30;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
      } else if (dateFilter === 'last90days') {
        numPoints = 90;
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
      } else if (timePeriod === 'weeks') {
        numPoints = 12;
        intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      } else if (timePeriod === 'months') {
        numPoints = 12;
        intervalMs = 30 * 24 * 60 * 60 * 1000; // ~1 month
      }
      
      // Generate trend showing growth over time
      for (let i = numPoints - 1; i >= 0; i--) {
        const pointDate = new Date(Date.now() - (i * intervalMs));
        const timestamp = pointDate.getTime();
        
        // For hourly data, calculate previous day's same hour value for comparison
        let previousValue: number | undefined;
        if (timePeriod === 'hours' && metric !== 'videos' && metric !== 'accounts') {
          const previousDayDate = new Date(timestamp - (24 * 60 * 60 * 1000));
          let prevDayValue = 0;
          
          submissions.forEach(video => {
            if (video.snapshots && video.snapshots.length > 0) {
              const snapshotAtPrevDay = video.snapshots
                .filter(s => new Date(s.capturedAt) <= previousDayDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              if (snapshotAtPrevDay && metric in snapshotAtPrevDay) {
                prevDayValue += (snapshotAtPrevDay as any)[metric] || 0;
              }
            }
          });
          previousValue = prevDayValue;
        }
        
        if (metric === 'videos') {
          // For published videos: count how many videos existed at this point
          const videosAtThisTime = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate <= pointDate;
          });
          data.push({ value: videosAtThisTime.length, timestamp, previousValue });
        } else if (metric === 'accounts') {
          // For active accounts: count unique uploaders at this point
          const videosAtThisTime = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate <= pointDate;
          });
          const uniqueAccounts = new Set(videosAtThisTime.map(v => v.uploaderHandle)).size;
          data.push({ value: uniqueAccounts, timestamp, previousValue });
        } else if (isFilteredPeriod) {
          // For filtered periods: show cumulative growth within the period
          let pointValue = 0;
          
          submissions.forEach(video => {
            // Find the snapshot closest to this point in time
            if (video.snapshots && video.snapshots.length > 0) {
              const snapshotAtPoint = video.snapshots
                .filter(s => new Date(s.capturedAt) <= pointDate)
                .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
              
              if (snapshotAtPoint) {
                // Get the baseline (earliest snapshot in period)
                const baseline = video.snapshots
                  .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];
                
                // Calculate delta from baseline to this point
                const delta = Math.max(0, (snapshotAtPoint[metric] || 0) - (baseline[metric] || 0));
                pointValue += delta;
              }
            } else if (new Date(video.uploadDate || video.dateSubmitted) <= pointDate) {
              // No snapshots but video exists: count its current value
              pointValue += video[metric] || 0;
            }
          });
          
          data.push({ value: pointValue, timestamp, previousValue });
        } else {
          // "All time": show cumulative total of all videos that existed at this point
          const videosAtThisTime = submissions.filter(v => {
            const uploadDate = v.uploadDate ? new Date(v.uploadDate) : new Date(v.dateSubmitted);
            return uploadDate <= pointDate;
          });
          
          const cumulativeValue = videosAtThisTime.reduce((sum, v) => sum + (v[metric] || 0), 0);
          data.push({ value: cumulativeValue, timestamp, previousValue });
        }
      }
      return data;
    };

    const formatNumber = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    };

    // Get period text based on date filter
    const getPeriodText = (): string => {
      switch (dateFilter) {
        case 'today':
          return 'Last 24 hours';
        case 'last7days':
          return 'Last 7 days';
        case 'last30days':
          return 'Last 30 days';
        case 'last90days':
          return 'Last 90 days';
        case 'mtd':
          return 'Month to date';
        case 'ytd':
          return 'Year to date';
        case 'custom':
          return 'Custom range';
        case 'all':
        default:
          return 'All time';
      }
    };

    const periodText = getPeriodText();

    const cards: KPICardData[] = [
      {
        id: 'views',
        label: 'Views',
        value: formatNumber(totalViews),
        icon: Play,
        accent: 'emerald',
        delta: { value: Math.abs(viewsGrowth), isPositive: viewsGrowth >= 0 },
        period: periodText,
        sparklineData: generateSparklineData('views')
      },
      {
        id: 'likes',
        label: 'Likes',
        value: formatNumber(totalLikes),
        icon: Heart,
        accent: 'pink',
        period: `${((totalLikes / totalViews) * 100).toFixed(1)}% of views`,
        sparklineData: generateSparklineData('likes')
      },
      {
        id: 'comments',
        label: 'Comments',
        value: formatNumber(totalComments),
        icon: MessageCircle,
        accent: 'blue',
        period: 'Total engagement',
        sparklineData: generateSparklineData('comments')
      },
      {
        id: 'shares',
        label: 'Shares',
        value: formatNumber(totalShares),
        icon: Share2,
        accent: 'orange',
        period: 'Total shares',
        sparklineData: generateSparklineData('shares')
      },
      {
        id: 'videos',
        label: 'Published Videos',
        value: publishedVideos,
        icon: Video,
        accent: 'violet',
        period: 'All time',
        sparklineData: generateSparklineData('videos')
      },
      {
        id: 'accounts',
        label: 'Active Accounts',
        value: activeAccounts,
        icon: AtSign,
        accent: 'teal',
        period: 'Total tracked',
        sparklineData: generateSparklineData('accounts')
      },
      {
        id: 'engagement',
        label: 'Engagement Rate',
        value: `${engagementRate.toFixed(1)}%`,
        icon: Activity,
        accent: 'violet',
        period: periodText,
        sparklineData: (() => {
          // Generate engagement rate sparkline data
          let numPoints = 30;
          let intervalMs = 24 * 60 * 60 * 1000; // 1 day
          
          if (dateFilter === 'today') {
            numPoints = 24;
            intervalMs = 60 * 60 * 1000;
          } else if (dateFilter === 'last7days') {
            numPoints = 7;
          } else if (dateFilter === 'last90days') {
            numPoints = 90;
          }
          
          const data = [];
          for (let i = numPoints - 1; i >= 0; i--) {
            const pointDate = new Date(Date.now() - (i * intervalMs));
            
            // Calculate engagement rate for this time period
            const videosInPeriod = submissions.filter(v => new Date(v.uploadDate) <= pointDate);
            const totalViews = videosInPeriod.reduce((sum, v) => sum + (v.views || 0), 0);
            const totalEngagement = videosInPeriod.reduce((sum, v) => 
              sum + (v.likes || 0) + (v.comments || 0) + (v.shares || 0), 0
            );
            const rate = totalViews > 0 ? ((totalEngagement / totalViews) * 100) : 0;
            
            data.push({
              value: Number(rate.toFixed(1)),
              timestamp: pointDate.getTime()
            });
          }
          return data;
        })()
      },
      {
        id: 'link-clicks',
        label: 'Link Clicks',
        value: formatNumber(linkClicks.length),
        icon: LinkIcon,
        accent: 'slate',
        period: linkClicks.length > 0 ? 'Total clicks' : 'No clicks yet',
        sparklineData: (() => {
          // Generate link clicks sparkline data
          let numPoints = 30;
          let intervalMs = 24 * 60 * 60 * 1000; // 1 day
          
          if (dateFilter === 'today') {
            numPoints = 24;
            intervalMs = 60 * 60 * 1000;
          } else if (dateFilter === 'last7days') {
            numPoints = 7;
          } else if (dateFilter === 'last90days') {
            numPoints = 90;
          }
          
          const data = [];
          for (let i = numPoints - 1; i >= 0; i--) {
            const pointDate = new Date(Date.now() - (i * intervalMs));
            const nextPointDate = new Date(Date.now() - ((i - 1) * intervalMs));
            
            // Count clicks in this time period
            const clicksInPeriod = linkClicks.filter(click => {
              const clickDate = new Date(click.timestamp);
              return clickDate >= pointDate && clickDate < nextPointDate;
            });
            
            data.push({
              value: clicksInPeriod.length,
              timestamp: pointDate.getTime()
            });
          }
          return data;
        })()
      }
    ];

    return cards;
  }, [submissions, linkClicks, dateFilter, timePeriod]);

  return (
    <>
      <div className="grid gap-4 md:gap-5 xl:gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpiData.map((card) => (
          <KPICard key={card.id} data={card} onClick={() => handleCardClick(card.id)} timePeriod={timePeriod} />
        ))}
      </div>

      <MetricComparisonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        submissions={submissions}
        linkClicks={linkClicks}
        dateFilter={dateFilter}
        initialMetric={selectedMetric}
      />
    </>
  );
};

// Separate component to handle sparkline rendering consistently
const KPISparkline: React.FC<{
  data: Array<{ value: number; timestamp?: number; previousValue?: number }>;
  id: string;
  gradient: string[];
  stroke: string;
  timePeriod?: TimePeriodType;
}> = ({ data, id, gradient, stroke, timePeriod = 'days' }) => {
  
  const formatTooltipDate = (timestamp?: number) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (timePeriod === 'hours') {
      const hour = date.getHours();
      const nextHour = (hour + 1) % 24;
      const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const displayNextHour = nextHour % 12 || 12;
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${displayHour}–${displayNextHour} ${nextPeriod}`;
    } else if (timePeriod === 'days') {
      return `${monthNames[date.getMonth()]} ${date.getDate()}`;
    } else if (timePeriod === 'weeks') {
      const weekEnd = new Date(timestamp + (6 * 24 * 60 * 60 * 1000));
      return `${monthNames[date.getMonth()]} ${date.getDate()}–${date.getMonth() === weekEnd.getMonth() ? weekEnd.getDate() : monthNames[weekEnd.getMonth()] + ' ' + weekEnd.getDate()}`;
    } else if (timePeriod === 'months') {
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
    return date.toLocaleDateString();
  };
  
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradient[0]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={gradient[1]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          position={{ y: 70 }}
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 99999 }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              const value = data.value;
              const timestamp = data.timestamp;
              const previousValue = data.previousValue;
              
              const dateStr = formatTooltipDate(timestamp);
              const showComparison = timePeriod === 'hours' && previousValue !== undefined;
              
              const diff = previousValue !== undefined ? value - previousValue : 0;
              let trendText = '';
              if (showComparison && previousValue !== undefined) {
                const percentChange = previousValue > 0 ? ((diff / previousValue) * 100).toFixed(1) : '0';
                const isPositive = diff >= 0;
                const trendIcon = isPositive ? '↑' : '↓';
                trendText = `${trendIcon} ${Math.abs(Number(percentChange))}% vs yesterday`;
              }
              
              // Format value based on metric type
              const isEngagementRate = id === 'engagement';
              const displayValue = isEngagementRate 
                ? `${value?.toLocaleString()}%` 
                : value?.toLocaleString();
              
              return (
                <div className="bg-gray-900/80 backdrop-blur-md text-white px-4 py-2.5 rounded-lg shadow-xl text-sm space-y-1 min-w-[200px] border border-white/10 z-[99999] relative">
                  {dateStr && <p className="text-xs text-gray-400 font-medium">{dateStr}</p>}
                  <p className="font-semibold text-lg">{displayValue}</p>
                  {showComparison && trendText && (
                    <p className={`text-xs font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trendText}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
          cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fill={`url(#gradient-${id})`}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 4, fill: stroke, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

const KPICard: React.FC<{ data: KPICardData; onClick?: () => void; timePeriod?: TimePeriodType }> = ({ data, onClick, timePeriod = 'days' }) => {
  const accentColors = {
    emerald: {
      icon: 'bg-emerald-500/10 ring-emerald-500/20',
      iconColor: 'text-emerald-400',
      gradient: ['#10b981', '#10b98100'],
      stroke: '#10b981',
      deltaBg: 'bg-emerald-400/10 text-emerald-300'
    },
    pink: {
      icon: 'bg-pink-500/10 ring-pink-500/20',
      iconColor: 'text-pink-400',
      gradient: ['#ec4899', '#ec489900'],
      stroke: '#ec4899',
      deltaBg: 'bg-pink-400/10 text-pink-300'
    },
    blue: {
      icon: 'bg-blue-500/10 ring-blue-500/20',
      iconColor: 'text-blue-400',
      gradient: ['#3b82f6', '#3b82f600'],
      stroke: '#3b82f6',
      deltaBg: 'bg-blue-400/10 text-blue-300'
    },
    violet: {
      icon: 'bg-violet-500/10 ring-violet-500/20',
      iconColor: 'text-violet-400',
      gradient: ['#8b5cf6', '#8b5cf600'],
      stroke: '#8b5cf6',
      deltaBg: 'bg-violet-400/10 text-violet-300'
    },
    teal: {
      icon: 'bg-teal-500/10 ring-teal-500/20',
      iconColor: 'text-teal-400',
      gradient: ['#14b8a6', '#14b8a600'],
      stroke: '#14b8a6',
      deltaBg: 'bg-teal-400/10 text-teal-300'
    },
    orange: {
      icon: 'bg-orange-500/10 ring-orange-500/20',
      iconColor: 'text-orange-400',
      gradient: ['#f97316', '#f9731600'],
      stroke: '#f97316',
      deltaBg: 'bg-orange-400/10 text-orange-300'
    },
    slate: {
      icon: 'bg-slate-500/10 ring-slate-500/20',
      iconColor: 'text-slate-400',
      gradient: ['#64748b', '#64748b00'],
      stroke: '#64748b',
      deltaBg: 'bg-slate-400/10 text-slate-300'
    }
  };

  const colors = accentColors[data.accent];
  const Icon = data.icon;

  return (
    <div 
      onClick={onClick}
      className="group relative min-h-[8rem] rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 p-4 lg:p-5 cursor-pointer">
      <div className="flex items-start justify-between h-full">
        {/* Left: Text Stack */}
        <div className="flex-1 flex flex-col justify-between min-h-full">
          <div>
            {/* Icon + Label */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ring-1 ${colors.icon}`}>
                <Icon className={`w-4.5 h-4.5 ${colors.iconColor}`} />
              </div>
              <span className="text-sm font-medium text-zinc-300">{data.label}</span>
            </div>

            {/* Value + Delta */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-3xl font-bold ${data.isEmpty ? 'text-zinc-500' : 'text-white'}`}>
                {data.value}
              </span>
              {data.delta && (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  data.delta.isPositive 
                    ? 'bg-emerald-400/10 text-emerald-300' 
                    : 'bg-rose-400/10 text-rose-300'
                }`}>
                  {data.delta.isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {data.delta.value.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Period Caption */}
            {data.period && (
              <p className="text-xs text-zinc-500">{data.period}</p>
            )}
          </div>

          {/* CTA (Empty State) */}
          {data.ctaText && (
            <button className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-zinc-300/90 bg-white/5 hover:bg-white/10 transition-colors self-start">
              {data.ctaText}
            </button>
          )}
        </div>

        {/* Right: Sparkline */}
        {data.sparklineData && !data.isEmpty && (
          <div className="w-[40%] h-full flex items-center ml-2">
            <KPISparkline
              data={data.sparklineData}
              id={data.id}
              gradient={colors.gradient}
              stroke={colors.stroke}
              timePeriod={timePeriod}
            />
          </div>
        )}

        {/* More CTA (top-right) */}
        {!data.isEmpty && !data.ctaText && (
          <button className="absolute top-4 right-4 inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs text-zinc-300/90 bg-white/5 hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
            More
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default KPICards;
