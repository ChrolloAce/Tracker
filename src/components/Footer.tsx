import React from 'react';
import { Link } from 'react-router-dom';
import viewtrackLogo from '/Viewtrack Logo Black.png';

const Footer: React.FC = () => {
  return (
    <footer className="py-8 md:py-12 px-4 md:px-6 border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          <Link to="/" className="flex items-center space-x-3">
            <img src={viewtrackLogo} alt="ViewTrack" className="h-7 md:h-8 w-auto" />
          </Link>
          
          {/* Footer Links */}
          <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm">
            <Link 
              to="/privacy" 
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/terms" 
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              to="/support" 
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Support
            </Link>
          </div>
          
          <p className="text-xs md:text-sm text-gray-500">
            © {new Date().getFullYear()} ViewTrack. Track smarter, grow faster.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

