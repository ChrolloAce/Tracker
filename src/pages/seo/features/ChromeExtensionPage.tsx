import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Chrome, Save, BarChart3, ArrowRight, 
  CheckCircle, Eye, TrendingUp
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const ChromeExtensionPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Instant Analytics',
      description: 'See engagement rates and avg views as you browse creator profiles.'
    },
    {
      icon: <Save className="w-6 h-6" />,
      title: 'Quick Save',
      description: 'Save interesting creators to your ViewTrack workspace with one click.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Performance Signals',
      description: 'Identify high-performing creators before you reach out.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Historical Data',
      description: 'See growth trends and consistency metrics at a glance.'
    }
  ];

  const platforms = [
    'TikTok profiles and videos',
    'Instagram profiles and Reels',
    'YouTube channels and Shorts',
    'X (Twitter) profiles'
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
            <span className="text-gray-900">Chrome Extension</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
                <Chrome className="w-4 h-4" />
                Browser Extension
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Analyze Creators in Real Time As You Browse
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                The ViewTrack Chrome Extension shows you creator analytics right on their 
                profile pages. Discover, analyze, and save—all without leaving the platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Get the Extension <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/start-tracking"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  Create Account First
                </Link>
              </div>
            </div>

            {/* Extension Preview */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500"></div>
                  <div>
                    <div className="font-bold text-gray-900">@creativecreator</div>
                    <div className="text-sm text-gray-500">1.2M followers</div>
                  </div>
                </div>
                <div className="bg-[#2282FF]/10 rounded-lg p-4 border border-[#2282FF]/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Chrome className="w-4 h-4 text-[#2282FF]" />
                    <span className="text-sm font-semibold text-[#2282FF]">ViewTrack Insights</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">Avg Views</div>
                      <div className="font-bold text-gray-900">245K</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Eng Rate</div>
                      <div className="font-bold text-gray-900">8.2%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Post Freq</div>
                      <div className="font-bold text-gray-900">3x/week</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Growth</div>
                      <div className="font-bold text-emerald-600">+12%</div>
                    </div>
                  </div>
                  <button className="w-full mt-3 py-2 bg-[#2282FF] text-white text-sm font-semibold rounded-lg">
                    Add to ViewTrack
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Works On
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {platforms.map((platform, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-700">{platform}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Related Features
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/start-tracking"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Create a ViewTrack account to use the extension →
            </Link>
            <Link
              to="/solutions/app-founders"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              How app founders discover creators →
            </Link>
            <Link
              to="/features/campaign-analytics"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Turn discovered creators into tracked campaigns →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Discover Your Next Top Creator
          </h2>
          <p className="text-gray-400 mb-8">
            Get the extension and start analyzing creators as you browse.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 mx-auto shadow-lg shadow-[#2282FF]/25"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChromeExtensionPage;

