import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * RefreshCountdown Component
 * Shows unified orchestrator timer - ONE progress bar for all accounts
 * Orchestrator runs every hour and processes all eligible accounts
 */
const RefreshCountdown: React.FC = () => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [accountCount, setAccountCount] = useState(0);
  const [lastOrchestratorRun, setLastOrchestratorRun] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen to tracked accounts count and last orchestrator run
  useEffect(() => {
    if (!currentOrgId || !currentProjectId) {
      setAccountCount(0);
      setLastOrchestratorRun(null);
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

    // Count active accounts
    const unsubscribeAccounts = onSnapshot(accountsRef, (snapshot) => {
      const activeAccounts = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return !data.status || data.status === 'active';
      });
      setAccountCount(activeAccounts.length);
      
      // Get the most recently refreshed account to approximate last orchestrator run
      const accountsWithRefresh = activeAccounts
        .map(doc => doc.data().lastRefreshed?.toDate())
        .filter(Boolean) as Date[];
      
      if (accountsWithRefresh.length > 0) {
        const mostRecent = accountsWithRefresh.sort((a, b) => b.getTime() - a.getTime())[0];
        setLastOrchestratorRun(mostRecent);
      }
    });

    return () => unsubscribeAccounts();
  }, [currentOrgId, currentProjectId]);

  const formatTimeAgo = (date: Date | undefined): string => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((currentTime - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getNextCronRun = (): Date => {
    // Cron runs at the top of every hour (:00)
    const now = new Date(currentTime);
    const nextRun = new Date(now);
    nextRun.setMinutes(0, 0, 0); // Set to top of current hour
    
    // If we're past the top of this hour, move to next hour
    if (now.getMinutes() > 0 || now.getSeconds() > 0) {
      nextRun.setHours(nextRun.getHours() + 1);
    }
    
    return nextRun;
  };

  const formatTimeUntil = (): string => {
    const nextRun = getNextCronRun();
    const secondsUntil = Math.floor((nextRun.getTime() - currentTime) / 1000);
    
    if (secondsUntil <= 0) return 'Running now';
    if (secondsUntil < 60) return `${secondsUntil}s`;
    
    const minutes = Math.floor(secondsUntil / 60);
    const seconds = secondsUntil % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getProgressPercent = (): number => {
    // Calculate progress through the current hour
    const now = new Date(currentTime);
    const minutesPastHour = now.getMinutes();
    const secondsPastMinute = now.getSeconds();
    const totalSecondsPastHour = (minutesPastHour * 60) + secondsPastMinute;
    const progress = (totalSecondsPastHour / 3600) * 100;
    
    return Math.min(progress, 100);
  };

  if (accountCount === 0) {
    return (
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>No tracked accounts</span>
        </div>
      </div>
    );
  }

  const progress = getProgressPercent();
  const isRunning = progress >= 100;

  return (
    <div className="border-t border-white/5">
      {/* Header */}
      <div className="px-4 py-3 bg-white/5">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-white/60" />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Orchestrator
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 text-white/40 ${isRunning ? 'animate-spin' : ''}`} />
            <span className="text-[10px] text-white/50">
              {accountCount} account{accountCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Unified Progress Bar */}
      <div className="px-4 py-3 border-b border-white/5">
        {/* Timing Info */}
        <div className="flex items-center justify-between text-[10px] mb-2">
          <span className="text-white/40">
            {lastOrchestratorRun ? `Last: ${formatTimeAgo(lastOrchestratorRun)}` : `Runs hourly at :00`}
          </span>
          <span className={`font-semibold ${isRunning ? 'text-emerald-400' : 'text-white/60'}`}>
            {isRunning ? '⚡ Running' : `Next: ${formatTimeUntil()}`}
        </span>
      </div>

      {/* Progress Bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div 
            className={`h-full transition-all duration-1000 ease-linear ${
              isRunning ? 'bg-emerald-400' : 'bg-white/40'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
        />
        </div>

        {/* Info Text */}
        <div className="text-[10px] text-white/30 text-center mt-2">
          Refreshes accounts every 12-24h based on tier
        </div>
      </div>
    </div>
  );
};

export default RefreshCountdown;
