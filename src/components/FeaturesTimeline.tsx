import React, { useEffect, useRef, useState } from 'react';
import dashboardImg from '/dashboard.png';

interface Feature {
  title: string;
  description: string;
  image: string;
}

const features: Feature[] = [
  {
    title: "Unified KPIs",
    description: "All your metrics in one place across all platforms.",
    image: dashboardImg
  },
  {
    title: "Revenue Tracking",
    description: "See which content drives real sales and conversions.",
    image: dashboardImg
  },
  {
    title: "UGC Campaigns",
    description: "Manage creator campaigns effortlessly from start to finish.",
    image: dashboardImg
  },
  {
    title: "Contracts",
    description: "Handle creator agreements seamlessly in one place.",
    image: dashboardImg
  },
  {
    title: "Link Tracking",
    description: "Monitor bio link performance and conversions.",
    image: dashboardImg
  },
  {
    title: "Auto Refresh",
    description: "24-hour automated data updates, plus on-demand refresh.",
    image: dashboardImg
  },
  {
    title: "Chrome Extension",
    description: "Research and track content directly from your browser.",
    image: dashboardImg
  },
  {
    title: "Growth Analytics",
    description: "Track performance trends and identify viral patterns.",
    image: dashboardImg
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
    <section className="py-20 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to scale</h2>
          <p className="text-xl text-gray-600">Powerful features for modern creators and brands</p>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="relative">
          {/* Center line - Background (gray) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 -translate-x-1/2 z-0"></div>
          
          {/* Center line - Progress (blue #2282FF) */}
          <div 
            ref={lineRef}
            className="hidden lg:block absolute left-1/2 top-0 w-0.5 -translate-x-1/2 z-0 transition-none"
            style={{ height: '0%', backgroundColor: '#2282FF' }}
          ></div>

          {/* Desktop Timeline - Alternating Layout */}
          <div className="hidden lg:block space-y-12">
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
                    className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-4 border-white shadow-lg z-10 transition-all duration-500 ${
                      isActive ? 'scale-100' : 'bg-gray-300 scale-75'
                    }`}
                    style={isActive ? { backgroundColor: '#2282FF' } : {}}
                  ></div>

                  {/* Content card */}
                  <div 
                    className={`w-5/12 ${isLeft ? 'pr-12' : 'pl-12'}`}
                    style={{
                      transform: isActive 
                        ? `perspective(1000px) rotateY(${isLeft ? '3deg' : '-3deg'})` 
                        : `perspective(1000px) rotateY(${isLeft ? '-2deg' : '2deg'})`,
                      opacity: isActive ? 1 : 0.4,
                      transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group">
                      <div className="h-64 overflow-hidden bg-gray-100">
                        <img 
                          src={feature.image} 
                          alt={feature.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                        <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile/Tablet - Simple Grid */}
          <div className="lg:hidden grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 group">
                <div className="h-56 overflow-hidden bg-gray-100">
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
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

