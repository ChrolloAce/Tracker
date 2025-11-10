import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface ComingSoonLockedProps {
  title: string;
  description?: string;
}

/**
 * ComingSoonLocked - Display a locked state for features coming soon with countdown
 */
const ComingSoonLocked: React.FC<ComingSoonLockedProps> = ({ 
  title, 
  description = "This feature is currently under development and will be available soon."
}) => {
  // Set launch date to 3 days from now
  const [launchDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date;
  });

  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const distance = launchDate.getTime() - now;

      if (distance > 0) {
        setTimeRemaining({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [launchDate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Lock Icon */}
        <div className="relative inline-flex items-center justify-center mb-6">
          {/* Outer glow ring */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-blue-500/20 rounded-full blur-2xl animate-pulse" />
          
          {/* Lock container */}
          <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 border border-blue-500/30 rounded-full w-24 h-24 flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Lock className="w-12 h-12 text-blue-400" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
          {title}
        </h2>

        {/* Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-full mb-6">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-blue-300 uppercase tracking-wider">
            Coming Soon
          </span>
        </div>

        {/* Countdown Timer */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <TimeUnit value={timeRemaining.days} label="Days" />
          <span className="text-blue-400 text-2xl font-bold">:</span>
          <TimeUnit value={timeRemaining.hours} label="Hours" />
          <span className="text-blue-400 text-2xl font-bold">:</span>
          <TimeUnit value={timeRemaining.minutes} label="Minutes" />
          <span className="text-blue-400 text-2xl font-bold">:</span>
          <TimeUnit value={timeRemaining.seconds} label="Seconds" />
        </div>

        {/* Description */}
        <p className="text-gray-400 text-base leading-relaxed">
          {description}
        </p>

        {/* Decorative elements */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-cyan-500/40 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

// TimeUnit component for countdown display
const TimeUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg px-4 py-2 min-w-[60px]">
      <span className="text-2xl font-bold text-white tabular-nums">
        {value.toString().padStart(2, '0')}
      </span>
    </div>
    <span className="text-xs text-gray-500 mt-1.5 uppercase tracking-wider font-medium">
      {label}
    </span>
  </div>
);

export default ComingSoonLocked;

