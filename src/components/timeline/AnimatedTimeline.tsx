import React, { useEffect, useRef, useState } from 'react';
import dashboardImg from '/dashboard.png';

interface TimelineStep {
  id: number;
  title: string;
  subtitle?: string;
  description: string;
  image: string;
}

const timelineData: TimelineStep[] = [
  {
    id: 1,
    title: "Easy Account Setup",
    subtitle: "In Seconds",
    description: "Simply add accounts and choose what content to track. Our streamlined setup delivers real-time data after your first sync.",
    image: dashboardImg
  },
  {
    id: 2,
    title: "Unified KPIs",
    subtitle: "& Powerful Filters",
    description: "Aggregate TikTok, Instagram, and YouTube metrics in one place. Use powerful filters to identify your best-performing content.",
    image: dashboardImg
  },
  {
    id: 3,
    title: "Comprehensive Analytics",
    subtitle: "Dashboard",
    description: "Get a bird's-eye view of your performance with our intuitive dashboard. Track engagement, growth trends, and audience metrics all in one place.",
    image: dashboardImg
  },
  {
    id: 4,
    title: "Track Your Conversion",
    subtitle: "ROI Insights",
    description: "Custom integrations like Apple's App Store Connect enable never-before-seen insights into content conversion and ROI. Identify which content really drives sales.",
    image: dashboardImg
  },
  {
    id: 5,
    title: "UGC & Influencer",
    subtitle: "Campaigns",
    description: "Create and manage creator campaigns with rewards and tracking.",
    image: dashboardImg
  },
  {
    id: 6,
    title: "Contracts",
    subtitle: "& Creator Portals",
    description: "All-in-one solution for creator agreements and collaboration.",
    image: dashboardImg
  },
  {
    id: 7,
    title: "Chrome Extension",
    subtitle: "Browser Research",
    description: "Research and discover content directly from your browser.",
    image: dashboardImg
  },
  {
    id: 8,
    title: "Track Links",
    subtitle: "Bio Link Analytics",
    description: "Monitor click-through rates and conversion from your bio links.",
    image: dashboardImg
  }
];

const AnimatedTimeline: React.FC = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const pathRef = useRef<SVGPathElement>(null);
  const [activeCards, setActiveCards] = useState<Set<number>>(new Set());

  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const index = Number(entry.target.getAttribute('data-index'));
        if (entry.isIntersecting) {
          entry.target.classList.add('timeline-visible');
          setActiveCards(prev => new Set([...prev, index]));
          // Add staggered animation
          setTimeout(() => {
            entry.target.classList.add('timeline-animated');
          }, index * 100);
        }
      });
    }, observerOptions);

    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    // Animate the path on scroll
    const animatePath = () => {
      if (!pathRef.current || !timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrolled = window.scrollY;
      const elementTop = scrolled + rect.top;
      const elementHeight = rect.height;
      
      // Calculate how much of the timeline is visible
      const visibleStart = scrolled;
      const visibleEnd = scrolled + viewportHeight;
      
      // Calculate progress
      let progress = 0;
      if (visibleEnd > elementTop) {
        const distanceScrolled = visibleEnd - elementTop;
        progress = Math.min(1, distanceScrolled / elementHeight);
      }
      
      // Update the line
      const percentage = progress * 100;
      pathRef.current.style.strokeDasharray = `${percentage}% ${100 - percentage}%`;
    };

    window.addEventListener('scroll', animatePath);
    animatePath(); // Initial call

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', animatePath);
    };
  }, []);

  return (
    <section id="journey" className="relative py-32 px-6 bg-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-96 h-96 bg-gray-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-gray-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-96 h-96 bg-gray-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full mb-6">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Product Journey
            </span>
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-4">Your Path to Success</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Follow our proven journey from setup to scale
          </p>
        </div>

        {/* Desktop Timeline */}
        <div ref={timelineRef} className="hidden lg:block relative">
          {/* SVG Path */}
          <svg className="absolute left-1/2 top-0 w-4 h-full -ml-2 overflow-visible" style={{ zIndex: 0 }}>
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#111111" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#111111" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#111111" stopOpacity="0.9" />
              </linearGradient>
            </defs>
            {/* Base line - always visible */}
            <line
              x1="2"
              y1="0"
              x2="2"
              y2="100%"
              stroke="#E5E7EB"
              strokeWidth="2"
              opacity="0.5"
            />
            {/* Animated line */}
            <line
              ref={pathRef}
              x1="2"
              y1="0"
              x2="2"
              y2="100%"
              stroke="#111111"
              strokeWidth="3"
              strokeDasharray="0 100%"
              style={{ transition: 'stroke-dasharray 0.3s ease-out' }}
            />
          </svg>

          {/* Timeline Cards */}
          <div className="relative space-y-12">
            {timelineData.map((step, index) => (
              <div
                key={step.id}
                ref={el => cardsRef.current[index] = el}
                data-index={index}
                className={`timeline-card relative flex items-center ${
                  index % 2 === 0 ? 'justify-start' : 'justify-end'
                }`}
              >
                {/* Connection Node */}
                <div className={`absolute left-1/2 -ml-4 w-8 h-8 rounded-full shadow-lg z-10 transition-all duration-500 ${
                  activeCards.has(index) 
                    ? 'bg-gray-900 scale-110' 
                    : 'bg-gray-300 scale-100'
                }`}>
                  <div className={`w-full h-full rounded-full ${
                    activeCards.has(index) ? 'animate-pulse' : ''
                  }`} />
                </div>

                {/* Card */}
                <div className={`timeline-card-content w-5/12 ${
                  index % 2 === 0 ? 'mr-auto pr-12' : 'ml-auto pl-12'
                }`}>
                  <div className={`group relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border-2 ${
                    activeCards.has(index)
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-200'
                  }`}>
                    {/* Image */}
                    <div className="h-48 overflow-hidden border-b border-gray-200">
                      <img 
                        src={step.image} 
                        alt={step.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    {/* Content */}
                    <div className="p-8">
                      <h3 className={`text-2xl font-bold mb-1 transition-colors duration-500 ${
                        activeCards.has(index) ? 'text-white' : 'text-gray-900'
                      }`}>
                        {step.title}
                      </h3>
                      {step.subtitle && (
                        <p className={`text-sm font-semibold mb-3 transition-colors duration-500 ${
                          activeCards.has(index) ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {step.subtitle}
                        </p>
                      )}
                      <p className={`leading-relaxed transition-colors duration-500 ${
                        activeCards.has(index) ? 'text-gray-200' : 'text-gray-600'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* Mobile/Tablet Timeline */}
        <div className="lg:hidden relative">
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 scrollbar-hide">
            {timelineData.map((step, index) => (
              <div
                key={step.id}
                className="snap-center shrink-0 w-80"
              >
                <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 h-full">
                  {/* Image */}
                  <div className="h-32 overflow-hidden">
                    <img 
                      src={step.image} 
                      alt={step.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {step.title}
                    </h3>
                    {step.subtitle && (
                      <p className="text-sm text-gray-600 font-semibold mb-3">
                        {step.subtitle}
                      </p>
                    )}
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .timeline-card {
          opacity: 0;
          transform: translateY(30px);
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .timeline-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .timeline-animated .timeline-card-content {
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
};

export default AnimatedTimeline;
