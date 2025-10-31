import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

type Pt = { x: number; y: number };

function getCenter(el: Element): Pt {
  const r = el.getBoundingClientRect();
  return { 
    x: r.left + r.width / 2 + window.scrollX, 
    y: r.top + r.height / 2 + window.scrollY 
  };
}

// Catmull–Rom to cubic Bézier converter
function catmullRom2bezier(points: Pt[], tension = 0.5) {
  if (points.length < 2) return '';
  const d: string[] = [];
  d.push(`M ${points[0].x},${points[0].y}`);
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const t = tension;

    const cp1x = p1.x + (p2.x - p0.x) / 6 * t;
    const cp1y = p1.y + (p2.y - p0.y) / 6 * t;
    const cp2x = p2.x - (p3.x - p1.x) / 6 * t;
    const cp2y = p2.y - (p3.y - p1.y) / 6 * t;

    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

export default function FlowCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathD, setPathD] = useState('');
  const [pathLength, setPathLength] = useState(0);

  function computePoints(): Pt[] {
    const ids = [
      'hero-center',
      'platform-ig',
      'platform-tt',
      'platform-shorts',
      'platform-x',
      'profiles-field',
      'funnel',
      'timeline-start',
    ];
    
    const els = ids
      .map((k) => document.querySelector(`[data-flow-anchor="${k}"]`))
      .filter(Boolean) as Element[];

    const pts = els.map(getCenter);

    // Visual adjustments
    return pts.map((p, i) => {
      if (ids[i] === 'profiles-field') return { x: p.x, y: p.y - 40 };
      if (ids[i] === 'funnel') return { x: p.x, y: p.y + 6 };
      return p;
    });
  }

  const recompute = () => {
    const pts = computePoints();
    if (pts.length < 2) return;
    
    const d = catmullRom2bezier(pts, 1.0);
    setPathD(d);

    // Measure path length
    requestAnimationFrame(() => {
      const svg = svgRef.current;
      if (!svg || !d) return;
      
      const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      temp.setAttribute('d', d);
      svg.appendChild(temp);
      const L = (temp as any).getTotalLength?.() ?? 0;
      setPathLength(L);
      svg.removeChild(temp);
    });
  };

  useLayoutEffect(() => {
    // Initial compute
    const timer = setTimeout(recompute, 100);
    
    const ro = new ResizeObserver(recompute);
    ro.observe(document.body);
    
    window.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  const { scrollYProgress } = useScroll();
  const eased = useSpring(scrollYProgress, { 
    stiffness: 70, 
    damping: 20, 
    mass: 0.2 
  });
  const dashOffset = useTransform(eased, [0, 1], [pathLength, 0]);

  const height = useMemo(() => 
    Math.max(document.body.scrollHeight, window.innerHeight), 
    [pathD]
  );
  const width = useMemo(() => 
    document.documentElement.scrollWidth, 
    [pathD]
  );

  if (!pathD) return null;

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none fixed left-0 top-0 z-[1]"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="flowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base faint rail */}
      <path
        d={pathD}
        stroke="rgba(79,70,229,0.15)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Main gradient stroke */}
      <motion.path
        d={pathD}
        stroke="url(#flowGradient)"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#glow)"
        style={{
          pathLength: 1,
          strokeDasharray: pathLength,
          strokeDashoffset: dashOffset,
        }}
      />

      {/* Shimmer layer */}
      <motion.path
        d={pathD}
        stroke="url(#flowGradient)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="20 60"
        strokeOpacity={0.5}
        fill="none"
        animate={{ strokeDashoffset: [0, -80] }}
        transition={{ 
          duration: 2.5, 
          repeat: Infinity, 
          ease: 'linear' 
        }}
      />
    </svg>
  );
}

