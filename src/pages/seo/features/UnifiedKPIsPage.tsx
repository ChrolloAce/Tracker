import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, TrendingUp, Filter, ArrowRight, 
  CheckCircle, BarChart3, Layers
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const UnifiedKPIsPage: React.FC = () => {
  const navigate = useNavigate();

  const kpis = [
    { label: 'Total Views', description: 'Aggregate views across all platforms' },
    { label: 'Engagement Rate', description: 'Combined likes, comments, shares' },
    { label: 'Revenue', description: 'Attributed sales and conversions' },
    { label: 'ROAS', description: 'Return on ad spend by campaign' },
    { label: 'CPA', description: 'Cost per acquisition tracking' },
    { label: 'Growth Rate', description: 'Week-over-week performance trends' }
  ];

  const features = [
    {
      icon: <Layers className="w-6 h-6" />,
      title: 'Cross-Platform Aggregation',
      description: 'Combine metrics from Instagram, TikTok, YouTube, and X into unified totals.'
    },
    {
      icon: <Filter className="w-6 h-6" />,
      title: 'Smart Filtering',
      description: 'Filter by campaign, creator, platform, date range, or custom segments.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Trend Analysis',
      description: 'See how your KPIs change over time with visual trend lines.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Customizable Tiles',
      description: 'Drag and drop to build your perfect dashboard layout.'
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
            <span className="text-gray-900">Unified KPIs</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2282FF]/10 text-[#2282FF] rounded-full text-sm font-semibold mb-4">
                <LayoutDashboard className="w-4 h-4" />
                Analytics
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Unified KPIs Across Every Creator and Campaign
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                One dashboard for all your creator campaigns. Roll up views, engagement, 
                and revenue across every platform in a single view.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/features/campaign-analytics"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  See Campaign Analytics
                </Link>
              </div>
            </div>

            {/* KPI Dashboard Preview */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 shadow-2xl">
              <div className="grid grid-cols-3 gap-3">
                {['1.2M', '4.8%', '$24K', '3.2x', '$2.40', '+18%'].map((value, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="text-gray-400 text-xs mb-1">{kpis[idx]?.label}</div>
                    <div className="text-white font-bold text-xl">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-gray-800/30 rounded-xl h-24 flex items-end p-3">
                {[30, 45, 35, 60, 50, 75, 65, 80, 70, 90].map((h, i) => (
                  <div key={i} className="flex-1 mx-0.5">
                    <div 
                      className="bg-gradient-to-t from-[#2282FF] to-[#2282FF]/50 rounded-t"
                      style={{ height: `${h}%` }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            Everything in One Place
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

      {/* KPI List */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Default KPI Tiles
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900">{kpi.label}</div>
                  <div className="text-xs text-gray-500">{kpi.description}</div>
                </div>
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
              to="/features/campaign-analytics"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Drill down from KPIs into campaigns →
            </Link>
            <Link
              to="/solutions/marketing-teams"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Unified dashboards for marketing teams →
            </Link>
            <Link
              to="/pricing"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Compare KPI features by tier →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Unify Your Analytics?
          </h2>
          <p className="text-gray-400 mb-8">
            See all your creator KPIs in one dashboard.
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

export default UnifiedKPIsPage;

