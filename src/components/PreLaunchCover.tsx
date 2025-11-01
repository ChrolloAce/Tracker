import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Clock } from 'lucide-react';
import vtLogo from '/vtlogo.png';

const LAUNCH_DATE = new Date('2025-11-01T22:00:00').getTime(); // Nov 1, 2025 at 10:00 PM (EST)
const BYPASS_PIN = '1111'; // Change this to your secure PIN
const BYPASS_KEY = 'prelaunch_bypass_v2'; // Changed key to force reset
const FORCE_LOCK = true; // ALWAYS show cover, ignore date completely

interface PreLaunchCoverProps {
  children: React.ReactNode;
}

export const PreLaunchCover: React.FC<PreLaunchCoverProps> = ({ children }) => {
  const [isBypassed, setIsBypassed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    console.log('🚀 PreLaunchCover mounted');
    console.log('🔒 FORCE_LOCK is:', FORCE_LOCK);
    
    // If FORCE_LOCK is true, ONLY check PIN bypass (ignore date completely)
    if (FORCE_LOCK) {
      const bypassed = localStorage.getItem(BYPASS_KEY);
      console.log('🔍 Bypass status in localStorage:', bypassed);
      
      if (bypassed === 'true') {
        console.log('✅ PIN bypass found - showing app');
        setIsBypassed(true);
      } else {
        console.log('🔒 Cover locked - PIN required to access');
        setIsBypassed(false);
      }
      return;
    }

    // Legacy date-based logic (not used when FORCE_LOCK = true)
    const bypassed = localStorage.getItem(BYPASS_KEY);
    if (bypassed === 'true') {
      setIsBypassed(true);
      return;
    }

    const now = Date.now();
    if (now >= LAUNCH_DATE) {
      setIsBypassed(true);
      localStorage.setItem(BYPASS_KEY, 'true');
    }
  }, []);

  useEffect(() => {
    // Update countdown every second (but DON'T unlock automatically)
    const interval = setInterval(() => {
      const now = Date.now();
      const distance = LAUNCH_DATE - now;

      if (distance < 0) {
        // Show zeros when countdown expires (but stay locked!)
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔑 PIN submitted:', pin);
    
    if (pin === BYPASS_PIN) {
      console.log('✅ Correct PIN! Bypassing cover...');
      setIsBypassed(true);
      localStorage.setItem(BYPASS_KEY, 'true');
      setPinError(false);
    } else {
      console.log('❌ Incorrect PIN');
      setPinError(true);
      setPin('');
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const handlePinChange = (value: string) => {
    // Only allow numbers, max 4 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(numericValue);
    setPinError(false);
  };

  // ALWAYS show cover unless explicitly bypassed with PIN
  if (isBypassed) {
    console.log('✅ Rendering app (bypassed)');
    return <>{children}</>;
  }

  // Show the pre-launch cover (locked!)
  console.log('🔒 Rendering pre-launch cover');
  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0A0A0B] via-[#111113] to-[#0A0A0B] flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <img src={vtLogo} alt="ViewTrack" className="h-16 w-auto" />
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          Coming Soon
        </h1>
        <p className="text-xl text-gray-400 mb-12">
          We're putting the finishing touches on something amazing
        </p>

        {/* Countdown Timer */}
        <div className="mb-12">
          <div className="grid grid-cols-4 gap-4 md:gap-6 mb-6">
            {/* Days */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">
                {String(timeRemaining.days).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">
                Days
              </div>
            </div>

            {/* Hours */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">
                {String(timeRemaining.hours).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">
                Hours
              </div>
            </div>

            {/* Minutes */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">
                {String(timeRemaining.minutes).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">
                Minutes
              </div>
            </div>

            {/* Seconds */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">
                {String(timeRemaining.seconds).padStart(2, '0')}
              </div>
              <div className="text-xs md:text-sm text-gray-400 uppercase tracking-wider">
                Seconds
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Launching November 1st, 2025 at 10:00 PM</span>
          </div>
        </div>

        {/* PIN Access */}
        <div className="max-w-md mx-auto">
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                {pinError ? (
                  <Lock className="w-5 h-5 text-red-400 animate-shake" />
                ) : (
                  <Lock className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="Enter PIN for early access"
                maxLength={4}
                className={`w-full pl-12 pr-4 py-4 bg-white/5 backdrop-blur-sm border ${
                  pinError ? 'border-red-500/50 shake' : 'border-white/10'
                } rounded-xl text-white text-center text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all`}
              />
            </div>
            
            {pinError && (
              <p className="text-red-400 text-sm animate-fade-in">
                Incorrect PIN. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Unlock className="w-5 h-5" />
              Unlock Early Access
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-600">
            Have early access? Enter your 4-digit PIN above
          </p>
        </div>
      </div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          50% {
            transform: translateY(-100px) translateX(50px);
            opacity: 1;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .shake {
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

