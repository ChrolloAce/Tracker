import React from 'react';
import { X, TrendingUp, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SUBSCRIPTION_PLANS } from '../types/subscription';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: 'account' | 'video' | 'link' | 'team' | 'mcp';
  currentLimit: number;
  currentUsage: number;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  resourceType,
  currentLimit,
  currentUsage
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const resourceNames = {
    account: 'tracked accounts',
    video: 'tracked videos',
    link: 'tracked links',
    team: 'team members',
    mcp: 'MCP API calls'
  };

  const resourceName = resourceNames[resourceType];

  const getUpgradedPlans = () => {
    const plans = [];
    
    // Show Pro and Ultra plans
    const pro = SUBSCRIPTION_PLANS.pro;
    const ultra = SUBSCRIPTION_PLANS.ultra;

    const getLimitForResource = (plan: typeof pro) => {
      switch (resourceType) {
        case 'account':
          return plan.features.maxAccounts;
        case 'video':
          return plan.features.maxVideos;
        case 'link':
          return plan.features.maxLinks;
        case 'team':
          return plan.features.teamSeats;
        case 'mcp':
          return plan.features.mcpCallsPerMonth;
        default:
          return 0;
      }
    };

    const proLimit = getLimitForResource(pro);
    const ultraLimit = getLimitForResource(ultra);

    if (proLimit > currentLimit || proLimit === -1) {
      plans.push({
        name: 'Pro',
        price: pro.monthlyPrice,
        limit: proLimit,
        recommended: true
      });
    }

    if (ultraLimit > currentLimit || ultraLimit === -1) {
      plans.push({
        name: 'Ultra',
        price: ultra.monthlyPrice,
        limit: ultraLimit,
        recommended: false
      });
    }

    return plans;
  };

  const plans = getUpgradedPlans();

  const handleUpgrade = () => {
    onClose();
    navigate('/subscription');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-b border-white/10 p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Upgrade to Add More</h2>
                  <p className="text-sm text-gray-400">You've reached your limit</p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current Status */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">Limit Reached</p>
                <p className="text-xs text-gray-400">
                  You're using <span className="font-bold text-white">{currentUsage}</span> out of{' '}
                  <span className="font-bold text-white">{currentLimit}</span> {resourceName}
                </p>
              </div>
            </div>
          </div>

          {/* Upgrade Options */}
          <div className="space-y-3 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Available Upgrades</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative bg-white/3 border ${
                    plan.recommended ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' : 'border-white/10'
                  } rounded-xl p-5 hover:bg-white/5 transition-colors`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-xs font-bold rounded-full">
                        RECOMMENDED
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <h4 className="text-xl font-bold text-white mb-1">{plan.name}</h4>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold text-white">${plan.price}</span>
                      <span className="text-sm text-gray-400">/month</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300">
                        <span className="font-bold text-white">
                          {plan.limit === -1 ? 'Unlimited' : plan.limit.toLocaleString()}
                        </span>{' '}
                        {resourceName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300">All features included</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-gray-300">Priority support</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors"
            >
              Not Now
            </button>
            <button
              onClick={handleUpgrade}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20"
            >
              View Plans →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;

