import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  RefreshCw, Clock, Zap, Bell, ArrowRight, 
  BarChart3
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const AutoRefreshPage: React.FC = () => {
  const navigate = useNavigate();

  const refreshTiers = [
    { plan: 'Starter', frequency: '24 hours', description: 'Daily metric updates' },
    { plan: 'Pro', frequency: '24 hours', description: 'Daily metric updates' },
    { plan: 'Enterprise', frequency: '12 hours', description: 'Twice-daily updates' }
  ];

  const benefits = [
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Always Current',
      description: 'Your dashboards update automatically—no manual refreshing needed.'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'On-Demand Sync',
      description: 'Need fresher data? Trigger a manual sync anytime.'
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: 'Refresh Logs',
      description: 'See exactly when each account was last synced.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Real Decisions',
      description: 'Make campaign decisions based on current performance.'
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
            <span className="text-gray-900">Auto-Refresh</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-4">
                <RefreshCw className="w-4 h-4" />
                Data Freshness
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Always-On, Auto-Refreshing Influencer Metrics
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Your data stays fresh automatically. ViewTrack syncs your creator metrics 
                on a schedule so you always have current performance data.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/influencer-marketing-analytics-platform"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  See Platform Overview
                </Link>
              </div>
            </div>

            {/* Refresh Animation */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-8 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-white font-semibold">Last Sync</div>
                  <div className="text-emerald-300 text-sm">2 hours ago</div>
                </div>
                <div className="flex items-center justify-center mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-white animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                </div>
                <div className="text-center text-white/80 text-sm">
                  Next sync in <span className="text-white font-bold">10 hours</span>
                </div>
                <div className="mt-4 w-full bg-white/10 rounded-full h-2">
                  <div className="bg-emerald-400 h-2 rounded-full" style={{ width: '58%' }}></div>
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
            Why Auto-Refresh Matters
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Refresh Tiers */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Refresh Frequency by Plan
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {refreshTiers.map((tier, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-all">
                <div className="text-lg font-bold text-gray-900 mb-2">{tier.plan}</div>
                <div className="text-3xl font-bold text-[#2282FF] mb-2">{tier.frequency}</div>
                <div className="text-sm text-gray-500">{tier.description}</div>
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
              to="/influencer-marketing-analytics-platform"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              See how auto-refresh powers the platform →
            </Link>
            <Link
              to="/features/campaign-analytics"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Real-time campaign analytics →
            </Link>
            <Link
              to="/solutions/app-founders"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Real-time metrics for app launches →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Get Always-Fresh Analytics
          </h2>
          <p className="text-gray-400 mb-8">
            Start tracking with automatic data refreshes.
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

export default AutoRefreshPage;

