import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShoppingBag, DollarSign, TrendingUp, Tag, ArrowRight, 
  CheckCircle, Target
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const DTCBrandsPage: React.FC = () => {
  const navigate = useNavigate();

  const metrics = [
    { label: 'Revenue Attribution', description: 'Track sales driven by each creator' },
    { label: 'ROAS Tracking', description: 'Measure return on creator spend' },
    { label: 'AOV Analysis', description: 'See average order value by campaign' },
    { label: 'Promo Code Analytics', description: 'Track performance of creator codes' }
  ];

  const benefits = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: 'Revenue Tracking',
      description: 'See exactly which creators and content drive actual sales.'
    },
    {
      icon: <Tag className="w-6 h-6" />,
      title: 'Promo Codes',
      description: 'Track performance of discount codes assigned to creators.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'ROAS Measurement',
      description: 'Calculate return on ad spend for every creator partnership.'
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: 'Optimize Campaigns',
      description: 'Double down on what works based on real revenue data.'
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
            <span className="text-gray-900">DTC Brands</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-4">
                <ShoppingBag className="w-4 h-4" />
                For DTC & Ecommerce
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Measure Creator-Driven Revenue for DTC Brands
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Connect influencer content to actual sales. Track AOV, ROAS, and 
                customer acquisition across all your creator partnerships.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/features/link-tracking"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  See Link Tracking
                </Link>
              </div>
            </div>

            {/* Visual */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="text-white/60 text-sm mb-2">Campaign: Summer Collection</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Revenue</div>
                    <div className="text-white font-bold text-xl">$84.2K</div>
                    <div className="text-emerald-300 text-xs">+24% vs goal</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Orders</div>
                    <div className="text-white font-bold text-xl">1,247</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">ROAS</div>
                    <div className="text-emerald-300 font-bold text-xl">4.2x</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">AOV</div>
                    <div className="text-white font-bold text-xl">$67.50</div>
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
            Built for Ecommerce Growth
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

      {/* Metrics */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Ecommerce Metrics That Matter
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
            Ready to Measure Creator ROI?
          </h2>
          <p className="text-gray-400 mb-8">
            Start tracking your creator-driven revenue today.
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

export default DTCBrandsPage;

