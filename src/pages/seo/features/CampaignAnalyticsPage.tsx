import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BarChart3, ArrowRight, 
  CheckCircle, Eye, Heart, MessageCircle, Share2
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const CampaignAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();

  const metrics = [
    { icon: <Eye className="w-5 h-5" />, label: 'Views', description: 'Total and unique video views' },
    { icon: <Heart className="w-5 h-5" />, label: 'Likes', description: 'Engagement and reactions' },
    { icon: <MessageCircle className="w-5 h-5" />, label: 'Comments', description: 'Audience conversations' },
    { icon: <Share2 className="w-5 h-5" />, label: 'Shares', description: 'Viral spread tracking' }
  ];

  const features = [
    {
      title: 'Multi-Platform Dashboards',
      description: 'See Instagram, TikTok, YouTube, and X performance in one unified view. No more switching between apps.'
    },
    {
      title: 'Campaign-Level Reporting',
      description: 'Group creators and content by campaign. Track performance against goals and deadlines.'
    },
    {
      title: 'Creator Performance Rankings',
      description: 'Automatically rank your creators by views, engagement, and ROI. Identify top performers instantly.'
    },
    {
      title: 'Historical Trends',
      description: 'Track how campaigns perform over time. See growth curves, peak performance, and long-tail impact.'
    }
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
            <span className="text-gray-900">Campaign Analytics</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2282FF]/10 text-[#2282FF] rounded-full text-sm font-semibold mb-4">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Campaign Analytics for Influencer & UGC Programs
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Track performance across all your creator campaigns with real-time dashboards, 
                detailed metrics, and actionable insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/features/unified-kpis"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  See Unified KPIs
                </Link>
              </div>
            </div>

            {/* Visual */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {metrics.map((m) => (
                    <div key={m.label} className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-gray-400 flex justify-center mb-1">{m.icon}</div>
                      <div className="text-white font-bold text-lg">12.5K</div>
                      <div className="text-gray-500 text-xs">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-gray-700/30 rounded-lg h-32 flex items-end p-3">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 mx-0.5">
                      <div 
                        className="bg-[#2282FF] rounded-t"
                        style={{ height: `${h}%` }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Track Every Metric That Matters
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#2282FF]/10 flex items-center justify-center mx-auto mb-3 text-[#2282FF]">
                  {metric.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{metric.label}</h3>
                <p className="text-sm text-gray-500">{metric.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            Powerful Analytics Features
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Features */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Related Features
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/features/unified-kpis"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Unified KPIs →
            </Link>
            <Link
              to="/features/auto-refresh"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Auto-Refresh →
            </Link>
            <Link
              to="/features/link-tracking"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Link Tracking →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to See Your Campaign Analytics?
          </h2>
          <p className="text-gray-400 mb-8">
            Start tracking your creator campaigns today.
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

export default CampaignAnalyticsPage;

