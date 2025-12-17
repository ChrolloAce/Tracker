import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Link2, Target, DollarSign, MousePointer, ArrowRight, 
  CheckCircle, BarChart3, TrendingUp
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const LinkTrackingPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <MousePointer className="w-6 h-6" />,
      title: 'Click Tracking',
      description: 'See exactly how many people click your creator links with real-time analytics.'
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: 'Conversion Attribution',
      description: 'Connect clicks to actual conversions—installs, signups, or purchases.'
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: 'Revenue Attribution',
      description: 'Track revenue back to specific creators and content pieces.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Performance Reports',
      description: 'Generate reports showing which creators and content drive the most ROI.'
    }
  ];

  const useCases = [
    'Bio link tracking for creators',
    'Campaign-specific landing pages',
    'Promo code attribution',
    'Affiliate program management',
    'A/B testing creator messaging',
    'Multi-touch attribution'
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Breadcrumb */}
      <div className="pt-24 px-6">
        <div className="max-w-6xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-gray-700">Home</Link>
            <span>/</span>
            <Link to="/features" className="hover:text-gray-700">Features</Link>
            <span>/</span>
            <span className="text-gray-900">Link Tracking</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-4">
                <Link2 className="w-4 h-4" />
                Attribution
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Link Tracking that Connects Creators to Revenue
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Go beyond vanity metrics. Create custom tracking links to attribute clicks, 
                conversions, and revenue directly to specific creators and content.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/pricing"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  View Pricing
                </Link>
              </div>
            </div>

            {/* Visual - Link Flow Diagram */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <span className="text-2xl">🎬</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">Creator Posts</div>
                    <div className="font-semibold text-gray-900">TikTok Video</div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <TrendingUp className="w-6 h-6 text-gray-300 rotate-90" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Link2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">ViewTrack Link</div>
                    <div className="font-mono text-sm text-[#2282FF]">vt.link/creator123</div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <TrendingUp className="w-6 h-6 text-gray-300 rotate-90" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">Conversion</div>
                    <div className="font-semibold text-emerald-600">$49 Sale Attributed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            Complete Attribution Suite
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-[#2282FF]/10 flex items-center justify-center mx-auto mb-4 text-[#2282FF]">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Use Cases
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {useCases.map((useCase, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-700">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Measuring Real ROI
          </h2>
          <p className="text-gray-400 mb-8">
            Connect your creator content to actual revenue.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 mx-auto shadow-lg shadow-[#2282FF]/25"
          >
            Start Tracking Now <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LinkTrackingPage;

