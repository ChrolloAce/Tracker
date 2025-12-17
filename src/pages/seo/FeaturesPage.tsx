import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BarChart3, Link2, FileText, Users, Chrome, Video, 
  LayoutDashboard, RefreshCw, ArrowRight, Sparkles 
} from 'lucide-react';
import NavBar from '../../components/NavBar';
import Footer from '../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  category: string;
}

const FeaturesPage: React.FC = () => {
  const navigate = useNavigate();

  const features: Feature[] = [
    {
      id: 'campaign-analytics',
      title: 'Campaign Analytics',
      description: 'Track performance across all your influencer and UGC campaigns with real-time dashboards and detailed metrics.',
      icon: <BarChart3 className="w-6 h-6" />,
      href: '/features/campaign-analytics',
      category: 'Analytics'
    },
    {
      id: 'unified-kpis',
      title: 'Unified KPIs',
      description: 'One dashboard for all creator campaigns. Roll up views, engagement, and revenue across every platform.',
      icon: <LayoutDashboard className="w-6 h-6" />,
      href: '/features/unified-kpis',
      category: 'Analytics'
    },
    {
      id: 'auto-refresh',
      title: 'Auto-Refresh',
      description: 'Always-on data syncing keeps your metrics fresh. 24-hour refresh on Pro, 12-hour on Enterprise.',
      icon: <RefreshCw className="w-6 h-6" />,
      href: '/features/auto-refresh',
      category: 'Analytics'
    },
    {
      id: 'link-tracking',
      title: 'Link Tracking',
      description: 'Connect creator content to revenue with custom tracking links. Measure clicks, conversions, and ROI.',
      icon: <Link2 className="w-6 h-6" />,
      href: '/features/link-tracking',
      category: 'Attribution'
    },
    {
      id: 'contracts',
      title: 'Contract Management',
      description: 'Built-in contract lifecycle management. Send, sign, and track influencer agreements in one place.',
      icon: <FileText className="w-6 h-6" />,
      href: '/features/contracts',
      category: 'Management'
    },
    {
      id: 'creator-portal',
      title: 'Creator Portal',
      description: 'Give creators live access to their performance data. No password sharing, transparent reporting.',
      icon: <Users className="w-6 h-6" />,
      href: '/features/creator-portal',
      category: 'Collaboration'
    },
    {
      id: 'ugc-campaigns',
      title: 'UGC Campaigns',
      description: 'Manage UGC workflows from brief to final asset. Track deliverables, revisions, and approvals.',
      icon: <Video className="w-6 h-6" />,
      href: '/features/ugc-campaigns',
      category: 'Management'
    },
    {
      id: 'chrome-extension',
      title: 'Chrome Extension',
      description: 'Analyze any creator while you browse. See engagement rates, audience signals, and save to ViewTrack.',
      icon: <Chrome className="w-6 h-6" />,
      href: '/features/chrome-extension',
      category: 'Extensions'
    }
  ];

  const categories = ['Analytics', 'Attribution', 'Management', 'Collaboration', 'Extensions'];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#2282FF]/10 text-[#2282FF] rounded-full text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Platform Features
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Everything You Need to Run Creator Campaigns
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            From analytics to contracts, ViewTrack gives you complete control over your influencer and UGC programs.
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
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all"
            >
              Compare Plans
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          {categories.map((category) => {
            const categoryFeatures = features.filter((f) => f.category === category);
            if (categoryFeatures.length === 0) return null;

            return (
              <div key={category} className="mb-16 last:mb-0">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">
                  {category}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryFeatures.map((feature) => (
                    <Link
                      key={feature.id}
                      to={feature.href}
                      className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-[#2282FF]/30 hover:shadow-xl transition-all"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-[#2282FF]/10 flex items-center justify-center mb-4 transition-colors">
                        <div className="text-gray-600 group-hover:text-[#2282FF] transition-colors">
                          {feature.icon}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#2282FF] transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-4">
                        {feature.description}
                      </p>
                      <span className="text-[#2282FF] text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Learn more <ArrowRight className="w-4 h-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Works With Your Stack
          </h2>
          <p className="text-gray-600 mb-12 max-w-2xl mx-auto">
            ViewTrack integrates with the platforms you already use for a seamless workflow.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { name: 'Instagram', logo: '/Instagram_icon.png' },
              { name: 'TikTok', logo: '/TiktokLogo.png' },
              { name: 'YouTube', logo: '/Youtube_shorts_icon.svg.png' },
              { name: 'X (Twitter)', logo: '/twitter-x-logo.png' },
            ].map((platform) => (
              <div key={platform.name} className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <img src={platform.logo} alt={platform.name} className="w-10 h-10 object-contain" />
                </div>
                <span className="text-sm font-medium text-gray-600">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Explore ViewTrack?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Start tracking your creator campaigns in minutes.
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
              View Pricing
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FeaturesPage;

