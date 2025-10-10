import React from 'react';
import { Eye, Users, Video, Heart, MessageCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { VideoSubmission } from '../types';

interface StatsOverviewProps {
  submissions: VideoSubmission[];
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ submissions }) => {
  // Calculate all stats
  const totalViews = submissions.reduce((sum, video) => sum + (video.views || 0), 0);
  const totalLikes = submissions.reduce((sum, video) => sum + (video.likes || 0), 0);
  const totalComments = submissions.reduce((sum, video) => sum + (video.comments || 0), 0);
  const activeAccounts = new Set(submissions.map(v => v.uploaderHandle)).size;
  const publishedVideos = submissions.length;
  
  // Calculate engagement rate (likes + comments) / views
  const totalEngagement = totalLikes + totalComments;
  const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

  // Get growth trends (compare last 7 days vs previous 7 days)
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

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    growth, 
    color = 'blue',
    subtitle
  }: { 
    title: string; 
    value: string | number; 
    icon: React.ComponentType<{ className?: string }>; 
    growth?: number;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'pink';
    subtitle?: string;
  }) => {
    const colorClasses = {
      blue: 'bg-gray-200 dark:bg-gray-800 text-blue-600 dark:text-gray-900 dark:text-white',
      green: 'bg-green-500/10 text-green-600 dark:text-green-400',
      purple: 'bg-gray-200 dark:bg-gray-800 text-purple-600 dark:text-gray-900 dark:text-white',
      orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      red: 'bg-red-500/10 text-red-600 dark:text-red-400',
      pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    };

    return (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          {growth !== undefined && (
            <div className={`flex items-center text-xs font-medium ${
              growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {growth >= 0 ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {Math.abs(growth).toFixed(1)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#161616] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Views"
          value={formatNumber(totalViews)}
          icon={Eye}
          growth={viewsGrowth}
          color="blue"
          subtitle={`+${formatNumber(last7DaysViews)}`}
        />
        
        <StatCard
          title="Active Accounts"
          value={activeAccounts}
          icon={Users}
          color="green"
        />
        
        <StatCard
          title="Published Videos"
          value={publishedVideos}
          icon={Video}
          color="purple"
        />
        
        <StatCard
          title="Likes"
          value={formatNumber(totalLikes)}
          icon={Heart}
          color="pink"
          subtitle={`${((totalLikes / totalViews) * 100).toFixed(1)}% of views`}
        />
        
        <StatCard
          title="Comments"
          value={formatNumber(totalComments)}
          icon={MessageCircle}
          color="orange"
          subtitle={`+${formatNumber(totalComments - (previous7Days.reduce((sum, v) => sum + (v.comments || 0), 0)))}`}
        />
        
        <StatCard
          title="Engagement"
          value={`${engagementRate.toFixed(1)}%`}
          icon={Activity}
          color="red"
          subtitle="Last 28 days"
        />
      </div>
    </div>
  );
};

export default StatsOverview;
