import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

interface NavBarProps {
  logo: string;
  onGetStarted: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ logo, onGetStarted }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', href: '#hero' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQs', href: '#faq' },
  ];

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out ${isScrolled ? 'pt-4' : 'pt-8'}`}>
      <div className={`mx-auto px-4 md:px-6 transition-all duration-500 ease-in-out ${isScrolled ? 'max-w-[1100px]' : 'max-w-[800px]'}`}>
        <nav 
          role="navigation" 
          aria-label="Primary"
          className={`flex items-center justify-between rounded-full border transition-all duration-500 ease-in-out
            ${isScrolled 
              ? 'bg-white/70 backdrop-blur-3xl border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(255,255,255,0.5)] py-3 px-4' 
              : 'bg-white/30 backdrop-blur-xl border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.02),inset_0_0_0_1px_rgba(255,255,255,0.1)] py-2.5 px-3'
            }`}
        >
          {/* Left: Logo */}
          <a href="/" className="flex items-center gap-2 pl-1 pr-2">
            <img src={logo} alt="ViewTrack" className="h-7 w-auto" />
          </a>

          {/* Center: Links (Desktop) */}
          <ul className="hidden md:flex items-center gap-8 lg:gap-10 text-[15px]">
            {navLinks.map((link) => (
              <li key={link.label} className="relative">
                <a
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    document.querySelector(link.href)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-gray-700 hover:text-black transition-colors font-medium relative group cursor-pointer"
                >
                  {link.label}
                  {/* Active indicator dot */}
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                </a>
              </li>
            ))}
          </ul>

          {/* Right: CTA + Mobile Menu */}
          <div className="flex items-center gap-2 pr-1">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] text-white px-4 py-2.5 text-[14.5px] font-medium shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign Up
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-700" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-4 right-4 mt-2 bg-white/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
            <ul className="py-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMobileMenuOpen(false);
                      document.querySelector(link.href)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="block px-6 py-3 text-gray-700 hover:bg-white/50 hover:text-black transition-colors font-medium cursor-pointer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavBar;
