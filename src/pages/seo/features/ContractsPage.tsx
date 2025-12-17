import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileText, PenTool, Clock, ArrowRight, 
  CheckCircle, Bell
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const ContractsPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Contract Templates',
      description: 'Start with professional templates or upload your own.'
    },
    {
      icon: <PenTool className="w-6 h-6" />,
      title: 'E-Signatures',
      description: 'Get contracts signed digitally—no printing needed.'
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: 'Term Tracking',
      description: 'Track deliverables, deadlines, and renewal dates.'
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: 'Reminders',
      description: 'Get notified before contracts expire or deadlines approach.'
    }
  ];

  const contractElements = [
    'Deliverables and content requirements',
    'Payment terms and schedules',
    'Content usage rights',
    'Exclusivity clauses',
    'FTC disclosure requirements',
    'Termination conditions'
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
            <span className="text-gray-900">Contracts</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold mb-4">
                <FileText className="w-4 h-4" />
                Management
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                Built-in Contract Management for Influencer Deals
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Create, send, and track influencer contracts without leaving ViewTrack. 
                From templates to e-signatures, manage the full contract lifecycle.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Start Tracking <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/solutions/influencer-agencies"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  For Agencies
                </Link>
              </div>
            </div>

            {/* Contract Preview */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-gray-200">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Creator Agreement</div>
                    <div className="text-sm text-gray-500">@janedoe • Q4 Campaign</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                  Signed ✓
                </span>
              </div>
              <div className="space-y-3">
                {['Deliverables', 'Payment', 'Usage Rights', 'Timeline'].map((section, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-gray-700">{section}</span>
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
            Contract Management Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-4 text-orange-600">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contract Elements */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            What's Included in Templates
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {contractElements.map((element, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-700">{element}</span>
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
              to="/solutions/influencer-agencies"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              See how agencies manage contracts at scale →
            </Link>
            <Link
              to="/features/ugc-campaigns"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Connect contracts to UGC campaigns →
            </Link>
            <Link
              to="/pricing"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Find contract management in your plan →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Streamline Your Creator Contracts
          </h2>
          <p className="text-gray-400 mb-8">
            Manage contracts and campaigns in one place.
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

export default ContractsPage;

