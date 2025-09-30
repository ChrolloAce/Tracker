import React, { useMemo } from 'react';
import { 
  Play, 
  Heart, 
  MessageCircle, 
  Activity, 
  AtSign, 
  Video, 
  DollarSign, 
  Download,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { VideoSubmission } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface KPICardsProps {
  submissions: VideoSubmission[];
}

interface KPICardData {
  id: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'emerald' | 'pink' | 'blue' | 'violet' | 'teal' | 'orange' | 'slate';
  delta?: { value: number; isPositive: boolean };
  period?: string;
  sparklineData?: Array<{ value: number }>;
  isEmpty?: boolean;
  ctaText?: string;
}

const KPICards: React.FC<KPICardsProps> = ({ submissions }) => {
  const kpiData = useMemo(() => {
    // Calculate metrics
    const totalViews = submissions.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = submissions.reduce((sum, v) => sum + (v.likes || 0), 0);
    const totalComments = submissions.reduce((sum, v) => sum + (v.comments || 0), 0);
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

    // Generate sparkline data (last 14 days)
    const generateSparklineData = (metric: 'views' | 'likes' | 'comments') => {
      const data = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayVideos = submissions.filter(v => {
          const uploadDate = new Date(v.uploadDate);
          uploadDate.setHours(0, 0, 0, 0);
          return uploadDate.getTime() === date.getTime();
        });
        
        const value = dayVideos.reduce((sum, v) => sum + (v[metric] || 0), 0);
        data.push({ value });
      }
      return data;
    };

    const formatNumber = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toString();
    };

    const cards: KPICardData[] = [
      {
        id: 'views',
        label: 'Views',
        value: formatNumber(totalViews),
        icon: Play,
        accent: 'emerald',
        delta: { value: Math.abs(viewsGrowth), isPositive: viewsGrowth >= 0 },
        period: 'Last 7 days',
        sparklineData: generateSparklineData('views')
      },
      {
        id: 'accounts',
        label: 'Active Accounts',
        value: activeAccounts,
        icon: AtSign,
        accent: 'teal',
        period: 'Total tracked'
      },
      {
        id: 'videos',
        label: 'Published Videos',
        value: publishedVideos,
        icon: Video,
        accent: 'orange',
        period: 'All time'
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
        id: 'engagement',
        label: 'Engagement',
        value: `${engagementRate.toFixed(1)}%`,
        icon: Activity,
        accent: 'violet',
        period: 'Last 28 days'
      },
      {
        id: 'revenue',
        label: 'App Revenue',
        value: '$0',
        icon: DollarSign,
        accent: 'emerald',
        isEmpty: true,
        ctaText: 'Set up +',
        period: 'Connect revenue tracking'
      },
      {
        id: 'installs',
        label: 'App Installs',
        value: '0',
        icon: Download,
        accent: 'slate',
        isEmpty: true,
        ctaText: 'Set up +',
        period: 'Connect install tracking'
      }
    ];

    return cards;
  }, [submissions]);

  return (
    <div className="grid gap-4 md:gap-5 xl:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {kpiData.map((card) => (
        <KPICard key={card.id} data={card} />
      ))}
    </div>
  );
};

const KPICard: React.FC<{ data: KPICardData }> = ({ data }) => {
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
    <div className="group relative min-h-[8rem] rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 shadow-lg hover:shadow-xl hover:ring-1 hover:ring-white/10 transition-all duration-300 p-4 lg:p-5">
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
            <ResponsiveContainer width="100%" height={56}>
              <AreaChart data={data.sparklineData}>
                <defs>
                  <linearGradient id={`gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.gradient[0]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.gradient[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={colors.stroke}
                  strokeWidth={2}
                  fill={`url(#gradient-${data.id})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
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
