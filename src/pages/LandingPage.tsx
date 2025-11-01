import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NavBar from '../components/NavBar';
import VideoShowcase from '../components/VideoShowcase';
import FeaturesTimeline from '../components/FeaturesTimeline';
import StripeService from '../services/StripeService';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const onGetStarted = () => {
    navigate('/login');
  };

  const handleSelectPlan = async (plan: 'basic' | 'pro' | 'ultra') => {
    // If not logged in, go to login first
    if (!user) {
      localStorage.setItem('selectedPlan', plan);
      navigate('/login');
      return;
    }

    // If logged in but no org, go to onboarding
    if (!currentOrgId) {
      localStorage.setItem('selectedPlan', plan);
      navigate('/create-organization');
      return;
    }

    // If logged in with org, create checkout session
    setLoadingPlan(plan);
    try {
      await StripeService.createCheckoutSession(currentOrgId, plan, 'monthly');
      // Redirect happens automatically inside the service
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Fixed Glassmorphism Navigation */}
      <NavBar logo={viewtrackLogo} onGetStarted={onGetStarted} />

      {/* Hero Section - Ultra Detailed Design */}
      <section id="hero" className="pt-40 pb-20 px-6 relative overflow-hidden">
        {/* Dotted Background Pattern */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="flex items-center justify-center min-h-[600px]">
            {/* Central Content Column */}
            <div className="relative max-w-4xl mx-auto text-center">
              {/* Logo Mark */}
              <div className="flex items-center justify-center mb-12">
                <img src={viewtrackLogo} alt="ViewTrack" className="h-16 w-auto" />
              </div>

              {/* Main Headline - Two Lines */}
              <div className="space-y-2 mb-8">
                <h1 className="text-5xl font-extrabold text-[#111111] leading-[1.1] tracking-tight">
                  <span className="text-[#2282FF]">Track</span><span className="text-[#2282FF]">,</span> <span className="text-[#2282FF]">Manage</span> and <span className="text-[#2282FF]">Scale</span>
                </h1>
                <h1 className="text-5xl font-extrabold text-[#111111] leading-[1.1] tracking-tight">
                  your UGC and influencer campaigns
                </h1>
              </div>

              {/* Supporting Sentence */}
              <p className="text-lg text-[#666666] mb-10 tracking-wide">
                Monitor content performance across all platforms in one dashboard.
              </p>

              {/* CTA Buttons */}
              <div className="flex items-center justify-center gap-4 mb-12">
                <button
                  onClick={onGetStarted}
                  className="px-9 py-4 bg-gradient-to-r from-[#007BFF] to-[#2583FF] hover:from-[#0066DD] hover:to-[#1E6FDD] text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 text-base"
                >
                  Start tracking now
                </button>
                <button
                  onClick={() => {
                    document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-9 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 text-base"
                >
                  Learn more
                </button>
              </div>

              {/* Supported Platforms - Simple Row */}
              <div className="flex items-center justify-center gap-6 mb-12">
                <img src={instagramIcon} alt="Instagram" className="h-8 w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                <img src={tiktokIcon} alt="TikTok" className="h-8 w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                <img src={youtubeIcon} alt="YouTube" className="h-8 w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                <img src={xLogo} alt="X" className="h-8 w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
              </div>

              {/* Product Video Showcase - Inside Hero */}
              <div className="mt-8">
                <VideoShowcase
                  src="/demo/overview.mp4"
                  caption="Analytics Dashboard · 14-day view"
                />
              </div>
            </div>
                </div>
              </div>
      </section>

      {/* Features Timeline */}
      <div id="features">
        <FeaturesTimeline />
      </div>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Pay as you go</h2>
            <p className="text-xl text-gray-600">Start small and scale your account limits as you scale your brand</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Basic Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$24</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Track 3 accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 100 videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>24-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>App Store integration</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>1 team seat</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectPlan('basic')}
                disabled={loadingPlan === 'basic'}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto disabled:opacity-50"
              >
                {loadingPlan === 'basic' ? 'Loading...' : 'Get Started'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-[#2282FF] hover:shadow-lg transition-shadow relative flex flex-col">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#2282FF] text-white text-sm font-bold rounded-full">
                Popular
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$79</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 1,000 videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>24-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>On-demand refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator campaigns</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Revenue tracking</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>1 team seat</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectPlan('pro')}
                disabled={loadingPlan === 'pro'}
                className="w-full px-6 py-3 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-xl transition-colors mt-auto disabled:opacity-50 shadow-lg shadow-[#2282FF]/20"
              >
                {loadingPlan === 'pro' ? 'Loading...' : 'Get Started'}
              </button>
            </div>

            {/* Ultra Plan */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ultra</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-gray-900">$199</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 5,000 videos</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>12-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>On-demand refresh</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator portals</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Contract management</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>20 team seats</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectPlan('ultra')}
                disabled={loadingPlan === 'ultra'}
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto disabled:opacity-50"
              >
                {loadingPlan === 'ultra' ? 'Loading...' : 'Get Started'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 shadow-2xl">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to track your growth?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join creators who are scaling their social presence with ViewTrack.
            </p>
            <button
              onClick={onGetStarted}
              className="px-10 py-4 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Get Started for Free
            </button>
            <p className="text-sm text-gray-400 mt-4">No credit card required • Start in 2 minutes</p>
          </div>
        </div>
      </section>


      {/* FAQ Section */}
      <section id="faq" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">FAQ</h2>
            <p className="text-xl text-gray-600">Common Questions</p>
            <p className="text-gray-500 mt-2">We're here to help you get the most out of ViewTrack</p>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What is ViewTrack?",
                answer: "ViewTrack is a comprehensive analytics platform for tracking social media content across Instagram, TikTok, and YouTube. We help creators and brands measure performance, manage campaigns, and optimize their content strategy."
              },
              {
                question: "Who is ViewTrack for?",
                answer: "Our platform is designed for content creators, influencers, UGC creators, marketing agencies, and brands who need professional analytics and campaign management tools."
              },
              {
                question: "How does ViewTrack help optimize marketing ROI?",
                answer: "We provide revenue tracking integrations with Apple App Store and RevenueCat, allowing you to see which content drives actual sales and conversions, not just vanity metrics."
              },
              {
                question: "What platforms can I track content from?",
                answer: "Currently we support Instagram, TikTok, and YouTube. We automatically sync your content and provide unified analytics across all platforms."
              },
              {
                question: "How easy is it to set up and add accounts?",
                answer: "Setup takes less than 2 minutes. Simply add the social media accounts you want to track, and we'll start syncing your data immediately."
              },
              {
                question: "What kind of analytics does ViewTrack provide?",
                answer: "We provide comprehensive metrics including views, likes, comments, shares, engagement rates, growth trends, top performers, posting schedules, and revenue attribution."
              }
            ].map((faq, index) => (
              <details key={index} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
                <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  <span>{faq.question}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">Have more questions?</p>
            <a 
              href="mailto:support@viewtrack.app"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-3">
              <img src={viewtrackLogo} alt="ViewTrack" className="h-8 w-auto" />
            </div>
            
            {/* Footer Links */}
            <div className="flex items-center gap-6 text-sm">
              <a 
                href="/privacy" 
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="/terms" 
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                Terms of Service
              </a>
              <a 
                href="/support" 
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                Support
              </a>
            </div>
            
            <p className="text-sm text-gray-500">
              © 2025 ViewTrack. Track smarter, grow faster.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;

