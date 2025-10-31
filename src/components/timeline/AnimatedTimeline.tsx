import React, { useEffect, useRef } from 'react';
import { 
  Settings, 
  BarChart3, 
  TrendingUp, 
  DollarSign,
  Users,
  FileText,
  Globe,
  Link,
  Sparkles
} from 'lucide-react';

interface TimelineStep {
  id: number;
  title: string;
  subtitle?: string;
  description: string;
  icon: React.ReactNode;
}

const timelineData: TimelineStep[] = [
  {
    id: 1,
    title: "Easy Account Setup",
    subtitle: "In Seconds",
    description: "Simply add accounts and choose what content to track. Our streamlined setup delivers real-time data after your first sync.",
    icon: <Settings className="w-5 h-5" />
  },
  {
    id: 2,
    title: "Unified KPIs",
    subtitle: "& Powerful Filters",
    description: "Aggregate TikTok, Instagram, and YouTube metrics in one place. Use powerful filters to identify your best-performing content.",
    icon: <BarChart3 className="w-5 h-5" />
  },
  {
    id: 3,
    title: "Comprehensive Analytics",
    subtitle: "Dashboard",
    description: "Get a bird's-eye view of your performance with our intuitive dashboard. Track engagement, growth trends, and audience metrics all in one place.",
    icon: <TrendingUp className="w-5 h-5" />
  },
  {
    id: 4,
    title: "Track Your Conversion",
    subtitle: "ROI Insights",
    description: "Custom integrations like Apple's App Store Connect enable never-before-seen insights into content conversion and ROI. Identify which content really drives sales.",
    icon: <DollarSign className="w-5 h-5" />
  },
  {
    id: 5,
    title: "UGC & Influencer",
    subtitle: "Campaigns",
    description: "Create and manage creator campaigns with rewards and tracking.",
    icon: <Users className="w-5 h-5" />
  },
  {
    id: 6,
    title: "Contracts",
    subtitle: "& Creator Portals",
    description: "All-in-one solution for creator agreements and collaboration.",
    icon: <FileText className="w-5 h-5" />
  },
  {
    id: 7,
    title: "Chrome Extension",
    subtitle: "Browser Research",
    description: "Research and discover content directly from your browser.",
    icon: <Globe className="w-5 h-5" />
  },
  {
    id: 8,
    title: "Track Links",
    subtitle: "Bio Link Analytics",
    description: "Monitor click-through rates and conversion from your bio links.",
    icon: <Link className="w-5 h-5" />
  }
];

const AnimatedTimeline: React.FC = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('timeline-visible');
          // Add staggered animation
          const index = Number(entry.target.getAttribute('data-index'));
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
      
      const scrollProgress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      const pathLength = pathRef.current.getTotalLength();
      const drawLength = pathLength * Math.min(scrollProgress * 2, 1); // Speed up the drawing
      
      pathRef.current.style.strokeDasharray = `${drawLength} ${pathLength}`;
    };

    window.addEventListener('scroll', animatePath);
    animatePath(); // Initial call

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', animatePath);
    };
  }, []);

  return (
    <section id="journey" className="relative py-32 px-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-20 left-10 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
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
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path
              ref={pathRef}
              d={`M 8 0 Q 8 100 ${timelineData.length % 2 === 0 ? -50 : 66} 150 T 8 ${150 * (timelineData.length - 1)} L 8 ${150 * timelineData.length}`}
              stroke="url(#pathGradient)"
              strokeWidth="3"
              fill="none"
              filter="url(#glow)"
              className="path-animation"
              strokeDasharray="0 9999"
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
                <div className="absolute left-1/2 -ml-3 w-6 h-6 bg-white rounded-full border-3 border-gradient shadow-lg z-10">
                  <div className="w-full h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 animate-pulse-slow" />
                </div>

                {/* Card */}
                <div className={`timeline-card-content w-5/12 ${
                  index % 2 === 0 ? 'mr-auto pr-12' : 'ml-auto pl-12'
                }`}>
                  <div className="group relative bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-emerald-200">
                    {/* Icon */}
                    <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <div className="text-white">
                        {step.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="pt-2">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">
                        {step.title}
                      </h3>
                      {step.subtitle && (
                        <p className="text-sm text-emerald-600 font-semibold mb-3">
                          {step.subtitle}
                        </p>
                      )}
                      <p className="text-gray-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    {/* Hover Effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/0 to-blue-400/0 group-hover:from-emerald-400/10 group-hover:to-blue-400/10 transition-all duration-500" />
                  </div>
                </div>
              </div>
            ))}

            {/* Launch Node */}
            <div className="relative flex items-center justify-center pt-12">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-purple-600 rounded-full blur-xl animate-pulse-slow" />
                <div className="relative w-24 h-24 bg-gradient-to-r from-emerald-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
                  <Sparkles className="w-10 h-10 text-white animate-spin-slow" />
                </div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-purple-600 bg-clip-text text-transparent">
                    Launch
                  </span>
                </div>
              </div>
            </div>
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
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-gray-100 h-full">
                  {/* Icon */}
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg mb-4">
                    <div className="text-white">
                      {step.icon}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {step.title}
                  </h3>
                  {step.subtitle && (
                    <p className="text-sm text-emerald-600 font-semibold mb-3">
                      {step.subtitle}
                    </p>
                  )}
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Launch Card */}
            <div className="snap-center shrink-0 w-80">
              <div className="bg-gradient-to-br from-emerald-500 to-purple-600 rounded-2xl p-6 shadow-xl h-full flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-white mx-auto mb-4 animate-spin-slow" />
                  <span className="text-2xl font-bold text-white">
                    Launch Your Success
                  </span>
                </div>
              </div>
            </div>
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
