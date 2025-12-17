import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import DashboardPage from './DashboardPage';
import { Loader2, ArrowLeft, Shield, AlertCircle } from 'lucide-react';

/**
 * ViewAs Context - Provides org/project IDs and pre-fetched data for super admin "view as user" functionality
 */
interface ViewAsContextType {
  isViewAsMode: boolean;
  viewAsOrgId: string;
  viewAsProjectId: string;
  viewAsOrgName: string;
  viewAsData: {
    videos: any[];
    accounts: any[];
    links: any[];
    organization: any;
    project: any;
    subscription: any;
  } | null;
}

const ViewAsContext = createContext<ViewAsContextType>({
  isViewAsMode: false,
  viewAsOrgId: '',
  viewAsProjectId: '',
  viewAsOrgName: '',
  viewAsData: null
});

export const useViewAsContext = () => useContext(ViewAsContext);

/**
 * View As Page
 * Allows super admin to view any organization's dashboard
 */
const ViewAsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [dashboardData, setDashboardData] = useState<ViewAsContextType['viewAsData']>(null);

  // Check if user is super admin
  const isSuperAdmin = SuperAdminService.isSuperAdmin(user?.email);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard');
      return;
    }

    if (!orgId) {
      setError('No organization ID provided');
      setLoading(false);
      return;
    }

    loadOrgData();
  }, [orgId, isSuperAdmin, navigate, user?.email]);

  const loadOrgData = async () => {
    if (!orgId || !user?.email) return;

    try {
      setLoading(true);
      setError(null);

      // Step 1: Get org info and project ID
      const viewAsResponse = await fetch(
        `/api/super-admin/view-as?orgId=${encodeURIComponent(orgId)}&email=${encodeURIComponent(user.email)}`
      );
      
      if (!viewAsResponse.ok) {
        const errData = await viewAsResponse.json();
        throw new Error(errData.error || 'Failed to load organization');
      }

      const viewAsData = await viewAsResponse.json();
      setOrgName(viewAsData.orgName);
      setProjectId(viewAsData.projectId);

      // Step 2: Fetch all dashboard data
      setLoadingData(true);
      const dashboardResponse = await fetch(
        `/api/super-admin/dashboard-data?orgId=${encodeURIComponent(orgId)}&projectId=${encodeURIComponent(viewAsData.projectId)}&email=${encodeURIComponent(user.email)}`
      );

      if (!dashboardResponse.ok) {
        const errData = await dashboardResponse.json();
        throw new Error(errData.error || 'Failed to load dashboard data');
      }

      const dashboardResult = await dashboardResponse.json();
      setDashboardData(dashboardResult.data);
      
      setLoading(false);
      setLoadingData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load organization');
      setLoading(false);
      setLoadingData(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white/30 mx-auto mb-4" />
          <p className="text-white/50 text-sm">
            {loadingData ? 'Loading dashboard data...' : 'Loading organization...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-white/30" />
          </div>
          <h1 className="text-xl font-medium text-white mb-2">Unable to View Organization</h1>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/super-admin')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Super Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <ViewAsContext.Provider value={{
      isViewAsMode: true,
      viewAsOrgId: orgId || '',
      viewAsProjectId: projectId,
      viewAsOrgName: orgName,
      viewAsData: dashboardData
    }}>
      {/* Super Admin Banner */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border-b border-white/10 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-white/70" />
            <span className="text-sm text-white/70">
              Super Admin Viewing: <span className="font-medium text-white">{orgName}</span>
            </span>
            <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-white/50">
              {dashboardData?.videos?.length || 0} videos • {dashboardData?.accounts?.length || 0} accounts
            </span>
          </div>
          <button
            onClick={() => navigate('/super-admin')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded text-xs font-medium hover:bg-white/90 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Exit View Mode
          </button>
        </div>
      </div>
      
      {/* Add padding for the banner */}
      <div className="pt-11">
        <DashboardPage />
      </div>
    </ViewAsContext.Provider>
  );
};

export default ViewAsPage;
export { ViewAsContext };
