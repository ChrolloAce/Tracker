import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Solutions', to: '/solutions' },
];

const NavBar = (_props?: { logo?: string; onGetStarted?: () => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'pt-2' : 'pt-4'}`}>
        <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="bg-white/80 backdrop-blur-xl border border-neutral-200 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
          <Link to="/" className="text-neutral-900 font-bold text-xl tracking-tight">
            ViewTrack
          </Link>

          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link to={link.to} className="text-sm text-neutral-500 hover:text-neutral-900 transition">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden md:inline text-sm text-neutral-500 hover:text-neutral-900 transition">
              Sign In
            </Link>
            <Link to="/start-tracking" className="hidden md:inline-flex items-center justify-center bg-orange-500 text-white rounded-xl px-5 py-2 text-sm font-medium shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all">
              Get Started
            </Link>

            <button type="button" className="md:hidden text-neutral-900 p-1" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-100">
            <Link to="/" className="text-neutral-900 font-bold text-xl tracking-tight" onClick={() => setMobileOpen(false)}>
              ViewTrack
            </Link>
            <button type="button" className="text-neutral-900 p-1" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex flex-col items-center justify-center flex-1 gap-8">
            {navLinks.map((link) => (
              <Link key={link.label} to={link.to} className="text-2xl text-neutral-700 hover:text-neutral-900 transition" onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link to="/login" className="text-lg text-neutral-500 hover:text-neutral-900 transition" onClick={() => setMobileOpen(false)}>
              Sign In
            </Link>
            <Link to="/start-tracking" className="bg-orange-500 text-white rounded-xl px-8 py-3 text-base font-medium shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all" onClick={() => setMobileOpen(false)}>
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </>
  );
};

export default NavBar;
