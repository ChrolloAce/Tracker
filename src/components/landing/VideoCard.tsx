import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Eye, MousePointerClick, DollarSign } from 'lucide-react';

interface VideoCardProps {
  id: number;
  views: string;
}

export const VideoCard: React.FC<VideoCardProps> = ({ id, views }) => {
  const isPositive = id % 2 !== 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  // Simple lazy load trigger on mount
  useEffect(() => {
    setShouldLoad(true);
  }, []);

  // Generate mock metrics based on ID for consistency
  const metrics = useMemo(() => {
    const seed = id * 123.45;
    const random = (offset: number) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    
    return {
      clicks: Math.floor(random(3) * 5000 + 100).toLocaleString(),
      revenue: `$${Math.floor(random(4) * 9500 + 500).toLocaleString()}`
    };
  }, [id]);

  // Generate a deterministic but random-looking graph path based on ID
  const graphPath = useMemo(() => {
    const seed = id * 123.45;
    const random = (offset: number) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    const startY = isPositive ? 80 : 30;
    const endY = isPositive ? 20 : 90;
    
    let d = `M0 100 L0 ${startY}`;
    
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const x = (i / steps) * 100;
      const targetY = startY + (endY - startY) * (i / steps);
      const noise = (random(i) - 0.5) * 30; 
      const y = Math.max(10, Math.min(90, targetY + noise));
      d += ` L${x} ${y}`;
    }
    
    d += ` V100 Z`;
    return d;
  }, [id, isPositive]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black group select-none border border-white/10">
      {/* Video Background - Lazy Loaded */}
      <div className="absolute inset-0 bg-zinc-900">
        {shouldLoad && (
          <video
            ref={videoRef}
            src={`/videos/video${id}.mp4`}
            className="w-full h-full object-cover transform scale-105 group-hover:scale-110 transition-transform duration-700 ease-out"
            autoPlay
            loop
            muted
            playsInline
            preload="none"
          />
        )}
      </div>

      {/* Graph Overlay - High Opacity */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <svg 
          className="w-full h-full opacity-80 mix-blend-screen" 
          preserveAspectRatio="none" 
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.95"/>
              <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.4"/>
            </linearGradient>
          </defs>
          <path 
            d={graphPath} 
            fill={`url(#grad-${id})`}
            stroke={isPositive ? '#34D399' : '#F87171'} 
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Gradient Overlay for Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-90 z-20" />

      {/* TikTok Style Metrics Stack - Right Side */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 z-30">
        
        {/* Views */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-lg transition-transform hover:scale-110">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow-md">{views}</span>
        </div>

        {/* Clicks */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-lg transition-transform hover:scale-110">
            <MousePointerClick className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow-md">{metrics.clicks}</span>
        </div>

        {/* Revenue */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-lg transition-transform hover:scale-110">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow-md">{metrics.revenue}</span>
        </div>

      </div>
      
      {/* Glass Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-40" />
    </div>
  );
};
