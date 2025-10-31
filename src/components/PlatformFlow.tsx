import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PLATFORMS } from '../lib/flow-data';

const PlatformFlow: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-24">
      {/* SVG Rail */}
      <div className="relative h-[180px] md:h-[220px]">
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1200 240"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Data rail connecting platforms"
        >
          <defs>
            <linearGradient id="rail-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
          </defs>
          
          {/* Main Path */}
          <motion.path
            d="M 50,120 Q 350,80 600,120 Q 850,160 1150,120"
            stroke="url(#rail-gradient)"
            strokeWidth="3"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: mounted ? 1 : 0, opacity: mounted ? 1 : 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          
          {/* Shimmer Path */}
          <motion.path
            d="M 50,120 Q 350,80 600,120 Q 850,160 1150,120"
            stroke="url(#rail-gradient)"
            strokeWidth="3"
            fill="none"
            strokeDasharray="20 80"
            opacity="0.4"
            animate={{
              strokeDashoffset: [0, -100]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </svg>

        {/* Platform Logos */}
        <div className="absolute inset-0">
          {PLATFORMS.map((platform, index) => {
            const positions = ['8%', '36%', '64%', '92%'];
            return (
              <motion.div
                key={platform.id}
                className="absolute top-1/2 -translate-y-1/2"
                data-flow={`platform-${platform.id}`}
                style={{ left: positions[index] }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.2, duration: 0.5 }}
              >
                <motion.div
                  className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-black/5 flex items-center justify-center p-2"
                  whileHover={{ scale: 1.1, y: -4 }}
                  animate={{
                    y: [0, -6, 0],
                  }}
                  transition={{
                    y: {
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.3,
                    }
                  }}
                >
                  <img src={platform.icon} alt={platform.label} className="w-full h-full object-contain" />
                </motion.div>
                <p className="text-xs text-gray-600 text-center mt-2 font-medium">{platform.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlatformFlow;

