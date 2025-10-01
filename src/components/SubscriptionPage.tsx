import React, { useState, useEffect } from 'react';
import { Check, X, Zap, Crown, Rocket, ChevronDown } from 'lucide-react';
import { SUBSCRIPTION_PLANS, PlanTier } from '../types/subscription';
import { useAuth } from '../contexts/AuthContext';
import StripeService from '../services/StripeService';
import SubscriptionService from '../services/SubscriptionService';

const SubscriptionPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('basic');
  const [loading, setLoading] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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
      window.location.href = 'mailto:support@viewtrack.com?subject=Enterprise Plan Inquiry';
      return;
    }

    setLoading(true);
    try {
      await StripeService.createCheckoutSession(currentOrgId, planTier, billingCycle);
    } catch (error: any) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  // Only show Basic, Pro, Ultra for main cards
  const mainPlans = [
    SUBSCRIPTION_PLANS.basic,
    SUBSCRIPTION_PLANS.pro,
    SUBSCRIPTION_PLANS.ultra,
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0A]">
      {/* Hero Section */}
      <div className="relative pt-16 pb-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
              Choose the perfect plan to track your content and grow your reach
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center bg-white dark:bg-[#161616] rounded-full p-1.5 border border-gray-200 dark:border-gray-800 shadow-sm">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === 'yearly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Yearly
                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">
                  Save 25%
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-stretch justify-center">
          {mainPlans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isCurrentPlan = currentPlan === plan.id;
            const isRecommended = plan.recommended;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col w-full max-w-sm bg-white dark:bg-[#161616] rounded-2xl p-8 border transition-all ${
                  isRecommended
                    ? 'border-blue-500 shadow-xl lg:scale-105 lg:-mt-4 lg:mb-4'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute top-6 right-6">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${
                  plan.id === 'basic' ? 'bg-gray-100 dark:bg-gray-800' :
                  plan.id === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' :
                  'bg-purple-50 dark:bg-purple-900/20'
                }`}>
                  {plan.id === 'basic' && <Zap className="w-7 h-7 text-gray-600 dark:text-gray-400" />}
                  {plan.id === 'pro' && <Crown className="w-7 h-7 text-blue-600 dark:text-blue-400" />}
                  {plan.id === 'ultra' && <Rocket className="w-7 h-7 text-purple-600 dark:text-purple-400" />}
                </div>

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.displayName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 min-h-[40px]">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-gray-900 dark:text-white">
                      ${price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">/month</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      ${(price * 12).toFixed(0)} billed annually
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading || isCurrentPlan}
                  className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all mb-8 ${
                    isCurrentPlan
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                      : isRecommended
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : loading ? 'Loading...' : 'Get Started'}
                </button>

                {/* Features */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.teamSeats}</strong> team {plan.features.teamSeats === 1 ? 'seat' : 'seats'}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Track <strong>{plan.features.maxAccounts === -1 ? 'unlimited' : plan.features.maxAccounts}</strong> accounts
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Up to <strong>{plan.features.maxVideos.toLocaleString()}</strong> videos
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Refresh every <strong>{plan.features.dataRefreshHours}h</strong>
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>{plan.features.mcpCallsPerMonth.toLocaleString()}</strong> API calls/month
                    </span>
                  </div>
                  {plan.features.refreshOnDemand && (
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        On-demand refresh
                      </span>
                    </div>
                  )}
                  {plan.features.apiAccess && (
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        API access
                      </span>
                    </div>
                  )}
                  {plan.features.prioritySupport && (
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Priority support
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Compare all features
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Choose the plan that's right for you
          </p>
        </div>

        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-6 px-6 text-sm font-semibold text-gray-900 dark:text-white">
                    Features
                  </th>
                  <th className="text-center py-6 px-6 text-sm font-semibold text-gray-900 dark:text-white">
                    Basic
                  </th>
                  <th className="text-center py-6 px-6 text-sm font-semibold text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-900/10">
                    Pro
                  </th>
                  <th className="text-center py-6 px-6 text-sm font-semibold text-gray-900 dark:text-white">
                    Ultra
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                <ComparisonRow 
                  feature="Team Seats"
                  basic={SUBSCRIPTION_PLANS.basic.features.teamSeats.toString()}
                  pro={SUBSCRIPTION_PLANS.pro.features.teamSeats.toString()}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.teamSeats.toString()}
                />
                <ComparisonRow 
                  feature="Tracked Accounts"
                  basic={SUBSCRIPTION_PLANS.basic.features.maxAccounts.toString()}
                  pro={SUBSCRIPTION_PLANS.pro.features.maxAccounts === -1 ? 'Unlimited' : SUBSCRIPTION_PLANS.pro.features.maxAccounts.toString()}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.maxAccounts === -1 ? 'Unlimited' : SUBSCRIPTION_PLANS.ultra.features.maxAccounts.toString()}
                />
                <ComparisonRow 
                  feature="Video Tracking"
                  basic={SUBSCRIPTION_PLANS.basic.features.maxVideos.toLocaleString()}
                  pro={SUBSCRIPTION_PLANS.pro.features.maxVideos.toLocaleString()}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.maxVideos.toLocaleString()}
                />
                <ComparisonRow 
                  feature="Data Refresh"
                  basic={`Every ${SUBSCRIPTION_PLANS.basic.features.dataRefreshHours}h`}
                  pro={`Every ${SUBSCRIPTION_PLANS.pro.features.dataRefreshHours}h`}
                  ultra={`Every ${SUBSCRIPTION_PLANS.ultra.features.dataRefreshHours}h`}
                />
                <ComparisonRow 
                  feature="API Calls/Month"
                  basic={SUBSCRIPTION_PLANS.basic.features.mcpCallsPerMonth.toLocaleString()}
                  pro={SUBSCRIPTION_PLANS.pro.features.mcpCallsPerMonth.toLocaleString()}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.mcpCallsPerMonth.toLocaleString()}
                />
                <ComparisonRow 
                  feature="On-Demand Refresh"
                  basic={SUBSCRIPTION_PLANS.basic.features.refreshOnDemand}
                  pro={SUBSCRIPTION_PLANS.pro.features.refreshOnDemand}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.refreshOnDemand}
                />
                <ComparisonRow 
                  feature="API Access"
                  basic={SUBSCRIPTION_PLANS.basic.features.apiAccess}
                  pro={SUBSCRIPTION_PLANS.pro.features.apiAccess}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.apiAccess}
                />
                <ComparisonRow 
                  feature="Priority Support"
                  basic={SUBSCRIPTION_PLANS.basic.features.prioritySupport}
                  pro={SUBSCRIPTION_PLANS.pro.features.prioritySupport}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.prioritySupport}
                />
                <ComparisonRow 
                  feature="Custom Branding"
                  basic={SUBSCRIPTION_PLANS.basic.features.customBranding}
                  pro={SUBSCRIPTION_PLANS.pro.features.customBranding}
                  ultra={SUBSCRIPTION_PLANS.ultra.features.customBranding}
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently asked questions
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Everything you need to know about the product and billing
          </p>
        </div>

        <div className="space-y-4">
          <FAQItem
            question="Can I change plans later?"
            answer="Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle."
            isExpanded={expandedFaq === 0}
            onToggle={() => setExpandedFaq(expandedFaq === 0 ? null : 0)}
          />
          <FAQItem
            question="What payment methods do you accept?"
            answer="We accept all major credit cards (Visa, MasterCard, American Express) through our secure payment processor Stripe."
            isExpanded={expandedFaq === 1}
            onToggle={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
          />
          <FAQItem
            question="Is there a free trial?"
            answer="Yes! All plans come with a 7-day free trial. No credit card required to start."
            isExpanded={expandedFaq === 2}
            onToggle={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
          />
          <FAQItem
            question="Can I cancel anytime?"
            answer="Absolutely. You can cancel your subscription at any time. Your account will remain active until the end of your current billing period."
            isExpanded={expandedFaq === 3}
            onToggle={() => setExpandedFaq(expandedFaq === 3 ? null : 3)}
          />
          <FAQItem
            question="Do you offer refunds?"
            answer="Yes, we offer a 7-day money-back guarantee. If you're not satisfied with our service, contact us within 7 days for a full refund."
            isExpanded={expandedFaq === 4}
            onToggle={() => setExpandedFaq(expandedFaq === 4 ? null : 4)}
          />
          <FAQItem
            question="What happens to my data if I cancel?"
            answer="Your data is safely stored for 30 days after cancellation. You can reactivate your account anytime within this period to restore everything."
            isExpanded={expandedFaq === 5}
            onToggle={() => setExpandedFaq(expandedFaq === 5 ? null : 5)}
          />
        </div>
      </div>
    </div>
  );
};

interface ComparisonRowProps {
  feature: string;
  basic: string | boolean;
  pro: string | boolean;
  ultra: string | boolean;
}

const ComparisonRow: React.FC<ComparisonRowProps> = ({ feature, basic, pro, ultra }) => {
  const renderCell = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-5 h-5 text-green-500 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-gray-300 dark:text-gray-700 mx-auto" />
      );
    }
    return <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>;
  };

  return (
    <tr>
      <td className="py-4 px-6 text-sm font-medium text-gray-900 dark:text-white">
        {feature}
      </td>
      <td className="py-4 px-6 text-center">
        {renderCell(basic)}
      </td>
      <td className="py-4 px-6 text-center bg-blue-50 dark:bg-blue-900/10">
        {renderCell(pro)}
      </td>
      <td className="py-4 px-6 text-center">
        {renderCell(ultra)}
      </td>
    </tr>
  );
};

interface FAQItemProps {
  question: string;
  answer: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isExpanded, onToggle }) => {
  return (
    <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
      >
        <span className="text-base font-semibold text-gray-900 dark:text-white pr-8">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
        />
      </button>
      {isExpanded && (
        <div className="px-6 pb-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
