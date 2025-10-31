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
    <div className="min-h-screen bg-white">
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

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>5 tracked videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>1 tracked account</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Basic analytics</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 border-2 border-gray-300 text-gray-900 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Basic Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$24</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>50 tracked videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>10 tracked accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Advanced analytics</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors"
              >
                Start Free Trial
              </button>
            </div>

            {/* Pro Plan - Highlighted */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-8 border-2 border-emerald-500 shadow-xl relative transform scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-sm font-bold rounded-full">
                Popular
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">$79</span>
                  <span className="text-emerald-100">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-white">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span>100 tracked videos</span>
                </li>
                <li className="flex items-center gap-2 text-white">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-white">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span>Campaign management</span>
                </li>
                <li className="flex items-center gap-2 text-white">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span>Revenue tracking</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 bg-white hover:bg-gray-100 text-emerald-600 font-semibold rounded-xl transition-colors"
              >
                Start Free Trial
              </button>
            </div>

            {/* Ultra Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ultra</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$199</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited videos</span>
                </li>
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
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Priority support</span>
                </li>
              </ul>
              <button
                onClick={handleGetStarted}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors"
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

