import React, { useMemo } from 'react';
import { VideoSubmission } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, startOfDay, eachDayOfInterval, subDays } from 'date-fns';

interface PostingActivityChartProps {
  submissions: VideoSubmission[];
}

const PostingActivityChart: React.FC<PostingActivityChartProps> = ({ submissions }) => {
  // Calculate posting activity by day
  const activityData = useMemo(() => {
    if (submissions.length === 0) return [];

    // Deduplicate videos by ID
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });

    // Group videos by day
    const postsByDay = new Map<string, number>();
    
    uniqueVideos.forEach(video => {
      const dayKey = format(startOfDay(video.dateSubmitted), 'yyyy-MM-dd');
      postsByDay.set(dayKey, (postsByDay.get(dayKey) || 0) + 1);
    });

    // Get date range (last 30 days or based on data)
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    
    // Find earliest video date
    const earliestDate = Array.from(uniqueVideos.values()).reduce((earliest, video) => {
      return video.dateSubmitted < earliest ? video.dateSubmitted : earliest;
    }, today);
    
    const startDate = earliestDate > thirtyDaysAgo ? thirtyDaysAgo : earliestDate;
    
    // Create data for each day
    const days = eachDayOfInterval({ start: startDate, end: today });
    
    return days.map(day => {
      const dayKey = format(startOfDay(day), 'yyyy-MM-dd');
      return {
        date: format(day, 'MMM dd'),
        fullDate: format(day, 'yyyy-MM-dd'),
        posts: postsByDay.get(dayKey) || 0
      };
    });
  }, [submissions]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalPosts = activityData.reduce((sum, day) => sum + day.posts, 0);
    const daysWithPosts = activityData.filter(day => day.posts > 0).length;
    const avgPostsPerDay = daysWithPosts > 0 ? totalPosts / daysWithPosts : 0;
    const maxPostsInDay = Math.max(...activityData.map(day => day.posts), 0);
    
    return {
      totalPosts,
      avgPostsPerDay,
      maxPostsInDay,
      daysTracked: activityData.length
    };
  }, [activityData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs">
          <div className="font-semibold">{data.date}</div>
          <div className="text-gray-300 mt-1">
            {data.posts} {data.posts === 1 ? 'post' : 'posts'}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Posting Activity</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Daily posting frequency over time</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Posts</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalPosts}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Avg/Day</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.avgPostsPerDay.toFixed(1)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Peak Day</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.maxPostsInDay}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Days Tracked</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.daysTracked}</div>
        </div>
      </div>

      {/* Chart */}
      {activityData.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No posting activity data available
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(156, 163, 175, 0.2)" 
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="rgba(156, 163, 175, 0.5)"
                tick={{ fill: 'rgba(156, 163, 175, 0.8)', fontSize: 11 }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                stroke="rgba(156, 163, 175, 0.5)"
                tick={{ fill: 'rgba(156, 163, 175, 0.8)', fontSize: 11 }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(156, 163, 175, 0.3)', strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="posts"
                stroke="rgb(59, 130, 246)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{
                  fill: 'rgb(59, 130, 246)',
                  strokeWidth: 2,
                  r: 4,
                  stroke: '#fff'
                }}
                activeDot={{
                  r: 6,
                  fill: 'rgb(59, 130, 246)',
                  stroke: '#fff',
                  strokeWidth: 2
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        Showing posting activity for the last {stats.daysTracked} days
      </div>
    </div>
  );
};

export default PostingActivityChart;

