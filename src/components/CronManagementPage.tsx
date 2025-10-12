import React, { useState, useEffect } from 'react';
import { Clock, Play, RefreshCw, CheckCircle, XCircle, AlertCircle, Settings, Film } from 'lucide-react';

const CronManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [triggerResult, setTriggerResult] = useState<any>(null);
  const [reelsRefreshResult, setReelsRefreshResult] = useState<any>(null);
  const [loadingReels, setLoadingReels] = useState(false);

  // Current schedule info
  const currentSchedule = {
    expression: "0 */12 * * *",
    description: "Every 12 hours (midnight & noon UTC)",
    nextRun: getNextRunTime("0 */12 * * *")
  };

  const schedulePresets = [
    { value: "* * * * *", label: "Every minute", description: "Testing only - uses quota quickly!" },
    { value: "*/5 * * * *", label: "Every 5 minutes", description: "Testing only" },
    { value: "*/15 * * * *", label: "Every 15 minutes", description: "Testing only" },
    { value: "0 * * * *", label: "Every hour", description: "Frequent updates" },
    { value: "0 */6 * * *", label: "Every 6 hours", description: "Good balance" },
    { value: "0 */12 * * *", label: "Every 12 hours", description: "Production default" },
    { value: "0 0 * * *", label: "Daily at midnight", description: "Once per day" },
  ];

  function getNextRunTime(cronExpression: string): string {
    // Simple estimation - in production, you'd use a cron parser library
    if (cronExpression === "0 */12 * * *") {
      const now = new Date();
      const hours = now.getUTCHours();
      const nextRun = hours < 12 ? 12 : 24;
      const hoursUntil = (nextRun - hours) % 24;
      return `~${hoursUntil}h ${60 - now.getUTCMinutes()}m`;
    }
    return "Check Vercel dashboard";
  }

  const loadStatus = async () => {
    setLoading(true);
    try {
      await fetch('/api/cron-status');
      // Just refresh the timestamp to show we checked
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualRefresh = async () => {
    if (!confirm('Trigger a manual refresh now? This will fetch fresh data for all accounts.')) {
      return;
    }

    setLoading(true);
    setTriggerResult(null);
    
    try {
      const response = await fetch('/api/cron-test');
      const result = await response.json();
      setTriggerResult(result);
      setLastRefresh(new Date());
      
      // Reload status after a delay
      setTimeout(() => loadStatus(), 3000);
    } catch (error: any) {
      setTriggerResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerReelsRefresh = async () => {
    if (!confirm('Trigger Instagram Reels refresh? This will fetch the latest reels for all tracked Instagram accounts.')) {
      return;
    }

    setLoadingReels(true);
    setReelsRefreshResult(null);
    
    try {
      const response = await fetch('/api/cron-refresh-reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true })
      });
      const result = await response.json();
      setReelsRefreshResult(result);
      setLastRefresh(new Date());
    } catch (error: any) {
      setReelsRefreshResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoadingReels(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Cron Job Management</h1>
                <p className="text-gray-400 text-sm">Manage automated video refreshes</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadStatus}
                disabled={loading}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={triggerManualRefresh}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Trigger Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current Schedule */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Current Schedule</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Expression</div>
              <div className="text-white font-mono text-lg">{currentSchedule.expression}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Description</div>
              <div className="text-white">{currentSchedule.description}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Next Run</div>
              <div className="text-white font-semibold">{currentSchedule.nextRun}</div>
            </div>
          </div>
        </div>

        {/* Individual Cron Jobs */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Individual Cron Jobs</h2>
          <div className="space-y-4">
            {/* All Videos Refresh */}
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-white font-medium">All Videos Refresh</div>
                  <div className="text-gray-400 text-sm">Refresh all tracked videos (TikTok, Instagram, YouTube)</div>
                </div>
              </div>
              <button
                onClick={triggerManualRefresh}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>Trigger</span>
              </button>
            </div>

            {/* Instagram Reels Refresh */}
            <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Film className="w-5 h-5 text-pink-400" />
                <div>
                  <div className="text-white font-medium">Instagram Reels Refresh</div>
                  <div className="text-gray-400 text-sm">Fetch latest reels from tracked Instagram accounts</div>
                </div>
              </div>
              <button
                onClick={triggerReelsRefresh}
                disabled={loadingReels}
                className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                {loadingReels ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>{loadingReels ? 'Running...' : 'Trigger'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Instagram Reels Refresh Result */}
        {reelsRefreshResult && (
          <div className={`rounded-2xl border p-6 ${
            reelsRefreshResult.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-start space-x-3">
              {reelsRefreshResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${
                  reelsRefreshResult.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {reelsRefreshResult.success ? 'Instagram Reels Refresh Completed!' : 'Instagram Reels Refresh Failed'}
                </h3>
                {reelsRefreshResult.success && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400">Duration</div>
                      <div className="text-white font-semibold">{reelsRefreshResult.durationSec}s</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Accounts</div>
                      <div className="text-white font-semibold">{reelsRefreshResult.accountsProcessed}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Reels</div>
                      <div className="text-white font-semibold">{reelsRefreshResult.reelsRefreshed}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Failed</div>
                      <div className="text-white font-semibold">{reelsRefreshResult.failedAccounts}</div>
                    </div>
                  </div>
                )}
                {reelsRefreshResult.error && (
                  <div className="text-red-300 text-sm">{reelsRefreshResult.error}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Presets */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Change Schedule (Edit vercel.json)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedulePresets.map((preset) => (
              <div
                key={preset.value}
                className={`bg-white/5 rounded-xl p-4 border ${
                  preset.value === currentSchedule.expression
                    ? 'border-blue-500 bg-gray-200 dark:bg-gray-800'
                    : 'border-white/10'
                } cursor-pointer hover:bg-white/10 transition-colors`}
                onClick={() => {
                  alert(`To change schedule to "${preset.label}":\n\n1. Open vercel.json\n2. Change "schedule" to: "${preset.value}"\n3. Commit and push to deploy\n\nExample:\n"crons": [{\n  "path": "/api/cron-refresh-videos",\n  "schedule": "${preset.value}"\n}]`);
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-white font-semibold mb-1">{preset.label}</div>
                    <div className="text-gray-400 text-sm mb-2">{preset.description}</div>
                    <code className="text-xs text-gray-900 dark:text-white bg-black/30 px-2 py-1 rounded">
                      {preset.value}
                    </code>
                  </div>
                  {preset.value === currentSchedule.expression && (
                    <CheckCircle className="w-5 h-5 text-gray-900 dark:text-white" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/api/cron-status"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-4 hover:from-purple-600/30 hover:to-blue-600/30 transition-colors"
            >
              <div className="text-gray-900 dark:text-white font-semibold mb-1">📊 Status Dashboard</div>
              <div className="text-gray-400 text-sm">View detailed status of all accounts</div>
            </a>
            <a
              href="/api/cron-test"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-4 hover:from-green-600/30 hover:to-emerald-600/30 transition-colors"
            >
              <div className="text-green-400 font-semibold mb-1">🔄 Manual Trigger</div>
              <div className="text-gray-400 text-sm">Run the cron job immediately</div>
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4 hover:from-blue-600/30 hover:to-cyan-600/30 transition-colors"
            >
              <div className="text-gray-900 dark:text-white font-semibold mb-1">⚡ Vercel Dashboard</div>
              <div className="text-gray-400 text-sm">View execution logs and history</div>
            </a>
          </div>
        </div>

        {/* Trigger Result */}
        {triggerResult && (
          <div className={`rounded-2xl border p-6 ${
            triggerResult.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-start space-x-3">
              {triggerResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${
                  triggerResult.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {triggerResult.success ? 'Refresh Completed!' : 'Refresh Failed'}
                </h3>
                {triggerResult.success && triggerResult.stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400">Duration</div>
                      <div className="text-white font-semibold">{triggerResult.duration}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Accounts</div>
                      <div className="text-white font-semibold">{triggerResult.stats.totalAccountsProcessed}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Videos</div>
                      <div className="text-white font-semibold">{triggerResult.stats.totalVideosRefreshed}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Failed</div>
                      <div className="text-white font-semibold">{triggerResult.stats.failedAccounts}</div>
                    </div>
                  </div>
                )}
                {triggerResult.error && (
                  <div className="text-red-300 text-sm">{triggerResult.error}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-yellow-500/10 backdrop-blur-xl rounded-2xl border border-yellow-500/30 p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-400 font-semibold mb-2">How to Change Schedule</h3>
              <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                <li>Open <code className="bg-black/30 px-2 py-0.5 rounded">vercel.json</code> in your code editor</li>
                <li>Find the <code className="bg-black/30 px-2 py-0.5 rounded">crons</code> section</li>
                <li>Change the <code className="bg-black/30 px-2 py-0.5 rounded">schedule</code> value to your desired cron expression</li>
                <li>Commit and push the changes to deploy</li>
                <li>Check Vercel Dashboard → Crons tab to verify the new schedule</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Last Refresh Info */}
        {lastRefresh && (
          <div className="text-center text-gray-400 text-sm">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CronManagementPage;

