import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Users, FileText, BarChart3, ArrowRight, 
  CheckCircle, Layers
} from 'lucide-react';
import NavBar from '../../../components/NavBar';
import Footer from '../../../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const AgenciesPage: React.FC = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: <Layers className="w-6 h-6" />,
      title: 'Multi-Client Management',
      description: 'Manage all your clients in one platform with separate workspaces.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'White-Label Reports',
      description: 'Export beautiful reports branded for your clients.'
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Contract Workflows',
      description: 'Manage creator contracts at scale with templates and tracking.'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Team Collaboration',
      description: 'Assign team members to accounts and campaigns.'
    }
  ];

  const features = [
    'Unlimited client workspaces',
    'Team member permissions',
    'Creator portal for transparency',
    'Bulk contract management',
    'Campaign-level reporting',
    'API access for integrations'
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
            <span className="text-gray-900">Agencies</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold mb-4">
                <Building2 className="w-4 h-4" />
                For Agencies
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                A Single Source of Truth for Influencer Agencies
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Manage multiple clients, streamline reporting, and scale your creator 
                operations—all in one platform built for agency workflows.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Book Agency Demo <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/pricing"
                  className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-200 transition-all text-center"
                >
                  Enterprise Pricing
                </Link>
              </div>
            </div>

            {/* Multi-Client Preview */}
            <div className="bg-gradient-to-br from-orange-600 to-red-700 rounded-2xl p-6 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="text-white/60 text-sm mb-3">Your Clients</div>
                <div className="space-y-2">
                  {[
                    { name: 'Fashion Brand Co', campaigns: 4, creators: 24 },
                    { name: 'Tech Startup Inc', campaigns: 2, creators: 12 },
                    { name: 'Beauty Line', campaigns: 6, creators: 45 }
                  ].map((client, idx) => (
                    <div key={idx} className="bg-white/10 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{client.name}</div>
                        <div className="text-white/60 text-xs">{client.campaigns} campaigns • {client.creators} creators</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/60" />
                    </div>
                  ))}
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
            Built for Agency Workflows
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-center">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-4 text-orange-600">
                  {benefit.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Agency Features
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
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
              Manage all your creator contracts in one place →
            </Link>
            <Link
              to="/features/creator-portal"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Share live performance with creators and clients →
            </Link>
            <Link
              to="/pricing"
              className="px-6 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#2282FF] hover:shadow-lg transition-all font-medium text-gray-700 hover:text-[#2282FF]"
            >
              Enterprise pricing for agencies →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Scale Your Agency Operations
          </h2>
          <p className="text-gray-400 mb-8">
            Manage all your clients and creators in one platform.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 mx-auto shadow-lg shadow-[#2282FF]/25"
          >
            Book Agency Demo <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AgenciesPage;

