import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * RefreshCountdown Component
 * Shows unified orchestrator timer - ONE progress bar for all accounts
 * Orchestrator runs every 5 minutes for testing (normally 12 hours)
 */
const RefreshCountdown: React.FC = () => {
  const { currentOrgId, currentProjectId } = useAuth();
  const [accountCount, setAccountCount] = useState(0);
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
    });

    return () => unsubscribeAccounts();
  }, [currentOrgId, currentProjectId]);

  const getNextCronRun = (): Date => {
    // Cron runs every 5 minutes (*/5 * * * *)
    const now = new Date(currentTime);
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    // Calculate next 5-minute mark (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
    const nextMinuteMark = Math.ceil(currentMinute / 5) * 5;
    
    const nextRun = new Date(now);
    nextRun.setSeconds(0, 0); // Reset seconds and milliseconds
    
    if (nextMinuteMark >= 60) {
      // Roll over to next hour
      nextRun.setHours(now.getHours() + 1);
      nextRun.setMinutes(0);
    } else if (nextMinuteMark === currentMinute && currentSecond === 0) {
      // If we're exactly at a 5-minute mark, move to next one
      nextRun.setMinutes(nextMinuteMark + 5);
    } else {
      nextRun.setMinutes(nextMinuteMark);
    }
    
    return nextRun;
  };

  const formatTimeUntil = (): string => {
    const nextRun = getNextCronRun();
    const secondsUntil = Math.floor((nextRun.getTime() - currentTime) / 1000);
    
    if (secondsUntil <= 0) return 'Running now';
    if (secondsUntil < 60) return `${secondsUntil}s`;
    
    const hours = Math.floor(secondsUntil / 3600);
    const minutes = Math.floor((secondsUntil % 3600) / 60);
    const seconds = secondsUntil % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const getProgressPercent = (): number => {
    // Calculate progress through the current 5-minute period
    const now = new Date(currentTime);
    const currentMinute = now.getMinutes();
    
    // Determine last 5-minute mark
    const lastRunMinute = Math.floor(currentMinute / 5) * 5;
    const lastRun = new Date(now);
    lastRun.setMinutes(lastRunMinute, 0, 0);
    
    // Calculate elapsed time since last run
    const elapsed = currentTime - lastRun.getTime();
    const fiveMinutesInMs = 5 * 60 * 1000;
    const progress = (elapsed / fiveMinutesInMs) * 100;
    
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
      {/* Unified Progress Bar */}
      <div className="px-4 py-3">
        {/* Timing Info */}
        <div className="text-[11px] text-white/60 mb-3 text-center">
          Data will refresh in {formatTimeUntil()}
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
      </div>
    </div>
  );
};

export default RefreshCountdown;
