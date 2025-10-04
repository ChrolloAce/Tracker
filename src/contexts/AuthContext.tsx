import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../services/firebase';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  currentOrgId: string | null;
  currentProjectId: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => void;
  switchProject: (projectId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        
        if (user) {
          console.log('✅ User signed in:', user.email);
          
          // Create user account in Firestore if doesn't exist
          await OrganizationService.createUserAccount(
            user.uid, 
            user.email!, 
            user.displayName || undefined,
            user.photoURL || undefined
          );
          
          // Get or create default organization
          const orgId = await OrganizationService.getOrCreateDefaultOrg(user.uid, user.email!, user.displayName || undefined);
          setCurrentOrgId(orgId);
          console.log('✅ Current organization:', orgId);

          // Get or create default project
          const projectId = await loadOrCreateProject(orgId, user.uid);
          setCurrentProjectId(projectId);
          console.log('✅ Current project:', projectId);
        } else {
          console.log('❌ User signed out');
          setCurrentOrgId(null);
          setCurrentProjectId(null);
        }
      } catch (error) {
        console.error('❌ Error during auth initialization:', error);
        // Set loading to false even on error to prevent infinite loading
        // User will be redirected to login or shown an error
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const loadOrCreateProject = async (orgId: string, userId: string): Promise<string> => {
    try {
      // Check if user has a last active project
      const lastProjectId = await ProjectService.getActiveProjectId(orgId, userId);
      if (lastProjectId) {
        const project = await ProjectService.getProjectWithStats(orgId, lastProjectId);
        if (project && !project.isArchived) {
          return lastProjectId;
        }
      }

      // Get all projects
      const projects = await ProjectService.getProjects(orgId, false);
      
      if (projects.length > 0) {
        // Use first non-archived project
        const projectId = projects[0].id;
        await ProjectService.setActiveProject(orgId, userId, projectId);
        return projectId;
      }

      // No projects exist, create default project
      console.log('📁 Creating default project for org:', orgId);
      const projectId = await ProjectService.createDefaultProject(orgId, userId);
      await ProjectService.setActiveProject(orgId, userId, projectId);
      return projectId;
    } catch (error) {
      console.error('Failed to load/create project:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log('✅ Signed in with Google');
    } catch (error) {
      console.error('Failed to sign in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Signed in with email');
    } catch (error) {
      console.error('Failed to sign in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Signed up with email');
    } catch (error) {
      console.error('Failed to sign up with email:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentOrgId(null);
      setCurrentProjectId(null);
      console.log('✅ Signed out');
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  };

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    setCurrentProjectId(null); // Reset project when switching orgs
    console.log('🔄 Switched to organization:', orgId);
  };

  const switchProject = async (projectId: string) => {
    if (!currentOrgId || !user) return;
    
    try {
      await ProjectService.setActiveProject(currentOrgId, user.uid, projectId);
      setCurrentProjectId(projectId);
      console.log('🔄 Switched to project:', projectId);
    } catch (error) {
      console.error('Failed to switch project:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    currentOrgId,
    currentProjectId,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    switchOrganization,
    switchProject,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

