import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { VideoSubmission } from '../types';
import { TrackedAccount } from '../types/accounts';
import { clsx } from 'clsx';

interface BarChartRaceProps {
  submissions: VideoSubmission[];
  accounts: TrackedAccount[];
  mode: 'platforms' | 'accounts';
  metric: 'views' | 'engagement' | 'videos';
}

interface RaceEntry {
  id: string;
  name: string;
  value: number;
  color: string;
  icon?: string;
  profilePicture?: string;
}

const PLATFORM_COLORS = {
  instagram: '#E4405F',
  tiktok: '#000000',
  youtube: '#FF0000',
  twitter: '#1DA1F2'
};

const BarChartRace: React.FC<BarChartRaceProps> = ({ 
  submissions, 
  accounts, 
  mode,
  metric 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);

  // Generate time periods (last 12 months)
  const timePeriods = useMemo(() => {
    const periods = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({
        date,
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
    }
    
    return periods;
  }, []);

  // Calculate data for each time period
  const raceData = useMemo(() => {
    return timePeriods.map((period, periodIndex) => {
      const periodEnd = new Date(period.date);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      if (mode === 'platforms') {
        // Aggregate by platform
        const platformData: Record<string, { views: number; engagement: number; videos: number }> = {
          instagram: { views: 0, engagement: 0, videos: 0 },
          tiktok: { views: 0, engagement: 0, videos: 0 },
          youtube: { views: 0, engagement: 0, videos: 0 },
          twitter: { views: 0, engagement: 0, videos: 0 }
        };

        submissions.forEach(video => {
          const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
          
          // Only count videos up to this time period
          if (uploadDate <= periodEnd) {
            const platform = video.platform;
            if (platform in platformData) {
              platformData[platform].videos++;
              platformData[platform].views += video.views || 0;
              platformData[platform].engagement += (video.likes || 0) + (video.comments || 0);
            }
          }
        });

        return Object.entries(platformData).map(([platform, data]) => ({
          id: platform,
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          value: metric === 'views' ? data.views : 
                 metric === 'engagement' ? data.engagement : 
                 data.videos,
          color: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS],
          icon: platform
        }));
      } else {
        // Aggregate by account
        const accountData: Record<string, { views: number; engagement: number; videos: number; account: TrackedAccount }> = {};

        submissions.forEach(video => {
          const uploadDate = new Date(video.uploadDate || video.dateSubmitted);
          
          // Only count videos up to this time period
          if (uploadDate <= periodEnd) {
            const accountKey = video.uploaderHandle;
            
            if (!accountData[accountKey]) {
              const account = accounts.find(a => a.username === accountKey);
              if (account) {
                accountData[accountKey] = { 
                  views: 0, 
                  engagement: 0, 
                  videos: 0,
                  account 
                };
              }
            }

            if (accountData[accountKey]) {
              accountData[accountKey].videos++;
              accountData[accountKey].views += video.views || 0;
              accountData[accountKey].engagement += (video.likes || 0) + (video.comments || 0);
            }
          }
        });

        return Object.entries(accountData)
          .map(([handle, data]) => ({
            id: handle,
            name: data.account.displayName || handle,
            value: metric === 'views' ? data.views : 
                   metric === 'engagement' ? data.engagement : 
                   data.videos,
            color: PLATFORM_COLORS[data.account.platform as keyof typeof PLATFORM_COLORS] || '#6366f1',
            profilePicture: data.account.profilePicture
          }))
          .filter(entry => entry.value > 0);
      }
    });
  }, [submissions, accounts, mode, metric, timePeriods]);

  // Get current period's sorted data
  const currentData = useMemo(() => {
    const data = raceData[currentTimeIndex] || [];
    return [...data].sort((a, b) => b.value - a.value).slice(0, 10);
  }, [raceData, currentTimeIndex]);

  const maxValue = useMemo(() => {
    return Math.max(...currentData.map(d => d.value), 1);
  }, [currentData]);

  // Auto-play animation
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTimeIndex(prev => {
        if (prev >= timePeriods.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500); // Change every 1.5 seconds

    return () => clearInterval(interval);
  }, [isPlaying, timePeriods.length]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const handlePlayPause = () => {
    if (currentTimeIndex >= timePeriods.length - 1) {
      setCurrentTimeIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTimeIndex(0);
  };

  return (
    <div className="bg-zinc-900/60 backdrop-blur border border-white/10 rounded-2xl p-8 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {mode === 'platforms' ? 'Top Platforms' : 'Top Accounts'}
          </h2>
          <p className="text-sm text-gray-400">
            Racing by {metric === 'views' ? 'Total Views' : metric === 'engagement' ? 'Total Engagement' : 'Video Count'}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={handlePlayPause}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {currentTimeIndex >= timePeriods.length - 1 ? 'Replay' : 'Play'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Time Period Display */}
      <div className="absolute top-8 right-8 text-6xl font-bold text-white/10 select-none pointer-events-none">
        {timePeriods[currentTimeIndex]?.label}
      </div>

      {/* Racing Bars */}
      <div className="space-y-4 relative">
        {currentData.map((entry, index) => {
          const barWidth = (entry.value / maxValue) * 100;
          const isTopThree = index < 3;

          return (
            <div
              key={entry.id}
              className="relative"
              style={{
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {/* Rank Number */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-500">
                {index + 1}
              </div>

              {/* Bar Container */}
              <div className="relative h-16 rounded-lg overflow-hidden bg-white/5">
                {/* Animated Bar */}
                <div
                  className={clsx(
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-1000 ease-out",
                    isTopThree && "shadow-lg"
                  )}
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: entry.color,
                    opacity: isTopThree ? 0.9 : 0.7
                  }}
                />

                {/* Content */}
                <div className="absolute inset-0 flex items-center justify-between px-4 z-10">
                  <div className="flex items-center gap-3">
                    {/* Profile Picture or Icon */}
                    {mode === 'accounts' && entry.profilePicture ? (
                      <img
                        src={entry.profilePicture}
                        alt={entry.name}
                        className="w-10 h-10 rounded-full border-2 border-white shadow-lg"
                      />
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                        style={{ backgroundColor: entry.color }}
                      >
                        {entry.name.charAt(0)}
                      </div>
                    )}
                    
                    {/* Name */}
                    <span className="font-semibold text-white text-lg drop-shadow-lg">
                      {entry.name}
                    </span>
                  </div>

                  {/* Value */}
                  <span className="font-bold text-2xl text-white drop-shadow-lg">
                    {formatNumber(entry.value)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-8">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{
              width: `${((currentTimeIndex + 1) / timePeriods.length) * 100}%`
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{timePeriods[0]?.label}</span>
          <span>{timePeriods[timePeriods.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
};

export default BarChartRace;

