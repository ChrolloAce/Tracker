import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BarChart3, TrendingUp, Shield, Zap, Users, Video,
  ArrowRight, Play, CheckCircle, Star
} from 'lucide-react';
import NavBar from '../../components/NavBar';
import Footer from '../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

const PlatformPage: React.FC = () => {
  const navigate = useNavigate();

  const platforms = [
    { name: 'Instagram', logo: instagramIcon, metrics: ['Reels', 'Stories', 'Posts'] },
    { name: 'TikTok', logo: tiktokIcon, metrics: ['Videos', 'Lives', 'Sounds'] },
    { name: 'YouTube', logo: youtubeIcon, metrics: ['Shorts', 'Videos', 'Streams'] },
    { name: 'X (Twitter)', logo: xLogo, metrics: ['Posts', 'Threads', 'Spaces'] }
  ];

  const capabilities = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Unified Analytics',
      description: 'Track views, engagement, and growth across all platforms in one dashboard. No more spreadsheet chaos.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Real-Time Performance',
      description: 'Auto-refreshing metrics keep you informed. See how campaigns perform as they happen.'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'No Password Sharing',
      description: 'Track any public account without credentials. Secure, compliant, and hassle-free.'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Revenue Attribution',
      description: 'Connect content to actual revenue with tracking links and integration with Apple, RevenueCat, and more.'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Creator Collaboration',
      description: 'Give creators their own portals with live performance data. Transparent, professional relationships.'
    },
    {
      icon: <Video className="w-6 h-6" />,
      title: 'UGC Workflows',
      description: 'Manage briefs, deliverables, and approvals all in one place. From concept to final asset.'
    }
  ];

  const testimonials = [
    {
      quote: "ViewTrack helped us scale from 10 to 200+ creator partnerships. The analytics are game-changing.",
      author: "Sarah M.",
      role: "Head of Growth, Mobile App",
      rating: 5
    },
    {
      quote: "Finally, a platform that understands what agencies need. Multi-client management is seamless.",
      author: "Mike R.",
      role: "Founder, UGC Agency",
      rating: 5
    },
    {
      quote: "We cut our reporting time by 80%. The unified dashboard is exactly what we needed.",
      author: "Jessica L.",
      role: "Marketing Director, DTC Brand",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#FAFAFB] to-transparent" />

        <div className="max-w-5xl mx-auto text-center relative">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight leading-tight">
            The Influencer Marketing Analytics Platform Built for Performance
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Track, measure, and optimize your creator campaigns across Instagram, TikTok, YouTube, and X. 
            From analytics to contracts, everything you need in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#2282FF]/25"
            >
              Start Tracking Now <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all flex items-center gap-2"
            >
              <Play className="w-5 h-5" /> Watch Demo
            </button>
          </div>

          {/* Platform Logos */}
          <div className="flex items-center justify-center gap-8 md:gap-12">
            {platforms.map((platform) => (
              <div key={platform.name} className="flex flex-col items-center gap-2">
                <img 
                  src={platform.logo} 
                  alt={platform.name} 
                  className="w-10 h-10 md:w-12 md:h-12 object-contain opacity-80 hover:opacity-100 transition-opacity" 
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Screenshot Placeholder */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {['Total Views', 'Engagement', 'New Videos', 'Revenue'].map((label) => (
                  <div key={label} className="bg-gray-700/50 rounded-xl p-4">
                    <div className="h-4 w-16 bg-gray-600 rounded mb-2"></div>
                    <div className="h-8 w-24 bg-gray-500 rounded"></div>
                  </div>
                ))}
              </div>
              <div className="bg-gray-700/30 rounded-xl h-48"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Scale Creator Marketing
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              ViewTrack combines analytics, campaign management, and collaboration tools in one powerful platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capabilities.map((cap, idx) => (
              <div key={idx} className="p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#2282FF]/10 flex items-center justify-center mb-4">
                  <div className="text-[#2282FF]">{cap.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{cap.title}</h3>
                <p className="text-gray-600">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built for Every Campaign Type
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Launch Campaigns',
                description: 'Flight massive creator pushes for app launches, product drops, or seasonal campaigns.',
                features: ['Bulk creator tracking', 'Real-time dashboards', 'Quick reporting']
              },
              {
                title: 'Always-On Programs',
                description: 'Manage ongoing ambassador and affiliate programs with continuous analytics.',
                features: ['Long-term tracking', 'Growth trends', 'Creator performance']
              },
              {
                title: 'UGC Production',
                description: 'Coordinate UGC creation from brief to final asset with built-in workflows.',
                features: ['Brief management', 'Approval flows', 'Asset library']
              }
            ].map((useCase) => (
              <div key={useCase.title} className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{useCase.title}</h3>
                <p className="text-gray-600 mb-4">{useCase.description}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Founders & Brands
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, idx) => (
              <div key={idx} className="bg-gray-50 rounded-2xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-gray-900">{t.author}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Creator Marketing?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of brands and agencies using ViewTrack.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#2282FF]/25"
            >
              Start Tracking Now <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/features"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-all"
            >
              Explore Features
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PlatformPage;

