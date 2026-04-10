import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Play,
  Bell,
} from 'lucide-react';
import Footer from '../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

// Mini live graph — canvas with smooth interpolation to new targets
const LiveGraph: React.FC<{ onTrend?: (up: boolean) => void }> = ({ onTrend }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const currentRef = React.useRef<number[]>(Array.from({ length: 16 }, () => Math.random() * 24 + 3));
  const targetRef = React.useRef<number[]>([...currentRef.current]);
  const colorRef = React.useRef('#22c55e');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas to actual display size for crispness
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.getContext('2d')?.scale(dpr, dpr);
    };
    resize();

    const addTarget = () => {
      const t = targetRef.current;
      t.push(Math.random() * 24 + 3);
      if (t.length > 16) t.shift();
      // Sync current length
      while (currentRef.current.length < t.length) currentRef.current.push(t[currentRef.current.length]);
      if (currentRef.current.length > t.length) currentRef.current.shift();
      const up = t[t.length - 1] < t[t.length - 2];
      colorRef.current = up ? '#22c55e' : '#ef4444';
      onTrend?.(up);
    };

    const pointInterval = setInterval(addTarget, 2000);

    let frame: number;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;

      // Lerp current toward target
      const cur = currentRef.current;
      const tgt = targetRef.current;
      for (let i = 0; i < cur.length; i++) {
        cur[i] += (tgt[i] - cur[i]) * 0.06;
      }

      const step = w / (cur.length - 1);
      const color = colorRef.current;

      ctx.clearRect(0, 0, w, h);

      // Build curve
      ctx.beginPath();
      ctx.moveTo(0, cur[0]);
      for (let i = 1; i < cur.length; i++) {
        const cx = (step * (i - 1) + step * i) / 2;
        const cy = (cur[i - 1] + cur[i]) / 2;
        ctx.quadraticCurveTo(step * (i - 1), cur[i - 1], cx, cy);
      }
      ctx.lineTo(w, cur[cur.length - 1]);

      // Stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Fill
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = color + '18';
      ctx.fill();

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => { clearInterval(pointInterval); cancelAnimationFrame(frame); };
  }, [onTrend]);

  return <canvas ref={canvasRef} className="w-full h-10" />;
};

// Animated counter
const LiveCounter: React.FC<{ base: number }> = ({ base }) => {
  const [val, setVal] = useState(base);
  useEffect(() => {
    const interval = setInterval(() => {
      const delta = base < 100 ? Math.floor((Math.random() - 0.45) * 3) : Math.floor((Math.random() - 0.4) * base * 0.05);
      setVal(v => Math.max(1, v + delta));
    }, 2000);
    return () => clearInterval(interval);
  }, [base]);

  let display: string;
  if (val >= 1_000_000) display = (val / 1_000_000).toFixed(2) + 'M';
  else if (val >= 100_000) display = (val / 1_000).toFixed(0) + 'K';
  else if (val >= 1_000) display = (val / 1_000).toFixed(1) + 'K';
  else display = val.toString();

  return <span>{display}</span>;
};

// Sliding price number — digits slide up/down when value changes
const SlidePrice: React.FC<{ value: number; prefix?: string }> = ({ prefix = '$', value }) => {
  const str = value.toString();
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span>{prefix}</span>
      {str.split('').map((digit, i) => (
        <span key={i} className="relative inline-block overflow-hidden" style={{ width: '0.6em', height: '1.15em' }}>
          <span
            className="absolute inset-x-0 transition-transform duration-500 ease-out"
            style={{ transform: `translateY(${-parseInt(digit) * 1.15}em)` }}
          >
            {[0,1,2,3,4,5,6,7,8,9].map(n => (
              <span key={n} className="block" style={{ height: '1.15em', lineHeight: '1.15em' }}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
};

// Smooth counting number — animates from old value to new
const SmoothNumber: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const targetRef = React.useRef(value);
  const frameRef = React.useRef<number>(0);

  useEffect(() => {
    targetRef.current = value;
    let current = display;

    const tick = () => {
      const diff = targetRef.current - current;
      if (Math.abs(diff) < 1) { setDisplay(targetRef.current); return; }
      current += diff * 0.08;
      setDisplay(Math.round(current));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
};

// Animated bar chart race — creators swap positions smoothly
const LinkBarChart: React.FC = () => {
  const ROW_H = 52;
  const GAP = 8;
  const initData = [
    { id: 'bible', name: 'Bible Stories', avatar: '/avatar-1.jpg', clicks: 2847 },
    { id: 'jack', name: 'Jack', avatar: '/avatar-2.jpg', clicks: 1923 },
    { id: 'prayer', name: 'Prayer Lock', avatar: '/avatar-3.jpg', clicks: 1456 },
    { id: 'gabe', name: 'Gabriel', avatar: '/avatar-4.jpg', clicks: 892 },
    { id: 'nev', name: 'Nev', avatar: '/avatar-5.jpg', clicks: 650 },
  ];

  // Keep items in ORIGINAL order always — never re-sort the array
  // Only update clicks and rankMap
  const [items, setItems] = useState(initData);
  const [rankMap, setRankMap] = useState<Record<string, number>>({
    bible: 0, jack: 1, prayer: 2, gabe: 3, nev: 4,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setItems(prev => {
        // Update clicks
        const updated = prev.map(c => ({
          ...c,
          clicks: Math.max(50, c.clicks + Math.floor((Math.random() - 0.4) * 1200)),
        }));

        // Force a swap by boosting one
        const byClicks = [...updated].sort((a, b) => b.clicks - a.clicks);
        const swapFrom = 1 + Math.floor(Math.random() * (byClicks.length - 1));
        const swapTo = Math.floor(Math.random() * swapFrom);
        // Find the item in updated array and boost its clicks
        const boostId = byClicks[swapFrom].id;
        const targetClicks = byClicks[swapTo].clicks;
        const finalItems = updated.map(c =>
          c.id === boostId ? { ...c, clicks: targetClicks + Math.floor(Math.random() * 100) + 30 } : c
        );

        // Compute new ranks from clicks
        const sorted = [...finalItems].sort((a, b) => b.clicks - a.clicks);
        const newRanks: Record<string, number> = {};
        sorted.forEach((c, i) => { newRanks[c.id] = i; });
        setRankMap(newRanks);

        return finalItems; // keep original order!
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const maxClicks = Math.max(...items.map(c => c.clicks));
  const totalH = items.length * ROW_H + (items.length - 1) * GAP;

  return (
    <div className="relative">
      <div className="text-[10px] text-neutral-400 uppercase tracking-widest mb-3">Clicks by Creator</div>
      <div className="relative" style={{ height: totalH }}>
        {items.map((c) => (
          <div
            key={c.id}
            className="absolute left-0 right-0 flex items-center gap-2.5 will-change-transform"
            style={{
              transform: `translateY(${(rankMap[c.id] ?? 0) * (ROW_H + GAP)}px)`,
              height: ROW_H,
              transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <img src={c.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            <div className="flex-1">
              <div className="h-9 bg-neutral-100 rounded-xl overflow-hidden relative">
                <div
                  style={{ width: `${Math.max(20, (c.clicks / maxClicks) * 100)}%`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl flex items-center justify-end pr-3"
                >
                  <span className="text-xs font-bold text-white tabular-nums"><SmoothNumber value={c.clicks} /></span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TYPEWRITER_PHRASES = [
  'all your creators',
  'all your competitors',
  'all your payouts',
  'everything you need to scale',
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [billingYearly, setBillingYearly] = useState(true);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const phrase = TYPEWRITER_PHRASES[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < phrase.length) {
      timeout = setTimeout(() => setCharIdx(charIdx + 1), 60);
    } else if (!deleting && charIdx === phrase.length) {
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx(charIdx - 1), 30);
    } else if (deleting && charIdx === 0) {
      setDeleting(false);
      setPhraseIdx((phraseIdx + 1) % TYPEWRITER_PHRASES.length);
    }

    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx]);

  const onGetStarted = () => {
    navigate('/login');
  };

  const onWatchDemo = () => {
    navigate('/demo/dashboard');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: "'Oswald', sans-serif" }}>
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500" style={{ paddingTop: scrolled ? '8px' : '16px' }}>
        <div className={`mx-auto px-4 md:px-6 transition-all duration-500 ${scrolled ? 'max-w-6xl' : 'max-w-5xl'}`}>
          <div className={`bg-white/80 backdrop-blur-xl border border-neutral-200 rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-500 ${scrolled ? 'shadow-lg' : 'shadow-sm'}`}>
            <img src={viewtrackLogo} alt="ViewTrack" className="h-8" />

            <div className="hidden md:flex items-center gap-8 text-sm text-neutral-500">
              <a href="#features" className="hover:text-neutral-900 transition-colors">Features</a>
              <a href="#reviews" className="hover:text-neutral-900 transition-colors">Reviews</a>
              <a href="#pricing" className="hover:text-neutral-900 transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-neutral-900 transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/login')} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors hidden sm:block">
                Sign In
              </button>
              <button onClick={onGetStarted} className="px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 md:pt-44 pb-16 md:pb-24 px-4 md:px-6 relative overflow-hidden">
        {/* Orange gradient with dot pattern */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1400px] h-[900px] bg-gradient-to-t from-orange-200 via-orange-100/50 to-transparent rounded-full blur-3xl" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, #f97316 1.5px, transparent 1.5px)',
              backgroundSize: '20px 20px',
              opacity: 0.35,
              maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 55%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 55%)',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Platform logos */}
            <div className="flex items-center justify-center gap-5 mb-8">
              {[
                { src: '/TiktokLogo.png', alt: 'TikTok' },
                { src: '/Instagram_icon.png', alt: 'Instagram' },
                { src: '/Youtube_shorts_icon.svg.png', alt: 'YouTube' },
                { src: '/twitter-x-logo.png', alt: 'X' },
              ].map((p) => (
                <img key={p.alt} src={p.src} alt={p.alt} className="h-7 w-7 object-contain opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all" />
              ))}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-neutral-900 leading-[1.1] tracking-tight mb-6">
              Track any account across all socials <span className="text-neutral-400">in one synced dashboard.</span>
            </h1>

            <p className="text-base md:text-lg text-neutral-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              ViewTrack tracks{' '}
              <span className="text-neutral-900 font-medium">
                {TYPEWRITER_PHRASES[phraseIdx].substring(0, charIdx)}
              </span>
              <span className="inline-block w-[2px] h-5 bg-orange-500 align-middle ml-0.5 animate-pulse" />
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button onClick={onGetStarted} className="group w-full sm:w-auto px-8 py-3.5 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={onWatchDemo} className="w-full sm:w-auto px-8 py-3.5 bg-white border border-neutral-300 text-neutral-700 font-semibold rounded-xl shadow-[0_4px_0_0_#d4d4d4] hover:shadow-[0_2px_0_0_#d4d4d4] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                30 Second Demo
              </button>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-2xl shadow-neutral-200/50">
              <video autoPlay muted loop playsInline className="w-full" poster="/LANDINGPAGE-PHOOTS/TrackView.png">
                <source src="/viewtrack-demo.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGO MARQUEE ── */}
      <section className="py-12 md:py-16 border-y border-neutral-100 bg-neutral-50 overflow-hidden">
        <p className="text-center text-xs uppercase tracking-widest text-neutral-400 mb-8">Trusted by growing brands</p>
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div className="flex animate-marquee gap-12 items-center whitespace-nowrap">
            {[...Array(2)].map((_, setIdx) => (
              <React.Fragment key={setIdx}>
                {[
                  { src: '/brand-prayerlock.jpg', name: 'Prayer Lock' },
                  { src: '/brand-snapout.jpg', name: 'Snapout' },
                  { src: '/brand-facecard.jpg', name: 'Facecard' },
                  { src: '/brand-gamemaps.jpg', name: 'Game Maps IRL' },
                  { src: '/brand-cuffed.jpg', name: 'Cuffed' },
                  { src: '/brand-ccn.webp', name: 'CCN: TCG' },
                  { src: '/brand-munch.jpg', name: 'Munch' },
                ].map((brand) => (
                  <div key={`${setIdx}-${brand.name}`} className="flex items-center gap-3 px-2 select-none shrink-0">
                    <img src={brand.src} alt={brand.name} className="w-9 h-9 rounded-xl object-cover opacity-40 grayscale" />
                    <span className="text-sm font-semibold text-neutral-300">{brand.name}</span>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Marquee animation */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 30s linear infinite;
          }
        `}</style>
      </section>

      {/* ── HOW IT WORKS — 3 steps with images ── */}
      <section className="py-24 md:py-32 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold text-center mb-12 uppercase tracking-tight">How it works</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Track any account without login', desc: 'Add your creators and track your competitors. Just paste a public link.', img: '/step-add.png' },
              { step: '02', title: 'Make data-driven decisions', desc: 'Views, engagement, CPM rates, and post schedules all in one dashboard.', img: '/step-track.png' },
              { step: '03', title: 'Scale your product with precision', desc: 'Define base fees and bonuses. We calculate, invoice, and pay creators for you.', img: '/step-pay.png' },
            ].map(({ step, title, desc, img }) => (
              <div key={step} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-56 overflow-hidden">
                  <img src={img} alt={title} className="w-full h-full object-cover" />
                </div>
                <div className="p-6">
                  <div className="text-2xl font-bold text-orange-500 mb-2">{step}</div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">{title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE SECTIONS (alternating left/right like Cluely) ── */}

      {/* Feature 1 — Dashboard: text left, image right */}
      <section id="features" className="py-24 md:py-32 px-4 md:px-6 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4 block">Analytics</span>
              <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 mb-4 leading-tight uppercase tracking-tight">
                All your creators, one dashboard.
              </h2>
              <p className="text-neutral-500 leading-relaxed mb-6">
                Track views, likes, comments, and engagement across TikTok, Instagram, YouTube, and X. All updating automatically. No more screenshots or spreadsheets.
              </p>
              <ul className="space-y-3">
                {['Real-time stats across all platforms', 'Auto-refresh, always up to date', 'Filter by campaign, creator, or date range'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-neutral-700">
                    <Check className="w-4 h-4 text-orange-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="mt-8 group px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm inline-flex items-center gap-2">
                Try it out now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            {/* Animated dashboard mock */}
            <div className="rounded-2xl border border-neutral-200 shadow-xl bg-white p-5 overflow-hidden">
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[{ label: 'Total Views', base: 9500000 }, { label: 'Creators', base: 24 }, { label: 'Engagement', base: 48, pct: true }, { label: 'Videos', base: 312 }].map((s, i) => (
                  <div key={s.label} className="bg-neutral-50 rounded-xl p-2.5 animate-pulse" style={{ animationDelay: `${i * 0.3}s`, animationDuration: '3s' }}>
                    <div className="text-[9px] text-neutral-400">{s.label}</div>
                    <div className="text-base font-bold text-neutral-900 tabular-nums">
                      {s.pct ? <><LiveCounter base={s.base} /><span className="text-[10px] font-normal">%</span></> : <LiveCounter base={s.base} />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-neutral-400 uppercase tracking-widest mb-3">Top Creators</div>
              <div className="space-y-3">
                {[
                  { platform: 'tiktok', views: 2100000, avatar: '/avatar-1.jpg' },
                  { platform: 'instagram', views: 1400000, avatar: '/avatar-2.jpg' },
                  { platform: 'youtube', views: 980000, avatar: '/avatar-3.jpg' },
                  { platform: 'tiktok', views: 870000, avatar: '/avatar-4.jpg' },
                  { platform: 'instagram', views: 650000, avatar: '/avatar-5.jpg' },
                ].map((c, idx) => {
                  const [trending, setTrending] = React.useState(true);
                  return (
                  <div key={idx} className="flex items-center gap-3 bg-neutral-50 rounded-xl px-3 py-3">
                    <div className="relative shrink-0">
                      <img src={c.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <img
                        src={c.platform === 'tiktok' ? '/TiktokLogo.png' : c.platform === 'instagram' ? '/Instagram_icon.png' : '/Youtube_shorts_icon.svg.png'}
                        alt={c.platform}
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white p-[1px] object-contain"
                      />
                    </div>
                    <div className="min-w-0 w-6" />
                    <div className="flex-1">
                      <LiveGraph onTrend={setTrending} />
                    </div>
                    <div className="text-right shrink-0 w-16">
                      <div className="text-sm font-bold text-neutral-900 tabular-nums"><LiveCounter base={c.views} /></div>
                      <div className={`text-[10px] font-medium tabular-nums transition-colors duration-500 ${trending ? 'text-green-500' : 'text-red-500'}`}>
                        {trending ? '▲ +' : '▼ -'}<LiveCounter base={12} />%
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2 — Link Tracking: image left, text right */}
      <section className="py-24 md:py-32 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            {/* Animated link tracking — bar chart race */}
            <div className="order-2 md:order-1 rounded-2xl border border-neutral-200 shadow-xl bg-white p-6 overflow-hidden relative">
              <LinkBarChart />
            </div>
            <div className="order-1 md:order-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4 block">Attribution</span>
              <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 mb-4 leading-tight uppercase tracking-tight">
                Track clicks. Attribute revenue.
              </h2>
              <p className="text-neutral-500 leading-relaxed mb-6">
                Generate branded short links for every creator post. See click-through rates, conversions, and revenue attribution in real time.
              </p>
              <ul className="space-y-3">
                {['Branded trackable links', 'Click analytics with location data', 'Revenue attribution per creator'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-neutral-700">
                    <Check className="w-4 h-4 text-orange-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="mt-8 group px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm inline-flex items-center gap-2">
                Try it out now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3 — Contracts: text left, image right */}
      <section className="py-24 md:py-32 px-4 md:px-6 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-4 block">Contracts</span>
              <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 mb-4 leading-tight uppercase tracking-tight">
                Contracts, built in.
              </h2>
              <p className="text-neutral-500 leading-relaxed mb-6">
                Create professional contracts from templates, send signing links, and track status. Built-in e-signatures make it seamless for both parties.
              </p>
              <ul className="space-y-3">
                {['Reusable contract templates', 'E-signature with draw or type', 'Real-time signing status'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-neutral-700">
                    <Check className="w-4 h-4 text-orange-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="mt-8 group px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm inline-flex items-center gap-2">
                Try it out now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            {/* Animated contracts mock */}
            <div className="rounded-2xl border border-neutral-200 shadow-xl bg-white p-6 overflow-hidden relative">
              {/* Contract header */}
              <div className="text-center mb-4">
                <div className="text-[10px] text-neutral-400 uppercase tracking-widest mb-1">Contract</div>
                <div className="text-sm font-semibold text-neutral-900">Content Creator Agreement</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">Between Acme Corp & @sarahcreates</div>
              </div>
              {/* Contract body lines */}
              <div className="space-y-2 mb-3">
                {[100, 92, 85, 100, 78, 95, 60].map((w, i) => (
                  <div key={i} className="h-1.5 bg-neutral-100 rounded-full" style={{ width: `${w}%` }} />
                ))}
              </div>
              {/* Terms section */}
              <div className="border-t border-neutral-100 pt-3 mb-3">
                <div className="text-[9px] text-neutral-400 uppercase tracking-widest mb-2">Terms</div>
                <div className="grid grid-cols-3 gap-2">
                  {[{ l: 'Duration', v: '6 months' }, { l: 'Rate', v: '$500/video' }, { l: 'Videos', v: '12 total' }].map(t => (
                    <div key={t.l} className="bg-neutral-50 rounded-lg p-2 text-center">
                      <div className="text-[9px] text-neutral-400">{t.l}</div>
                      <div className="text-[11px] font-semibold text-neutral-900">{t.v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Signatures — both animate */}
              <div className="border-t border-neutral-200 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-neutral-400 mb-2">Company</div>
                  <div className="h-12 border border-neutral-200 rounded-lg flex items-center justify-center bg-neutral-50">
                    <svg className="w-20 h-8 text-neutral-800" viewBox="0 0 120 35">
                      <path d="M4 28 C8 12 14 6 20 14 C26 22 28 8 34 10 C40 12 38 24 44 18 C50 12 52 6 58 14 L62 18 C64 20 66 16 70 12 C74 8 78 18 82 22 C86 26 88 14 92 10 C96 6 100 16 104 20 C108 24 112 12 116 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="400" className="animate-[drawSig_6s_ease-in-out_infinite]" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-400" /><span className="text-[10px] text-green-600 font-medium">Signed</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 mb-2">Creator</div>
                  <div className="h-12 border border-neutral-200 rounded-lg flex items-center justify-center bg-neutral-50">
                    <svg className="w-20 h-8 text-neutral-800" viewBox="0 0 120 35">
                      <path d="M6 24 C10 8 16 4 22 16 C28 28 30 6 38 12 C42 16 44 28 50 20 L56 14 C58 12 62 22 66 26 C70 30 72 10 78 8 C84 6 86 20 90 24 C94 28 98 8 102 6 L108 10 C110 12 114 22 118 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="400" className="animate-[drawSig2_6s_ease-in-out_infinite]" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-400" /><span className="text-[10px] text-green-600 font-medium">Signed</span></div>
                </div>
              </div>
              {/* "Contract Signed!" popup */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white border border-green-200 rounded-2xl shadow-2xl px-6 py-4 text-center animate-[popIn_6s_ease-in-out_infinite]">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="text-sm font-bold text-neutral-900">Contract Signed!</div>
                  <div className="text-[10px] text-neutral-500">Both parties have signed</div>
                </div>
              </div>
              <style>{`
                @keyframes drawSig { 0%, 15% { stroke-dashoffset: 400; } 45%, 100% { stroke-dashoffset: 0; } }
                @keyframes drawSig2 { 0%, 40% { stroke-dashoffset: 400; } 70%, 100% { stroke-dashoffset: 0; } }
                @keyframes popIn { 0%, 65% { opacity: 0; transform: scale(0.8); } 72%, 92% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.8); } }
              `}</style>
            </div>
          </div>
        </div>
      </section>


      {/* ── TESTIMONIALS — scrolling marquee ── */}
      <section id="reviews" className="py-16 md:py-20 overflow-hidden">
        <h2 className="text-4xl md:text-6xl font-bold text-center mb-10 px-4 uppercase tracking-tight">What others say</h2>

        {/* Row 1 — scrolls left */}
        <div className="relative mb-4">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee-left gap-4 whitespace-nowrap">
            {[...Array(2)].map((_, s) => (
              <React.Fragment key={s}>
                {[
                  { q: "ViewTrack is the only tool that lets us track every creator across every platform without asking for a single password. It just works.", name: 'Ernesto', role: 'App Founder', avatar: '/review-ernesto.jpg' },
                  { q: "We use ViewTrack to track over 10 creators for Prayer Lock, a $300K/yr app. It's the backbone of our entire creator program.", name: 'Mau', role: 'App Founder', avatar: '/review-luis.jpg' },
                  { q: "The contract management feature alone is worth it. Send, sign, done. No more back and forth over email.", name: 'Penelope L.', role: 'App Founder', avatar: '/review-penelope.jpg' },
                  { q: "We track 200+ creators across 4 platforms. ViewTrack handles it all without breaking a sweat.", name: 'Jah', role: 'App Founder', avatar: '/review-rogelio.jpg' },
                  { q: "I can see exactly which creators are performing and which aren't. The auto-refresh saves me hours every week.", name: 'Rogelio', role: 'App Founder', avatar: '/review-jah.jpg' },
                ].map(t => (
                  <div key={`${s}-${t.name}`} className="inline-flex flex-col bg-white rounded-2xl border border-neutral-200 p-8 w-[400px] shrink-0 whitespace-normal">
                    <p className="text-sm text-neutral-600 leading-relaxed mb-5 flex-1">{t.q}</p>
                    <div className="flex items-center gap-3">
                      <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        <div className="text-xs text-neutral-500">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Row 2 — scrolls right */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex animate-marquee-right gap-4 whitespace-nowrap">
            {[...Array(2)].map((_, s) => (
              <React.Fragment key={s}>
                {[
                  { q: "Best analytics tool we've used. Clean UI, fast data, and the Chrome extension is clutch for saving content on the fly.", name: 'Manuela', role: 'App Founder', avatar: '/review-manuela.jpg' },
                  { q: "The link tracking gives us attribution we never had before. We finally know which creators actually drive revenue.", name: 'Luis', role: 'App Founder', avatar: '/review-mau.jpg' },
                  { q: "Switched from a $500/mo tool and ViewTrack does more for a fraction of the price. Absolute no brainer.", name: 'Rogelio', role: 'App Founder', avatar: '/review-jah.jpg' },
                  { q: "Our creators love the portal. They can see their own stats without us having to send screenshots every week.", name: 'Jah', role: 'App Founder', avatar: '/review-rogelio.jpg' },
                  { q: "We use it to track everything for Prayer Lock. The dashboard is fast, the data is always fresh, and the team loves it.", name: 'Mau', role: 'App Founder', avatar: '/review-luis.jpg' },
                ].map(t => (
                  <div key={`${s}-${t.name}`} className="inline-flex flex-col bg-white rounded-2xl border border-neutral-200 p-8 w-[400px] shrink-0 whitespace-normal">
                    <p className="text-sm text-neutral-600 leading-relaxed mb-5 flex-1">{t.q}</p>
                    <div className="flex items-center gap-3">
                      <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                        <div className="text-xs text-neutral-500">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes marquee-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          @keyframes marquee-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
          .animate-marquee-left { animation: marquee-left 40s linear infinite; }
          .animate-marquee-right { animation: marquee-right 45s linear infinite; }
        `}</style>
      </section>

      {/* ── REPORTING & COLLABORATION BENTO ── */}
      <section className="py-24 md:py-32 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 uppercase tracking-tight">Features for a 10x team</h2>
          {/* Top row — 3 cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            {/* Card 1 — Integrations */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-neutral-50 h-48 flex items-center justify-center px-6 relative">
                {/* 3 video thumbnails stacked with rotation */}
                <div className="relative w-48 h-32">
                  <div className="absolute left-0 top-2 w-28 h-20 rounded-xl bg-gradient-to-br from-orange-200 to-orange-400 shadow-lg -rotate-6 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="w-6 h-6 text-white/80" /></div>
                  </div>
                  <div className="absolute right-0 top-0 w-28 h-20 rounded-xl bg-gradient-to-br from-pink-200 to-pink-400 shadow-lg rotate-3 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="w-6 h-6 text-white/80" /></div>
                  </div>
                  <div className="absolute left-6 top-6 w-32 h-22 rounded-xl bg-gradient-to-br from-blue-200 to-blue-400 shadow-xl z-10 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="w-7 h-7 text-white" /></div>
                  </div>
                  {/* Floating badges */}
                  <div className="absolute -top-1 -right-2 bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full z-20 shadow">VIRAL</div>
                  <div className="absolute bottom-0 -left-2 bg-white text-neutral-900 text-[8px] font-bold px-2 py-0.5 rounded-full z-20 shadow border border-neutral-200">2.4M views</div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-1">Viral Video Discovery</h3>
                <p className="text-sm text-neutral-500">Browse trending content across all platforms and save it to your library.</p>
              </div>
            </div>

            {/* Card 2 — Real-time Alerts (stacked notifications) */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-neutral-50 h-48 flex items-center justify-center px-6">
                <div className="relative w-full max-w-[240px]">
                  {/* Background stacked cards */}
                  <div className="absolute inset-x-3 top-2 h-full bg-white rounded-xl border border-neutral-200 opacity-40" />
                  <div className="absolute inset-x-1.5 top-1 h-full bg-white rounded-xl border border-neutral-200 opacity-60" />
                  {/* Front notification */}
                  <div className="relative bg-white rounded-xl shadow-lg border border-neutral-200 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-neutral-900">Video hit 2M views</p>
                        <p className="text-[10px] text-neutral-400">@prayerlock · TikTok</p>
                      </div>
                      <span className="text-[9px] text-orange-500 font-bold bg-orange-50 px-1.5 py-0.5 rounded shrink-0">NEW</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-neutral-900">Contract signed</p>
                        <p className="text-[10px] text-neutral-400">Gabriel Storm signed</p>
                      </div>
                      <span className="text-[9px] text-neutral-400">2m ago</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-1">Real-time Alerts</h3>
                <p className="text-sm text-neutral-500">Get notified when videos hit milestones or deadlines pass.</p>
              </div>
            </div>

            {/* Card 3 — Cross-platform Dashboard */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-white h-48 flex flex-col pt-4 pb-0 overflow-hidden">
                <div className="flex items-center justify-end gap-1.5 mb-2 px-5">
                  {['/Instagram_icon.png', '/Youtube_shorts_icon.svg.png', '/TiktokLogo.png', '/twitter-x-logo.png'].map((s, i) => (
                    <img key={i} src={s} className="w-3.5 h-3.5 object-contain opacity-50" alt="" />
                  ))}
                </div>
                <div className="flex-1 min-h-0">
                  <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="w-full h-full block">
                    <path d="M0,80 C30,75 50,60 80,50 C110,40 130,48 160,38 C190,28 210,35 240,22 C260,14 280,18 300,15" fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
                    <path d="M0,80 C30,75 50,60 80,50 C110,40 130,48 160,38 C190,28 210,35 240,22 C260,14 280,18 300,15 L300,100 L0,100 Z" fill="#f97316" fillOpacity="0.08" />
                  </svg>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-1">Cross-platform Dashboard</h3>
                <p className="text-sm text-neutral-500">TikTok, Instagram, YouTube, and X stats in one place.</p>
              </div>
            </div>
          </div>

          {/* Bottom row — 2 cards same height as top */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Card 4 — Team Roles */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-neutral-50 h-48 flex flex-col items-center justify-center p-5 gap-3">
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-neutral-200 w-full max-w-[280px]">
                  <img src="/review-ernesto.jpg" className="w-9 h-9 rounded-full object-cover" alt="" />
                  <div className="flex-1"><p className="text-xs font-medium text-neutral-900">Ernesto L.</p><p className="text-[9px] text-neutral-400">ernesto@team.com</p></div>
                  <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Admin</span>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-neutral-200 w-full max-w-[280px]">
                  <img src="/review-mau.jpg" className="w-9 h-9 rounded-full object-cover" alt="" />
                  <div className="flex-1"><p className="text-xs font-medium text-neutral-900">Mau B.</p><p className="text-[9px] text-neutral-400">mau@team.com</p></div>
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">View Only</span>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-1">Permissions & Roles</h3>
                <p className="text-sm text-neutral-500">Invite team members or stakeholders with custom access levels.</p>
              </div>
            </div>

            {/* Card 5 — API & Integrations */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-neutral-50 h-48 flex items-center justify-center px-5 relative">
                {/* Left: messaging platforms */}
                <div className="flex flex-col gap-3 items-center">
                  <img src="/logo-telegram.png" className="w-10 h-10 rounded-xl object-contain" alt="Telegram" />
                  <img src="/logo-whatsapp.png" className="w-10 h-10 rounded-xl object-contain" alt="WhatsApp" />
                  <img src="/logo-discord.webp" className="w-10 h-10 rounded-xl object-contain" alt="Discord" />
                </div>
                {/* Arrows SVG */}
                <svg className="w-16 h-32 mx-2" viewBox="0 0 60 120">
                  <defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#f97316" /></marker></defs>
                  <line x1="0" y1="20" x2="55" y2="60" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#ah)" />
                  <line x1="0" y1="60" x2="55" y2="60" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#ah)" />
                  <line x1="0" y1="100" x2="55" y2="60" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#ah)" />
                </svg>
                {/* Center: ViewTrack */}
                <div className="w-14 h-14 rounded-2xl bg-orange-500 shadow-lg flex items-center justify-center shrink-0">
                  <img src="/vtlogo.png" className="w-8 h-8" alt="ViewTrack" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-1">API & Integrations</h3>
                <p className="text-sm text-neutral-500">Connect with Telegram, WhatsApp, Discord, and your own tools via API.</p>
              </div>
            </div>

            {/* Card 6 — Creator Portals */}
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-neutral-50 h-48 flex flex-col items-center justify-center p-5 gap-2">
                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 w-full max-w-[240px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><img src="/avatar-5.jpg" className="w-8 h-8 rounded-full object-cover" alt="" /></div>
                    <div><p className="text-[10px] font-bold text-neutral-900">@nevanimates</p><p className="text-[8px] text-neutral-400">Creator Portal</p></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-neutral-50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-neutral-400">Views</p><p className="text-[10px] font-bold text-neutral-900">1.2M</p></div>
                    <div className="bg-neutral-50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-neutral-400">Videos</p><p className="text-[10px] font-bold text-neutral-900">48</p></div>
                    <div className="bg-neutral-50 rounded-lg p-1.5 text-center"><p className="text-[8px] text-neutral-400">Earned</p><p className="text-[10px] font-bold text-orange-500">$2.4K</p></div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-neutral-900 mb-1">Creator Portals</h3>
                <p className="text-sm text-neutral-500">Give creators a branded portal to view stats and submit content.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-10 uppercase tracking-tight">Simple and transparent pricing</h2>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={`text-sm font-medium ${!billingYearly ? 'text-neutral-900' : 'text-neutral-400'}`}>Monthly</span>
            <button
              onClick={() => setBillingYearly(!billingYearly)}
              className={`relative w-12 h-7 rounded-full transition-colors ${billingYearly ? 'bg-orange-500' : 'bg-neutral-300'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${billingYearly ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${billingYearly ? 'text-neutral-900' : 'text-neutral-400'}`}>Yearly</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-full transition-opacity ${billingYearly ? 'text-orange-500 bg-orange-50 opacity-100' : 'opacity-0'}`}>20% OFF</span>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {[
              {
                name: 'Starter',
                monthly: 24, yearly: 19,
                desc: 'Perfect for small teams and individual creators getting started.',
                features: ['Unlimited tracked accounts', 'Up to 150 videos', '24-hour data refresh', 'Creator portals', 'Contract management', '2 team seats', 'Email support'],
                cta: 'Get Started', ctaStyle: 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50',
                gradient: 'from-neutral-100 to-neutral-50', highlighted: false,
              },
              {
                name: 'Pro',
                monthly: 79, yearly: 65,
                desc: 'For growing brands scaling their creator campaigns.',
                features: ['Unlimited tracked accounts', 'Up to 1,000 videos', '24-hour data refresh', 'Revenue tracking & attribution', 'Creator campaigns', 'Creator portals', 'Contract management', '5 team seats', 'Priority support'],
                cta: 'Get Started', ctaStyle: 'bg-orange-500 text-white hover:bg-orange-600',
                gradient: 'from-orange-100 to-orange-50', highlighted: true,
              },
              {
                name: 'Ultra',
                monthly: 199, yearly: 165,
                desc: 'For agencies and large teams with high-volume needs.',
                features: ['Unlimited tracked accounts', 'Up to 5,000 videos', '12-hour data refresh', 'Revenue tracking & attribution', 'Creator campaigns', '15 team seats', 'API access', 'Dedicated account manager', 'Custom integrations'],
                cta: 'Get Started', ctaStyle: 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50',
                gradient: 'from-neutral-100 to-neutral-50', highlighted: false,
              },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-2xl overflow-hidden flex flex-col relative ${plan.highlighted ? 'bg-orange-500 text-white shadow-xl' : 'border border-neutral-200 bg-white'}`}>
                {plan.highlighted && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-neutral-900 text-white text-[10px] font-semibold uppercase tracking-wider rounded-b-xl z-10">Most Popular</div>
                )}
                {/* Top area */}
                <div className={`px-8 pt-10 pb-6 ${plan.highlighted ? '' : `bg-gradient-to-br ${plan.gradient}`}`}>
                  <h3 className={`text-lg font-semibold mb-3 ${plan.highlighted ? 'text-white' : 'text-neutral-900'}`}>{plan.name}</h3>
                  <p className={`text-xs mb-1 ${plan.highlighted ? 'text-orange-200' : 'text-neutral-400'}`}>Starts at</p>
                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className={`text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-neutral-900'}`}>
                      <SlidePrice value={billingYearly ? plan.yearly : plan.monthly} />
                    </span>
                    <span className={`text-sm ${plan.highlighted ? 'text-orange-200' : 'text-neutral-500'}`}>/month</span>
                  </div>
                  <p className={`text-sm leading-relaxed ${plan.highlighted ? 'text-orange-100' : 'text-neutral-500'}`}>{plan.desc}</p>
                  <p className={`text-xs mt-2 ${plan.highlighted ? 'text-orange-200' : 'text-neutral-400'}`}>
                    {billingYearly ? `Billed annually at $${(billingYearly ? plan.yearly : plan.monthly) * 12}` : 'Billed monthly'}
                  </p>
                </div>
                {/* CTA */}
                <div className="px-8 py-5">
                  <button
                    onClick={plan.name === 'Enterprise' ? () => navigate('/pricing') : onGetStarted}
                    className={`w-full py-3.5 font-semibold rounded-xl text-sm ${plan.highlighted ? 'bg-white text-orange-600 shadow-[0_4px_0_0_#e5e5e5] hover:shadow-[0_2px_0_0_#e5e5e5] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]' : 'bg-orange-500 text-white shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]'} transition-all`}
                  >
                    {plan.cta} <ArrowRight className="w-4 h-4 inline ml-1" />
                  </button>
                </div>
                {/* Divider + features */}
                <div className="px-8 pb-8">
                  <div className={`border-t pt-5 mb-4 ${plan.highlighted ? 'border-orange-400/30' : 'border-neutral-200'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${plan.highlighted ? 'text-orange-200' : 'text-neutral-400'}`}>
                      {plan.name === 'Starter' ? 'Includes:' : plan.name === 'Pro' ? 'Starter features, plus:' : 'Pro features, plus:'}
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map(f => (
                      <li key={f} className={`flex items-center gap-2.5 text-sm ${plan.highlighted ? 'text-white' : 'text-neutral-700'}`}>
                        <Check className={`w-4 h-4 shrink-0 ${plan.highlighted ? 'text-orange-200' : 'text-orange-500'}`} />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

          {/* Custom Enterprise card */}
          <div className="max-w-6xl mx-auto mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-8 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-sm font-bold text-orange-500 uppercase tracking-wider mb-2">Enterprise</p>
                <h3 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3 tracking-tight">Custom pricing</h3>
                <p className="text-neutral-500 leading-relaxed mb-6">
                  Unlimited tracking, live data refreshes, and custom workflows for brands operating at scale.
                </p>
                <button onClick={() => navigate('/pricing')} className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm inline-flex items-center gap-2">
                  Book Enterprise Call <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <ul className="space-y-3">
                  {['Unlimited tracking', 'Hourly data refreshes', 'Custom integrations and workflows', 'Dedicated Slack channel support', 'Priority feature requests'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-neutral-700">
                      <Check className="w-4 h-4 text-orange-500 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 md:py-32 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 uppercase tracking-tight">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              { q: 'Who is ViewTrack for?', a: 'ViewTrack is built for brands, agencies, and app founders running creator marketing campaigns. Use it to track video performance, manage contracts, and pay creators, all in one platform.' },
              { q: 'Do I need to connect my social accounts?', a: 'No. ViewTrack tracks public data. Just paste a creator\'s profile URL or video link. No passwords or OAuth connections required.' },
              { q: 'Which platforms are supported?', a: 'TikTok, Instagram, YouTube, and X (Twitter). We track views, likes, comments, shares, and engagement across all four platforms.' },
              { q: 'Can I track competitors?', a: 'Yes. Add any public account to your dashboard. Competitors, creators, or your own brand accounts. Track them all side by side.' },
              { q: 'Is there a free trial?', a: 'Yes. Start with a free trial on any plan. No credit card required. Cancel anytime.' },
              { q: 'How does contract management work?', a: 'Create contracts from templates, send signing links to creators, and track status. Both parties sign electronically with our built-in e-signature system.' },
            ].map(({ q, a }) => {
              const [open, setOpen] = React.useState(false);
              return (
                <div key={q} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                  <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left">
                    <span className="text-base font-semibold text-neutral-900 pr-4">{q}</span>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${open ? 'bg-orange-500 rotate-180' : 'bg-orange-100'}`}>
                      <img src="/Viewtrack Logo Black.png" alt="" className={`w-5 h-5 ${open ? 'invert brightness-200' : ''}`} />
                    </div>
                  </button>
                  {open && (
                    <div className="px-6 pb-5">
                      <p className="text-sm text-neutral-500 leading-relaxed">{a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28 px-4 md:px-6 bg-neutral-900">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">Ready to scale your creator program?</h2>
          <p className="text-neutral-400 mb-10 max-w-lg mx-auto">
            Join hundreds of brands using ViewTrack to track, manage, and pay creators. All in one platform.
          </p>
          <button onClick={onGetStarted} className="group px-10 py-4 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm inline-flex items-center gap-2">
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
