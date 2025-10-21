import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  AlertTriangle, 
  Check, 
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SubscriptionService from '../services/SubscriptionService';
import StripeService from '../services/StripeService';
import { PlanTier, SUBSCRIPTION_PLANS } from '../types/subscription';

const BillingManagementPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('free');
  const [subscription, setSubscription] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    loadBillingInfo();
  }, [currentOrgId]);

  const loadBillingInfo = async () => {
    if (!currentOrgId) return;
    
    setLoading(true);
    try {
      const [tier, sub] = await Promise.all([
        SubscriptionService.getPlanTier(currentOrgId),
        SubscriptionService.getSubscription(currentOrgId),
      ]);
      
      setCurrentPlan(tier);
      setSubscription(sub);
    } catch (error) {
      console.error('Failed to load billing info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!currentOrgId) return;
    
    setActionLoading(true);
    try {
      // This would call your backend to cancel via Stripe API
      // For now, we'll show it needs backend implementation
      alert('Cancel functionality requires backend API endpoint. Would you like me to create it?');
      setShowCancelModal(false);
    } catch (error) {
      console.error('Failed to cancel:', error);
      alert('Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgradePlan = async (newPlan: PlanTier) => {
    if (!currentOrgId) return;
    
    setActionLoading(true);
    try {
      await StripeService.createCheckoutSession(currentOrgId, newPlan, 'monthly');
      setShowUpgradeModal(false);
    } catch (error) {
      console.error('Failed to upgrade:', error);
      alert('Failed to start upgrade process');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    // This would open Stripe Elements for payment method update
    alert('Payment method update requires Stripe Elements integration. Would you like me to add it?');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const planDetails = SUBSCRIPTION_PLANS[currentPlan];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-50/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Billing Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your subscription, payment methods, and billing history
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Plan Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Subscription Card */}
            <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Current Subscription
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  subscription?.status === 'active' 
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  {subscription?.status === 'active' ? 'Active' : subscription?.status || 'Free'}
                </span>
              </div>

              <div className="space-y-4">
                {/* Plan Name */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">Plan</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {planDetails?.displayName || 'Free'}
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">Price</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {currentPlan === 'free' ? 'Free' : `$${planDetails?.monthlyPrice}/month`}
                  </span>
                </div>

                {/* Renewal Date */}
                {subscription?.currentPeriodEnd && (
                  <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">Renews on</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {subscription.currentPeriodEnd.toDate().toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Features */}
                <div className="pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Included Features
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{planDetails?.features.teamSeats} team seat{planDetails?.features.teamSeats !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{planDetails?.features.maxAccounts === -1 ? 'Unlimited' : planDetails?.features.maxAccounts} accounts</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{planDetails?.features.maxVideos.toLocaleString()} videos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{planDetails?.features.dataRefreshHours}h refresh</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                {currentPlan !== 'free' && currentPlan !== 'ultra' && (
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Upgrade Plan
                  </button>
                )}
                {currentPlan !== 'free' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel Subscription
                  </button>
                )}
                {currentPlan === 'free' && (
                  <button
                    onClick={() => navigate('/subscription')}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    View Plans
                  </button>
                )}
              </div>
            </div>

            {/* Payment Method Card */}
            {currentPlan !== 'free' && (
              <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Payment Method
                  </h2>
                  <CreditCard className="w-5 h-5 text-gray-400" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0A0A0A] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">•••• •••• •••• 4242</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Expires 12/25</p>
                      </div>
                    </div>
                    <button
                      onClick={handleUpdatePaymentMethod}
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                    >
                      Update
                    </button>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your payment method will be charged automatically on your renewal date.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Usage This Month
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">API Calls</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {subscription?.usage?.mcpCalls || 0} / {planDetails?.features.mcpCallsPerMonth.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                    <div 
                      className="bg-emerald-600 h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, ((subscription?.usage?.mcpCalls || 0) / planDetails?.features.mcpCallsPerMonth) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Need Help? */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                Have questions about your billing or subscription? We're here to help!
              </p>
              <a
                href="mailto:support@viewtrack.com"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Contact Support
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Full Portal Link */}
            {currentPlan !== 'free' && subscription?.stripeCustomerId && (
              <div className="bg-gray-50 dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Advanced Options
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  For detailed billing history and invoices, visit the full billing portal.
                </p>
                <button
                  onClick={async () => {
                    try {
                      await StripeService.createPortalSession(currentOrgId!);
                    } catch (error) {
                      console.error('Failed to open portal:', error);
                    }
                  }}
                  className="w-full px-4 py-2 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2"
                >
                  Open Full Portal
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#161616] rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Cancel Subscription?
              </h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your billing period.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Canceling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#161616] rounded-xl max-w-2xl w-full p-6 border border-gray-200 dark:border-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Upgrade Your Plan
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {Object.entries(SUBSCRIPTION_PLANS)
                .filter(([key]) => key !== 'free' && key !== 'enterprise')
                .map(([key, plan]) => (
                  <button
                    key={key}
                    onClick={() => handleUpgradePlan(key as PlanTier)}
                    disabled={actionLoading || key === currentPlan}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      key === currentPlan
                        ? 'border-gray-300 dark:border-gray-700 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {plan.displayName}
                      </h4>
                      {key === currentPlan && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      ${plan.monthlyPrice}<span className="text-sm text-gray-500">/mo</span>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {plan.description}
                    </p>
                  </button>
                ))}
            </div>

            <button
              onClick={() => setShowUpgradeModal(false)}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingManagementPage;

