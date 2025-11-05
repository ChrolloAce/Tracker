import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PlatformIcon } from './ui/PlatformIcon';

interface AccountRefreshStatus {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  lastRefreshed?: Date;
  refreshStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  refreshInterval: number; // hours
}

/**
 * RefreshCountdown Component
 * Shows per-account refresh status with individual timers
 */
const RefreshCountdown: React.FC = () => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [accounts, setAccounts] = useState<AccountRefreshStatus[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen to tracked accounts
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) {
      setAccounts([]);
      return;
    }

    const accountsRef = collection(
      db,
      'organizations',
      currentOrgId,
      'projects',
      currentProjectId,
      'trackedAccounts'
    );

    const q = query(accountsRef, where('status', '==', 'active'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData: AccountRefreshStatus[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username || 'Unknown',
          platform: data.platform || 'instagram',
          lastRefreshed: data.lastRefreshed?.toDate(),
          refreshStatus: data.refreshStatus || 'idle',
          refreshInterval: data.refreshInterval || 12 // Default 12 hours
        };
      });
      setAccounts(accountsData);
    });

    return () => unsubscribe();
  }, [currentOrgId, currentProjectId]);

  const formatTimeAgo = (date: Date | undefined): string => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((currentTime - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatTimeUntil = (date: Date | undefined, intervalHours: number): string => {
    if (!date) return 'Soon';
    
    const nextRefreshTime = date.getTime() + (intervalHours * 60 * 60 * 1000);
    const secondsUntil = Math.floor((nextRefreshTime - currentTime) / 1000);
    
    if (secondsUntil <= 0) return 'Eligible now';
    if (secondsUntil < 60) return `${secondsUntil}s`;
    if (secondsUntil < 3600) return `${Math.floor(secondsUntil / 60)}m`;
    if (secondsUntil < 86400) return `${Math.floor(secondsUntil / 3600)}h`;
    return `${Math.floor(secondsUntil / 86400)}d`;
  };

  const getProgressPercent = (date: Date | undefined, intervalHours: number): number => {
    if (!date) return 0;
    
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const elapsed = currentTime - date.getTime();
    const progress = Math.min((elapsed / intervalMs) * 100, 100);
    return progress;
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'processing':
        return <Loader className="w-3 h-3 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-emerald-400" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return <Clock className="w-3 h-3 text-white/40" />;
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>No tracked accounts</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/5">
      {/* Header */}
      <div className="px-4 py-2 bg-white/5">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-white/60" />
          <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Refresh Status
          </span>
        </div>
      </div>

      {/* Accounts List */}
      <div className="max-h-64 overflow-y-auto">
        {accounts.map((account) => {
          const progress = getProgressPercent(account.lastRefreshed, account.refreshInterval);
          const isEligible = progress >= 100;
          
          return (
            <div 
              key={account.id} 
              className="px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
            >
              {/* Account Info */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-3 h-3 flex-shrink-0">
                    <PlatformIcon platform={account.platform} size="sm" />
                  </div>
                  <span className="text-xs font-medium text-white/90 truncate">
                    @{account.username}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {getStatusIcon(account.refreshStatus)}
                </div>
              </div>

              {/* Timing Info */}
              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className="text-white/40">
                  {formatTimeAgo(account.lastRefreshed)}
                </span>
                <span className={`font-medium ${isEligible ? 'text-emerald-400' : 'text-white/60'}`}>
                  {isEligible ? '✓ Eligible' : `Next: ${formatTimeUntil(account.lastRefreshed, account.refreshInterval)}`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${
                    isEligible ? 'bg-emerald-400' : 'bg-white/40'
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-white/5">
        <div className="text-[10px] text-white/40 text-center">
          Orchestrator checks every hour
        </div>
      </div>
    </div>
  );
};

export default RefreshCountdown;
