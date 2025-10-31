import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavBarProps {
  logo: string;
  onGetStarted: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ logo, onGetStarted }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'benefits', label: 'Benefits' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'faq', label: 'FAQs' },
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="relative z-50 mt-6 md:mt-8">
      <div className="mx-auto max-w-[1100px] px-4 md:px-6">
        <nav 
          role="navigation" 
          aria-label="Primary"
          className="flex items-center justify-between rounded-full bg-white border border-black/[0.06] py-2.5 pl-3 pr-2 md:py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_1px_0_rgba(0,0,0,0.04)]"
        >
          {/* Left: Logo */}
          <a href="/" className="flex items-center gap-2 pl-2.5 md:pl-3 pr-2">
            <img src={logo} alt="ViewTrack" className="h-7 w-auto" />
          </a>

          {/* Center: Desktop Links */}
          <ul className="hidden md:flex items-center gap-8 lg:gap-10 text-[15px]">
            {navLinks.map((link) => (
              <li key={link.id} className="relative">
                <button
                  onClick={() => scrollToSection(link.id)}
                  className="text-gray-700 hover:text-black transition-colors duration-200 font-medium focus:outline-none focus-visible:text-black"
                >
                  {link.label}
                </button>
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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-700" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Sheet */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 bg-white border border-black/[0.06] rounded-2xl shadow-xl p-4">
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => scrollToSection(link.id)}
                    className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                  >
                    {link.label}
                  </button>
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

