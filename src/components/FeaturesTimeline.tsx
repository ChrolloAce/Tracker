import React, { useEffect, useRef, useState } from 'react';

// Import new landing page images
import trackViewImg from '/LANDINGPAGE-PHOOTS/TrackView.png';
import createCampaignsImg from '/LANDINGPAGE-PHOOTS/CreateCampaigns.png';
import signContractsImg from '/LANDINGPAGE-PHOOTS/SignContracts.png';
import trackLinksImg from '/linkimage.png';
import chromeExtensionImg from '/LANDINGPAGE-PHOOTS/ChromeExtension.png';
import creatorPortalImg from '/LANDINGPAGE-PHOOTS/Creator Portal.png';

interface Feature {
  title: string;
  description: string;
  image: string;
  comingSoon?: string;
}

const features: Feature[] = [
  {
    title: "Unified KPIs",
    description: "Stop switching between apps. View aggregated performance metrics from Instagram, TikTok, and YouTube in a single, real-time dashboard designed for clarity.",
    image: trackViewImg
  },
  {
    title: "Creator Portal",
    description: "Give creators and clients transparent, secure access to their live performance data without sharing passwords or sensitive account details.",
    image: creatorPortalImg,
    comingSoon: "Coming Dec 5 2025"
  },
  {
    title: "UGC Campaigns",
    description: "Streamline your entire campaign workflow. Create detailed briefs, track deliverables, manage revisions, and approve content all in one collaborative workspace.",
    image: createCampaignsImg,
    comingSoon: "Coming Dec 5 2025"
  },
  {
    title: "Contracts",
    description: "Generate, send, and e-sign legally binding agreements effortlessly. Manage terms, renewals, and compliance documents directly within the platform.",
    image: signContractsImg,
    comingSoon: "Coming Dec 5 2025"
  },
  {
    title: "Link Tracking",
    description: "Go beyond vanity metrics. Use custom tracking links to attribute clicks, conversions, and revenue directly to specific creators and content pieces.",
    image: trackLinksImg
  },
  {
    title: "Auto Refresh",
    description: "Never rely on stale data again. Our system automatically refreshes metrics every 24 hours, with on-demand sync options for critical campaign moments.",
    image: trackViewImg
  },
  {
    title: "Chrome Extension",
    description: "Identify opportunities instantly. Analyze creator engagement rates, average views, and audience demographics directly while browsing social platforms.",
    image: chromeExtensionImg
  }
];

const FeaturesTimeline: React.FC = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!timelineRef.current || !lineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Calculate scroll progress
      const timelineStart = rect.top;
      const timelineHeight = rect.height;
      const scrollStart = viewportHeight * 0.8;
      const scrollEnd = viewportHeight * 0.2;
      
      let progress = 0;
      
      if (timelineStart < scrollStart) {
        const scrollDistance = scrollStart - timelineStart;
        const totalDistance = timelineHeight + (scrollStart - scrollEnd);
        progress = Math.min(1, Math.max(0, scrollDistance / totalDistance));
      }
      
      setScrollProgress(progress);
      
      // Update line height
      lineRef.current.style.height = `${progress * 100}%`;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-bold text-[#111] mb-6 tracking-tight leading-tight">
            Everything you need to scale
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">
            Powerful features for modern creators and brands, consolidated into one intuitive platform.
          </p>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="relative">
          {/* Center line - Background (lighter gray) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-100 -translate-x-1/2 z-0"></div>
          
          {/* Center line - Progress (Black for monotone) */}
          <div 
            ref={lineRef}
            className="hidden lg:block absolute left-1/2 top-0 w-px -translate-x-1/2 z-0 transition-none"
            style={{ height: '0%', backgroundColor: '#111' }}
          ></div>

          {/* Desktop Timeline - Alternating Layout */}
          <div className="hidden lg:block space-y-24">
            {features.map((feature, index) => {
              const isLeft = index % 2 === 0;
              const cardProgress = Math.max(0, Math.min(1, (scrollProgress * features.length) - index));
              const isActive = cardProgress > 0;
              
              return (
                <div
                  key={index}
                  className={`relative flex items-center ${
                    isLeft ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {/* Connection dot */}
                  <div 
                    className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-10 transition-all duration-500 ${
                      isActive 
                        ? 'bg-black shadow-[0_0_0_4px_rgba(255,255,255,1),0_0_0_5px_rgba(0,0,0,0.1)] scale-125' 
                        : 'bg-gray-200 border-4 border-white scale-100'
                    }`}
                  ></div>

                  {/* Content card */}
                  <div 
                    className={`w-[45%] ${isLeft ? 'pr-12' : 'pl-12'}`}
                    style={{
                      transform: isActive 
                        ? `translateY(0) opacity(1)` 
                        : `translateY(40px) opacity(0.5)`,
                      transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    <div className="group cursor-default">
                      {/* Floating Image Container */}
                      <div className="h-80 overflow-hidden bg-[#FAFAFA] rounded-[2.5rem] border border-gray-100 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.12)] relative flex items-center justify-center transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_35px_60px_-15px_rgba(0,0,0,0.15)]">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        {/* Coming Soon Badge */}
                        {feature.comingSoon && (
                          <div className="absolute top-6 right-6 z-20">
                            <span className="bg-black text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-white/20">
                              {feature.comingSoon}
                            </span>
                          </div>
                        )}

                        <img 
                          src={feature.image} 
                          alt={feature.title}
                          className="w-full h-full object-cover drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-700 ease-out rounded-3xl"
                        />
                      </div>
                      
                      {/* 3D-ish Text Layout */}
                      <div className="pt-8 px-4 text-center md:text-left">
                        <h3 className="text-3xl font-extrabold text-[#111] mb-3 tracking-tighter drop-shadow-sm">{feature.title}</h3>
                        <p className="text-gray-500 text-lg font-medium leading-relaxed max-w-md">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile/Tablet - Simple Grid */}
          <div className="lg:hidden grid md:grid-cols-2 gap-12">
            {features.map((feature, index) => (
              <div key={index} className="group">
                <div className="h-64 overflow-hidden bg-[#FAFAFA] rounded-[2.5rem] border border-gray-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] relative flex items-center justify-center transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)]">
                  {/* Coming Soon Badge */}
                  {feature.comingSoon && (
                    <div className="absolute top-4 right-4 z-20">
                      <span className="bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-white/20">
                        {feature.comingSoon}
                      </span>
                    </div>
                  )}
                  
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-500 rounded-2xl"
                  />
                </div>
                <div className="pt-6 px-2 text-center">
                  <h3 className="text-2xl font-extrabold text-[#111] mb-2 tracking-tighter drop-shadow-sm">{feature.title}</h3>
                  <p className="text-gray-500 text-base font-medium leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesTimeline;
