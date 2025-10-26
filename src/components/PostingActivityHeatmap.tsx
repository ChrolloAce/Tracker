import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { VideoSubmission } from '../types';
import { format, eachDayOfInterval, startOfDay, subYears } from 'date-fns';
import { Play } from 'lucide-react';
import { PlatformIcon } from './ui/PlatformIcon';
import DayVideosModal from './DayVideosModal';

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
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  // Calculate heatmap data for the last year (ending TODAY)
  const heatmapData = useMemo(() => {
    const today = startOfDay(new Date()); // End at today
    const yearAgo = startOfDay(subYears(today, 1)); // Start 1 year ago
    
    // Get all days from 1 year ago to today (no future dates)
    const allDays = eachDayOfInterval({ start: yearAgo, end: today });
    
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
              title: sub.title?.substring(0, 30) || sub.caption?.substring(0, 30),
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
      dateRange: `${format(yearAgo, 'MMM d, yyyy')} - ${format(today, 'MMM d, yyyy')}`,
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
    if (dayData.count > 0) {
      setSelectedDay(dayData);
      if (onDateClick) {
        onDateClick(dayData.date, dayData.videos);
      }
    }
  };

  const handleMouseEnter = (dayData: DayData, e: React.MouseEvent) => {
    setHoveredDay(dayData);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    
    // Edge detection for tooltip
    const tooltipWidth = 400; // Width of tooltip
    const tooltipHeight = 500; // Max height of tooltip
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let x = rect.left + rect.width / 2;
    let y = rect.top - 10;
    
    // Check right edge
    if (x + tooltipWidth / 2 > viewportWidth) {
      x = viewportWidth - tooltipWidth / 2 - 20; // 20px padding from edge
    }
    
    // Check left edge
    if (x - tooltipWidth / 2 < 0) {
      x = tooltipWidth / 2 + 20; // 20px padding from edge
    }
    
    // Check top edge (flip to bottom if needed)
    if (y - tooltipHeight < 0) {
      y = rect.bottom + 10; // Show below instead
    }
    
    setTooltipPosition({ x, y });
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
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 flex flex-col gap-[2px] text-xs text-white/40 pt-1">
          <div className="h-4">M</div>
          <div className="h-4">T</div>
          <div className="h-4">W</div>
          <div className="h-4">T</div>
          <div className="h-4">F</div>
          <div className="h-4">S</div>
          <div className="h-4">S</div>
        </div>

        {/* Heatmap grid - FULL WIDTH with responsive cells */}
        <div className="flex-1">
          <div className="grid gap-[2px]" style={{ 
            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
            gridAutoFlow: 'column'
          }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[2px]">
                {/* Fill empty days at the start of the first week */}
                {weekIndex === 0 && week[0] && week[0].date.getDay() > 0 && (
                  Array.from({ length: week[0].date.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square w-full" />
                  ))
                )}
                
                {week.map((day) => (
                  <div
                    key={format(day.date, 'yyyy-MM-dd')}
                    className={`
                      aspect-square w-full rounded-sm transition-all cursor-pointer
                      ${getColorIntensity(day.count)}
                      ${day.count > 0 ? 'hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1 hover:ring-offset-zinc-900' : ''}
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
        <div className="flex items-center gap-[2px]">
          <div className="w-4 h-4 rounded-sm bg-zinc-800/50" />
          <div className="w-4 h-4 rounded-sm bg-emerald-500/20" />
          <div className="w-4 h-4 rounded-sm bg-emerald-500/40" />
          <div className="w-4 h-4 rounded-sm bg-emerald-500/60" />
          <div className="w-4 h-4 rounded-sm bg-emerald-500/80" />
        </div>
        <div>More Posts</div>
      </div>

      {/* KPI-Style Tooltip with Videos */}
      {hoveredDay && hoveredDay.count > 0 && createPortal(
        <div 
          className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10" 
          style={{ 
            position: 'fixed',
            left: `${tooltipPosition.x - 200}px`, // Center by subtracting half width
            top: `${tooltipPosition.y}px`,
            zIndex: 999999999,
            width: '400px',
            maxHeight: '500px',
            pointerEvents: 'none'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              {format(hoveredDay.date, 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-2xl font-bold text-white">
              {hoveredDay.count}
            </p>
          </div>
          
          {/* Divider */}
          <div className="border-t border-white/10 mx-5"></div>
          
          {/* Videos List */}
          <div className="px-5 py-3 max-h-[400px] overflow-y-auto">
            {hoveredDay.videos
              .sort((a, b) => (b.views || 0) - (a.views || 0)) // Sort by views (top performing first)
              .slice(0, 5)
              .map((video, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 py-2.5 hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
              >
                {/* Video Thumbnail */}
                <div className="flex-shrink-0 w-16 h-12 relative rounded-md overflow-hidden bg-gray-800">
                  {video.thumbnail ? (
                    <>
                      <img 
                        src={video.thumbnail} 
                        alt={video.title || ''} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Play Icon Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="w-5 h-5 text-white fill-white opacity-80" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-gray-600" />
                    </div>
                  )}
                  {/* Platform Icon Badge */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#1a1a1a] border-2 border-[#1a1a1a] flex items-center justify-center">
                    <div className="w-3.5 h-3.5">
                      <PlatformIcon platform={video.platform} className="w-full h-full" />
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-tight">
                    {video.title || video.caption || 'Untitled'}
                  </p>
                  <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                    <span className="truncate">{video.uploaderHandle}</span>
                    <span>•</span>
                    <span>{(video.views || 0).toLocaleString()} views</span>
                  </div>
                </div>
              </div>
            ))}
            {hoveredDay.videos.length > 5 && (
              <div className="text-xs text-gray-400 text-center mt-2">
                +{hoveredDay.videos.length - 5} more video{hoveredDay.videos.length - 5 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          
          {/* Footer hint */}
          <div className="border-t border-white/10 px-5 py-2 text-[10px] text-gray-500 text-center">
            Click to view all videos
          </div>
        </div>,
        document.body
      )}

      {/* Modal for selected day videos - using DayVideosModal for consistency */}
      <DayVideosModal
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        date={selectedDay?.date || new Date()}
        videos={selectedDay?.videos || []}
        metricLabel="posts"
        onVideoClick={onVideoClick}
      />
    </div>
  );
};

export default PostingActivityHeatmap;

