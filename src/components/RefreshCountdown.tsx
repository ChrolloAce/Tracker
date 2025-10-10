import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * RefreshCountdown Component
 * Shows countdown timer for next automatic refresh
 */
const RefreshCountdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const REFRESH_INTERVAL = 300; // 5 minutes

  useEffect(() => {
    // Calculate initial time left based on current time
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    // Find next 5-minute mark (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
    const nextRefreshMinute = Math.ceil(currentMinute / 5) * 5;
    const minutesUntilRefresh = (nextRefreshMinute - currentMinute + 60) % 60;
    const secondsUntilRefresh = 60 - currentSecond;
    
    const initialTimeLeft = (minutesUntilRefresh * 60 + secondsUntilRefresh) % REFRESH_INTERVAL || REFRESH_INTERVAL;
    setTimeLeft(initialTimeLeft);

    // Update countdown every second
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return REFRESH_INTERVAL; // Reset to 5 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
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
          {minutes}:{seconds.toString().padStart(2, '0')}
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

