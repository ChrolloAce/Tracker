import React from 'react';
import { X, DollarSign } from 'lucide-react';
import { RevenueIntegrationsSettings } from './RevenueIntegrationsSettings';

interface RevenueIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  projectId: string;
}

const RevenueIntegrationsModal: React.FC<RevenueIntegrationsModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  projectId
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0A0A0A] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Revenue Integrations</h2>
              <p className="text-sm text-gray-400">Connect and manage your revenue tracking sources</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <RevenueIntegrationsSettings 
            organizationId={organizationId}
            projectId={projectId}
          />
        </div>
      </div>
    </div>
  );
};

export default RevenueIntegrationsModal;

