import React, { useState, useEffect } from 'react';
import { 
  MoreHorizontal,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import SubscriptionService from '../services/SubscriptionService';
import UsageTrackingService, { UsageStatus } from '../services/UsageTrackingService';
import { PlanTier, SUBSCRIPTION_PLANS } from '../types/subscription';

const BillingManagementPage: React.FC = () => {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('free');
  const [subscription, setSubscription] = useState<any>(null);
  const [usageStatus, setUsageStatus] = useState<UsageStatus[]>([]);

  useEffect(() => {
    loadBillingInfo();
  }, [currentOrgId]);

  const loadBillingInfo = async () => {
    if (!currentOrgId) return;
    
    setLoading(true);
    try {
      const [tier, sub, usage] = await Promise.all([
        SubscriptionService.getPlanTier(currentOrgId),
        SubscriptionService.getSubscription(currentOrgId),
        UsageTrackingService.getUsageStatus(currentOrgId)
      ]);
      
      setCurrentPlan(tier);
      setSubscription(sub);
      setUsageStatus(usage);
    } catch (error) {
      console.error('Failed to load billing info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const planDetails = SUBSCRIPTION_PLANS[currentPlan];
  
  // Format dates
  const startDate = subscription?.createdAt 
    ? new Date(subscription.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'N/A';
  
  const nextBillingDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd.seconds * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'N/A';

  // Usage card data
  const usageCards = [
    {
      label: 'Tracked Videos',
      status: usageStatus.find(s => s.resource === 'Tracked Videos'),
      available: true
    },
    {
      label: 'Tracked Accounts',
      status: usageStatus.find(s => s.resource === 'Tracked Accounts'),
      available: true
    },
    {
      label: 'Manual Refreshes',
      status: null,
      available: planDetails.features.refreshOnDemand
    },
    {
      label: 'Team Seats',
      status: usageStatus.find(s => s.resource === 'Team Members'),
      available: true
    },
    {
      label: 'MCP Calls',
      status: usageStatus.find(s => s.resource === 'MCP Calls'),
      available: planDetails.features.mcpCallsPerMonth > 0
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Subscription</h1>
          <p className="text-gray-400">Manage your organization's subscription and billing information.</p>
        </div>

        {/* Usage Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          {usageCards.map((card, index) => (
            <UsageCard key={index} {...card} />
          ))}
        </div>

        {/* Subscription Details */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Subscription Details</h2>
          <p className="text-gray-400 mb-6">
            Compare all plans on our{' '}
            <a 
              href="/subscription" 
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              pricing page
            </a>
            . If you have specific needs,{' '}
            <a 
              href="mailto:support@viewtrack.app" 
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              talk to us
            </a>
            .
          </p>

          {/* Plan Breakdown Table */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-6">
            <div className="space-y-4">
              <DetailRow label="Active Plan" value={planDetails.displayName + ' Plan'} />
              <DetailRow 
                label="Billing Cycle" 
                value={subscription?.interval === 'year' ? 'Yearly' : 'Monthly'} 
              />
              <DetailRow label="Started On" value={startDate} />
              <DetailRow 
                label={subscription?.interval === 'year' ? 'Yearly Price' : 'Monthly Price'} 
                value={`$${subscription?.interval === 'year' ? planDetails.yearlyPrice.toFixed(2) : planDetails.monthlyPrice.toFixed(2)}`} 
              />
              <DetailRow label="Next Billing Date" value={nextBillingDate} />
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => navigate('/subscription')}
                className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg font-medium transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Upgrade Plan
              </button>
              <button className="p-2.5 hover:bg-white/5 rounded-lg transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Usage Card Component with Circular Progress
interface UsageCardProps {
  label: string;
  status: UsageStatus | undefined | null;
  available: boolean;
}

const UsageCard: React.FC<UsageCardProps> = ({ label, status, available }) => {
  if (!available) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center">
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-white/10"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-600">—</span>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-500 text-center">{label}</p>
        <p className="text-xs text-gray-600 text-center mt-1">Not available</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center">
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-white/10"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-400">0%</span>
          </div>
        </div>
        <p className="text-sm font-medium text-gray-400 text-center">{label}</p>
        <p className="text-xs text-gray-500 text-center mt-1">0 of 0 used</p>
      </div>
    );
  }

  const percentage = status.isUnlimited ? 0 : status.percentage;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Color based on usage
  const getColor = () => {
    if (status.isUnlimited) return 'text-emerald-400';
    if (status.isOverLimit) return 'text-red-400';
    if (status.isNearLimit) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center hover:bg-black/60 transition-colors">
      <div className="relative w-24 h-24 mb-4">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-white/10"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className={getColor()}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${getColor()}`}>
            {status.isUnlimited ? '∞' : `${Math.round(percentage)}%`}
          </span>
        </div>
      </div>
      <p className="text-sm font-medium text-gray-300 text-center">{label}</p>
      <p className="text-xs text-gray-500 text-center mt-1">
        {status.current} of {status.isUnlimited ? '∞' : status.limit} used
      </p>
    </div>
  );
};

// Detail Row Component
interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
};

export default BillingManagementPage;
