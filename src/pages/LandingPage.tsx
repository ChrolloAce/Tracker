import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, BookOpen } from 'lucide-react';
import NavBar from '../components/NavBar';
import FeaturesTimeline from '../components/FeaturesTimeline';
import Footer from '../components/Footer';
import { VideoCarousel3D } from '../components/landing/VideoCarousel3D';
import { HeroWidget } from '../components/landing/HeroWidget';
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
      <section id="hero" className="pt-28 md:pt-40 pb-12 md:pb-20 px-4 md:px-6 relative overflow-hidden">
        {/* Dotted Background Pattern */}
        <div 
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        />
        {/* Strong Fade to white at bottom for smooth transition */}
        <div className="absolute z-20 inset-x-0 bottom-0 h-64 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-12 gap-8 items-center min-h-[500px] md:min-h-[600px]">
            {/* Central Content Column */}
            <div className="lg:col-span-7 relative text-left">
              {/* Supported Platforms - Simple Row */}
              <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                <img src={instagramIcon} alt="Instagram" className="h-6 md:h-8 w-6 md:w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                <img src={tiktokIcon} alt="TikTok" className="h-6 md:h-8 w-6 md:w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                <img src={youtubeIcon} alt="YouTube" className="h-6 md:h-8 w-6 md:w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
                <img src={xLogo} alt="X" className="h-6 md:h-8 w-6 md:w-8 object-contain opacity-60 hover:opacity-100 transition-opacity" />
              </div>

              {/* Main Headline - Two Lines */}
              <div className="space-y-1 md:space-y-2 mb-6 md:mb-8">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#111111] leading-[1.1] tracking-tight">
                  Manage all your marketing
                </h1>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#111111] leading-[1.1] tracking-tight">
                  across socials in one place
                </h1>
              </div>

              {/* Supporting Sentence */}
              <p className="text-base md:text-lg text-[#666666] mb-8 md:mb-10 tracking-wide max-w-2xl">
                ViewTrack handles contracts, performance analytics, creator communication, and campaigns across all platforms—so you can focus on scaling your brand.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 mb-8 md:mb-12">
                <button
                  onClick={onGetStarted}
                  className="group relative w-full sm:w-auto px-8 md:px-9 py-3.5 md:py-4 bg-gradient-to-r from-[#007BFF] to-[#2583FF] hover:from-[#0066DD] hover:to-[#1E6FDD] text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 text-sm md:text-base overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Start tracking now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
                </button>
                <button
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="group relative w-full sm:w-auto px-8 md:px-9 py-3.5 md:py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 text-sm md:text-base overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <BookOpen className="w-4 h-4" /> Learn more
                  </span>
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-black/5 to-transparent skew-x-12" />
                </button>
              </div>
              </div>

            {/* Right Column: Interactive Widget */}
            <div className="hidden lg:block lg:col-span-5 relative">
              <HeroWidget />
            </div>
                </div>

          {/* 3D Video Carousel - Full Width */}
          <div className="w-screen relative left-1/2 -ml-[50vw] overflow-hidden pb-10 md:pb-20 -mt-16 md:-mt-24">
            <VideoCarousel3D />
          </div>
        </div>
      </section>

      {/* Founders' Note */}
      <section className="pt-8 pb-20 px-4 md:px-6 bg-white relative z-30 -mt-12">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 bg-black text-white text-xs font-bold rounded-full mb-6 tracking-widest uppercase">
            By Founders, For Founders
          </div>
          <h2 className="text-2xl md:text-4xl font-bold text-[#111] leading-tight tracking-tight">
            "Viewtrack was built by <a href="https://x.com/ErnestoSOFTWARE" target="_blank" rel="noopener noreferrer" className="text-[#2282FF] hover:underline">@ernestoSOFTWARE</a> who owns 9 apps and has scaled massive campaigns. We built the platform we wished we had consolidating everything you need to stop wasting budget and start scaling profitably."
          </h2>
              </div>
      </section>

      {/* Features Timeline */}
      <div id="features">
        <FeaturesTimeline />
      </div>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 md:py-20 px-4 md:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4 px-4">Pay as you go</h2>
            <p className="text-lg md:text-xl text-gray-600 px-4">Start small and scale your account limits as you scale your brand</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {/* Basic Plan */}
            <div className="bg-white rounded-2xl p-6 md:p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col sm:col-span-2 lg:col-span-1">
              <div className="mb-5 md:mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Basic</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900">$24</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-2.5 md:space-y-3 mb-6 md:mb-8 flex-grow">
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 150 videos</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>24-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator portals <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Contract management <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>2 team seats</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectPlan('basic')}
                disabled={loadingPlan === 'basic'}
                data-fast-goal="landing_pricing_basic_monthly"
                data-fast-goal-plan="basic"
                data-fast-goal-billing-cycle="monthly"
                data-fast-goal-price="24"
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto disabled:opacity-50"
              >
                {loadingPlan === 'basic' ? 'Loading...' : 'Get Started'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl p-6 md:p-8 border-2 border-[#2282FF] hover:shadow-lg transition-shadow relative flex flex-col sm:col-span-2 lg:col-span-1">
              <div className="absolute -top-3 md:-top-4 left-1/2 -translate-x-1/2 px-3 md:px-4 py-1 bg-[#2282FF] text-white text-xs md:text-sm font-bold rounded-full whitespace-nowrap">
                Popular
              </div>
              <div className="mb-5 md:mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900">$79</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-2.5 md:space-y-3 mb-6 md:mb-8 flex-grow">
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 1,000 videos</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>24-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Revenue tracking</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator campaigns <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator portals <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Contract management <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>5 team seats</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectPlan('pro')}
                disabled={loadingPlan === 'pro'}
                data-fast-goal="landing_pricing_pro_monthly"
                data-fast-goal-plan="pro"
                data-fast-goal-billing-cycle="monthly"
                data-fast-goal-price="79"
                className="w-full px-6 py-3 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-xl transition-colors mt-auto disabled:opacity-50 shadow-lg shadow-[#2282FF]/20"
              >
                {loadingPlan === 'pro' ? 'Loading...' : 'Get Started'}
              </button>
            </div>

            {/* Ultra Plan */}
            <div className="bg-white rounded-2xl p-6 md:p-8 border-2 border-gray-200 hover:shadow-lg transition-shadow flex flex-col sm:col-span-2 lg:col-span-1">
              <div className="mb-5 md:mb-6">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Ultra</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900">$199</span>
                  <span className="text-gray-600">/month</span>
                </div>
              </div>
              <ul className="space-y-2.5 md:space-y-3 mb-6 md:mb-8 flex-grow">
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Unlimited accounts</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Up to 5,000 videos</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>12-hour data refresh</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Revenue tracking</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Creator portals <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Contract management <span className="ml-2 text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">Coming Dec 5 2025</span></span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2 text-sm md:text-base text-gray-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-xs">✓</span>
                  </div>
                  <span>15 team seats</span>
                </li>
              </ul>
              <button
                onClick={() => handleSelectPlan('ultra')}
                disabled={loadingPlan === 'ultra'}
                data-fast-goal="landing_pricing_ultra_monthly"
                data-fast-goal-plan="ultra"
                data-fast-goal-billing-cycle="monthly"
                data-fast-goal-price="199"
                className="w-full px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors mt-auto disabled:opacity-50"
              >
                {loadingPlan === 'ultra' ? 'Loading...' : 'Get Started'}
              </button>
            </div>
          </div>
        </div>
      </section>



      {/* FAQ Section */}
      <section id="faq" className="py-12 md:py-20 px-4 md:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">FAQ</h2>
            <p className="text-lg md:text-xl text-gray-600">Common Questions</p>
            <p className="text-sm md:text-base text-gray-500 mt-1 md:mt-2">We're here to help you get the most out of ViewTrack</p>
          </div>

          <div className="space-y-3 md:space-y-4">
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
              <details key={index} className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 hover:shadow-md transition-shadow group">
                <summary className="font-semibold text-sm md:text-base text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  <span>{faq.question}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs md:text-sm">▼</span>
                </summary>
                <p className="mt-3 md:mt-4 text-sm md:text-base text-gray-600 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>

        </div>
      </section>

      <Footer />

    </div>
  );
};

export default LandingPage;

