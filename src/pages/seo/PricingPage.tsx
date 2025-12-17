import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NavBar from '../../components/NavBar';
import Footer from '../../components/Footer';
import StripeService from '../../services/StripeService';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = async (plan: 'basic' | 'pro' | 'ultra') => {
    if (!user) {
      localStorage.setItem('selectedPlan', plan);
      navigate('/login');
      return;
    }

    if (!currentOrgId) {
      localStorage.setItem('selectedPlan', plan);
      navigate('/create-organization');
      return;
    }

    setLoadingPlan(plan);
    try {
      await StripeService.createCheckoutSession(currentOrgId, plan, billingCycle);
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      id: 'basic',
      name: 'Starter',
      monthlyPrice: 24,
      annualPrice: 19,
      description: 'Perfect for small teams and individual creators getting started',
      features: [
        'Unlimited tracked accounts',
        'Up to 150 videos',
        '24-hour data refresh',
        'Creator portals',
        'Contract management',
        '2 team seats',
        'Email support'
      ],
      cta: 'Start with Starter',
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      monthlyPrice: 79,
      annualPrice: 65,
      description: 'For growing brands scaling their creator campaigns',
      features: [
        'Unlimited tracked accounts',
        'Up to 1,000 videos',
        '24-hour data refresh',
        'Revenue tracking & attribution',
        'Creator campaigns',
        'Creator portals',
        'Contract management',
        '5 team seats',
        'Priority support'
      ],
      cta: 'Start with Pro',
      popular: true
    },
    {
      id: 'ultra',
      name: 'Enterprise',
      monthlyPrice: 199,
      annualPrice: 165,
      description: 'For agencies and large teams with high-volume needs',
      features: [
        'Unlimited tracked accounts',
        'Up to 5,000 videos',
        '12-hour data refresh',
        'Revenue tracking & attribution',
        'Creator campaigns',
        'Creator portals',
        'Contract management',
        '15 team seats',
        'API access',
        'Dedicated account manager',
        'Custom integrations'
      ],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  const faqs = [
    {
      question: 'Can I change plans later?',
      answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any differences.'
    },
    {
      question: 'What counts as a "video"?',
      answer: 'A video is any piece of content you\'re actively tracking. This includes posts from Instagram Reels, TikTok, YouTube Shorts, and regular YouTube videos.'
    },
    {
      question: 'Do you offer refunds?',
      answer: 'We offer a 14-day money-back guarantee on all plans. If you\'re not satisfied, contact us for a full refund.'
    },
    {
      question: 'What\'s included in revenue tracking?',
      answer: 'Revenue tracking connects your content performance to actual revenue through integrations with Apple App Store Connect, RevenueCat, and custom attribution links.'
    },
    {
      question: 'Can I add more team seats?',
      answer: 'Yes, additional team seats can be added to any plan. Contact us for custom seat packages.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure Stripe integration.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <NavBar logo={viewtrackLogo} onGetStarted={() => navigate('/login')} />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Simple Pricing for Scaling Influencer Campaigns
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Start tracking your creator campaigns today. No hidden fees, no long-term contracts.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-white rounded-full p-1.5 border border-gray-200 shadow-sm">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-8 border-2 transition-all hover:shadow-xl flex flex-col relative ${
                  plan.popular
                    ? 'border-[#2282FF] shadow-lg shadow-[#2282FF]/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#2282FF] text-white text-sm font-bold rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
                    </span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-emerald-600 mt-1">
                      Billed annually (${(billingCycle === 'yearly' ? plan.annualPrice : plan.monthlyPrice) * 12}/year)
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-gray-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id as 'basic' | 'pro' | 'ultra')}
                  disabled={loadingPlan === plan.id}
                  className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-[#2282FF] hover:bg-[#1b6dd9] text-white shadow-lg shadow-[#2282FF]/25'
                      : 'bg-gray-900 hover:bg-black text-white'
                  } disabled:opacity-50`}
                >
                  {loadingPlan === plan.id ? 'Loading...' : plan.cta}
                  {loadingPlan !== plan.id && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Compare Plans
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 text-gray-600 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 text-gray-900 font-semibold">Starter</th>
                  <th className="text-center py-4 px-4 text-[#2282FF] font-semibold">Pro</th>
                  <th className="text-center py-4 px-4 text-gray-900 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { feature: 'Tracked Accounts', starter: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
                  { feature: 'Tracked Videos', starter: '150', pro: '1,000', enterprise: '5,000' },
                  { feature: 'Data Refresh', starter: '24 hours', pro: '24 hours', enterprise: '12 hours' },
                  { feature: 'Team Seats', starter: '2', pro: '5', enterprise: '15' },
                  { feature: 'Revenue Tracking', starter: false, pro: true, enterprise: true },
                  { feature: 'Creator Campaigns', starter: false, pro: true, enterprise: true },
                  { feature: 'Creator Portals', starter: true, pro: true, enterprise: true },
                  { feature: 'Contract Management', starter: true, pro: true, enterprise: true },
                  { feature: 'API Access', starter: false, pro: false, enterprise: true },
                  { feature: 'Custom Integrations', starter: false, pro: false, enterprise: true },
                ].map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-4 px-4 text-gray-700">{row.feature}</td>
                    <td className="py-4 px-4 text-center">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-gray-700">{row.starter}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center bg-[#2282FF]/5">
                      {typeof row.pro === 'boolean' ? (
                        row.pro ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-gray-700 font-medium">{row.pro}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof row.enterprise === 'boolean' ? (
                        row.enterprise ? (
                          <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )
                      ) : (
                        <span className="text-gray-700">{row.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-600 text-center mb-12">
            Everything you need to know about our pricing
          </p>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <details
                key={idx}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow group"
              >
                <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-[#2282FF]" />
                    {faq.question}
                  </span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-gray-600 leading-relaxed pl-8">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Scale Your Creator Campaigns?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of brands and agencies using ViewTrack to drive results.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-full transition-all flex items-center gap-2 shadow-lg shadow-[#2282FF]/25"
            >
              Start Tracking Now <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/influencer-marketing-analytics-platform')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition-all"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PricingPage;

