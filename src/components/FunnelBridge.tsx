import React from 'react';
import { motion } from 'framer-motion';

const FunnelBridge: React.FC = () => {
  return (
    <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-12">
      <svg 
        className="w-full h-32"
        viewBox="0 0 1200 120"
        fill="none"
      >
        <defs>
          <linearGradient id="funnel-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <radialGradient id="funnel-glow">
            <stop offset="0%" stopColor="rgba(79,70,229,0.35)" />
            <stop offset="100%" stopColor="rgba(79,70,229,0)" />
          </radialGradient>
        </defs>
        
        {/* Funnel Shape - Two paths merging */}
        <motion.path
          d="M 400,0 L 600,120"
          stroke="url(#funnel-gradient)"
          strokeWidth="3"
          fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
        />
        <motion.path
          d="M 800,0 L 600,120"
          stroke="url(#funnel-gradient)"
          strokeWidth="3"
          fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          viewport={{ once: true }}
        />
        
        {/* Glow at junction */}
        <circle cx="600" cy="120" r="40" fill="url(#funnel-glow)" opacity="0.6" />
      </svg>
    </div>
  );
};

export default FunnelBridge;

