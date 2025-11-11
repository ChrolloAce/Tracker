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
        let orgId = currentOrgId;
        
        // Check if user already has organizations in the database
        if (!orgId) {
          console.log('🔍 Checking for existing organizations...');
          const userOrgs = await OrganizationService.getUserOrganizations(user.uid);
          
          if (userOrgs.length > 0) {
            // User has existing orgs - use the first one
            orgId = userOrgs[0].id;
            console.log('✅ Found existing organization:', orgId);
            await OrganizationService.setDefaultOrg(user.uid, orgId);
          } else {
            // No existing orgs - create a new one
            console.log('📝 Creating new organization...');
            const userName = user.displayName || user.email?.split('@')[0] || 'User';
            const orgName = `${userName}'s Workspace`;
            
            // Create org data object with proper structure
            const orgData = {
              name: orgName,
              email: user.email!,
              displayName: user.displayName || user.email?.split('@')[0] || 'User'
            };
            
            orgId = await OrganizationService.createOrganization(user.uid, orgData);
            await OrganizationService.setDefaultOrg(user.uid, orgId);
            console.log('✅ Created new organization:', orgId);
          }
        }
        
        // Check for existing projects
        let projectId = currentProjectId;
        if (!projectId && orgId) {
          console.log('🔍 Checking for existing projects...');
          const projects = await ProjectService.getProjects(orgId, false);
          
          if (projects.length > 0) {
            // User has existing projects - use the first one
            projectId = projects[0].id;
            console.log('✅ Found existing project:', projectId);
            await ProjectService.setActiveProject(orgId, user.uid, projectId);
          } else {
            // No existing projects - create a new one
            console.log('📝 Creating new project...');
            projectId = await ProjectService.createDefaultProject(orgId, user.uid);
            await ProjectService.setActiveProject(orgId, user.uid, projectId);
            console.log('✅ Created new project:', projectId);
          }
        }

        console.log('✅ Onboarding complete - org:', orgId, 'project:', projectId);
        
        // Wait for Firestore to propagate changes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Navigate to root - let App.tsx routing detect the org/project and redirect properly
        window.location.href = '/';

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

