import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService, { OrganizationSummary, SuperAdminStats } from '../services/SuperAdminService';
import Sidebar from '../components/layout/Sidebar';
import { 
  Building2, 
  Users, 
  Video, 
  AtSign, 
  Crown, 
  Search,
  ChevronRight,
  Loader2,
  Shield,
  X,
  AlertCircle,
  Eye,
  RefreshCw,
  Zap,
  Check
} from 'lucide-react';
import { ProxiedImage } from '../components/ProxiedImage';

const SuperAdminPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'paid' | 'free'>('all');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [orgDetails, setOrgDetails] = useState<{
    organization: OrganizationSummary | null;
    trackedAccounts: any[];
    videos: any[];
    members: any[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'basic' | 'pro' | 'enterprise'>('basic');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Check if user is super admin
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [isSuperAdmin, navigate, user?.email]);

  const loadData = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    setError(null);
    try {
      const { organizations: orgs, stats: statsData } = await SuperAdminService.getAllOrganizations(user.email);
      setOrganizations(orgs);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  const loadOrgDetails = async (orgId: string) => {
    if (!user?.email) return;
    
    setLoadingDetails(true);
    setSelectedOrg(orgId);
    try {
      const details = await SuperAdminService.getOrganizationDetails(orgId, user.email);
      setOrgDetails(details);
    } catch (err) {
      // Silently fail
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeOrgDetails = () => {
    setSelectedOrg(null);
    setOrgDetails(null);
    setShowPlanModal(false);
    setActionSuccess(null);
  };

  // Action: View as user
  const handleViewAsUser = (orgId: string) => {
    // Store the org ID in sessionStorage and redirect
    sessionStorage.setItem('superAdminViewAs', orgId);
    navigate('/dashboard');
  };

  // Action: Grant plan
  const handleGrantPlan = async () => {
    if (!selectedOrg || !user?.email) return;
    
    setActionLoading('grant-plan');
    try {
      const response = await fetch(`/api/super-admin/grant-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          orgId: selectedOrg,
          planTier: selectedPlan
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to grant plan');
      }
      
      setActionSuccess(`Granted ${selectedPlan} plan successfully!`);
      setShowPlanModal(false);
      
      // Refresh org details
      loadOrgDetails(selectedOrg);
      loadData();
      
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Trigger refresh
  const handleTriggerRefresh = async (orgId: string) => {
    if (!user?.email) return;
    
    setActionLoading('refresh-' + orgId);
    try {
      const response = await fetch(`/api/super-admin/trigger-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          orgId: orgId
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to trigger refresh');
      }
      
      setActionSuccess('Refresh triggered successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter organizations
  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPlan = 
      filterPlan === 'all' ||
      (filterPlan === 'paid' && org.planTier !== 'free') ||
      (filterPlan === 'free' && org.planTier === 'free');
    
    return matchesSearch && matchesPlan;
  });

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      {/* Sidebar */}
      <Sidebar 
        onCollapsedChange={setIsSidebarCollapsed}
        initialCollapsed={isSidebarCollapsed}
        activeTab="super-admin"
        isMobileOpen={isMobileSidebarOpen}
        onMobileToggle={setIsMobileSidebarOpen}
      />

      {/* Main Content */}
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
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Super Admin</h1>
                  <p className="text-xs text-white/40">Platform Overview</p>
                </div>
              </div>
              <div className="text-sm text-white/40 hidden sm:block font-mono">
                {user?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-white/50 flex-shrink-0" />
              <div>
                <p className="text-white/70 font-medium">Unable to load data</p>
                <p className="text-white/40 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Success Toast */}
          {actionSuccess && (
            <div className="fixed top-4 right-4 z-50 bg-white/10 border border-white/20 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
              <Check className="w-5 h-5 text-white" />
              <span className="text-white font-medium">{actionSuccess}</span>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              <span className="ml-3 text-white/30">Loading...</span>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                  <StatCard icon={Building2} label="Total Orgs" value={stats.totalOrganizations} />
                  <StatCard icon={Crown} label="Paid" value={stats.totalPaidOrganizations} highlight />
                  <StatCard icon={Building2} label="Free" value={stats.totalFreeOrganizations} />
                  <StatCard icon={Users} label="Users" value={stats.totalUsers} />
                  <StatCard icon={AtSign} label="Accounts" value={stats.totalTrackedAccounts} />
                  <StatCard icon={Video} label="Videos" value={stats.totalVideos} />
                </div>
              )}

              {/* Plan Breakdown */}
              {stats && (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6">
                  <h2 className="text-sm font-medium mb-3 text-white/50 uppercase tracking-wider">Plan Distribution</h2>
                  <div className="flex flex-wrap gap-2">
                    <PlanBadge plan="Free" count={stats.planBreakdown.free} />
                    <PlanBadge plan="Basic" count={stats.planBreakdown.basic} />
                    <PlanBadge plan="Pro" count={stats.planBreakdown.pro} />
                    <PlanBadge plan="Enterprise" count={stats.planBreakdown.enterprise} />
                  </div>
                </div>
              )}

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search organizations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-white/20 text-sm"
                  />
                </div>
                <div className="flex gap-1.5 bg-white/[0.02] border border-white/5 rounded-lg p-1">
                  {(['all', 'paid', 'free'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setFilterPlan(filter)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        filterPlan === filter 
                          ? 'bg-white text-black' 
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Organizations List */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="text-sm text-white/50">{filteredOrgs.length} organizations</span>
                </div>
                <div className="divide-y divide-white/5">
                  {filteredOrgs.map((org) => (
                    <div
                      key={org.id}
                      className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex items-center gap-3"
                    >
                      <div 
                        className="flex-1 flex items-center gap-3 cursor-pointer"
                        onClick={() => loadOrgDetails(org.id)}
                      >
                        <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center text-white/70 font-medium text-sm">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white text-sm truncate">{org.name}</h3>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                              org.planTier === 'free' ? 'bg-white/5 text-white/40' :
                              org.planTier === 'basic' ? 'bg-white/10 text-white/60' :
                              org.planTier === 'pro' ? 'bg-white/10 text-white/70' :
                              'bg-white/10 text-white/80'
                            }`}>
                              {org.planTier}
                            </span>
                          </div>
                          <div className="text-xs text-white/30 truncate">{org.ownerEmail || 'No owner'}</div>
                        </div>
                        <div className="hidden md:flex items-center gap-6 text-xs text-white/40">
                          <div className="text-center">
                            <div className="font-medium text-white/70">{org.memberCount}</div>
                            <div>members</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-white/70">{org.totalTrackedAccounts}</div>
                            <div>accounts</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-white/70">{org.totalVideos}</div>
                            <div>videos</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewAsUser(org.id); }}
                          className="p-2 hover:bg-white/5 rounded-lg transition-colors group"
                          title="View as user"
                        >
                          <Eye className="w-4 h-4 text-white/30 group-hover:text-white/70" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTriggerRefresh(org.id); }}
                          disabled={actionLoading === 'refresh-' + org.id}
                          className="p-2 hover:bg-white/5 rounded-lg transition-colors group disabled:opacity-50"
                          title="Trigger refresh"
                        >
                          <RefreshCw className={`w-4 h-4 text-white/30 group-hover:text-white/70 ${actionLoading === 'refresh-' + org.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); loadOrgDetails(org.id); }}
                          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-white/30" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredOrgs.length === 0 && !error && (
                    <div className="px-6 py-12 text-center text-white/30 text-sm">
                      No organizations found
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Organization Details Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {orgDetails?.organization && (
                  <>
                    <div className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center text-white/70 font-medium">
                      {orgDetails.organization.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-medium text-white text-sm">{orgDetails.organization.name}</h2>
                      <p className="text-xs text-white/40">{orgDetails.organization.ownerEmail}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Action Buttons */}
                <button
                  onClick={() => handleViewAsUser(selectedOrg)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View as User
                </button>
                <button
                  onClick={() => setShowPlanModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Grant Plan
                </button>
                <button
                  onClick={() => handleTriggerRefresh(selectedOrg)}
                  disabled={actionLoading === 'refresh-' + selectedOrg}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'refresh-' + selectedOrg ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={closeOrgDetails}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                </div>
              ) : orgDetails ? (
                <div className="space-y-4">
                  {/* Org Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                      <div className="text-lg font-medium text-white">{orgDetails.members.length}</div>
                      <div className="text-[10px] text-white/40 uppercase">Members</div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                      <div className="text-lg font-medium text-white">{orgDetails.organization?.projectCount || 0}</div>
                      <div className="text-[10px] text-white/40 uppercase">Projects</div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                      <div className="text-lg font-medium text-white">{orgDetails.trackedAccounts.length}</div>
                      <div className="text-[10px] text-white/40 uppercase">Accounts</div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
                      <div className="text-lg font-medium text-white">{orgDetails.videos.length}</div>
                      <div className="text-[10px] text-white/40 uppercase">Videos</div>
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <h3 className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">Members</h3>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg divide-y divide-white/5">
                      {orgDetails.members.map((member: any) => (
                        <div key={member.id} className="px-3 py-2 flex items-center gap-2">
                          <div className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-white/50 text-xs font-medium">
                            {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white/70 truncate">{member.displayName || 'No name'}</div>
                            <div className="text-[10px] text-white/40 truncate">{member.email}</div>
                          </div>
                          <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-white/50">
                            {member.role || 'member'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tracked Accounts */}
                  <div>
                    <h3 className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">
                      Tracked Accounts ({orgDetails.trackedAccounts.length})
                    </h3>
                    {orgDetails.trackedAccounts.length > 0 ? (
                      <div className="bg-white/[0.02] border border-white/5 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
                        {orgDetails.trackedAccounts.map((account: any) => (
                          <div key={account.id} className="px-3 py-2 flex items-center gap-2">
                            {account.profilePicture ? (
                              <ProxiedImage
                                src={account.profilePicture}
                                alt={account.username}
                                className="w-8 h-8 rounded-full object-cover"
                                fallback={
                                  <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/50 text-xs">
                                    {(account.username || 'A').charAt(0).toUpperCase()}
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/50 text-xs">
                                {(account.username || 'A').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-white/70 truncate">
                                @{account.username || account.displayName}
                              </div>
                              <div className="text-[10px] text-white/40 capitalize">{account.platform}</div>
                            </div>
                            <div className="text-right text-xs">
                              <div className="text-white/70">{(account.followerCount || 0).toLocaleString()}</div>
                              <div className="text-[10px] text-white/40">followers</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-center text-white/30 text-xs">
                        No tracked accounts
                      </div>
                    )}
                  </div>

                  {/* Videos */}
                  <div>
                    <h3 className="text-[10px] font-medium text-white/40 mb-2 uppercase tracking-wider">
                      Videos ({orgDetails.videos.length})
                    </h3>
                    {orgDetails.videos.length > 0 ? (
                      <div className="bg-white/[0.02] border border-white/5 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
                        {orgDetails.videos.slice(0, 20).map((video: any) => (
                          <div key={video.id} className="px-3 py-2 flex items-center gap-2">
                            {video.thumbnail ? (
                              <img
                                src={video.thumbnail}
                                alt="Video"
                                className="w-12 h-8 rounded object-cover bg-white/5"
                              />
                            ) : (
                              <div className="w-12 h-8 bg-white/5 rounded flex items-center justify-center">
                                <Video className="w-3 h-3 text-white/20" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-white/70 truncate">
                                {video.title || video.description || 'No title'}
                              </div>
                              <div className="text-[10px] text-white/40 capitalize">{video.platform}</div>
                            </div>
                            <div className="text-right text-xs">
                              <div className="text-white/70">{(video.views || 0).toLocaleString()}</div>
                              <div className="text-[10px] text-white/40">views</div>
                            </div>
                          </div>
                        ))}
                        {orgDetails.videos.length > 20 && (
                          <div className="px-3 py-2 text-center text-[10px] text-white/30">
                            + {orgDetails.videos.length - 20} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 text-center text-white/30 text-xs">
                        No videos
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Grant Plan Modal */}
      {showPlanModal && selectedOrg && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-sm p-4">
            <h3 className="text-sm font-medium text-white mb-4">Grant Plan Access</h3>
            
            <div className="space-y-2 mb-4">
              {(['free', 'basic', 'pro', 'enterprise'] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full px-4 py-3 rounded-lg text-left text-sm transition-colors ${
                    selectedPlan === plan 
                      ? 'bg-white text-black' 
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium capitalize">{plan}</div>
                  <div className={`text-xs ${selectedPlan === plan ? 'text-black/60' : 'text-white/40'}`}>
                    {plan === 'free' && 'Limited features'}
                    {plan === 'basic' && '10 accounts, basic analytics'}
                    {plan === 'pro' && '50 accounts, advanced analytics'}
                    {plan === 'enterprise' && 'Unlimited, priority support'}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowPlanModal(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantPlan}
                disabled={actionLoading === 'grant-plan'}
                className="flex-1 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'grant-plan' ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Grant Access'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  highlight?: boolean;
}> = ({ icon: Icon, label, value, highlight }) => {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-white/[0.04] border border-white/10' : 'bg-white/[0.02] border border-white/5'}`}>
      <Icon className="w-4 h-4 text-white/30 mb-2" />
      <div className="text-xl font-medium text-white">{value.toLocaleString()}</div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
    </div>
  );
};

// Plan Badge Component
const PlanBadge: React.FC<{
  plan: string;
  count: number;
}> = ({ plan, count }) => {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
      <span className="text-xs text-white/50">{plan}</span>
      <span className="text-sm font-medium text-white">{count}</span>
    </div>
  );
};

export default SuperAdminPage;
