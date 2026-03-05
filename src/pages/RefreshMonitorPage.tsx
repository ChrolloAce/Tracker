import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import RefreshMonitorService, { type RefreshMonitorData } from '../services/RefreshMonitorService';
import Sidebar from '../components/layout/Sidebar';
import RefreshOverviewCards from '../components/refresh-monitor/RefreshOverviewCards';
import OrgRefreshTable from '../components/refresh-monitor/OrgRefreshTable';
import AccountRefreshTable from '../components/refresh-monitor/AccountRefreshTable';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  Check,
  Activity,
} from 'lucide-react';

const RefreshMonitorPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RefreshMonitorData | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);

  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  // Auth guard
  useEffect(() => {
    if (!isSuperAdmin) navigate('/dashboard');
  }, [isSuperAdmin, navigate]);

  // Fetch data
  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const result = await RefreshMonitorService.fetchMonitorData(user.email);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load refresh data');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (isSuperAdmin) loadData();
  }, [isSuperAdmin, loadData]);

  // Refresh button
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    setRefreshSuccess('Data refreshed');
    setTimeout(() => setRefreshSuccess(null), 2000);
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      <Sidebar
        onCollapsedChange={setIsSidebarCollapsed}
        initialCollapsed={isSidebarCollapsed}
        activeTab="refresh-monitor"
        isMobileOpen={isMobileSidebarOpen}
        onMobileToggle={setIsMobileSidebarOpen}
      />

      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Header */}
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
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Refresh Monitor</h1>
                  <p className="text-xs text-white/40">Per-Account Health & Refresh Status</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <div className="text-sm text-white/40 hidden sm:block font-mono">{user?.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
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

          {/* Fetched time */}
          {data && (
            <div className="text-[10px] text-white/20">
              Fetched {new Date(data.fetchedAt).toLocaleTimeString()}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              <span className="ml-3 text-white/30">Loading refresh data…</span>
            </div>
          ) : data ? (
            <>
              <RefreshOverviewCards overview={data.systemOverview} />
              <OrgRefreshTable organizations={data.organizations} />
              <AccountRefreshTable accounts={data.accounts} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default RefreshMonitorPage;
