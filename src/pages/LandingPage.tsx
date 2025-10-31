import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, BookOpen, Star, Play, Heart, MessageCircle, Share2, Video, UserPlus } from 'lucide-react';
import blackLogo from '../components/blacklogo.png';
import dashboardImg from '/dashboard.png';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={blackLogo} alt="ViewTrack" className="h-10 w-auto" />
            </div>
            <button
              onClick={handleGetStarted}
              className="px-6 py-2.5 text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Ultra Detailed Design */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Dotted Background Pattern */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="flex items-center justify-center min-h-[600px]">
            {/* Central Content Column */}
            <div className="relative max-w-2xl mx-auto text-center">
              {/* Logo Mark - 4 Circles */}
              <div className="flex items-center justify-center mb-12">
                <div className="grid grid-cols-2 gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-900 to-black shadow-sm"></div>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 shadow-sm"></div>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-sm"></div>
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 shadow-sm"></div>
                </div>
              </div>

              {/* Main Headline - Two Lines */}
              <div className="space-y-1 mb-8">
                <h1 className="text-6xl font-extrabold text-[#111111] leading-[1.1] tracking-tight">
                  Think, plan, and track
                </h1>
                <h2 className="text-[56px] font-normal text-[#9B9B9B] leading-[1.1] tracking-tight">
                  all in one place
                </h2>
              </div>

              {/* Supporting Sentence */}
              <p className="text-lg text-[#666666] mb-10 tracking-wide">
                Efficiently manage your tasks and boost productivity.
              </p>

              {/* CTA Button */}
              <button
                onClick={handleGetStarted}
                className="px-9 py-4 bg-gradient-to-r from-[#007BFF] to-[#2583FF] hover:from-[#0066DD] hover:to-[#1E6FDD] text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 text-base"
              >
                Get free demo
              </button>

              {/* Floating Cards Around Central Content */}
              
              {/* Top-Left: Yellow Sticky Note */}
              <div className="absolute -left-48 -top-12 transform -rotate-6 hidden lg:block">
                <div className="relative w-36 h-36 bg-gradient-to-br from-[#FFF47D] to-[#FFED4E] rounded-sm shadow-xl" style={{clipPath: 'polygon(0 0, 100% 0, 98% 98%, 0 100%)'}}>
                  {/* Pushpin */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-md"></div>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-3 bg-gradient-to-b from-gray-400 to-gray-500"></div>
                  
                  {/* Handwritten Text */}
                  <div className="p-4 pt-6 text-left">
                    <p className="text-xs leading-relaxed text-gray-700" style={{fontFamily: 'cursive'}}>
                      Take notes to keep<br/>
                      track of crucial details,<br/>
                      and accomplish more<br/>
                      tasks with ease.
                    </p>
                  </div>
                  
                  {/* Blue Checkmark Badge */}
                  <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-[#007BFF] rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white text-lg font-bold">✓</span>
                  </div>
                </div>
              </div>

              {/* Top-Right: Reminder Card */}
              <div className="absolute -right-40 -top-8 transform rotate-3 hidden lg:block">
                <div className="relative w-48 h-32 bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reminders</p>
                  <p className="text-sm font-bold text-gray-900 mb-1">Today's Meeting</p>
                  <p className="text-xs text-gray-600">12:00–12:35</p>
                  
                  {/* Clock Icon */}
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border-2 border-gray-300 shadow-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bottom-Left: Task List Widget */}
              <div className="absolute -left-52 bottom-0 transform -rotate-2 hidden lg:block">
                <div className="w-52 bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-gray-200 p-5">
                  <p className="text-sm font-semibold text-gray-900 mb-4">Today's tasks</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-700 mb-1">New ideas for campaign</p>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-700 mb-1">Design PPT Kit</p>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full w-1/2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom-Right: Integrations Card */}
              <div className="absolute -right-48 bottom-4 transform rotate-2 hidden lg:block">
                <div className="w-44 bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-blue-100 p-5">
                  <p className="text-xs font-semibold text-gray-500 mb-4">100+ Integrations</p>
                  <div className="flex items-center gap-3">
                    {/* Gmail Icon */}
                    <div className="w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center transform hover:-translate-y-1 transition-transform">
                      <div className="w-8 h-6 bg-gradient-to-br from-red-500 to-red-600 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs font-bold">M</span>
                      </div>
                    </div>
                    
                    {/* Google Calendar Icon */}
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md flex items-center justify-center transform hover:-translate-y-1 transition-transform">
                      <span className="text-white text-xl font-bold">31</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Original Stats Section Removed - Replaced with Hero */}
      
      {/* Metrics Section Removed - Integrated into Hero */}

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Column - Marketing Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                  Track unlimited videos
                </span>
              </div>

              {/* Main Headline */}
              <div className="space-y-4">
                <h1 className="text-6xl font-bold text-gray-900 leading-tight">
                  Fueling growth
                  <span className="inline-flex items-center mx-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                      <TrendingUp className="w-7 h-7 text-white" />
                    </div>
                  </span>
                  with every click.
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                  Track your views, conversions and creators to drive more revenue.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleGetStarted}
                  className="px-8 py-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Start tracking now
                </button>
                <button
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                >
                  <BookOpen className="w-5 h-5" />
                  Learn more
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-8 pt-4">
                <div className="flex items-center">
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white"></div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-white"></div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-white"></div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-white flex items-center justify-center">
                      <span className="text-xs font-bold text-white">+50</span>
                    </div>
                  </div>
                  <span className="ml-4 text-sm text-gray-600">Trusted by creators</span>
                </div>
                
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide mt-1">
                    Rated Excellent: 5/5
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Dashboard Screenshot */}
            <div className="relative">
              <div className="relative">
                {/* Dashboard Image */}
                <div className="rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
                  <img 
                    src={dashboardImg} 
                    alt="ViewTrack Dashboard" 
                    className="w-full h-auto"
                  />
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -z-10 top-1/4 -right-12 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
              <div className="absolute -z-10 bottom-1/4 -left-12 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section - 6 KPI Cards */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Real Results, Real Growth</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track the metrics that matter and watch your influence grow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Play,
                title: 'Views',
                value: '461.9M',
                growth: '+461.9M',
                color: 'from-emerald-500 to-emerald-600',
                strokeColor: '#10b981',
              },
              {
                icon: Heart,
                title: 'Likes',
                value: '13.4M',
                growth: '+13.4M',
                color: 'from-pink-500 to-pink-600',
                strokeColor: '#ec4899',
              },
              {
                icon: MessageCircle,
                title: 'Comments',
                value: '394.7K',
                growth: '+394.7K',
                color: 'from-blue-500 to-blue-600',
                strokeColor: '#3b82f6',
              },
              {
                icon: Share2,
                title: 'Shares',
                value: '28.6K',
                growth: '+28.6K',
                color: 'from-purple-500 to-purple-600',
                strokeColor: '#a855f7',
              },
              {
                icon: Video,
                title: 'Videos',
                value: '341',
                growth: '+341',
                color: 'from-orange-500 to-orange-600',
                strokeColor: '#f97316',
              },
              {
                icon: UserPlus,
                title: 'Accounts',
                value: '30',
                growth: '+30',
                color: 'from-indigo-500 to-indigo-600',
                strokeColor: '#6366f1',
              },
            ].map((metric, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${metric.color} rounded-lg flex items-center justify-center shadow-lg`}>
                      <metric.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{metric.title}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-white">{metric.value}</h3>
                    <span className="text-sm font-semibold text-emerald-400">{metric.growth}</span>
                  </div>
                  
                  {/* Mini Graph */}
                  <div className="h-16 w-full">
                    <svg className="w-full h-full" viewBox="0 0 200 50" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={metric.strokeColor} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={metric.strokeColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M0,${30 + Math.random() * 10} L${40},${25 + Math.random() * 15} L${80},${20 + Math.random() * 10} L${120},${15 + Math.random() * 15} L${160},${10 + Math.random() * 10} L200,${5 + Math.random() * 10}`}
                        fill="none"
                        stroke={metric.strokeColor}
                        strokeWidth="2"
                      />
                      <path
                        d={`M0,${30 + Math.random() * 10} L${40},${25 + Math.random() * 15} L${80},${20 + Math.random() * 10} L${120},${15 + Math.random() * 15} L${160},${10 + Math.random() * 10} L200,${5 + Math.random() * 10} L200,50 L0,50 Z`}
                        fill={`url(#gradient-${index})`}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Benefits Sections - Horizontal with Images */}
      
      {/* 1. Easy Account Setup */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">Easy Account Setup in Seconds</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Simply add accounts and choose what content to track. Our streamlined setup delivers real-time data after your first sync.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-2 shadow-xl border border-gray-200">
              <img src={dashboardImg} alt="Dashboard" className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Unified KPIs */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-white rounded-2xl p-2 shadow-xl border border-gray-200">
              <img src={dashboardImg} alt="Analytics" className="w-full rounded-xl" />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">Unified KPIs & Powerful Filters</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Aggregate TikTok, Instagram, and YouTube metrics in one place. Use powerful filters to identify your best-performing content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Comprehensive Analytics */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">Comprehensive Analytics Dashboard</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Get a bird's-eye view of your performance with our intuitive dashboard. Track engagement, growth trends, and audience metrics all in one place.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-2 shadow-xl border border-gray-200">
              <img src={dashboardImg} alt="Analytics Dashboard" className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Track Your Conversion */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-white rounded-2xl p-2 shadow-xl border border-gray-200">
              <img src={dashboardImg} alt="Conversion Tracking" className="w-full rounded-xl" />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">Track Your Conversion</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Custom integrations like Apple's App Store Connect enable never-before-seen insights into content conversion and the ROI of your organic marketing. Identify which content really drives sales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">All-in-One Platform</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* UGC Campaigns */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">UGC & Influencer Campaigns</h3>
              <p className="text-gray-600">Create and manage creator campaigns with rewards and tracking.</p>
            </div>

            {/* Contracts & Portals */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Contracts & Creator Portals</h3>
              <p className="text-gray-600">All-in-one solution for creator agreements and collaboration.</p>
            </div>

            {/* Chrome Extension */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Play className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Chrome Extension</h3>
              <p className="text-gray-600">Research and discover content directly from your browser.</p>
            </div>

            {/* Track Links */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                <Share2 className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Track Links</h3>
              <p className="text-gray-600">Monitor click-through rates and conversion from your bio links.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">Choose the perfect plan for your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Basic Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$24</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Track 3 accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 100 videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>24-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>App Store integration</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>1 team seat</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto"
              >
                Start Free Trial
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow relative flex flex-col">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-600 text-white text-sm font-bold rounded-full">
                Popular
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$79</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 1,000 videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>24-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>On-demand refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator campaigns</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Revenue tracking</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>1 team seat</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto"
              >
                Start Free Trial
              </button>
            </div>

            {/* Ultra Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ultra</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$199</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 5,000 videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>12-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>On-demand refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator portals</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Contract management</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>20 team seats</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 shadow-2xl">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to track your growth?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join creators who are scaling their social presence with ViewTrack.
            </p>
            <button
              onClick={handleGetStarted}
              className="px-10 py-4 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Get Started for Free
            </button>
            <p className="text-sm text-gray-400 mt-4">No credit card required • Start in 2 minutes</p>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Our Blog</h2>
            <p className="text-xl text-gray-600">Insights, Tools, and More</p>
            <p className="text-gray-500 mt-2">Become an expert in UGC marketing today leveraging our industry knowledge and unique tools</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Blog Post 1 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
              <div className="h-48 bg-gradient-to-br from-emerald-500 to-teal-500"></div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Felix Vemmer</p>
                    <p className="text-xs text-gray-500">Sep 30, 2025</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Introducing the viral.app API</h3>
                <p className="text-gray-600">Build custom workflows and integrations with programmatic access to your analytics</p>
              </div>
            </div>

            {/* Blog Post 2 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
              <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-500"></div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Mike Schneider</p>
                    <p className="text-xs text-gray-500">Sep 10, 2025</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Individual Video Analytics & Daily Breakdowns</h3>
                <p className="text-gray-600">Track how single videos go viral with detailed performance insights and daily top performer breakdowns</p>
              </div>
            </div>

            {/* Blog Post 3 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
              <div className="h-48 bg-gradient-to-br from-orange-500 to-red-500"></div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Mike Schneider</p>
                    <p className="text-xs text-gray-500">May 19, 2025</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Launching viral.app</h3>
                <p className="text-gray-600">UGC-Marketing with the ultimate growth-pilot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">FAQ</h2>
            <p className="text-xl text-gray-600">Common Questions</p>
            <p className="text-gray-500 mt-2">We're here to help you get the most out of viral.app</p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What is viral.app?",
                answer: "viral.app is a comprehensive analytics platform for tracking social media content across Instagram, TikTok, and YouTube. We help creators and brands measure performance, manage campaigns, and optimize their content strategy."
              },
              {
                question: "Who is viral.app for?",
                answer: "Our platform is designed for content creators, influencers, UGC creators, marketing agencies, and brands who need professional analytics and campaign management tools."
              },
              {
                question: "How does viral.app help optimize marketing ROI?",
                answer: "We provide revenue tracking integrations with Apple App Store and RevenueCat, allowing you to see which content drives actual sales and conversions, not just vanity metrics."
              },
              {
                question: "What platforms can I track content from?",
                answer: "Currently we support Instagram, TikTok, and YouTube. We automatically sync your content and provide unified analytics across all platforms."
              },
              {
                question: "How easy is it to set up and add accounts?",
                answer: "Setup takes less than 2 minutes. Simply add the social media accounts you want to track, and we'll start syncing your data immediately."
              },
              {
                question: "What kind of analytics does viral.app provide?",
                answer: "We provide comprehensive metrics including views, likes, comments, shares, engagement rates, growth trends, top performers, posting schedules, and revenue attribution."
              }
            ].map((faq, index) => (
              <details key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
                <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  <span>{faq.question}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Have more questions?</p>
            <a 
              href="mailto:support@viral.app"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <img src={blackLogo} alt="ViewTrack" className="h-8 w-auto" />
            </div>
            <p className="text-sm text-gray-500">
              © 2025 ViewTrack. Track smarter, grow faster.
            </p>
          </div>
        </div>
      </footer>

      {/* CSS for animations */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;

