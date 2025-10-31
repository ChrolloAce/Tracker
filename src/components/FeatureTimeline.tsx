import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { TrendingUp, Link, BarChart3, Target, Wallet } from 'lucide-react';
import { FEATURES } from '../lib/flow-data';

const iconMap: Record<string, React.ComponentType<any>> = {
  chart: BarChart3,
  link: Link,
  trending: TrendingUp,
  target: Target,
  wallet: Wallet,
};

const FeatureTimeline: React.FC = () => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center']
  });
  
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  return (
    <div ref={containerRef} className="relative mx-auto max-w-6xl px-4 md:px-6 py-24">
      {/* Center Spine */}
      <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-gradient-to-b from-indigo-500/20 to-cyan-400/20">
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-indigo-500 to-cyan-400 origin-top"
          style={{ scaleY }}
        />
      </div>

      {/* Feature Items */}
      <div className="space-y-24">
        {FEATURES.map((feature, index) => {
          const Icon = iconMap[feature.icon] || BarChart3;
          const isLeft = index % 2 === 0;

          return (
            <motion.div
              key={feature.id}
              className="relative"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className={`flex items-center ${isLeft ? 'justify-start' : 'justify-end'}`}>
                {/* Card */}
                <motion.div
                  className={`w-full md:w-[calc(50%-40px)] bg-white border border-black/5 rounded-2xl p-6 md:p-7 shadow-[0_10px_30px_rgba(0,0,0,0.04)] ${isLeft ? 'md:mr-auto' : 'md:ml-auto'}`}
                  whileHover={{ 
                    boxShadow: '0 0 0 3px rgba(79,70,229,0.15), 0 10px 30px rgba(0,0,0,0.08)' 
                  }}
                  tabIndex={0}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#111111] mb-2">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Spine Node */}
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white border-2 border-indigo-500 rounded-full flex items-center justify-center shadow-lg z-10"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.2 }}
              >
                <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default FeatureTimeline;

