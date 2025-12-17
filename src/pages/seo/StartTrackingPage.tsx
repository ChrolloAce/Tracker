import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Shield, Zap, Clock, 
  Users, BarChart3, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import viewtrackLogo from '/Viewtrack Logo Black.png';
import instagramIcon from '/Instagram_icon.png';
import tiktokIcon from '/TiktokLogo.png';
import youtubeIcon from '/Youtube_shorts_icon.svg.png';
import xLogo from '/twitter-x-logo.png';

const StartTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const benefits = [
    { icon: <Zap className="w-5 h-5" />, text: 'Start tracking in under 2 minutes' },
    { icon: <Shield className="w-5 h-5" />, text: 'No password sharing required' },
    { icon: <Clock className="w-5 h-5" />, text: 'Real-time analytics dashboard' },
    { icon: <Users className="w-5 h-5" />, text: 'Invite unlimited team members' }
  ];

  const steps = [
    {
      number: '01',
      title: 'Create Your Account',
      description: 'Sign up with Google or email. Takes 30 seconds.'
    },
    {
      number: '02',
      title: 'Add Your Accounts',
      description: 'Paste any public social profile URL to start tracking.'
    },
    {
      number: '03',
      title: 'See Your Analytics',
      description: 'Watch your dashboard populate with real performance data.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFB] flex">
      {/* Left Side - Content */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12">
        <div className="max-w-lg">
          {/* Logo */}
          <img 
            src={viewtrackLogo} 
            alt="ViewTrack" 
            className="h-10 mb-12 cursor-pointer" 
            onClick={() => navigate('/')}
          />

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight leading-tight">
            Start Tracking Your Creator Campaigns
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of founders and brands using ViewTrack to measure and optimize their influencer marketing.
          </p>

          {/* Benefits */}
          <ul className="space-y-3 mb-10">
            {benefits.map((benefit, idx) => (
              <li key={idx} className="flex items-center gap-3 text-gray-700">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  {benefit.icon}
                </div>
                <span>{benefit.text}</span>
              </li>
            ))}
          </ul>

          {/* How It Works */}
          <div className="mb-10">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              How It Works
            </h2>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.number} className="flex gap-4">
                  <div className="text-2xl font-bold text-[#2282FF]/20">{step.number}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supported Platforms */}
          <div>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              Supported Platforms
            </h2>
            <div className="flex items-center gap-4">
              <img src={instagramIcon} alt="Instagram" className="w-8 h-8 object-contain opacity-60" />
              <img src={tiktokIcon} alt="TikTok" className="w-8 h-8 object-contain opacity-60" />
              <img src={youtubeIcon} alt="YouTube" className="w-8 h-8 object-contain opacity-60" />
              <img src={xLogo} alt="X" className="w-8 h-8 object-contain opacity-60" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Card */}
      <div className="hidden lg:flex flex-1 bg-gray-900 items-center justify-center p-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {user ? 'Welcome Back!' : 'Get Started Free'}
            </h2>
            <p className="text-gray-600 text-center mb-8">
              {user ? 'Continue to your dashboard' : 'No credit card required'}
            </p>

            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
              >
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <>
                {/* Google Sign In */}
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 transition-all flex items-center justify-center gap-3 mb-4"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">or</span>
                  </div>
                </div>

                {/* Email Sign Up */}
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2282FF]/25"
                >
                  Sign up with Email <ArrowRight className="w-5 h-5" />
                </button>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Already have an account?{' '}
                  <button 
                    onClick={() => navigate('/login')}
                    className="text-[#2282FF] font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </>
            )}

            {/* Trust Badges */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-6 text-gray-400">
                <div className="flex items-center gap-1.5 text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Shield className="w-3.5 h-3.5" />
                  <span>SOC 2</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Link */}
          <p className="text-center text-gray-400 mt-6 text-sm">
            Questions? Check our{' '}
            <button 
              onClick={() => navigate('/pricing')}
              className="text-white underline hover:no-underline"
            >
              FAQ
            </button>
            {' '}or{' '}
            <button 
              onClick={() => navigate('/support')}
              className="text-white underline hover:no-underline"
            >
              contact support
            </button>
          </p>
        </div>
      </div>

      {/* Mobile CTA (shown on smaller screens) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 lg:hidden">
        <button
          onClick={() => navigate('/login')}
          className="w-full py-4 bg-[#2282FF] hover:bg-[#1b6dd9] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          Start Tracking Now <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default StartTrackingPage;

