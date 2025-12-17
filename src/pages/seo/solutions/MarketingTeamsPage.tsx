import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, LayoutDashboard, TrendingUp, ArrowRight, 
  CheckCircle, FileText
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const MarketingTeamsPage: React.FC = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      title: 'Executive Dashboards',
      description: 'Roll-up views for leadership with key KPIs at a glance.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Cross-Channel Analytics',
      description: 'See performance across all platforms and campaigns.'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Team Permissions',
      description: 'Control who sees what with role-based access.'
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Automated Reports',
      description: 'Schedule reports to stakeholders automatically.'
    }
  ];

  const useCases = [
    'Monthly performance reviews',
    'Campaign post-mortems',
    'Budget allocation decisions',
    'Creator performance rankings',
    'ROI reporting to leadership',
    'Cross-team collaboration'
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
            <Link to="/solutions" className="hover:text-gray-700">Solutions</Link>
            <span>/</span>
            <span className="text-gray-900">Marketing Teams</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
                <Users className="w-4 h-4" />
                For Marketing Teams
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Centralized Creator Analytics for In-House Teams
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Roll up influencer, UGC, and affiliate performance for leadership. 
                Unified reporting across all creator programs without the spreadsheets.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/resources/influencer-analytics-guide"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  Read Analytics Guide
                </Link>
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="text-white/60 text-sm mb-3">Q4 Creator Performance</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Total Reach</div>
                    <div className="text-white font-bold text-xl">12.4M</div>
                    <div className="text-emerald-400 text-xs">+18% vs Q3</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">ROAS</div>
                    <div className="text-white font-bold text-xl">3.8x</div>
                    <div className="text-emerald-400 text-xs">+0.4x vs Q3</div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-white/60 text-xs mb-2">Revenue by Channel</div>
                  <div className="flex gap-1 h-4">
                    <div className="bg-pink-400 rounded" style={{ width: '40%' }}></div>
                    <div className="bg-cyan-400 rounded" style={{ width: '35%' }}></div>
                    <div className="bg-yellow-400 rounded" style={{ width: '25%' }}></div>
                  </div>
                  <div className="flex justify-between mt-2 text-white/60 text-xs">
                    <span>TikTok</span>
                    <span>Instagram</span>
                    <span>YouTube</span>
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
            Built for Marketing Leaders
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600">
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Common Use Cases
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {useCases.map((useCase, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-700">{useCase}</span>
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
              to="/features/unified-kpis"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Roll up creator KPIs for leadership →
            </Link>
            <Link
              to="/features/campaign-analytics"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Drill into individual campaigns →
            </Link>
            <Link
              to="/resources/influencer-analytics-guide"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Learn best practices for creator reporting →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Unify Your Creator Analytics
          </h2>
          <p className="text-gray-400 mb-8">
            Stop juggling spreadsheets. Get one source of truth.
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

export default MarketingTeamsPage;

