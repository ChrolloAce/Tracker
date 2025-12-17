import React, { useState, useEffect } from 'react';
import { Wrench, Lock } from 'lucide-react';
import viewtrackLogo from '/Viewtrack Logo Black.png';

interface MaintenanceCoverProps {
  children: React.ReactNode;
  accessCode?: string;
}

const MaintenanceCover: React.FC<MaintenanceCoverProps> = ({ 
  children, 
  accessCode = '2024' 
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 0, seconds: 0 });

  // Check if already unlocked from session
  useEffect(() => {
    const unlocked = sessionStorage.getItem('maintenance_unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
  }, []);

  // Countdown timer (decorative - always shows 12 hours)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === accessCode) {
      setIsUnlocked(true);
      sessionStorage.setItem('maintenance_unlocked', 'true');
      setError(false);
    } else {
      setError(true);
      setInputCode('');
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
        
        {/* Radial Gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 50%)'
          }}
        />

        {/* Animated Pulse Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5"
              style={{
                width: `${200 + i * 150}px`,
                height: `${200 + i * 150}px`,
                animation: `pulse-ring ${3 + i}s ease-out infinite`,
                animationDelay: `${i * 0.5}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* Logo */}
        <div className="mb-8">
          <img 
            src={viewtrackLogo} 
            alt="ViewTrack" 
            className="h-10 mx-auto invert opacity-90"
          />
        </div>

        {/* Maintenance Icon */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 mb-4">
            <Wrench className="w-10 h-10 text-white/60 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Under Maintenance
        </h1>
        
        <p className="text-white/50 text-lg mb-8">
          We're making ViewTrack even better. Be back soon!
        </p>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-1 font-mono">
              {String(timeLeft.hours).padStart(2, '0')}
            </div>
            <div className="text-xs text-white/40 uppercase tracking-wider">Hours</div>
          </div>
          <div className="text-3xl text-white/30 font-light">:</div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-1 font-mono">
              {String(timeLeft.minutes).padStart(2, '0')}
            </div>
            <div className="text-xs text-white/40 uppercase tracking-wider">Minutes</div>
          </div>
          <div className="text-3xl text-white/30 font-light">:</div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-1 font-mono">
              {String(timeLeft.seconds).padStart(2, '0')}
            </div>
            <div className="text-xs text-white/40 uppercase tracking-wider">Seconds</div>
          </div>
        </div>

        {/* Access Code Input */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 justify-center">
            <Lock className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/40">Team Access</span>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Enter access code"
              className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white text-center text-lg tracking-widest placeholder-white/30 focus:outline-none focus:ring-2 transition-all ${
                error 
                  ? 'border-red-500/50 focus:ring-red-500/30 animate-shake' 
                  : 'border-white/10 focus:ring-white/20'
              }`}
              autoComplete="off"
            />
            
            <button
              type="submit"
              className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-colors"
            >
              Access Dashboard
            </button>
          </form>
          
          {error && (
            <p className="text-red-400 text-sm mt-3 animate-fade-in">
              Invalid access code
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-white/30 text-sm mt-8">
          Questions? Email <a href="mailto:support@viewtrack.app" className="text-white/50 hover:text-white/70 underline">support@viewtrack.app</a>
        </p>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.3;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default MaintenanceCover;

