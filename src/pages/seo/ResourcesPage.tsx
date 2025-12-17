import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BookOpen, FileSpreadsheet, FileText, Download, 
  ArrowRight, Sparkles, Clock 
} from 'lucide-react';
import NavBar from '../../components/NavBar';
import Footer from '../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'guide' | 'template' | 'playbook';
  icon: React.ReactNode;
  href: string;
  readTime?: string;
  downloadable?: boolean;
}

const ResourcesPage: React.FC = () => {
  const navigate = useNavigate();

  const resources: Resource[] = [
    {
      id: 'influencer-analytics-guide',
      title: 'Influencer Analytics Guide',
      description: 'Learn how to measure creator ROI with our comprehensive analytics framework. Covers KPIs, attribution, and reporting best practices.',
      type: 'guide',
      icon: <BookOpen className="w-6 h-6" />,
      href: '/resources/influencer-analytics-guide',
      readTime: '15 min read'
    },
    {
      id: 'campaign-reporting-template',
      title: 'Campaign Reporting Template',
      description: 'Ready-to-use Google Sheets and Excel templates for tracking influencer campaign performance and creating client reports.',
      type: 'template',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      href: '/resources/influencer-campaign-reporting-template',
      downloadable: true
    },
    {
      id: 'ugc-brief-template',
      title: 'UGC Campaign Brief Template',
      description: 'Professional brief template for onboarding UGC creators. Includes deliverables checklist, brand guidelines, and usage rights.',
      type: 'template',
      icon: <FileText className="w-6 h-6" />,
      href: '/resources/ugc-campaign-brief-template',
      downloadable: true
    }
  ];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'guide':
        return { text: 'Guide', color: 'bg-blue-100 text-blue-700' };
      case 'template':
        return { text: 'Template', color: 'bg-emerald-100 text-emerald-700' };
      case 'playbook':
        return { text: 'Playbook', color: 'bg-purple-100 text-purple-700' };
      default:
        return { text: 'Resource', color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#2282FF]/10 text-[#2282FF] rounded-full text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Free Resources
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Influencer Analytics Guides & Templates
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Everything you need to run successful creator campaigns. Guides, templates, and playbooks from the ViewTrack team.
          </p>
        </div>
      </section>

      {/* Resources Grid */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((resource) => {
              const typeLabel = getTypeLabel(resource.type);
              return (
                <Link
                  key={resource.id}
                  to={resource.href}
                  className="group bg-white rounded-2xl p-6 border border-gray-200 hover:border-[#2282FF]/30 hover:shadow-xl transition-all flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-[#2282FF]/10 flex items-center justify-center transition-colors">
                      <div className="text-gray-600 group-hover:text-[#2282FF] transition-colors">
                        {resource.icon}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeLabel.color}`}>
                      {typeLabel.text}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#2282FF] transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4 flex-grow">
                    {resource.description}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    {resource.readTime && (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {resource.readTime}
                      </span>
                    )}
                    {resource.downloadable && (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        <Download className="w-3 h-3" /> Downloadable
                      </span>
                    )}
                    <span className="text-[#2282FF] text-sm font-semibold flex items-center gap-1 ml-auto group-hover:gap-2 transition-all">
                      {resource.downloadable ? 'Get Template' : 'Read Guide'}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Get New Resources in Your Inbox
          </h2>
          <p className="text-gray-600 mb-8">
            Join 5,000+ marketers getting weekly tips on influencer analytics and campaign optimization.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#2282FF] focus:ring-2 focus:ring-[#2282FF]/20 outline-none transition-all"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
          <p className="text-gray-500 text-xs mt-4">
            No spam, unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Put These Insights into Action?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Start tracking your creator campaigns with ViewTrack.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#2282FF]/25"
            >
              Start Tracking Now <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/influencer-marketing-analytics-platform')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-all"
            >
              Learn About ViewTrack
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ResourcesPage;

