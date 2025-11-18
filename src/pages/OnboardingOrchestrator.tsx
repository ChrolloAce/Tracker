import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';

const OnboardingOrchestrator: React.FC = () => {
  const { user, currentOrgId, currentProjectId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // If user already has org and project, go straight to dashboard
    if (currentOrgId && currentProjectId) {
      console.log('✅ User already has org and project, navigating to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    const setupUser = async () => {
      try {
        // Check if user already has organizations in the database
        if (!currentOrgId) {
          console.log('🔍 Checking for existing organizations...');
          const userOrgs = await OrganizationService.getUserOrganizations(user.uid);
          
          if (userOrgs.length > 0) {
            // User has existing orgs - use the first one
            const orgId = userOrgs[0].id;
            console.log('✅ Found existing organization:', orgId);
            await OrganizationService.setDefaultOrg(user.uid, orgId);
            
            // Check for existing projects
            console.log('🔍 Checking for existing projects...');
            const projects = await ProjectService.getProjects(orgId, false);
            
            if (projects.length > 0) {
              // User has existing projects - use the first one
              const projectId = projects[0].id;
              console.log('✅ Found existing project:', projectId);
              await ProjectService.setActiveProject(orgId, user.uid, projectId);
              
              // Wait for Firestore to propagate changes
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Navigate to dashboard
              window.location.href = '/dashboard';
            } else {
              // Org exists but no projects - redirect to dashboard where they can create a project
              console.log('⚠️ Org exists but no projects - redirecting to dashboard');
              window.location.href = '/dashboard';
            }
          } else {
            // No existing orgs - redirect to proper onboarding wizard
            console.log('🎯 New user detected - redirecting to organization creation wizard');
            navigate('/create-organization', { replace: true });
          }
        } else {
          // Has org but no project - check for projects
          console.log('🔍 Has org, checking for projects...');
          const projects = await ProjectService.getProjects(currentOrgId, false);
          
          if (projects.length > 0) {
            // User has existing projects - use the first one
            const projectId = projects[0].id;
            console.log('✅ Found existing project:', projectId);
            await ProjectService.setActiveProject(currentOrgId, user.uid, projectId);
            
            // Wait for Firestore to propagate changes
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Navigate to dashboard
            window.location.href = '/dashboard';
          } else {
            // Has org but no projects - redirect to dashboard where they can create a project
            console.log('⚠️ Has org but no projects - redirecting to dashboard');
            window.location.href = '/dashboard';
          }
        }

      } catch (err: any) {
        console.error('❌ Onboarding error:', err);
        // Navigate to root on error - let routing handle it
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = '/';
      }
    };

    setupUser();
  }, [user, currentOrgId, currentProjectId, navigate]);

  // Just show spinning circle - no error messages, no text
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin" />
    </div>
  );
};

export default OnboardingOrchestrator;

