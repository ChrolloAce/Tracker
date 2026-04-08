import React from 'react';
import { Link } from 'react-router-dom';


const linkClasses = 'text-sm text-neutral-500 hover:text-neutral-900 transition-colors';

const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200">
      <div className="max-w-6xl mx-auto py-16 px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2">
              <img src="/Viewtrack Logo Black.png" alt="ViewTrack" className="h-7" />
              <span className="text-xl font-bold text-neutral-900">ViewTrack</span>
            </Link>
            <p className="text-sm text-neutral-500">
              The all-in-one platform for creator analytics and campaign management.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Sections</h4>
            <ul className="space-y-2">
              <li><a href="#features" className={linkClasses}>Features</a></li>
              <li><a href="#reviews" className={linkClasses}>Reviews</a></li>
              <li><a href="#pricing" className={linkClasses}>Pricing</a></li>
              <li><a href="#faq" className={linkClasses}>FAQ</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/privacy" className={linkClasses}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={linkClasses}>Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-200 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-600">&copy; {new Date().getFullYear()} ViewTrack. All rights reserved.</p>
          <a href="https://x.com/tryviewtrack" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5">
            <img src="/twitter-x-logo.png" className="h-4 w-4 object-contain" alt="X" />
            <span className="text-sm">@tryviewtrack</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
