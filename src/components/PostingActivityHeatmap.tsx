import React, { useMemo, useState } from 'react';
import { VideoSubmission } from '../types';
import { format, startOfWeek, addDays, startOfYear, endOfYear, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';

interface PostingActivityHeatmapProps {
  submissions: VideoSubmission[];
  onVideoClick?: (video: VideoSubmission) => void;
  onDateClick?: (date: Date, videos: VideoSubmission[]) => void;
}

interface DayData {
  date: Date;
  count: number;
  videos: VideoSubmission[];
}

const PostingActivityHeatmap: React.FC<PostingActivityHeatmapProps> = ({ 
  submissions, 
  onVideoClick,
  onDateClick 
}) => {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Calculate heatmap data for the last year
  const heatmapData = useMemo(() => {
    const today = new Date();
    const yearStart = startOfYear(today);
    const yearEnd = endOfYear(today);
    
    // Get all days in the year
    const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
    
    // Group submissions by day - deduplicate videos first
    const uniqueVideos = new Map<string, VideoSubmission>();
    submissions.forEach(video => {
      const key = video.id || video.url || `${video.platform}_${video.uploaderHandle}_${video.dateSubmitted.getTime()}`;
      if (!uniqueVideos.has(key)) {
        uniqueVideos.set(key, video);
      }
    });
    
    const dayMap = new Map<string, VideoSubmission[]>();
    let usingUploadDateCount = 0;
    let usingSubmittedCount = 0;
    
    uniqueVideos.forEach(sub => {
      // Use uploadDate (actual upload date from platform), fall back to dateSubmitted
      // This ensures ALL videos show up in the heatmap
      const hasUploadDate = !!sub.uploadDate;
      const pubDate = sub.uploadDate || sub.dateSubmitted;
      
      if (hasUploadDate) usingUploadDateCount++;
      else usingSubmittedCount++;
      
      if (pubDate) {
        try {
          const dateKey = format(startOfDay(new Date(pubDate)), 'yyyy-MM-dd');
          if (!dayMap.has(dateKey)) {
            dayMap.set(dateKey, []);
          }
          dayMap.get(dateKey)!.push(sub);
          
          // Debug first 5 videos
          if (dayMap.size <= 5) {
            console.log(`📹 Video added to heatmap:`, {
              title: sub.title?.substring(0, 30) || sub.description?.substring(0, 30),
              uploadDate: sub.uploadDate ? format(new Date(sub.uploadDate), 'MMM d, yyyy') : 'none',
              dateSubmitted: format(new Date(sub.dateSubmitted), 'MMM d, yyyy'),
              usedDate: format(new Date(pubDate), 'MMM d, yyyy'),
              dateKey
            });
          }
        } catch (error) {
          console.warn('Invalid date for video:', { pubDate, video: sub });
        }
      }
    });
    
    console.log(`📊 Date source breakdown: ${usingUploadDateCount} using uploadDate, ${usingSubmittedCount} using dateSubmitted`);
    
    // Debug: Show first 10 dates with posts
    const datesWithPosts = Array.from(dayMap.keys()).sort();
    const videosWithUploadDate = Array.from(uniqueVideos.values()).filter(v => v.uploadDate).length;
    const videosWithoutUploadDate = uniqueVideos.size - videosWithUploadDate;
    
    console.log('📅 Heatmap Debug:', {
      totalSubmissions: submissions.length,
      uniqueVideos: uniqueVideos.size,
      videosWithUploadDate,
      videosWithoutUploadDate,
      daysWithPosts: dayMap.size,
      dateRange: `${format(yearStart, 'MMM d, yyyy')} - ${format(yearEnd, 'MMM d, yyyy')}`,
      firstDatesWithPosts: datesWithPosts.slice(0, 10),
      lastDatesWithPosts: datesWithPosts.slice(-10),
      postsPerDay: Array.from(dayMap.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([date, videos]) => ({ date, count: videos.length }))
    });
    
    // Create day data array
    const dayData: DayData[] = allDays.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const videos = dayMap.get(dateKey) || [];
      return {
        date,
        count: videos.length,
        videos
      };
    });
    
    return dayData;
  }, [submissions]);

  // Organize data into weeks
  const weeks = useMemo(() => {
    const weeksArray: DayData[][] = [];
    let currentWeek: DayData[] = [];
    
    heatmapData.forEach((day, index) => {
      const dayOfWeek = day.date.getDay(); // 0 = Sunday, 6 = Saturday
      
      // Start a new week on Sunday
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
      
      currentWeek.push(day);
      
      // Push the last week if we're at the end
      if (index === heatmapData.length - 1 && currentWeek.length > 0) {
        weeksArray.push(currentWeek);
      }
    });
    
    return weeksArray;
  }, [heatmapData]);

  // Get color intensity based on count
  const getColorIntensity = (count: number): string => {
    if (count === 0) return 'bg-zinc-800/50';
    if (count === 1) return 'bg-emerald-500/20';
    if (count === 2) return 'bg-emerald-500/40';
    if (count === 3) return 'bg-emerald-500/60';
    if (count >= 4) return 'bg-emerald-500/80';
    return 'bg-zinc-800/50';
  };

  const handleCellClick = (dayData: DayData) => {
    if (dayData.count > 0 && onDateClick) {
      onDateClick(dayData.date, dayData.videos);
    }
  };

  const handleMouseEnter = (dayData: DayData, e: React.MouseEvent) => {
    setHoveredDay(dayData);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  const stats = useMemo(() => {
    const totalPosts = heatmapData.reduce((sum, day) => sum + day.count, 0);
    const activeDays = heatmapData.filter(day => day.count > 0).length;
    const maxPostsInDay = Math.max(...heatmapData.map(day => day.count), 0);
    const avgPostsPerDay = totalPosts / heatmapData.length;
    
    return {
      totalPosts,
      activeDays,
      maxPostsInDay,
      avgPostsPerDay: avgPostsPerDay.toFixed(1)
    };
  }, [heatmapData]);

  return (
    <div className="bg-zinc-900 rounded-lg shadow-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Posting Activity</h2>
        <div className="text-sm text-white/60">
          {stats.totalPosts} posts • {stats.activeDays} active days
        </div>
      </div>

      {/* Day labels and Heatmap grid */}
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 flex flex-col gap-1 text-[10px] text-white/40 pt-1">
          <div className="h-3">M</div>
          <div className="h-3">T</div>
          <div className="h-3">W</div>
          <div className="h-3">T</div>
          <div className="h-3">F</div>
          <div className="h-3">S</div>
          <div className="h-3">S</div>
        </div>

        {/* Heatmap grid - FULL WIDTH */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 w-full">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1">
                {/* Fill empty days at the start of the first week */}
                {weekIndex === 0 && week[0] && week[0].date.getDay() > 0 && (
                  Array.from({ length: week[0].date.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-3 h-3" />
                  ))
                )}
                
                {week.map((day) => (
                  <div
                    key={format(day.date, 'yyyy-MM-dd')}
                    className={`
                      w-3 h-3 rounded-sm transition-all cursor-pointer
                      ${getColorIntensity(day.count)}
                      ${day.count > 0 ? 'hover:ring-2 hover:ring-emerald-400 hover:ring-offset-2 hover:ring-offset-zinc-900' : ''}
                    `}
                    onClick={() => handleCellClick(day)}
                    onMouseEnter={(e) => handleMouseEnter(day, e)}
                    onMouseLeave={handleMouseLeave}
                    title={`${format(day.date, 'MMM d, yyyy')}: ${day.count} post${day.count !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 text-xs text-white/40">
        <div>Fewer Posts</div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-zinc-800/50" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/20" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
        </div>
        <div>More Posts</div>
      </div>

      {/* Tooltip */}
      {hoveredDay && hoveredDay.count > 0 && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-zinc-800 border border-white/20 rounded-lg shadow-xl p-3 max-w-xs">
            <div className="text-xs font-semibold text-white mb-2">
              {format(hoveredDay.date, 'MMMM d, yyyy')}
            </div>
            <div className="text-xs text-emerald-400 mb-2">
              {hoveredDay.count} post{hoveredDay.count !== 1 ? 's' : ''}
            </div>
            
            {hoveredDay.videos.length > 0 && (
              <div className="space-y-1">
                {hoveredDay.videos.slice(0, 3).map((video, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-xs text-white/70 hover:text-white cursor-pointer transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onVideoClick) onVideoClick(video);
                    }}
                  >
                    {video.thumbnail && (
                      <img 
                        src={video.thumbnail} 
                        alt="" 
                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 truncate">
                      {video.title || video.description?.substring(0, 40) || 'Untitled'}
                    </div>
                  </div>
                ))}
                {hoveredDay.videos.length > 3 && (
                  <div className="text-xs text-white/50 pl-10">
                    +{hoveredDay.videos.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostingActivityHeatmap;

