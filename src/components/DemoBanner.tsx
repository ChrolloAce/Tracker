import React from 'react';
import { Eye, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DemoBanner: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-r from-[#2282FF] to-[#1b6dd9] border-b border-[#2282FF]/20">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Eye className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              Demo Mode - Read Only
            </p>
            <p className="text-white/80 text-xs">
              Exploring with sample data. Sign up to create your own account.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-[#2282FF] rounded-full transition-colors font-medium text-sm shadow-lg"
        >
          <span>Sign Up</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default DemoBanner;

