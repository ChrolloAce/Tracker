import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Link2,
  FileText,
  Users,
  Globe,
  RefreshCw,
  Check,
  X,
  Play,
  Zap,
} from 'lucide-react';
import Footer from '../components/Footer';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const onGetStarted = () => {
    navigate('/demo/dashboard');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 pt-4">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="bg-white/80 backdrop-blur-xl border border-neutral-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
            <img src={viewtrackLogo} alt="ViewTrack" className="h-6" />

            <div className="hidden md:flex items-center gap-8 text-sm text-neutral-500">
              <a href="#features" className="hover:text-neutral-900 transition-colors">Features</a>
              <a href="/pricing" className="hover:text-neutral-900 transition-colors">Pricing</a>
              <a href="/solutions" className="hover:text-neutral-900 transition-colors">Solutions</a>
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

            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-neutral-900 leading-[1.15] tracking-tight mb-6">
              Track every creator. Pay results. <span className="text-neutral-400">Zero spreadsheets.</span>
            </h1>

            <p className="text-base md:text-lg text-neutral-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              The all-in-one platform to track, manage, and analyze your creator campaigns across TikTok, Instagram, YouTube, and X.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button onClick={onGetStarted} className="group w-full sm:w-auto px-8 py-3.5 bg-orange-500 text-white font-semibold rounded-xl shadow-[0_4px_0_0_#c2410c] hover:shadow-[0_2px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm flex items-center justify-center gap-2">
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={onGetStarted} className="w-full sm:w-auto px-8 py-3.5 bg-white border border-neutral-300 text-neutral-700 font-semibold rounded-xl shadow-[0_4px_0_0_#d4d4d4] hover:shadow-[0_2px_0_0_#d4d4d4] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all text-sm flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                Watch Demo
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
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-neutral-50 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-neutral-50 to-transparent z-10 pointer-events-none" />

          <div className="flex animate-marquee gap-16 items-center whitespace-nowrap">
            {[...Array(2)].map((_, setIdx) => (
              <React.Fragment key={setIdx}>
                {['Acme Corp', 'Bloom Beauty', 'FitFuel', 'Wander Goods', 'NovaBrand', 'Peakly', 'Crestline', 'UrbanEdge', 'Solara', 'Kinetic Labs'].map((brand) => (
                  <span key={`${setIdx}-${brand}`} className="text-lg font-semibold text-neutral-300 select-none px-4">
                    {brand}
                  </span>
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

      {/* ── BEFORE / AFTER ── */}
      <section className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">Stop drowning in spreadsheets</h2>
          <p className="text-neutral-500 text-center mb-14 max-w-xl mx-auto">See the difference ViewTrack makes for your creator program.</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8">
              <div className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-6">Without ViewTrack</div>
              <ul className="space-y-4">
                {['Manual tracking across platforms', 'Screenshot-based analytics', 'Spreadsheet chaos', 'Invoice nightmares'].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-neutral-700">
                    <X className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8">
              <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-6">With ViewTrack</div>
              <ul className="space-y-4">
                {['Automated tracking across all platforms', 'Real-time dashboard analytics', 'One-click reports', 'Seamless creator payments'].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-neutral-700">
                    <Check className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 md:py-28 px-4 md:px-6 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">How it works</h2>
          <p className="text-neutral-500 text-center mb-14 max-w-xl mx-auto">Get started in minutes, not days.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Add your creators', description: 'Paste any TikTok, Instagram, YouTube, or X link. We handle the rest.', icon: Users },
              { step: '02', title: 'Track performance', description: 'Real-time views, likes, and engagement across all platforms in one dashboard.', icon: BarChart3 },
              { step: '03', title: 'Scale & pay', description: 'Automated reports, contracts, and creator payments — all in one place.', icon: Zap },
            ].map(({ step, title, description, icon: Icon }) => (
              <div key={step} className="rounded-2xl border border-neutral-200 bg-white p-8 hover:shadow-lg hover:border-neutral-300 transition-all">
                <div className="text-xs font-mono text-neutral-400 mb-4">{step}</div>
                <Icon className="w-8 h-8 text-neutral-900 mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES BENTO ── */}
      <section id="features" className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">Everything you need</h2>
          <p className="text-neutral-500 text-center mb-14 max-w-xl mx-auto">A complete toolkit for managing creator campaigns at scale.</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: BarChart3, title: 'Campaign Analytics', desc: 'Track views, engagement, and ROI across every campaign in real time.' },
              { icon: Link2, title: 'Link Tracking', desc: 'Generate and monitor trackable links for every creator post.' },
              { icon: FileText, title: 'Contract Management', desc: 'Send, sign, and manage creator contracts without leaving the platform.' },
              { icon: Users, title: 'Creator Portal', desc: 'Give creators a branded portal to submit content and track payments.' },
              { icon: Globe, title: 'Chrome Extension', desc: 'Add videos to campaigns directly from TikTok, Instagram, or YouTube.' },
              { icon: RefreshCw, title: 'Auto-Refresh Stats', desc: 'Stats update automatically so your data is always current.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border border-neutral-200 bg-white p-6 hover:shadow-lg hover:border-neutral-300 transition-all">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                  <Icon className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-base font-semibold text-neutral-900 mb-1">{title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT SCREENSHOTS ── */}
      <section className="py-20 md:py-28 px-4 md:px-6 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">See it in action</h2>
          <p className="text-neutral-500 text-center mb-14 max-w-xl mx-auto">A dashboard designed for speed and clarity.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { src: '/LANDINGPAGE-PHOOTS/TrackView.png', label: 'Unified Dashboard' },
              { src: '/LANDINGPAGE-PHOOTS/TrackLinks.png', label: 'Link Tracking' },
              { src: '/LANDINGPAGE-PHOOTS/SignContracts.png', label: 'Contract Management' },
            ].map(({ src, label }) => (
              <div key={label} className="group">
                <div className="rounded-2xl overflow-hidden border border-neutral-200 mb-3 group-hover:shadow-lg transition-shadow">
                  <img src={src} alt={label} className="w-full object-cover" />
                </div>
                <p className="text-sm text-neutral-500 text-center font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 md:py-28 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">What teams are saying</h2>
          <p className="text-neutral-500 text-center mb-14 max-w-xl mx-auto">Hear from the brands already scaling with ViewTrack.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "ViewTrack replaced three tools for us. We track every creator post in one dashboard and the auto-refresh stats alone save hours each week.", name: 'Sarah Chen', role: 'Head of Influencer Marketing', company: 'Bloom Beauty' },
              { quote: "We went from spreadsheets to real-time analytics overnight. The contract management feature is a game-changer for scaling our program.", name: 'Marcus Rivera', role: 'Creator Partnerships Lead', company: 'FitFuel' },
              { quote: "Finally a platform that tracks TikTok, Instagram, YouTube, and X in one place. Our reporting time dropped by 80%.", name: 'Emily Nakamura', role: 'Marketing Director', company: 'Wander Goods' },
            ].map(({ quote, name, role, company }) => (
              <div key={name} className="rounded-2xl border border-neutral-200 bg-white p-6 flex flex-col hover:shadow-lg transition-shadow">
                <p className="text-sm text-neutral-600 leading-relaxed flex-1 mb-6">"{quote}"</p>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{name}</div>
                  <div className="text-xs text-neutral-500">{role}, {company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28 px-4 md:px-6 bg-neutral-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">Ready to scale your creator program?</h2>
          <p className="text-neutral-400 mb-10 max-w-lg mx-auto">
            Join hundreds of brands using ViewTrack to track, manage, and pay creators — all in one platform.
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
