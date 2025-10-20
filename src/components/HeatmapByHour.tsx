import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Type definitions
export interface HourStat {
  timestamp: string | Date;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  videos?: Array<{ id: string; title: string; thumbnailUrl?: string }>;
}

export type HeatmapMetric = 'views' | 'likes' | 'comments' | 'shares';

interface CellMeta {
  metricTotal: number;
  countVideos: number;
  videos: Array<{ id: string; title: string; thumbnailUrl?: string }>;
  range: { start: Date; end: Date };
}

interface HeatmapByHourProps {
  data: HourStat[];
  metric: HeatmapMetric;
  timezone?: string;
  onCellClick?: (params: {
    dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    hour: number;
    metricTotal: number;
    videos: Array<{ id: string; title: string; thumbnailUrl?: string }>;
    range: { start: Date; end: Date };
  }) => void;
}

// Helper functions
const toLocal = (date: Date | string, timezone?: string): Date => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!timezone) return d;
  
  // Convert to timezone using Intl API
  const tzDate = new Date(
    d.toLocaleString('en-US', { timeZone: timezone })
  );
  return tzDate;
};

const getDayIndex = (date: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 => {
  return date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

const getHour = (date: Date): number => {
  return date.getHours();
};

const formatHourRange = (hour: number): string => {
  const start = hour % 12 === 0 ? 12 : hour % 12;
  const end = (hour + 1) % 12 === 0 ? 12 : (hour + 1) % 12;
  const startPeriod = hour < 12 ? 'AM' : 'PM';
  const endPeriod = (hour + 1) < 12 || (hour + 1) === 24 ? 'AM' : 'PM';
  
  if (hour === 23) {
    return `${start} ${startPeriod} – 12 ${endPeriod}`;
  }
  
  return `${start}–${end} ${endPeriod}`;
};

const formatDay = (idx: 0 | 1 | 2 | 3 | 4 | 5 | 6, short = false): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return short ? shortDays[idx] : days[idx];
};

const aggregateToMatrix = (
  data: HourStat[],
  metric: HeatmapMetric,
  timezone?: string
): {
  matrix: number[][];
  cellsMeta: CellMeta[][];
  globalMin: number;
  globalMax: number;
} => {
  // Initialize 24x7 matrix (rows=hours, cols=days)
  const matrix: number[][] = Array(24).fill(0).map(() => Array(7).fill(0));
  const cellsMeta: CellMeta[][] = Array(24).fill(0).map(() =>
    Array(7).fill(0).map(() => ({
      metricTotal: 0,
      countVideos: 0,
      videos: [],
      range: { start: new Date(), end: new Date() }
    }))
  );

  // Aggregate data into matrix
  data.forEach(stat => {
    const localDate = toLocal(stat.timestamp, timezone);
    const dayIndex = getDayIndex(localDate);
    const hour = getHour(localDate);

    const metricValue = stat[metric] || 0;
    matrix[hour][dayIndex] += metricValue;
    
    const cell = cellsMeta[hour][dayIndex];
    cell.metricTotal += metricValue;
    cell.countVideos += stat.videos?.length || 0;
    
    // Keep top 3 videos by metric value
    if (stat.videos) {
      cell.videos.push(...stat.videos);
      cell.videos.sort((a, b) => {
        // Assuming we want to sort by title alphabetically for now
        // In a real implementation, you'd sort by metric value
        return a.title.localeCompare(b.title);
      });
      cell.videos = cell.videos.slice(0, 3);
    }

    // Set time range for this cell (hour window)
    const rangeStart = new Date(localDate);
    rangeStart.setMinutes(0, 0, 0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setHours(rangeStart.getHours() + 1);
    cell.range = { start: rangeStart, end: rangeEnd };
  });

  // Calculate global min/max
  let globalMin = Infinity;
  let globalMax = -Infinity;

  matrix.forEach(row => {
    row.forEach(value => {
      if (value > 0) {
        globalMin = Math.min(globalMin, value);
        globalMax = Math.max(globalMax, value);
      }
    });
  });

  if (globalMin === Infinity) globalMin = 0;
  if (globalMax === -Infinity) globalMax = 0;

  return { matrix, cellsMeta, globalMin, globalMax };
};

export const HeatmapByHour: React.FC<HeatmapByHourProps> = ({
  data,
  metric,
  timezone,
  onCellClick
}) => {
  const [focusedCell, setFocusedCell] = useState<{ hour: number; day: number } | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    hour: number;
    day: number;
    x: number;
    y: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  // Check container width for responsiveness
  useEffect(() => {
    if (!gridRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      setIsNarrow(width < 600);
    });

    resizeObserver.observe(gridRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { matrix, cellsMeta, globalMin, globalMax } = useMemo(
    () => aggregateToMatrix(data, metric, timezone),
    [data, metric, timezone]
  );

  const getIntensity = useCallback((value: number): number => {
    if (globalMax === globalMin || globalMax === 0) return 0;
    return (value - globalMin) / (globalMax - globalMin);
  }, [globalMin, globalMax]);

  const handleCellClick = useCallback((hour: number, dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6) => {
    const cell = cellsMeta[hour][dayIndex];
    if (onCellClick) {
      onCellClick({
        dayIndex,
        hour,
        metricTotal: cell.metricTotal,
        videos: cell.videos,
        range: cell.range
      });
    }
  }, [cellsMeta, onCellClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, hour: number, day: number) => {
    let newHour = hour;
    let newDay = day;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newHour = Math.max(0, hour - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newHour = Math.min(23, hour + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newDay = Math.max(0, day - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newDay = Math.min(6, day + 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleCellClick(hour, day as 0 | 1 | 2 | 3 | 4 | 5 | 6);
        return;
      case 'Escape':
        e.preventDefault();
        setTooltipData(null);
        setFocusedCell(null);
        return;
      default:
        return;
    }

    setFocusedCell({ hour: newHour, day: newDay });
    // Focus the new cell
    const cellElement = document.querySelector(
      `[data-hour="${newHour}"][data-day="${newDay}"]`
    ) as HTMLElement;
    cellElement?.focus();
  }, [handleCellClick]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, hour: number, day: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipData({
      hour,
      day,
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  const formatMetricValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const getMetricLabel = (): string => {
    return metric.charAt(0).toUpperCase() + metric.slice(1);
  };

  return (
    <div ref={gridRef} className="w-full">
      <div className="grid" style={{
        gridTemplateColumns: 'auto repeat(7, 1fr)',
        gap: '1px',
        fontSize: '9px'
      }}>
        {/* Header row with day labels */}
        <div />
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={`day-${i}`}
            className="text-center text-gray-400 font-medium py-1 text-[9px]"
          >
            {formatDay(i as 0 | 1 | 2 | 3 | 4 | 5 | 6, true)}
          </div>
        ))}

        {/* Grid rows - show all 24 hours */}
        {Array.from({ length: 24 }, (_, hour) => (
          <React.Fragment key={`hour-${hour}`}>
            {/* Hour label - show only every 4 hours */}
            <div className="text-right text-gray-400 font-medium pr-1 text-[8px] flex items-center justify-end">
              {hour % 4 === 0 ? formatHourRange(hour).split('–')[0] : ''}
            </div>

            {/* Cells for each day */}
            {Array.from({ length: 7 }, (_, day) => {
              const value = matrix[hour][day];
              const intensity = getIntensity(value);
              const cell = cellsMeta[hour][day];
              const isEmpty = value === 0;

              return (
                <button
                  key={`cell-${hour}-${day}`}
                  data-hour={hour}
                  data-day={day}
                  className="h-3 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:z-10 transition-all"
                  style={{
                    backgroundColor: isEmpty
                      ? 'rgba(255, 255, 255, 0.05)'
                      : `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`, // emerald-500
                    cursor: isEmpty ? 'default' : 'pointer'
                  }}
                  onClick={() => !isEmpty && handleCellClick(hour, day as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                  onMouseEnter={(e) => handleMouseEnter(e, hour, day)}
                  onMouseLeave={handleMouseLeave}
                  onFocus={() => setFocusedCell({ hour, day })}
                  onBlur={() => setFocusedCell(null)}
                  onKeyDown={(e) => handleKeyDown(e, hour, day)}
                  tabIndex={0}
                  aria-label={
                    isEmpty
                      ? `${formatDay(day as 0 | 1 | 2 | 3 | 4 | 5 | 6)} ${formatHourRange(hour)} — No posts`
                      : `${formatDay(day as 0 | 1 | 2 | 3 | 4 | 5 | 6)} ${formatHourRange(hour)} — ${formatMetricValue(value)} ${metric} — ${cell.countVideos} ${cell.countVideos === 1 ? 'video' : 'videos'}`
                  }
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Tooltip */}
      {tooltipData && createPortal(
        <div
          className="fixed z-[999999] pointer-events-none"
          style={{
            left: tooltipData.x,
            top: tooltipData.y - 10,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-[#1a1a1a] backdrop-blur-xl text-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-white/10 min-w-[260px]">
            {matrix[tooltipData.hour][tooltipData.day] === 0 ? (
              <div className="px-5 py-4">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                  {formatDay(tooltipData.day as 0 | 1 | 2 | 3 | 4 | 5 | 6)} · {formatHourRange(tooltipData.hour)}
                </div>
                <div className="text-gray-400 text-sm">No posts</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {formatDay(tooltipData.day as 0 | 1 | 2 | 3 | 4 | 5 | 6)} · {formatHourRange(tooltipData.hour)}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-white">
                      {formatMetricValue(matrix[tooltipData.hour][tooltipData.day])}
                    </p>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="border-t border-white/10 mx-5"></div>
                
                {/* Content */}
                <div className="px-5 py-3">
                  <div className="text-xs text-gray-400 mb-3">
                    {cellsMeta[tooltipData.hour][tooltipData.day].countVideos} {cellsMeta[tooltipData.hour][tooltipData.day].countVideos === 1 ? 'video' : 'videos'}
                  </div>

                  {cellsMeta[tooltipData.hour][tooltipData.day].videos.length > 0 && (
                    <div className="space-y-2">
                      {cellsMeta[tooltipData.hour][tooltipData.day].videos.slice(0, 3).map((video, idx) => (
                        <div key={video.id || idx} className="flex items-center gap-2">
                          {video.thumbnailUrl && (
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                            />
                          )}
                          <span className="text-xs text-white truncate flex-1">{video.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HeatmapByHour;

