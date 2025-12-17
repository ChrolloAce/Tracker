import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Video, FileText, CheckSquare, MessageSquare, ArrowRight, 
  Clock
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const UGCCampaignsPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Brief Management',
      description: 'Create and share detailed briefs with UGC creators.'
    },
    {
      icon: <CheckSquare className="w-6 h-6" />,
      title: 'Deliverable Tracking',
      description: 'Track content through draft, revision, and approval stages.'
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Feedback & Revisions',
      description: 'Comment directly on submissions and request changes.'
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Deadline Management',
      description: 'Set and track deadlines for each deliverable.'
    }
  ];

  const workflowSteps = [
    { step: '1', title: 'Create Brief', description: 'Define objectives, guidelines, and deliverables' },
    { step: '2', title: 'Assign Creators', description: 'Select creators and send briefs' },
    { step: '3', title: 'Review Drafts', description: 'Receive submissions and provide feedback' },
    { step: '4', title: 'Approve & Publish', description: 'Approve final content and track performance' }
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
            <span className="text-gray-900">UGC Campaigns</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-sm font-semibold mb-4">
                <Video className="w-4 h-4" />
                Content Management
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                UGC Campaign Management from Brief to Final Asset
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Manage your entire UGC workflow in one place. From creative briefs to 
                final approvals, keep everyone aligned and on schedule.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Managing UGC <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/resources/ugc-campaign-brief-template"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  Get Brief Template
                </Link>
              </div>
            </div>

            {/* Kanban Preview */}
            <div className="bg-gradient-to-br from-pink-600 to-rose-700 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="text-white font-semibold mb-4">Campaign: Summer UGC</div>
                <div className="grid grid-cols-3 gap-2">
                  {['Draft', 'Review', 'Approved'].map((status, idx) => (
                    <div key={status} className="bg-white/10 rounded-lg p-2">
                      <div className="text-white/60 text-xs mb-2">{status}</div>
                      {[...Array(idx === 1 ? 2 : idx === 2 ? 3 : 1)].map((_, i) => (
                        <div key={i} className="bg-white/20 rounded p-2 mb-1.5 last:mb-0">
                          <div className="h-2 bg-white/40 rounded w-3/4 mb-1"></div>
                          <div className="h-2 bg-white/20 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ))}
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
            UGC Workflow Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mx-auto mb-4 text-pink-600">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            The UGC Workflow
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {workflowSteps.map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4 text-center relative">
                <div className="w-8 h-8 rounded-full bg-[#2282FF] text-white font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <div className="font-semibold text-gray-900 mb-1">{item.title}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-0.5 bg-gray-200"></div>
                )}
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
              to="/features/contracts"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Attach contracts to UGC campaigns →
            </Link>
            <Link
              to="/resources/ugc-campaign-brief-template"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Use the UGC campaign brief template →
            </Link>
            <Link
              to="/solutions/influencer-agencies"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              See how agencies manage UGC at scale →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Streamline Your UGC Production
          </h2>
          <p className="text-gray-400 mb-8">
            Manage briefs, deliverables, and approvals in one place.
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

export default UGCCampaignsPage;

