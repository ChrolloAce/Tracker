import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Download, CheckCircle, ArrowRight
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const UGCBriefTemplatePage: React.FC = () => {
  const navigate = useNavigate();

  const briefSections = [
    { title: 'Campaign Objective', description: 'What you want to achieve' },
    { title: 'Target Audience', description: 'Who the content is for' },
    { title: 'Content Requirements', description: 'Format, length, and specs' },
    { title: 'Key Messages', description: 'What to communicate' },
    { title: 'Dos and Don\'ts', description: 'Brand guidelines' },
    { title: 'Deliverables', description: 'Expected outputs and timeline' },
    { title: 'Usage Rights', description: 'Where content will be used' },
    { title: 'Payment Terms', description: 'Compensation details' }
  ];

  const bestPractices = [
    'Be specific about content format and length',
    'Include visual references and mood boards',
    'Clearly state FTC disclosure requirements',
    'Define the approval process upfront',
    'Set realistic deadlines with buffer time',
    'Include contact info for questions'
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Breadcrumb */}
      <div className="pt-24 px-6">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-gray-700">Home</Link>
            <span>/</span>
            <Link to="/resources" className="hover:text-gray-700">Resources</Link>
            <span>/</span>
            <span className="text-gray-900">UGC Campaign Brief Template</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Template</span>
            <span className="text-gray-500 text-sm flex items-center gap-1">
              <Download className="w-3 h-3" /> Free Download
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            UGC Campaign Brief Template
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            A professional brief template for onboarding UGC creators. Includes deliverables 
            checklist, brand guidelines, usage rights, and everything else you need.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25">
              <Download className="w-5 h-5" /> Download Brief Template
            </button>
            <Link
              to="/features/ugc-campaigns"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
            >
              Manage Briefs in ViewTrack
            </Link>
          </div>
        </div>
      </section>

      {/* Brief Sections */}
      <section className="py-12 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Template Sections</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {briefSections.map((section, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl border border-gray-200">
                <div className="w-6 h-6 rounded-full bg-[#2282FF]/10 flex items-center justify-center text-[#2282FF] font-bold text-xs flex-shrink-0">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Brief Best Practices</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <ul className="space-y-3">
              {bestPractices.map((practice, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span className="text-gray-700">{practice}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Template Preview</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-xl font-bold text-gray-900">UGC Campaign Brief</h3>
              <p className="text-gray-500">[Brand Name] × [Creator Name]</p>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Campaign Objective</h4>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                  [Describe what you want to achieve with this content...]
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Deliverables</h4>
                <ul className="text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
                  <li>☐ 1x 30-60 second TikTok video</li>
                  <li>☐ Hook within first 3 seconds</li>
                  <li>☐ Product demo showing [feature]</li>
                  <li>☐ Call-to-action: [CTA]</li>
                </ul>
              </div>
              
              <div className="text-center text-gray-400 py-4">
                ... more sections in full template ...
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Related Resources
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/features/ugc-campaigns"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Turn this brief into a live UGC campaign →
            </Link>
            <Link
              to="/features/contracts"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Pair briefs with contracts in ViewTrack →
            </Link>
            <Link
              to="/solutions/influencer-agencies"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              See how agencies use UGC briefs at scale →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Manage UGC Campaigns End-to-End
          </h2>
          <p className="text-gray-400 mb-8">
            From brief to final asset, all in one platform.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 mx-auto shadow-lg shadow-[#2282FF]/25"
          >
            Start Managing UGC <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default UGCBriefTemplatePage;

