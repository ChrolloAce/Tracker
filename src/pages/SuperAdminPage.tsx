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
  Calendar,
  Loader2,
  Shield,
  X,
  AlertCircle
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
      console.error('Failed to load super admin data:', err);
      setError(err.message || 'Failed to load organizations. This feature only works on production (Vercel).');
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
      console.error('Failed to load org details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeOrgDetails = () => {
    setSelectedOrg(null);
    setOrgDetails(null);
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
        <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10">
          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Super Admin</h1>
                  <p className="text-xs text-white/50">Platform Overview</p>
                </div>
              </div>
              <div className="text-sm text-white/50 hidden sm:block">
                {user?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Unable to load data</p>
                <p className="text-red-400/70 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white/50" />
              <span className="ml-3 text-white/50">Loading organizations...</span>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
                  <StatCard icon={Building2} label="Total Orgs" value={stats.totalOrganizations} color="blue" />
                  <StatCard icon={Crown} label="Paid Orgs" value={stats.totalPaidOrganizations} color="emerald" />
                  <StatCard icon={Building2} label="Free Orgs" value={stats.totalFreeOrganizations} color="gray" />
                  <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="purple" />
                  <StatCard icon={AtSign} label="Accounts" value={stats.totalTrackedAccounts} color="pink" />
                  <StatCard icon={Video} label="Videos" value={stats.totalVideos} color="orange" />
                </div>
              )}

              {/* Plan Breakdown */}
              {stats && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4 text-white">Plan Distribution</h2>
                  <div className="flex flex-wrap gap-3">
                    <PlanBadge plan="Free" count={stats.planBreakdown.free} color="gray" />
                    <PlanBadge plan="Basic" count={stats.planBreakdown.basic} color="blue" />
                    <PlanBadge plan="Pro" count={stats.planBreakdown.pro} color="purple" />
                    <PlanBadge plan="Enterprise" count={stats.planBreakdown.enterprise} color="emerald" />
                  </div>
                </div>
              )}

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search by org name, owner email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterPlan('all')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterPlan === 'all' ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    All ({organizations.length})
                  </button>
                  <button
                    onClick={() => setFilterPlan('paid')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterPlan === 'paid' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    Paid ({organizations.filter(o => o.planTier !== 'free').length})
                  </button>
                  <button
                    onClick={() => setFilterPlan('free')}
                    className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterPlan === 'free' ? 'bg-gray-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    Free ({organizations.filter(o => o.planTier === 'free').length})
                  </button>
                </div>
              </div>

              {/* Organizations List */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-4 md:px-6 py-4 border-b border-white/10">
                  <h2 className="text-lg font-semibold text-white">Organizations ({filteredOrgs.length})</h2>
                </div>
                <div className="divide-y divide-white/5">
                  {filteredOrgs.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => loadOrgDetails(org.id)}
                      className="px-4 md:px-6 py-4 hover:bg-white/5 cursor-pointer transition-colors flex items-center gap-3 md:gap-4"
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-base md:text-lg flex-shrink-0">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white truncate">{org.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            org.planTier === 'free' ? 'bg-gray-500/20 text-gray-400' :
                            org.planTier === 'basic' ? 'bg-blue-500/20 text-blue-400' :
                            org.planTier === 'pro' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {org.plan}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-white/50 mt-1 flex-wrap">
                          <span className="truncate max-w-[150px] md:max-w-none">{org.ownerEmail || 'No owner'}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {org.createdAt.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
                        <div className="text-center">
                          <div className="font-semibold text-white">{org.memberCount}</div>
                          <div className="text-xs text-white/50">Members</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-white">{org.totalTrackedAccounts}</div>
                          <div className="text-xs text-white/50">Accounts</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-white">{org.totalVideos}</div>
                          <div className="text-xs text-white/50">Videos</div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0" />
                    </div>
                  ))}
                  {filteredOrgs.length === 0 && !error && (
                    <div className="px-6 py-12 text-center text-white/50">
                      {organizations.length === 0 
                        ? 'No organizations found. Deploy to Vercel to see data.'
                        : 'No organizations match your search'}
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-4 md:px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {orgDetails?.organization && (
                  <>
                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                      {orgDetails.organization.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-semibold text-white">{orgDetails.organization.name}</h2>
                      <p className="text-sm text-white/50">{orgDetails.organization.ownerEmail}</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={closeOrgDetails}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              ) : orgDetails ? (
                <div className="space-y-6">
                  {/* Org Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-xl md:text-2xl font-bold text-white">{orgDetails.members.length}</div>
                      <div className="text-xs text-white/50">Members</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-xl md:text-2xl font-bold text-white">{orgDetails.organization?.projectCount || 0}</div>
                      <div className="text-xs text-white/50">Projects</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-xl md:text-2xl font-bold text-white">{orgDetails.trackedAccounts.length}</div>
                      <div className="text-xs text-white/50">Accounts</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 text-center">
                      <div className="text-xl md:text-2xl font-bold text-white">{orgDetails.videos.length}</div>
                      <div className="text-xs text-white/50">Videos</div>
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wider">Members</h3>
                    <div className="bg-white/5 rounded-xl divide-y divide-white/5">
                      {orgDetails.members.map((member: any) => (
                        <div key={member.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {(member.displayName || member.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{member.displayName || 'No name'}</div>
                            <div className="text-xs text-white/50 truncate">{member.email}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            member.role === 'owner' ? 'bg-yellow-500/20 text-yellow-400' :
                            member.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {member.role || 'member'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tracked Accounts */}
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wider">
                      Tracked Accounts ({orgDetails.trackedAccounts.length})
                    </h3>
                    {orgDetails.trackedAccounts.length > 0 ? (
                      <div className="bg-white/5 rounded-xl divide-y divide-white/5 max-h-64 overflow-y-auto">
                        {orgDetails.trackedAccounts.map((account: any) => (
                          <div key={account.id} className="px-4 py-3 flex items-center gap-3">
                            {account.profilePicture ? (
                              <ProxiedImage
                                src={account.profilePicture}
                                alt={account.username}
                                className="w-10 h-10 rounded-full object-cover"
                                fallback={
                                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {(account.username || 'A').charAt(0).toUpperCase()}
                                  </div>
                                }
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {(account.username || 'A').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                @{account.username || account.displayName}
                              </div>
                              <div className="text-xs text-white/50 capitalize">{account.platform}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-white">{(account.followerCount || 0).toLocaleString()}</div>
                              <div className="text-xs text-white/50">followers</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-xl p-6 text-center text-white/50">
                        No tracked accounts
                      </div>
                    )}
                  </div>

                  {/* Videos */}
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wider">
                      Videos ({orgDetails.videos.length})
                    </h3>
                    {orgDetails.videos.length > 0 ? (
                      <div className="bg-white/5 rounded-xl divide-y divide-white/5 max-h-64 overflow-y-auto">
                        {orgDetails.videos.slice(0, 20).map((video: any) => (
                          <div key={video.id} className="px-4 py-3 flex items-center gap-3">
                            {video.thumbnail ? (
                              <img
                                src={video.thumbnail}
                                alt="Video"
                                className="w-16 h-10 rounded object-cover bg-white/5"
                              />
                            ) : (
                              <div className="w-16 h-10 bg-white/10 rounded flex items-center justify-center">
                                <Video className="w-4 h-4 text-white/30" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">
                                {video.title || video.description || 'No title'}
                              </div>
                              <div className="text-xs text-white/50 capitalize">{video.platform}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="text-white">{(video.views || 0).toLocaleString()}</div>
                              <div className="text-xs text-white/50">views</div>
                            </div>
                          </div>
                        ))}
                        {orgDetails.videos.length > 20 && (
                          <div className="px-4 py-3 text-center text-sm text-white/50">
                            + {orgDetails.videos.length - 20} more videos
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-xl p-6 text-center text-white/50">
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
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}> = ({ icon: Icon, label, value, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    gray: 'from-gray-500/20 to-gray-600/10 border-gray-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
  };

  const iconColors: Record<string, string> = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    gray: 'text-gray-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
    orange: 'text-orange-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-3 md:p-4`}>
      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColors[color]} mb-2`} />
      <div className="text-xl md:text-2xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
};

// Plan Badge Component
const PlanBadge: React.FC<{
  plan: string;
  count: number;
  color: string;
}> = ({ plan, count, color }) => {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3`}>
      <span className="font-medium text-sm">{plan}</span>
      <span className="text-base md:text-lg font-bold">{count}</span>
    </div>
  );
};

export default SuperAdminPage;
