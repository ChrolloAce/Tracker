import React, { useState, useEffect } from 'react';
import { Check, X, Zap, Crown, Rocket, Building2 } from 'lucide-react';
import { SUBSCRIPTION_PLANS, PlanTier } from '../types/subscription';
import { useAuth } from '../contexts/AuthContext';
import StripeService from '../services/StripeService';
import SubscriptionService from '../services/SubscriptionService';

const SubscriptionPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('basic');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrentPlan();
  }, [currentOrgId]);

  const loadCurrentPlan = async () => {
    if (!currentOrgId) return;
    try {
      const tier = await SubscriptionService.getPlanTier(currentOrgId);
      setCurrentPlan(tier);
    } catch (error) {
      console.error('Failed to load plan:', error);
    }
  };

  const handleSelectPlan = async (planTier: PlanTier) => {
    if (!currentOrgId) return;
    if (planTier === 'enterprise') {
      window.location.href = 'mailto:support@yourapp.com?subject=Enterprise Plan Inquiry';
      return;
    }

    setLoading(true);
    try {
      await StripeService.createCheckoutSession(currentOrgId, planTier, billingCycle);
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPlanIcon = (tier: PlanTier) => {
    switch (tier) {
      case 'basic': return Zap;
      case 'pro': return Crown;
      case 'ultra': return Rocket;
      case 'enterprise': return Building2;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose the perfect plan for you to go viral.
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Upgrade anytime. Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center space-x-4 bg-white dark:bg-[#161616] rounded-full p-1 shadow-lg border border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Billed Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all relative ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Billed Yearly
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                -25%
              </span>
            </button>
            <button
              className="px-6 py-2 rounded-full text-sm font-medium text-gray-600 dark:text-gray-400 cursor-not-allowed"
            >
              Free Demo 🎉
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
            const Icon = getPlanIcon(plan.id);
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isCurrentPlan = currentPlan === plan.id;
            const isRecommended = plan.recommended;

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-[#161616] rounded-2xl p-8 border-2 transition-all ${
                  isRecommended
                    ? 'border-blue-500 shadow-2xl scale-105'
                    : 'border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600'
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Best Deal Badge */}
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                      Best Deal
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Current
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  plan.id === 'basic' ? 'bg-gray-100 dark:bg-gray-800' :
                  plan.id === 'pro' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  plan.id === 'ultra' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  'bg-orange-100 dark:bg-orange-900/30'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    plan.id === 'basic' ? 'text-gray-600 dark:text-gray-400' :
                    plan.id === 'pro' ? 'text-blue-600 dark:text-blue-400' :
                    plan.id === 'ultra' ? 'text-purple-600 dark:text-purple-400' :
                    'text-orange-600 dark:text-orange-400'
                  }`} />
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.displayName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {plan.description}
                </p>

                {/* Price */}
                {plan.id === 'enterprise' ? (
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      Custom
                    </span>
                  </div>
                ) : (
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400"> /month</span>
                    {billingCycle === 'yearly' && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Save ${((plan.monthlyPrice - plan.yearlyPrice) * 12).toFixed(0)}/year
                      </p>
                    )}
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading || isCurrentPlan}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all mb-6 ${
                    isCurrentPlan
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                      : isRecommended
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl transform hover:-translate-y-0.5'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : loading ? 'Loading...' : 'Select Plan'}
                </button>

                {/* Features */}
                <div className="space-y-3">
                  <Feature 
                    text={`${plan.features.teamSeats === -1 ? 'Unlimited' : plan.features.teamSeats} team seat${plan.features.teamSeats !== 1 ? 's' : ''}`}
                    included={true}
                    badge={plan.features.flexibleSeats ? 'Flexible' : ''}
                  />
                  <Feature 
                    text={`Track ${plan.features.maxAccounts === -1 ? 'unlimited' : plan.features.maxAccounts} account${plan.features.maxAccounts !== 1 ? 's' : ''}`}
                    included={true}
                  />
                  <Feature 
                    text={`Track up to ${plan.features.maxVideos === -1 ? 'unlimited' : plan.features.maxVideos.toLocaleString()} videos`}
                    included={true}
                  />
                  <Feature 
                    text={`Data refreshes every ${plan.features.dataRefreshHours} hours`}
                    included={true}
                  />
                  <Feature 
                    text={`${plan.features.mcpCallsPerMonth === -1 ? 'Unlimited' : plan.features.mcpCallsPerMonth.toLocaleString()} MCP calls per month`}
                    included={true}
                  />
                  <Feature 
                    text="App Store integration"
                    included={plan.features.appStoreIntegration}
                  />
                  <Feature 
                    text="Refresh data on-demand"
                    included={plan.features.refreshOnDemand}
                  />
                  <Feature 
                    text="Manage creators"
                    included={plan.features.manageCreators}
                    badge={plan.features.manageCreators ? 'Coming Soon' : ''}
                  />
                </div>

                {/* 7-Day Money-Back Guarantee */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-xs text-center text-gray-500 dark:text-gray-500">
                    7-Day Money-Back Guarantee 🛡️
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Enterprise
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            App Studios & Agencies
          </p>
          <button
            onClick={() => window.location.href = 'mailto:support@yourapp.com?subject=Enterprise Plan'}
            className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Building2 className="w-5 h-5" />
            <span>Contact us for custom pricing</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface FeatureProps {
  text: string;
  included: boolean;
  badge?: string;
}

const Feature: React.FC<FeatureProps> = ({ text, included, badge }) => {
  return (
    <div className="flex items-center space-x-2">
      {included ? (
        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <X className="w-5 h-5 text-gray-300 dark:text-gray-700 flex-shrink-0" />
      )}
      <span className={`text-sm ${
        included 
          ? 'text-gray-700 dark:text-gray-300' 
          : 'text-gray-400 dark:text-gray-600 line-through'
      }`}>
        {text}
      </span>
      {badge && (
        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
          {badge}
        </span>
      )}
    </div>
  );
};

export default SubscriptionPage;

