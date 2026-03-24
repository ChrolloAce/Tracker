import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';
import dashboardPreview from '/LANDINGPAGE-PHOOTS/TrackView.png';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const onGetStarted = () => {
    navigate('/demo/dashboard');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Fixed Glassmorphism Navigation */}
      <NavBar logo={viewtrackLogo} onGetStarted={onGetStarted} />

      {/* Hero Section */}
      <section id="hero" className="pt-28 md:pt-40 pb-12 md:pb-20 px-4 md:px-6 relative overflow-hidden">
        {/* Dotted Background Pattern */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: 'radial-gradient(circle, #D1D5DB 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        />

        <div className="max-w-7xl mx-auto relative">
          {/* Centered Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            {/* Platform icons row */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src={tiktokIcon} alt="TikTok" className="h-8 md:h-10 w-8 md:w-10 object-contain" />
              <img src={instagramIcon} alt="Instagram" className="h-8 md:h-10 w-8 md:w-10 object-contain" />
              <img src={youtubeIcon} alt="YouTube" className="h-8 md:h-10 w-8 md:w-10 object-contain" />
              <img src={xLogo} alt="X" className="h-8 md:h-10 w-8 md:w-10 object-contain" />
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#111111] leading-[1.15] tracking-tight mb-6">
              The first <span className="text-[#007BFF]">agentic social media analytics tool</span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base md:text-lg lg:text-xl text-[#666666] mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
              Track any video, manage your creators, and hook it up to your agent so it self-improves based on data.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 md:mb-16">
              <button
                onClick={onGetStarted}
                className="group relative w-full sm:w-auto px-8 md:px-9 py-3.5 md:py-4 bg-gradient-to-r from-[#007BFF] to-[#2583FF] hover:from-[#0066DD] hover:to-[#1E6FDD] text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 text-sm md:text-base overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  See it in action <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              </button>
              <button
                onClick={onGetStarted}
                className="group relative w-full sm:w-auto px-8 md:px-9 py-3.5 md:py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-full border-2 border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 text-sm md:text-base overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  🦞 Add to Open Claw
                </span>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-black/5 to-transparent skew-x-12" />
              </button>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/10 border border-gray-200">
              <img
                src={dashboardPreview}
                alt="ViewTrack Dashboard"
                className="w-full"
              />
            </div>
            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;

