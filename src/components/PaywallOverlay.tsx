import React, { useState } from 'react';
import { Check, Eye, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import StripeService from '../services/StripeService';
import { getAuth } from 'firebase/auth';

interface PaywallOverlayProps {
  isActive: boolean;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ isActive }) => {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [testModeLoading, setTestModeLoading] = useState(false);

  if (!isActive) return null;

  // Check if demo account
  const isDemoAccount = user?.email?.toLowerCase() === '001ernestolopez@gmail.com';

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

  const handleTestModeGrant = async () => {
    if (!currentOrgId || !user) return;
    
    setTestModeLoading(true);
    try {
      console.log('🧪 [TEST MODE] Granting Basic plan...');
      
      const authUser = getAuth().currentUser;
      if (!authUser) {
        throw new Error('Not authenticated');
      }
      
      const token = await authUser.getIdToken();
      
      const response = await fetch('/api/test-grant-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId: currentOrgId,
          planTier: 'basic',
          userId: user.uid
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to grant test plan');
      }
      
      const result = await response.json();
      console.log('✅ [TEST MODE] Success:', result);
      
      alert(`✅ Test Mode Activated!\n\nPlan: ${result.planTier}\nExpires: ${new Date(result.expiresAt).toLocaleDateString()}\nPending accounts activated: ${result.pendingAccountsActivated}\n\nReloading dashboard...`);
      
      // Reload to update UI
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ [TEST MODE] Failed:', error);
      alert(`Failed to grant test plan: ${error.message}`);
      setTestModeLoading(false);
    }
  };

  return (
      <div className="relative z-10 max-w-6xl w-full mx-auto">
        <div className="text-center mb-8">
          {/* Demo Button - Minimalistic with subtle pulse */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <button
              onClick={() => navigate('/demo/dashboard')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-medium rounded-lg transition-all animate-pulse-subtle"
            >
              <Eye className="w-4 h-4" />
              <span>View Demo Organization</span>
            </button>
            
            {/* TEST MODE BUTTON - Only for demo account */}
            {isDemoAccount && (
              <button
                onClick={handleTestModeGrant}
                disabled={testModeLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 hover:text-green-300 font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>{testModeLoading ? 'Activating...' : '🧪 TEST MODE: Grant Basic Plan (Free)'}</span>
              </button>
            )}
          </div>
          
          <h2 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h2>
          <p className="text-gray-400 text-lg">Unlock full access to ViewTrack</p>
        </div>
        
        <style>{`
          @keyframes pulse-subtle {
            0%, 100% {
              opacity: 0.7;
              box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.05);
            }
            50% {
              opacity: 1;
              box-shadow: 0 0 20px 0 rgba(255, 255, 255, 0.1);
            }
          }
          .animate-pulse-subtle {
            animation: pulse-subtle 3s ease-in-out infinite;
          }
        `}</style>

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
                <span>Unlimited accounts</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Up to 150 videos</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>24-hour data refresh</span>
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
                <span>2 team seats</span>
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
                <span>Revenue tracking</span>
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-[#2282FF]" />
                <span>Creator campaigns</span>
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
                <span>5 team seats</span>
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
                <span>Revenue tracking</span>
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
                <span>15 team seats</span>
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

        {/* Settings Link */}
        <div className="text-center mt-8">
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

