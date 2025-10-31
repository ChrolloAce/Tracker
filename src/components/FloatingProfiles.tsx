import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { PROFILES } from '../lib/flow-data';

const FloatingProfiles: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  return (
    <div ref={containerRef} className="relative mx-auto max-w-6xl px-4 md:px-6 py-24">
      {/* Curved Path SVG */}
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 400"
        fill="none"
      >
        <defs>
          <linearGradient id="profile-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="50%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
        </defs>
        
        <motion.path
          d="M 600,400 Q 600,250 600,50"
          stroke="url(#profile-gradient)"
          strokeWidth="3"
          fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          viewport={{ once: true }}
        />
      </svg>

      {/* Flow Anchor - Profiles Field */}
      <div data-flow-anchor="profiles-field" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] w-[1px] z-0" />

      {/* Floating Avatars */}
      <div className="relative h-[400px] flex items-center justify-center">
        {PROFILES.map((profile, index) => {
          const positions = [
            { x: '-30%', y: '20%' },
            { x: '30%', y: '10%' },
            { x: '-20%', y: '50%' },
            { x: '25%', y: '60%' },
            { x: '0%', y: '80%' },
          ];

          return (
            <motion.div
              key={profile.id}
              className="absolute"
              style={{
                left: `calc(50% + ${positions[index].x})`,
                top: positions[index].y,
              }}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <motion.div
                animate={{
                  y: [0, -6, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: index * 0.5,
                }}
              >
                <motion.img
                  src={profile.avatar}
                  alt={profile.name}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-[0_8px_24px_rgba(79,70,229,0.35)]"
                  whileHover={{ scale: 1.08, boxShadow: '0 0 0 3px rgba(79,70,229,0.15)' }}
                />
                <p className="text-xs text-gray-600 text-center mt-2 font-medium">{profile.name}</p>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingProfiles;

