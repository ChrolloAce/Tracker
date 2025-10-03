import React from 'react';
import { TrendingUp, BookOpen, Play, Users, Star, BarChart3, Link as LinkIcon, Filter, Eye } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">ViewTrack</span>
            </div>
            <button
              onClick={onGetStarted}
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
                  From Instagram to TikTok to YouTube, we track every view, like, and share across your content. 
                  Grow your social presence on autopilot.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={onGetStarted}
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

            {/* Right Column - Dashboard Preview */}
            <div className="relative">
              <div className="space-y-4">
                {/* Dashboard Card */}
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                    <span className="text-xs text-gray-500">Last 24 hours</span>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">Views</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-900">124.5K</p>
                      <p className="text-xs text-blue-600 mt-1">↑ 23% today</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">Engagement</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-900">18.2%</p>
                      <p className="text-xs text-purple-600 mt-1">↑ 5% today</p>
                    </div>
                  </div>

                  {/* Video List */}
                  <div className="space-y-3">
                    {[
                      { title: 'Summer Vibes 2024', views: '45.2K', platform: 'instagram', color: 'pink' },
                      { title: 'Behind the Scenes', views: '32.8K', platform: 'tiktok', color: 'blue' },
                      { title: 'Tutorial: Quick Tips', views: '28.1K', platform: 'youtube', color: 'red' },
                    ].map((video, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className={`w-10 h-10 bg-gradient-to-br from-${video.color}-400 to-${video.color}-600 rounded-lg`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{video.title}</p>
                          <p className="text-xs text-gray-500">{video.views} views</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs text-gray-500">Live</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Feature Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                      <LinkIcon className="w-4 h-4 text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">Link Tracking</h4>
                    <p className="text-xs text-gray-500">Monitor every click</p>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                      <Filter className="w-4 h-4 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">Smart Rules</h4>
                    <p className="text-xs text-gray-500">Auto-filter content</p>
                  </div>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -z-10 top-1/4 -right-12 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
              <div className="absolute -z-10 bottom-1/4 -left-12 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Everything you need to grow</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track, analyze, and optimize your social media presence with powerful tools designed for creators.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Eye,
                title: 'Multi-Platform Tracking',
                description: 'Track Instagram, TikTok, and YouTube videos from a single dashboard.',
                color: 'blue',
              },
              {
                icon: LinkIcon,
                title: 'Link Analytics',
                description: 'Create branded short links and track every click with detailed analytics.',
                color: 'purple',
              },
              {
                icon: Filter,
                title: 'Smart Rules',
                description: 'Set up automated filters to organize and prioritize your content.',
                color: 'orange',
              },
              {
                icon: TrendingUp,
                title: 'Real-Time Insights',
                description: 'Get instant updates on your content performance across all platforms.',
                color: 'green',
              },
              {
                icon: Users,
                title: 'Account Tracking',
                description: 'Monitor entire social media accounts and track all their videos automatically.',
                color: 'pink',
              },
              {
                icon: BarChart3,
                title: 'Beautiful Reports',
                description: 'Visualize your growth with stunning charts and comprehensive analytics.',
                color: 'indigo',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
              >
                <div className={`w-12 h-12 bg-${feature.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}-600`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
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
              onClick={onGetStarted}
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
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">ViewTrack</span>
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

