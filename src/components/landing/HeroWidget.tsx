import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users } from 'lucide-react';

// Import Platform Icons
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import viewtrackLogo from '/Viewtrack Logo Black.png';

// Mock Data for Graph
const GRAPH_DATA = [
  { name: 'Mon', value: 2400, ppValue: 1800, date: 'Nov 20' },
  { name: 'Tue', value: 1398, ppValue: 1100, date: 'Nov 21' },
  { name: 'Wed', value: 9800, ppValue: 4500, date: 'Nov 22' },
  { name: 'Thu', value: 3908, ppValue: 3200, date: 'Nov 23' },
  { name: 'Fri', value: 4800, ppValue: 4100, date: 'Nov 24' },
  { name: 'Sat', value: 3800, ppValue: 3400, date: 'Nov 25' },
  { name: 'Sun', value: 4300, ppValue: 3900, date: 'Nov 26' },
];

// Mock Data for Race Chart with Real Images & Platforms
const RACE_DATA = [
  { name: 'Alex Creates', handle: '@alex_creates', value: 85, color: '#E5E7EB', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60', platform: 'tiktok', icon: tiktokIcon },
  { name: 'Sarah Style', handle: '@sarah_style', value: 72, color: '#E5E7EB', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=60', platform: 'instagram', icon: instagramIcon },
  { name: 'Mike Tech', handle: '@mike_tech', value: 64, color: '#E5E7EB', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&auto=format&fit=crop&q=60', platform: 'youtube', icon: youtubeIcon },
  { name: 'Jess Vlogs', handle: '@jess_vlogs', value: 58, color: '#E5E7EB', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=60', platform: 'instagram', icon: instagramIcon },
];

// Mock Data for Live Activity with Icons
const ACTIVITY_DATA = [
  { user: '@david_g', action: 'posted a new video', time: '2m ago', icon: tiktokIcon, platform: 'TikTok' },
  { user: '@anna_m', action: 'reached 1M views', time: '5m ago', icon: instagramIcon, platform: 'Instagram' },
  { user: '@tech_daily', action: 'gained 500 followers', time: '12m ago', icon: youtubeIcon, platform: 'YouTube' },
  { user: '@creative_co', action: 'started a campaign', time: '15m ago', icon: viewtrackLogo, platform: 'ViewTrack' },
];

type ViewType = 'growth' | 'creators' | 'live';

export const HeroWidget: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('growth');
  const [isHovered, setIsHovered] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // Auto-cycle views
  useEffect(() => {
    if (isHovered) return; // Pause on hover

    const interval = setInterval(() => {
      setActiveView(current => {
        if (current === 'growth') return 'creators';
        if (current === 'creators') return 'live';
        return 'growth';
      });
    }, 4000); // Switch every 4 seconds

    return () => clearInterval(interval);
  }, [isHovered]);

  // Increment animation key when switching to live view to re-trigger animations
  useEffect(() => {
    if (activeView === 'live') {
      setAnimationKey(prev => prev + 1);
    }
  }, [activeView]);

  const renderContent = () => {
    switch (activeView) {
      case 'growth':
        return (
          <div className="h-full w-full flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400">Total Views</p>
                <h3 className="text-2xl font-bold text-white">2.4M <span className="text-emerald-400 text-sm font-medium ml-1">+12.5%</span></h3>
              </div>
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="flex-grow -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={GRAPH_DATA}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  <Area type="monotone" dataKey="ppValue" stroke="#52525B" strokeWidth={2} strokeDasharray="4 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      
      case 'creators':
        return (
          <div className="h-full w-full flex flex-col justify-center space-y-5 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white">Top Performers</h3>
              <Users className="w-4 h-4 text-gray-500" />
            </div>
            {RACE_DATA.map((creator) => (
              <div key={creator.handle} className="flex items-center gap-3">
                {/* Avatar with Platform Icon */}
                <div className="relative flex-shrink-0">
                  <img 
                    src={creator.avatar} 
                    alt={creator.name} 
                    className="w-10 h-10 rounded-full border border-white/10 shadow-sm object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-[#111] rounded-full p-0.5 border border-white/10 shadow-sm">
                    <img src={creator.icon} alt={creator.platform} className="w-3.5 h-3.5 object-contain" />
                  </div>
                </div>

                {/* Race Bar Section */}
                <div className="flex-grow relative h-10 flex items-center">
                   {/* Bar Background */}
                  <div className="absolute inset-0 bg-white/5 rounded-r-full rounded-l-md" />
                  
                  {/* Animated Bar - Darker Gray */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 rounded-r-full rounded-l-md transition-all duration-1000 ease-out opacity-40"
                    style={{ 
                      width: `${creator.value}%`,
                      backgroundColor: '#52525B', // Zinc-600
                      animation: `slideWidth 1s ease-out forwards`
                    }}
                  />
                  
                  {/* Content on top of bar */}
                  <div className="relative z-10 flex justify-between w-full px-3 text-sm">
                    <div className="flex flex-col justify-center">
                      <span className="font-bold text-gray-200 leading-none">{creator.handle}</span>
                    </div>
                    <span className="font-bold text-white self-center">{creator.value}k</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'live':
        return (
          <div className="h-full w-full flex flex-col animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Live Activity</h3>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs text-emerald-400 font-medium">Live</span>
              </div>
            </div>
            <div className="space-y-4">
              {ACTIVITY_DATA.map((item, i) => (
                <div 
                  key={`live-${i}-${animationKey}`} // Force re-render for animation
                  className="flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-both"
                  style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'both' }}
                >
                  <div className="p-1.5 bg-white/5 rounded-full shrink-0 shadow-sm border border-white/10">
                    <img src={item.icon} alt={item.platform} className="w-5 h-5 object-contain opacity-90" />
                  </div>
                  <div className="text-sm">
                    <p className="text-gray-200 leading-tight">
                      <span className="font-semibold text-white">{item.user}</span> {item.action}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.time} • {item.platform}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="relative w-full max-w-md mx-auto md:mr-0 md:ml-auto bg-[#09090B]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.05)] p-8 h-[380px] transition-all duration-300 hover:shadow-2xl hover:shadow-black/40"
      style={{ animation: 'float 6s ease-in-out infinite' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tabs */}
      <div className="flex p-1 bg-white/5 rounded-xl mb-8 border border-white/5">
        {(['growth', 'creators', 'live'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              activeView === view 
                ? 'bg-[#27272A] text-white shadow-sm border border-white/10' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="h-[calc(100%-60px)] relative">
        {renderContent()}
      </div>

      {/* Decorative Elements */}
      <div className="absolute -z-10 top-10 right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -z-10 bottom-10 left-10 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700" />

      <style>{`
        @keyframes slideWidth {
          from { width: 0; }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
};
