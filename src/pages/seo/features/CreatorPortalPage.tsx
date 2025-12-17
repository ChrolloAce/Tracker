import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, Eye, Lock, Share2, ArrowRight, 
  CheckCircle, Shield
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const CreatorPortalFeaturePage: React.FC = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Live Performance Data',
      description: 'Creators see their views, engagement, and rankings in real-time.'
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'No Password Sharing',
      description: 'Secure access without sharing your platform credentials.'
    },
    {
      icon: <Share2 className="w-6 h-6" />,
      title: 'Easy Sharing',
      description: 'One-click invite links to onboard creators instantly.'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Permission Controls',
      description: 'Control exactly what data creators can see.'
    }
  ];

  const creatorFeatures = [
    'Personal performance dashboard',
    'Campaign participation view',
    'Earnings and payout tracking',
    'Content submission portal',
    'Direct messaging with brand',
    'Contract and agreement access'
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
            <span className="text-gray-900">Creator Portal</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
                <Users className="w-4 h-4" />
                Collaboration
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Creator Portal for Transparent, Live Performance Data
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Give your creators their own dashboard to see their performance. 
                Build trust with transparency—no password sharing required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Free <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/solutions/influencer-agencies"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  For Agencies
                </Link>
              </div>
            </div>

            {/* Portal Preview */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                    JD
                  </div>
                  <div>
                    <div className="text-white font-semibold">@janedoe</div>
                    <div className="text-white/60 text-sm">Creator Portal</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Total Views</div>
                    <div className="text-white font-bold text-xl">1.2M</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">This Week</div>
                    <div className="text-emerald-400 font-bold text-xl">+45K</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Campaigns</div>
                    <div className="text-white font-bold text-xl">3</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Rank</div>
                    <div className="text-yellow-400 font-bold text-xl">#2</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            Why Brands Love Creator Portals
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mx-auto mb-4 text-purple-600">
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Creator Features */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            What Creators See
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {creatorFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Build Better Creator Relationships
          </h2>
          <p className="text-gray-400 mb-8">
            Start sharing live performance data with your creators today.
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

export default CreatorPortalFeaturePage;

