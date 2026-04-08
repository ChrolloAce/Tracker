import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Features', to: '/#features' },
  { label: 'Reviews', to: '/#reviews' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'FAQ', to: '/#faq' },
];

const NavBar = (_props?: { logo?: string; onGetStarted?: () => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleNavClick = (to: string) => {
    setMobileOpen(false);
    if (to.startsWith('/#')) {
      // If we're on the homepage, just scroll
      if (window.location.pathname === '/') {
        const el = document.querySelector(to.replace('/', ''));
        el?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Navigate home then scroll
        navigate('/');
        setTimeout(() => {
          const el = document.querySelector(to.replace('/', ''));
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      navigate(to);
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500" style={{ paddingTop: isScrolled ? '8px' : '16px' }}>
        <div className={`mx-auto px-4 md:px-6 transition-all duration-500 ${isScrolled ? 'max-w-6xl' : 'max-w-5xl'}`}>
          <div className={`bg-white/80 backdrop-blur-xl border border-neutral-200 rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-500 ${isScrolled ? 'shadow-lg' : 'shadow-sm'}`}>
            <Link to="/" className="flex items-center gap-2">
              <img src="/viewtrack-logo.png" alt="ViewTrack" className="h-8" />
            </Link>

            <div className="hidden md:flex items-center gap-8 text-sm text-neutral-500">
              {navLinks.map((link) => (
                <button key={link.label} onClick={() => handleNavClick(link.to)} className="hover:text-neutral-900 transition-colors">
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login" className="hidden md:inline text-sm text-neutral-500 hover:text-neutral-900 transition">
                Sign In
              </Link>
              <Link to="/login" className="hidden md:inline-flex items-center justify-center bg-orange-500 text-white rounded-xl px-5 py-2 text-sm font-medium shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all">
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
            <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
              <img src="/viewtrack-logo.png" alt="ViewTrack" className="h-7" />
            </Link>
            <button type="button" className="text-neutral-900 p-1" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex flex-col items-center justify-center flex-1 gap-8">
            {navLinks.map((link) => (
              <button key={link.label} onClick={() => handleNavClick(link.to)} className="text-2xl text-neutral-700 hover:text-neutral-900 transition">
                {link.label}
              </button>
            ))}
            <Link to="/login" className="text-lg text-neutral-500 hover:text-neutral-900 transition" onClick={() => setMobileOpen(false)}>
              Sign In
            </Link>
            <Link to="/login" className="bg-orange-500 text-white rounded-xl px-8 py-3 text-base font-medium shadow-[0_3px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[2px] active:shadow-none active:translate-y-[3px] transition-all" onClick={() => setMobileOpen(false)}>
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </>
  );
};

export default NavBar;
