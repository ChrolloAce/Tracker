import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Clock, Download
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const AnalyticsGuidePage: React.FC = () => {
  const navigate = useNavigate();

  const chapters = [
    { title: 'Understanding Influencer KPIs', description: 'Views, engagement, reach, and beyond' },
    { title: 'Attribution Models', description: 'First-touch, last-touch, and multi-touch' },
    { title: 'Reporting Cadences', description: 'Weekly, monthly, and campaign-level' },
    { title: 'Benchmarks by Platform', description: 'What "good" looks like on each platform' },
    { title: 'ROI Calculation', description: 'Formulas and frameworks for measuring return' },
    { title: 'Advanced Strategies', description: 'Incrementality testing and holdout groups' }
  ];

  const keyMetrics = [
    { metric: 'Engagement Rate', formula: '(Likes + Comments + Shares) / Views × 100' },
    { metric: 'Cost Per View (CPV)', formula: 'Total Spend / Total Views' },
    { metric: 'Return on Ad Spend (ROAS)', formula: 'Revenue Attributed / Total Spend' },
    { metric: 'Cost Per Acquisition (CPA)', formula: 'Total Spend / Conversions' }
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
            <span className="text-gray-900">Influencer Analytics Guide</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Guide</span>
            <span className="text-gray-500 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" /> 15 min read
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Influencer Analytics Guide: How to Measure Creator ROI
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            A comprehensive framework for measuring influencer marketing performance. 
            Learn the KPIs, attribution models, and reporting best practices used by top brands.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
            >
              Apply This in ViewTrack <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all flex items-center justify-center gap-2">
              <Download className="w-5 h-5" /> Download PDF
            </button>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-12 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">What You'll Learn</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {chapters.map((chapter, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-xl border border-gray-200 hover:border-[#2282FF]/30 hover:shadow-md transition-all">
                <div className="w-8 h-8 rounded-lg bg-[#2282FF]/10 flex items-center justify-center text-[#2282FF] font-bold text-sm flex-shrink-0">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{chapter.title}</h3>
                  <p className="text-sm text-gray-500">{chapter.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Metrics Section */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Metrics & Formulas</h2>
          <div className="space-y-4">
            {keyMetrics.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-2">{item.metric}</h3>
                <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700">
                  {item.formula}
                </code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Article Content Preview */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto prose prose-lg">
          <h2>Chapter 1: Understanding Influencer KPIs</h2>
          <p>
            Before diving into complex attribution models, it's essential to understand 
            the foundational metrics that make up influencer marketing analytics. These 
            KPIs form the building blocks of any measurement framework.
          </p>
          <h3>Views vs. Impressions</h3>
          <p>
            While often used interchangeably, views and impressions have distinct meanings 
            depending on the platform. On TikTok, a view counts after 1 second of playback. 
            On YouTube, it's after 30 seconds. Understanding these nuances is critical for 
            accurate cross-platform reporting.
          </p>
          <blockquote className="border-l-4 border-[#2282FF] pl-4 italic text-gray-600">
            "The best influencer marketers don't just track vanity metrics—they connect 
            content performance to business outcomes."
          </blockquote>
          <p>
            <strong>Continue reading in ViewTrack...</strong> Apply this framework with 
            our built-in analytics dashboards that calculate these metrics automatically.
          </p>
        </div>
      </section>

      {/* Internal Links */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Apply This Framework
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/influencer-marketing-analytics-platform"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              See how ViewTrack implements this framework →
            </Link>
            <Link
              to="/features/campaign-analytics"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Campaign analytics aligned to this framework →
            </Link>
            <Link
              to="/start-tracking"
              className="px-6 py-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Start applying this analytics guide →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Turn Insights Into Action
          </h2>
          <p className="text-gray-400 mb-8">
            Apply this framework with ViewTrack's built-in analytics.
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

export default AnalyticsGuidePage;

