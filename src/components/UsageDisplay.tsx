import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UsageTrackingService, { UsageStatus } from '../services/UsageTrackingService';
import { TrendingUp, Users, Video, Link, Zap } from 'lucide-react';

interface UsageDisplayProps {
  compact?: boolean; // Compact view for sidebar/header
}

const UsageDisplay: React.FC<UsageDisplayProps> = ({ compact = false }) => {
  const { currentOrgId } = useAuth();
  const [usageStatus, setUsageStatus] = useState<UsageStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrgId) return;

    const loadUsage = async () => {
      try {
        const status = await UsageTrackingService.getUsageStatus(currentOrgId);
        setUsageStatus(status);
      } catch (error) {
        console.error('Failed to load usage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsage();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUsage, 30000);
    return () => clearInterval(interval);
  }, [currentOrgId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(compact ? 2 : 5)].map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg"></div>
        ))}
      </div>
    );
  }

  const getIcon = (resource: string) => {
    switch (resource) {
      case 'Tracked Accounts':
        return <Users className="w-5 h-5" />;
      case 'Tracked Videos':
        return <Video className="w-5 h-5" />;
      case 'Tracked Links':
        return <Link className="w-5 h-5" />;
      case 'Team Members':
        return <Users className="w-5 h-5" />;
      case 'MCP Calls':
        return <Zap className="w-5 h-5" />;
      default:
        return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getBarColor = (status: UsageStatus) => {
    if (status.isOverLimit) return 'bg-red-500';
    if (status.isNearLimit) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const displayedStatus = compact ? usageStatus.slice(0, 3) : usageStatus;

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      {displayedStatus.map((status) => (
        <div
          key={status.resource}
          className={`bg-white/3 border border-white/10 rounded-lg p-${compact ? '3' : '4'} hover:bg-white/5 transition-colors`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`text-${status.isOverLimit ? 'red' : status.isNearLimit ? 'yellow' : 'gray'}-400`}>
                {getIcon(status.resource)}
              </div>
              <span className={`text-${compact ? 'xs' : 'sm'} font-medium text-gray-300`}>
                {status.resource}
              </span>
            </div>
            <span className={`text-${compact ? 'xs' : 'sm'} font-bold ${
              status.isUnlimited 
                ? 'text-emerald-400' 
                : status.isOverLimit 
                  ? 'text-red-400' 
                  : 'text-white'
            }`}>
              {status.current} / {status.isUnlimited ? '∞' : status.limit}
            </span>
          </div>

          {!status.isUnlimited && (
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getBarColor(status)} transition-all duration-300`}
                style={{ width: `${Math.min(status.percentage, 100)}%` }}
              />
            </div>
          )}

          {status.isOverLimit && !compact && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Limit reached! Upgrade to add more.</span>
            </div>
          )}

          {status.isNearLimit && !status.isOverLimit && !compact && (
            <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Approaching limit</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default UsageDisplay;

