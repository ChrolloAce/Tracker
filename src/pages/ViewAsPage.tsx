import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminService from '../services/SuperAdminService';
import DashboardPage from './DashboardPage';
import { Loader2, ArrowLeft, Shield } from 'lucide-react';

/**
 * ViewAs Context - Provides org/project IDs for super admin "view as user" functionality
 */
const ViewAsContext = createContext<{
  isViewAsMode: boolean;
  viewAsOrgId: string;
  viewAsProjectId: string;
  viewAsOrgName: string;
}>({
  isViewAsMode: false,
  viewAsOrgId: '',
  viewAsProjectId: '',
  viewAsOrgName: ''
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
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');

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
  }, [orgId, isSuperAdmin, navigate]);

  const loadOrgData = async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      setError(null);

      // Get org name
      const orgDoc = await getDoc(doc(db, 'organizations', orgId));
      if (!orgDoc.exists()) {
        setError('Organization not found');
        setLoading(false);
        return;
      }
      setOrgName(orgDoc.data()?.name || 'Unknown Organization');

      // Get first project
      const projectsQuery = query(
        collection(db, 'organizations', orgId, 'projects'),
        limit(1)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      
      if (projectsSnapshot.empty) {
        setError('Organization has no projects');
        setLoading(false);
        return;
      }

      const firstProject = projectsSnapshot.docs[0];
      setProjectId(firstProject.id);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load organization');
      setLoading(false);
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
          <p className="text-white/50 text-sm">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white/30" />
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
      viewAsOrgName: orgName
    }}>
      {/* Super Admin Banner */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-white/10 backdrop-blur-sm border-b border-white/10 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-white/70" />
            <span className="text-sm text-white/70">
              Viewing as: <span className="font-medium text-white">{orgName}</span>
            </span>
          </div>
          <button
            onClick={() => navigate('/super-admin')}
            className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Exit View Mode
          </button>
        </div>
      </div>
      
      {/* Add padding for the banner */}
      <div className="pt-10">
        <DashboardPage />
      </div>
    </ViewAsContext.Provider>
  );
};

export default ViewAsPage;
export { ViewAsContext };

