import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavBarProps {
  logo: string;
  onGetStarted: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ logo, onGetStarted }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Home', href: '#hero' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQs', href: '#faq' },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pt-6 md:pt-8">
      <div className="mx-auto max-w-[1100px] px-4 md:px-6">
        <nav 
          role="navigation" 
          aria-label="Primary"
          className="flex items-center justify-between rounded-full bg-white/80 backdrop-blur-xl border border-white/20 px-2.5 py-2.5 md:px-3 md:py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_1px_0_rgba(0,0,0,0.04)]"
          style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.1) inset' }}
        >
          {/* Left: Logo */}
          <a href="/" className="flex items-center gap-2 pl-2.5 md:pl-3 pr-2">
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
          <div className="flex items-center gap-2 pr-2 md:pr-3">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-[#111111] text-white px-4 py-2.5 text-[14.5px] font-medium shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 transition"
            >
              View Plans
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

