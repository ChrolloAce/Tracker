import React, { useState } from 'react';
import { Check, Sparkles, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import StripeService from '../services/StripeService';

interface PaywallOverlayProps {
  isActive: boolean;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ isActive }) => {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!isActive) return null;

  const handleSwitchToDemo = async () => {
    // Just navigate to the public demo page
    navigate('/demo');
  };

  const handleUpgrade = async (plan: 'basic' | 'pro' | 'ultra') => {
    if (!currentOrgId) return;
    
    setLoading(true);
    try {
      await StripeService.createCheckoutSession(currentOrgId, plan, 'monthly');
      // Redirect happens automatically inside the service
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
      <div className="relative z-10 max-w-6xl w-full mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#2282FF]/10 border border-[#2282FF]/20 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-[#2282FF]" />
            <span className="text-sm font-medium text-[#2282FF]">Upgrade Required</span>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h2>
          <p className="text-gray-400 text-lg mb-4">Unlock full access to ViewTrack</p>
          
          {/* Try Demo Button */}
          <button
            onClick={handleSwitchToDemo}
            className="inline-flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full transition-colors font-medium text-sm"
          >
            <Eye className="w-4 h-4" />
            <span>Try Free Demo</span>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Basic Plan */}
          <div className="bg-[#161616] border border-gray-800 rounded-2xl p-8 hover:border-[#2282FF]/50 transition-all">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Basic</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$24</span>
                <span className="text-gray-400">/month</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Track 3 accounts</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Up to 100 videos</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>24-hour data refresh</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>App Store integration</span>
              </li>
            </ul>
            <button
              onClick={() => handleUpgrade('basic')}
              disabled={loading}
              data-fast-goal="paywall_pricing_basic_monthly"
              data-fast-goal-plan="basic"
              data-fast-goal-billing-cycle="monthly"
              data-fast-goal-price="24"
              className="w-full px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-full transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Upgrade to Basic'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-[#161616] border-2 border-[#2282FF] rounded-2xl p-8 relative transform scale-105">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#2282FF] text-white text-sm font-bold rounded-full">
              Popular
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$79</span>
                <span className="text-gray-400">/month</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Unlimited accounts</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Up to 1,000 videos</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>24-hour data refresh</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>On-demand refresh</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Creator campaigns</span>
              </li>
            </ul>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={loading}
              data-fast-goal="paywall_pricing_pro_monthly"
              data-fast-goal-plan="pro"
              data-fast-goal-billing-cycle="monthly"
              data-fast-goal-price="79"
              className="w-full px-6 py-3 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-colors disabled:opacity-50 shadow-lg shadow-[#2282FF]/20"
            >
              {loading ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Ultra Plan */}
          <div className="bg-[#161616] border border-gray-800 rounded-2xl p-8 hover:border-[#2282FF]/50 transition-all">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Ultra</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$199</span>
                <span className="text-gray-400">/month</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Unlimited accounts</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Up to 5,000 videos</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>12-hour data refresh</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Creator portals</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Contract management</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>20 team seats</span>
              </li>
            </ul>
            <button
              onClick={() => handleUpgrade('ultra')}
              disabled={loading}
              data-fast-goal="paywall_pricing_ultra_monthly"
              data-fast-goal-plan="ultra"
              data-fast-goal-billing-cycle="monthly"
              data-fast-goal-price="199"
              className="w-full px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-full transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Upgrade to Ultra'}
            </button>
          </div>
        </div>

        {/* Dismiss Button - Go to Settings */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/settings/billing')}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            View billing settings →
          </button>
        </div>
      </div>
  );
};

export default PaywallOverlay;

