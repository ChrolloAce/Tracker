import { useLayoutEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };

const sel = (name: string, root: HTMLElement) => 
  root.querySelector(`[data-flow="${name}"]`) as HTMLElement | null;

function centerIn(el: HTMLElement, root: HTMLElement): Pt {
  const r = el.getBoundingClientRect();
  const base = root.getBoundingClientRect();
  return { 
    x: r.left - base.left + r.width / 2, 
    y: r.top - base.top + r.height / 2 
  };
}

// Catmull-Rom to cubic Bézier converter
function crToBezier(points: Pt[], t = 1) {
  if (points.length < 2) return '';
  const d = [`M ${points[0].x},${points[0].y}`];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1 = { x: p1.x + (p2.x - p0.x) / 6 * t, y: p1.y + (p2.y - p0.y) / 6 * t };
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6 * t, y: p2.y - (p3.y - p1.y) / 6 * t };
    
    d.push(`C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

export default function FlowCanvas() {
  const rootRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [leftD, setLeftD] = useState('');
  const [rightD, setRightD] = useState('');
  const [spineD, setSpineD] = useState('');
  const [chipPts, setChipPts] = useState<Pt[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const root = document.getElementById('flow-container') as HTMLElement;
    if (!root) return;
    
    rootRef.current = root;

    const compute = () => {
      const hL = sel('hero-left', root);
      const hR = sel('hero-right', root);
      const pIG = sel('platform-ig', root);
      const pTT = sel('platform-tt', root);
      const pYT = sel('platform-yt', root);
      const pX = sel('platform-x', root);
      const merge = sel('merge', root);
      const time = sel('timeline', root);

      if (!(hL && hR && pIG && pTT && pYT && pX && merge && time)) return;

      // Left branch: hero-left → IG → YT → merge
      const leftPts: Pt[] = [
        centerIn(hL, root),
        { x: centerIn(hL, root).x - 60, y: centerIn(hL, root).y + 30 },
        centerIn(pIG, root),
        centerIn(pYT, root),
        centerIn(merge, root)
      ];

      // Right branch: hero-right → TT → X → merge
      const rightPts: Pt[] = [
        centerIn(hR, root),
        { x: centerIn(hR, root).x + 60, y: centerIn(hR, root).y + 30 },
        centerIn(pTT, root),
        centerIn(pX, root),
        centerIn(merge, root)
      ];

      setLeftD(crToBezier(leftPts, 1.1));
      setRightD(crToBezier(rightPts, 1.1));

      // Spine from merge to timeline
      const m = centerIn(merge, root);
      const t = centerIn(time, root);
      setSpineD(`M ${m.x},${m.y} C ${m.x},${m.y + 60} ${t.x},${t.y - 60} ${t.x},${t.y}`);

      // Creator chips along paths
      const svg = svgRef.current;
      if (!svg) return;
      
      const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.appendChild(tmp);

      const chips: Pt[] = [];
      [leftPts, rightPts].forEach((pts) => {
        tmp.setAttribute('d', crToBezier(pts, 1.1));
        const L = (tmp as any).getTotalLength?.() ?? 0;
        [0.25, 0.5, 0.75].forEach(f => {
          const p = (tmp as any).getPointAtLength?.(L * f);
          if (p) chips.push({ x: p.x, y: p.y });
        });
      });
      svg.removeChild(tmp);
      setChipPts(chips);

      // Update box size
      setBox({ w: root.clientWidth, h: root.scrollHeight });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(root);
    window.addEventListener('resize', compute);
    
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  if (!leftD || !rightD || !spineD) return null;

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute left-0 top-0 z-[2]"
      width={box.w}
      height={box.h}
      viewBox={`0 0 ${box.w} ${box.h}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="chip-clip">
          <circle cx="10" cy="10" r="8" />
        </clipPath>
      </defs>

      {/* Left & right rails - base */}
      <path d={leftD} fill="none" stroke="rgba(79,70,229,0.20)" strokeWidth="6" strokeLinecap="round" />
      <path d={rightD} fill="none" stroke="rgba(79,70,229,0.20)" strokeWidth="6" strokeLinecap="round" />
      
      {/* Left & right rails - gradient */}
      <path d={leftD} fill="none" stroke="url(#g)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />
      <path d={rightD} fill="none" stroke="url(#g)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />

      {/* Merge + spine - base */}
      <path d={spineD} fill="none" stroke="rgba(79,70,229,0.20)" strokeWidth="6" strokeLinecap="round" />
      
      {/* Merge + spine - gradient */}
      <path d={spineD} fill="none" stroke="url(#g)" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />

      {/* Small creator chips riding the rails */}
      {chipPts.map((p, i) => (
        <g key={i} transform={`translate(${p.x - 10},${p.y - 10})`}>
          <circle cx="10" cy="10" r="12" fill="#fff" />
          <circle cx="10" cy="10" r="8" fill="#ddd" />
          <circle cx="10" cy="10" r="12" fill="none" stroke="url(#g)" strokeWidth="2" opacity="0.7" />
        </g>
      ))}
    </svg>
  );
}

