import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Smartphone, Download, TrendingUp, DollarSign, ArrowRight, 
  CheckCircle, Target
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const AppFoundersPage: React.FC = () => {
  const navigate = useNavigate();

  const metrics = [
    { label: 'App Installs', description: 'Track installs driven by each creator' },
    { label: 'Trial Conversions', description: 'See who drives actual trial signups' },
    { label: 'MRR Attribution', description: 'Connect subscription revenue to creators' },
    { label: 'LTV by Source', description: 'Understand lifetime value by campaign' }
  ];

  const benefits = [
    {
      icon: <Download className="w-6 h-6" />,
      title: 'Track Installs',
      description: 'See exactly which creators and content drive app downloads.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Measure Growth',
      description: 'Track your creator campaigns against user acquisition goals.'
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: 'Revenue Attribution',
      description: 'Connect creator content to actual MRR with our integrations.'
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: 'Optimize Spend',
      description: 'Double down on creators that drive real business results.'
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
            <Link to="/solutions" className="hover:text-gray-700">Solutions</Link>
            <span>/</span>
            <span className="text-gray-900">App Founders</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-4">
                <Smartphone className="w-4 h-4" />
                For App Founders
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Scale Your App with Creator Marketing
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Track installs, trials, and revenue driven by influencer campaigns. 
                Built for founders who need to prove creator marketing ROI.
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
                  See Pricing
                </Link>
              </div>
            </div>

            {/* Visual */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="text-white/60 text-sm mb-2">Campaign Performance</div>
                <div className="text-white font-bold text-2xl mb-4">App Launch Q4</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Installs</div>
                    <div className="text-white font-bold text-xl">24.5K</div>
                    <div className="text-emerald-400 text-xs">+12% this week</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Trials</div>
                    <div className="text-white font-bold text-xl">8.2K</div>
                    <div className="text-emerald-400 text-xs">33% conversion</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">MRR</div>
                    <div className="text-emerald-400 font-bold text-xl">$12.4K</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">CAC</div>
                    <div className="text-white font-bold text-xl">$2.40</div>
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
            Built for App Growth Teams
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

      {/* Metrics */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Metrics That Matter for Apps
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900">{metric.label}</div>
                  <div className="text-sm text-gray-500">{metric.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Scale Your App?
          </h2>
          <p className="text-gray-400 mb-8">
            Join thousands of app founders using ViewTrack.
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

export default AppFoundersPage;

