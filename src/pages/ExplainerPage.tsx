import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Step {
  title: string;
  subtitle: string;
  visual: React.ReactNode;
}

/* ─── Animated visuals for each step ─── */

const AddAccountVisual: React.FC<{ active: boolean }> = ({ active }) => {
  const platforms = [
    { name: 'TikTok', color: '#000000', icon: '♪', followers: '1.2M' },
    { name: 'Instagram', color: '#E1306C', icon: '◷', followers: '840K' },
    { name: 'YouTube', color: '#FF0000', icon: '▶', followers: '2.1M' },
    { name: 'X', color: '#000000', icon: '𝕏', followers: '390K' },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Search bar */}
      <div
        className={`w-72 bg-white/10 backdrop-blur rounded-2xl border border-white/20 px-4 py-3 flex items-center gap-3 transition-all duration-700 ${
          active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-gray-400 text-sm">@username</span>
      </div>

      {/* Account cards flying in */}
      <div className="flex flex-col gap-2.5 w-72">
        {platforms.map((p, i) => (
          <div
            key={p.name}
            className="bg-white/10 backdrop-blur rounded-xl border border-white/10 px-4 py-3 flex items-center justify-between transition-all duration-500"
            style={{
              transitionDelay: `${300 + i * 200}ms`,
              opacity: active ? 1 : 0,
              transform: active ? 'translateX(0)' : 'translateX(60px)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: p.color }}
              >
                {p.icon}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{p.name}</p>
                <p className="text-gray-400 text-xs">{p.followers} followers</p>
              </div>
            </div>
            <div
              className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center transition-all duration-300"
              style={{
                transitionDelay: `${800 + i * 200}ms`,
                opacity: active ? 1 : 0,
                transform: active ? 'scale(1)' : 'scale(0)',
              }}
            >
              <span className="text-white text-xs font-bold">+</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LiveDashboardVisual: React.FC<{ active: boolean }> = ({ active }) => {
  const [barHeights, setBarHeights] = useState([0, 0, 0, 0, 0, 0, 0, 0]);
  const targets = [45, 65, 52, 80, 70, 90, 75, 95];

  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => setBarHeights(targets), 400);
      return () => clearTimeout(timer);
    } else {
      setBarHeights([0, 0, 0, 0, 0, 0, 0, 0]);
    }
  }, [active]);

  const stats = [
    { label: 'Total Views', value: '12.4M', change: '+24%', color: 'text-green-400' },
    { label: 'Engagement', value: '8.7%', change: '+12%', color: 'text-green-400' },
    { label: 'New Followers', value: '34.2K', change: '+18%', color: 'text-green-400' },
  ];

  return (
    <div className="w-72 flex flex-col gap-3">
      {/* Stats row */}
      <div className="flex gap-2">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="flex-1 bg-white/10 backdrop-blur rounded-xl border border-white/10 p-3 transition-all duration-500"
            style={{
              transitionDelay: `${200 + i * 150}ms`,
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(20px)',
            }}
          >
            <p className="text-gray-400 text-[9px]">{s.label}</p>
            <p className="text-white text-base font-bold leading-tight">{s.value}</p>
            <p className={`${s.color} text-[10px] font-semibold`}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div
        className="bg-white/10 backdrop-blur rounded-xl border border-white/10 p-4 transition-all duration-500"
        style={{
          transitionDelay: '600ms',
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-xs font-semibold">Performance</span>
          <span className="text-green-400 text-[10px] font-semibold">Live</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {barHeights.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-gradient-to-t from-blue-600 to-cyan-400 transition-all duration-700 ease-out"
                style={{
                  height: `${h}%`,
                  transitionDelay: `${700 + i * 80}ms`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Live feed */}
      {['@creator_mike posted a new Reel — 42K views', '@brand_sarah TikTok trending — 1.2M views'].map((item, i) => (
        <div
          key={i}
          className="bg-white/5 rounded-lg border border-white/10 px-3 py-2 flex items-center gap-2 transition-all duration-500"
          style={{
            transitionDelay: `${1200 + i * 200}ms`,
            opacity: active ? 1 : 0,
            transform: active ? 'translateX(0)' : 'translateX(-30px)',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <p className="text-gray-300 text-[11px]">{item}</p>
        </div>
      ))}
    </div>
  );
};

const AIAnalysisVisual: React.FC<{ active: boolean }> = ({ active }) => {
  const hooks = [
    { hook: '"Nobody talks about this but..."', views: '4.2M', score: 94 },
    { hook: '"I tested this for 30 days..."', views: '2.8M', score: 87 },
    { hook: '"Stop scrolling if you want to..."', views: '1.9M', score: 81 },
  ];

  return (
    <div className="w-72 flex flex-col gap-3">
      {/* AI header */}
      <div
        className="bg-white/10 backdrop-blur rounded-xl border border-white/10 p-4 transition-all duration-500"
        style={{
          transitionDelay: '200ms',
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(0.9)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <img src="/openclaw.webp" alt="Open Claw" className="w-7 h-7 rounded-full" />
          <div>
            <p className="text-white text-xs font-semibold">Open Claw AI</p>
            <p className="text-gray-400 text-[10px]">Analyzing patterns...</p>
          </div>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-[2s] ease-out"
            style={{ width: active ? '100%' : '0%', transitionDelay: '400ms' }}
          />
        </div>
      </div>

      {/* Hook analysis cards */}
      {hooks.map((h, i) => (
        <div
          key={i}
          className="bg-white/10 backdrop-blur rounded-xl border border-white/10 p-3 transition-all duration-500"
          style={{
            transitionDelay: `${800 + i * 300}ms`,
            opacity: active ? 1 : 0,
            transform: active ? 'translateY(0)' : 'translateY(16px)',
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-blue-400 text-[10px] font-semibold">Hook #{i + 1}</span>
            <span className="text-gray-400 text-[10px]">{h.views} views</span>
          </div>
          <p className="text-white text-xs mb-2">{h.hook}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: active ? `${h.score}%` : '0%',
                  transitionDelay: `${1000 + i * 300}ms`,
                }}
              />
            </div>
            <span className="text-green-400 text-[10px] font-bold">{h.score}%</span>
          </div>
        </div>
      ))}

      {/* Insight */}
      <div
        className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 transition-all duration-500"
        style={{
          transitionDelay: '1800ms',
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(10px)',
        }}
      >
        <p className="text-blue-300 text-[11px]">
          Pattern: Open loops + bold claims perform 3.2x better for this niche
        </p>
      </div>
    </div>
  );
};

/* ─── Main Explainer Page ─── */

const ExplainerPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps: Step[] = [
    {
      title: 'Add any account in seconds',
      subtitle: 'Just paste a username. We support TikTok, Instagram, YouTube, and X.',
      visual: <AddAccountVisual active={!isTransitioning} />,
    },
    {
      title: 'Your live analytics dashboard',
      subtitle: 'Track every video\'s performance across all platforms in one place. Updated every 12 hours.',
      visual: <LiveDashboardVisual active={!isTransitioning} />,
    },
    {
      title: 'AI that learns what goes viral',
      subtitle: 'Open Claw analyzes top hooks, trends, and patterns so you can replicate what works.',
      visual: <AIAnalysisVisual active={!isTransitioning} />,
    },
  ];

  const goToStep = (next: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(next);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 400);
  };

  // Auto-advance every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        const next = (prev + 1) % steps.length;
        goToStep(next);
        return prev; // goToStep handles the actual update
      });
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleGetStarted = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Skip button */}
      <button
        onClick={handleGetStarted}
        className="absolute top-6 right-6 text-gray-500 hover:text-white text-sm transition-colors"
      >
        Skip
      </button>

      {/* Logo */}
      <div className="mb-8">
        <h2 className="text-white text-xl font-bold tracking-tight">ViewTrack</h2>
      </div>

      {/* Step content */}
      <div className="flex flex-col items-center max-w-md w-full">
        {/* Visual */}
        <div
          className={`mb-8 transition-all duration-400 ${
            isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {steps[currentStep].visual}
        </div>

        {/* Text */}
        <div
          className={`text-center mb-8 transition-all duration-400 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          <h1 className="text-white text-2xl sm:text-3xl font-bold mb-3 leading-tight">
            {steps[currentStep].title}
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-sm mx-auto">
            {steps[currentStep].subtitle}
          </p>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep ? 'w-8 bg-blue-500' : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleGetStarted}
          className="w-full max-w-xs px-8 py-3.5 bg-gradient-to-r from-[#007BFF] to-[#2583FF] hover:from-[#0066DD] hover:to-[#1E6FDD] text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 text-sm sm:text-base"
        >
          Get Started
        </button>

        <p className="text-gray-600 text-xs mt-4">Free to try. No credit card required.</p>
      </div>
    </div>
  );
};

export default ExplainerPage;
