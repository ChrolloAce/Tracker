import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Smartphone, ShoppingBag, Building2, Users, 
  ArrowRight, Target, TrendingUp, BarChart3 
} from 'lucide-react';
import NavBar from '../../components/NavBar';
import Footer from '../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

interface Solution {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  metrics: string[];
  color: string;
}

const SolutionsPage: React.FC = () => {
  const navigate = useNavigate();

  const solutions: Solution[] = [
    {
      id: 'app-founders',
      title: 'App Founders',
      subtitle: 'Scale your app with creator marketing',
      description: 'Track installs, trials, and subscriptions driven by influencer campaigns. Connect content performance to actual MRR.',
      icon: <Smartphone className="w-8 h-8" />,
      href: '/solutions/app-founders',
      metrics: ['App installs', 'Trial conversions', 'MRR attribution'],
      color: 'from-purple-500 to-indigo-600'
    },
    {
      id: 'dtc-brands',
      title: 'DTC & Ecommerce',
      subtitle: 'Measure creator-driven revenue',
      description: 'Connect influencer content to actual sales. Track AOV, ROAS, and customer acquisition across all your creator partnerships.',
      icon: <ShoppingBag className="w-8 h-8" />,
      href: '/solutions/dtc-brands',
      metrics: ['Revenue attribution', 'ROAS tracking', 'Promo code analytics'],
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'influencer-agencies',
      title: 'Agencies',
      subtitle: 'Manage multi-client campaigns',
      description: 'One platform for all your clients. Streamline reporting, contracts, and creator management across accounts.',
      icon: <Building2 className="w-8 h-8" />,
      href: '/solutions/influencer-agencies',
      metrics: ['Multi-client dashboards', 'White-label reports', 'Team collaboration'],
      color: 'from-orange-500 to-red-600'
    },
    {
      id: 'marketing-teams',
      title: 'Marketing Teams',
      subtitle: 'Centralized creator analytics',
      description: 'Roll up influencer, UGC, and affiliate performance for leadership. Unified reporting across all creator programs.',
      icon: <Users className="w-8 h-8" />,
      href: '/solutions/marketing-teams',
      metrics: ['Executive dashboards', 'Cross-channel analytics', 'Team permissions'],
      color: 'from-blue-500 to-cyan-600'
    }
  ];

  const stats = [
    { value: '10M+', label: 'Videos Tracked' },
    { value: '50K+', label: 'Creators Managed' },
    { value: '500+', label: 'Brands & Agencies' },
    { value: '99.9%', label: 'Uptime' }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Solutions for Founders, Brands & Agencies
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Whether you're scaling an app, running DTC campaigns, or managing multiple clients, ViewTrack adapts to your workflow.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 px-6 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {solutions.map((solution) => (
              <Link
                key={solution.id}
                to={solution.href}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-200 hover:shadow-2xl transition-all"
              >
                {/* Header with gradient */}
                <div className={`bg-gradient-to-r ${solution.color} p-6 text-white`}>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                      {solution.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{solution.title}</h3>
                      <p className="text-white/80">{solution.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {solution.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {solution.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>

                  <span className="text-[#2282FF] font-semibold flex items-center gap-2 group-hover:gap-3 transition-all">
                    Explore {solution.title} <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why ViewTrack Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Teams Choose ViewTrack
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Built by founders who've scaled massive creator campaigns. We understand what you need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#2282FF]/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-[#2282FF]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Built for Performance</h3>
              <p className="text-gray-600">
                Every feature is designed to help you measure and improve campaign ROI.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Scale Without Limits</h3>
              <p className="text-gray-600">
                From your first campaign to thousands of creators, ViewTrack grows with you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-Time Insights</h3>
              <p className="text-gray-600">
                Make decisions based on fresh data with automatic metric refreshing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Find Your Solution
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Not sure which plan fits? Talk to our team.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#2282FF]/25"
            >
              Start Tracking Now <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-all"
            >
              Compare Plans
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SolutionsPage;

