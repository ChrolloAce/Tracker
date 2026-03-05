import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import ApifyMonitorService, { type ApifyMonitorData } from '../services/ApifyMonitorService';
import Sidebar from '../components/layout/Sidebar';
import ApifyStatsCards from '../components/apify-monitor/ApifyStatsCards';
import ApifyCostChart from '../components/apify-monitor/ApifyCostChart';
import ApifyActorTable from '../components/apify-monitor/ApifyActorTable';
import ApifyRunsTable from '../components/apify-monitor/ApifyRunsTable';
import ApifyStatusDistribution from '../components/apify-monitor/ApifyStatusDistribution';
import {
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  Check,
  Zap,
  Calendar,
} from 'lucide-react';
import { getAuth } from 'firebase/auth';

const LOOKBACK_OPTIONS = [
  { label: '24h', days: 1 },
  { label: '3d', days: 3 },
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

const ApifyMonitorPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApifyMonitorData | null>(null);
  const [lookbackDays, setLookbackDays] = useState(7);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Refresh action states
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);
  const [manualRefreshLoading, setManualRefreshLoading] = useState(false);

  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  // ── Auth guard ──
  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard');
    }
  }, [isSuperAdmin, navigate]);

  // ── Fetch data ──
  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ApifyMonitorService.fetchMonitorData(user.email, lookbackDays);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load Apify data');
    } finally {
      setLoading(false);
    }
  }, [user?.email, lookbackDays]);

  useEffect(() => {
    if (isSuperAdmin) loadData();
  }, [isSuperAdmin, loadData]);

  // ── Refresh data button ──
  const handleRefreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    setRefreshSuccess('Data refreshed');
    setTimeout(() => setRefreshSuccess(null), 2000);
  };

  // ── Manual cron trigger ──
  const handleManualRefresh = async () => {
    setManualRefreshLoading(true);
    try {
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken();
      await ApifyMonitorService.triggerManualRefresh(token);
      setRefreshSuccess('Orchestrator triggered! All orgs refreshing…');
      setTimeout(() => setRefreshSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger refresh');
    } finally {
      setManualRefreshLoading(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      <Sidebar
        onCollapsedChange={setIsSidebarCollapsed}
        initialCollapsed={isSidebarCollapsed}
        activeTab="apify-monitor"
        isMobileOpen={isMobileSidebarOpen}
        onMobileToggle={setIsMobileSidebarOpen}
      />

      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* ── Header ── */}
        <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Apify Monitor</h1>
                  <p className="text-xs text-white/40">Cost & Run Analytics • Support Backend</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Manual Refresh All Orgs */}
                <button
                  onClick={handleManualRefresh}
                  disabled={manualRefreshLoading}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
                  title="Trigger manual refresh for ALL organizations"
                >
                  {manualRefreshLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  Manual Refresh All
                </button>

                {/* Refresh Data */}
                <button
                  onClick={handleRefreshData}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <div className="text-sm text-white/40 hidden sm:block font-mono">
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
          {/* Error */}
          {error && (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-white/50 flex-shrink-0" />
              <div>
                <p className="text-white/70 font-medium">Error</p>
                <p className="text-white/40 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Success toast */}
          {refreshSuccess && (
            <div className="fixed top-4 right-4 z-50 bg-white/10 border border-white/20 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
              <Check className="w-5 h-5 text-white" />
              <span className="text-white font-medium">{refreshSuccess}</span>
            </div>
          )}

          {/* Lookback picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white/30" />
            <span className="text-xs text-white/40">Time window:</span>
            <div className="flex gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1">
              {LOOKBACK_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setLookbackDays(opt.days)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    lookbackDays === opt.days
                      ? 'bg-white text-black'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {data && (
              <span className="text-[10px] text-white/20 ml-2">
                Fetched {new Date(data.fetchedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              <span className="ml-3 text-white/30">Loading Apify data…</span>
            </div>
          ) : data ? (
            <>
              {/* Stats */}
              <ApifyStatsCards summary={data.summary} />

              {/* Status distribution */}
              <ApifyStatusDistribution
                distribution={data.summary.statusDistribution}
                totalRuns={data.summary.totalRuns}
              />

              {/* Cost chart */}
              <ApifyCostChart dailyCosts={data.dailyCosts} />

              {/* Actor breakdown */}
              <ApifyActorTable actors={data.actorBreakdown} />

              {/* Recent runs */}
              <ApifyRunsTable runs={data.recentRuns} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default ApifyMonitorPage;
