import React, { useState, useEffect } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
  duration?: number; // Duration in milliseconds
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  onComplete, 
  duration = 3000 
}) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const targetProgress = 100;
    
    // Smooth animation with easing
    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth acceleration/deceleration
      const easeInOutCubic = (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      
      const easedProgress = easeInOutCubic(progressRatio);
      const currentProgress = Math.floor(easedProgress * targetProgress);
      
      setProgress(currentProgress);
      
      // Add haptic-like micro delays for certain milestones
      const isHapticMilestone = currentProgress % 10 === 0 && currentProgress > 0;
      
      if (progressRatio < 1) {
        // Slight delay for haptic effect on milestones
        const delay = isHapticMilestone ? 50 : 16; // ~60fps normally, slower on milestones
        setTimeout(animateProgress, delay);
      } else {
        // Completed
        setProgress(100);
        setTimeout(() => {
          setIsComplete(true);
          setTimeout(onComplete, 500); // Brief pause before calling onComplete
        }, 200);
      }
    };
    
    // Start animation after a brief delay
    setTimeout(animateProgress, 100);
  }, [duration, onComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 flex items-center justify-center z-50">
      {/* Glass background overlay */}
      <div 
        className="fixed inset-0 bg-gradient-to-br from-white/20 via-blue-100/10 to-purple-100/20 backdrop-blur-sm pointer-events-none" 
        style={{
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
        }} 
      />
      
      {/* Loading content */}
      <div className="relative z-10 text-center">
        {/* Logo or brand */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl backdrop-blur-md border border-white/20">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
        </div>
        
        {/* Progress counter */}
        <div className="mb-6">
          <div 
            className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent transition-all duration-100"
            style={{
              transform: progress % 10 === 0 && progress > 0 ? 'scale(1.05)' : 'scale(1)',
              filter: progress % 10 === 0 && progress > 0 ? 'brightness(1.2)' : 'brightness(1)',
            }}
          >
            {progress}
          </div>
          <div className="text-lg text-gray-600 mt-2 font-medium">
            Calculating your level...
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-80 mx-auto">
          <div className="h-2 bg-white/20 backdrop-blur-sm border border-white/30 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-100 ease-out shadow-lg"
              style={{ 
                width: `${progress}%`,
                boxShadow: progress % 10 === 0 && progress > 0 ? '0 0 20px rgba(59, 130, 246, 0.5)' : '0 0 10px rgba(59, 130, 246, 0.3)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
        
        {/* Completion animation */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 border-4 border-green-500 rounded-full flex items-center justify-center animate-pulse">
              <svg 
                className="w-16 h-16 text-green-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={3} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            </div>
          </div>
        )}
      </div>
      
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 opacity-30 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
