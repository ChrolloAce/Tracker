import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter } from 'lucide-react';

const linkClasses = 'text-sm text-neutral-500 hover:text-neutral-900 transition-colors';

const Footer: React.FC = () => {
  return (
    <footer className="bg-neutral-50 border-t border-neutral-200">
      <div className="max-w-7xl mx-auto py-16 px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/" className="text-xl font-bold text-neutral-900">
              ViewTrack
            </Link>
            <p className="text-sm text-neutral-500">
              The all-in-one platform for creator analytics and campaign management.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
              Product
            </h4>
            <ul className="space-y-2">
              <li><Link to="/features" className={linkClasses}>Features</Link></li>
              <li><Link to="/pricing" className={linkClasses}>Pricing</Link></li>
              <li><Link to="/solutions" className={linkClasses}>Solutions</Link></li>
              <li><Link to="/features/chrome-extension" className={linkClasses}>Chrome Extension</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
              Resources
            </h4>
            <ul className="space-y-2">
              <li><Link to="/blog" className={linkClasses}>Blog</Link></li>
              <li><Link to="/docs" className={linkClasses}>Documentation</Link></li>
              <li><Link to="/api" className={linkClasses}>API</Link></li>
              <li><Link to="/support" className={linkClasses}>Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
              Legal
            </h4>
            <ul className="space-y-2">
              <li><Link to="/privacy" className={linkClasses}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={linkClasses}>Terms of Service</Link></li>
              <li><Link to="/security" className={linkClasses}>Security</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-neutral-200 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-600">
            &copy; 2026 ViewTrack. All rights reserved.
          </p>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <Twitter className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
