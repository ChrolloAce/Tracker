import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileSpreadsheet, Download, CheckCircle, ArrowRight, 
  BarChart3
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const ReportingTemplatePage: React.FC = () => {
  const navigate = useNavigate();

  const templateSections = [
    { title: 'Campaign Overview', description: 'High-level metrics and goals' },
    { title: 'Creator Performance', description: 'Individual creator breakdowns' },
    { title: 'Content Analysis', description: 'Top-performing posts and insights' },
    { title: 'Revenue Attribution', description: 'Sales and conversion tracking' },
    { title: 'Platform Comparison', description: 'Cross-platform performance' },
    { title: 'Recommendations', description: 'Next steps and optimizations' }
  ];

  const formats = [
    { name: 'Google Sheets', icon: '📊', description: 'Live collaboration' },
    { name: 'Excel', icon: '📗', description: 'Offline editing' },
    { name: 'PDF', icon: '📄', description: 'Client presentations' }
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
            <span className="text-gray-900">Campaign Reporting Template</span>
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
            Influencer Campaign Reporting Template
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Ready-to-use Google Sheets and Excel templates for tracking influencer campaign 
            performance and creating professional client reports.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25">
              <Download className="w-5 h-5" /> Download Template
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all"
            >
              Or Skip Templates → Use ViewTrack
            </button>
          </div>
        </div>
      </section>

      {/* Template Preview */}
      <section className="py-12 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">What's Included</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {templateSections.map((section, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Format Options */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Formats</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {formats.map((format, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 text-center hover:shadow-lg transition-all cursor-pointer">
                <div className="text-4xl mb-3">{format.icon}</div>
                <h3 className="font-bold text-gray-900 mb-1">{format.name}</h3>
                <p className="text-sm text-gray-500">{format.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Templates vs. ViewTrack
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" /> Manual Templates
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-gray-400">•</span> Copy-paste data from each platform
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-400">•</span> Manual formula updates
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-400">•</span> Time-consuming data entry
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-400">•</span> Risk of human error
                </li>
              </ul>
            </div>
            <div className="bg-[#2282FF]/5 p-6 rounded-xl border-2 border-[#2282FF]/20">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#2282FF]" /> ViewTrack Automated
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Auto-sync from all platforms
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Real-time dashboard updates
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> One-click report exports
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Always accurate metrics
                </li>
              </ul>
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
              to="/features/link-tracking"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Feed link tracking data into this template →
            </Link>
            <Link
              to="/features/unified-kpis"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Upgrade from spreadsheets to unified KPIs →
            </Link>
            <Link
              to="/start-tracking"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Skip spreadsheets and start tracking in ViewTrack →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Automate Your Reporting?
          </h2>
          <p className="text-gray-400 mb-8">
            Skip the manual work. Let ViewTrack do the heavy lifting.
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

export default ReportingTemplatePage;

