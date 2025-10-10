import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * RefreshCountdown Component
 * Shows countdown timer for next automatic refresh
 */
const RefreshCountdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(43200); // 12 hours in seconds
  const REFRESH_INTERVAL = 43200; // 12 hours (12 * 60 * 60)

  useEffect(() => {
    // Calculate initial time left based on current time
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentSecond = now.getUTCSeconds();
    
    // Next refresh is at 0:00 UTC or 12:00 UTC
    const nextRefreshHour = currentHour < 12 ? 12 : 24;
    const hoursUntilRefresh = nextRefreshHour - currentHour;
    const minutesUntilRefresh = 60 - currentMinute - 1;
    const secondsUntilRefresh = 60 - currentSecond;
    
    const initialTimeLeft = (hoursUntilRefresh * 3600) + (minutesUntilRefresh * 60) + secondsUntilRefresh;
    setTimeLeft(initialTimeLeft);

    // Update countdown every second
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return REFRESH_INTERVAL; // Reset to 12 hours
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  // Calculate progress percentage for visual indicator
  const progress = ((REFRESH_INTERVAL - timeLeft) / REFRESH_INTERVAL) * 100;

  return (
    <div className="px-4 py-3 border-t border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
          Auto Refresh
        </span>
        <RefreshCw className="w-3 h-3 text-white/30" />
      </div>
      
      {/* Countdown Timer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">Next refresh in:</span>
        <span className="text-sm font-bold text-white/90 font-mono">
          {hours}h {minutes}m {seconds}s
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default RefreshCountdown;

