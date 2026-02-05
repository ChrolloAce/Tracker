import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getRedirectResult
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import OrganizationService from '../services/OrganizationService';
import ProjectService from '../services/ProjectService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  currentOrgId: string | null;
  currentProjectId: string | null;
  userRole: string | null;
  isAdmin: boolean;
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // First check for redirect result, then set up auth state listener
    const initAuth = async () => {
      // Protect against React StrictMode double-call consuming the redirect result
      const redirectCheckKey = 'firebase_redirect_check_in_progress';
      if (sessionStorage.getItem(redirectCheckKey)) {
        console.log('⏭️ Redirect check already in progress, skipping duplicate call');
        return;
      }
      
      sessionStorage.setItem(redirectCheckKey, 'true');
      
      try {
        console.log('🔍 Checking for Google redirect result...');
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 Current pathname:', window.location.pathname);
        console.log('📍 Current search:', window.location.search);
        console.log('🌐 Auth domain configured:', auth.app.options.authDomain);
        console.log('🔐 Current auth state before redirect check:', auth.currentUser?.email || 'No user');
        
        // Check for Firebase auth persistence data in localStorage
        const firebaseKeys = Object.keys(localStorage).filter(key => key.startsWith('firebase:'));
        console.log('🔑 Firebase localStorage keys:', firebaseKeys.length > 0 ? firebaseKeys : 'NONE FOUND');
        if (firebaseKeys.length > 0) {
          firebaseKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
              try {
                const parsed = JSON.parse(value);
                console.log(`  - ${key}:`, parsed.uid ? `User ${parsed.uid}` : 'Other data');
              } catch {
                console.log(`  - ${key}:`, value.substring(0, 50) + '...');
              }
            }
          });
        }
        
        const result = await getRedirectResult(auth);
        
        console.log('📦 getRedirectResult returned:', result ? 'USER OBJECT' : 'NULL');
        
        if (result) {
          console.log('✅ Google sign-in redirect successful:', result.user.email);
          console.log('👤 User ID:', result.user.uid);
          console.log('🔑 Provider:', result.providerId);
          console.log('📧 Email verified:', result.user.emailVerified);
          console.log('🎫 Access token available:', !!result.user.getIdToken);
          
          // Store in sessionStorage that we just completed a redirect
          sessionStorage.setItem('justCompletedGoogleRedirect', 'true');
          
          // Create user account immediately after successful sign-in
          try {
            await OrganizationService.createUserAccount(
              result.user.uid,
              result.user.email!,
              result.user.displayName || undefined,
              result.user.photoURL || undefined
            );
            console.log('✅ User account created/verified in Firestore');
          } catch (err) {
            console.error('❌ Error creating user account:', err);
          }
        } else {
          console.log('ℹ️ No redirect result (normal page load)');
        }
      } catch (error: any) {
        console.error('❌ Google sign-in redirect check error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle specific errors gracefully
        if (error.code === 'auth/popup-blocked') {
          alert('Popup was blocked. Please allow popups for this site.');
        } else if (error.code === 'auth/unauthorized-domain') {
          alert('This domain is not authorized for Google sign-in. Please contact support.');
        } else if (error.code === 'auth/cancelled-popup-request') {
          console.log('User cancelled the sign-in');
        } else if (
          error.message?.includes('missing initial state') ||
          error.message?.includes('sessionStorage is inaccessible') ||
          error.code === 'auth/missing-or-invalid-nonce'
        ) {
          // This happens in storage-partitioned environments (Safari, Firefox strict mode)
          // or when sessionStorage was cleared. Just treat it as a normal page load.
          console.log('ℹ️ Redirect state lost (storage partitioned or cleared) - treating as normal page load');
          // Don't show an error to the user - they can just sign in again with popup mode
        } else {
          // For other errors, log but don't alert on page load - it's disruptive
          console.warn('⚠️ Redirect result check failed, user can sign in again:', error.message);
        }
      } finally {
        // Clear the lock after a short delay
        setTimeout(() => {
          sessionStorage.removeItem(redirectCheckKey);
        }, 1000);
      }
    };

    initAuth();

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // ✅ Check if we're on an invitation page - if so, skip org/project loading
        // The invitation page will handle org membership after acceptance
        const isInvitationPage = window.location.pathname.startsWith('/invitations/');
        if (isInvitationPage) {
          console.log('🎯 On invitation page - skipping org/project loading');
          setCurrentOrgId(null);
          setCurrentProjectId(null);
          setUserRole(null);
          setLoading(false);
          return;
        }
        
        // Check custom email verification (skip for demo account and Google sign-ins)
        if (user.email !== '001ernestolopez@gmail.com' && user.providerData[0]?.providerId === 'password') {
          // Check if user has verified their email via our custom code system
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const isVerified = userDoc.exists() && userDoc.data()?.emailVerified === true;
          
          if (!isVerified) {
            console.log('⚠️ Email not verified for:', user.email);
            setUser(user);
            setCurrentOrgId(null);
            setCurrentProjectId(null);
            setUserRole(null);
            setLoading(false);
            // Don't redirect - let the app show verification screen
            return;
          }
        }
        
        // Create user account in Firestore if doesn't exist
        await OrganizationService.createUserAccount(
          user.uid, 
          user.email!, 
          user.displayName || undefined,
          user.photoURL || undefined
        );
        
        // FIRST: Always check if user has ANY organizations
        console.log('🔍 Checking user organizations for:', user.uid);
        const userOrgs = await OrganizationService.getUserOrganizations(user.uid);
        console.log('📊 User has', userOrgs.length, 'organizations:', userOrgs.map(o => o.id));
        
        let orgId: string | null = null;
        
        if (userOrgs.length === 0) {
          // No organizations at all - let routing handle redirect
          console.log('❌ User has no organizations');
          setCurrentOrgId(null);
          setCurrentProjectId(null);
          setUserRole(null);
          setLoading(false);
          // Don't manually redirect - App.tsx routing will handle it
          return;
        }
        
        // User has orgs! Get the default org or use first one
        const userAccount = await OrganizationService.getUserAccount(user.uid);
        
        // Set admin status
        setIsAdmin(userAccount?.isAdmin === true);
        if (userAccount?.isAdmin) {
          console.log('🔓 Admin user detected:', user.uid);
        }
        
        if (userAccount?.defaultOrgId && userOrgs.find(o => o.id === userAccount.defaultOrgId)) {
          // Use saved default org
          orgId = userAccount.defaultOrgId;
          console.log('✅ Using saved default org:', orgId);
        } else {
          // No default set or default doesn't exist - use first org
          orgId = userOrgs[0].id;
          console.log('✅ Using first org as default:', orgId);
          await OrganizationService.setDefaultOrg(user.uid, orgId);
          
          // Mark onboarding as complete if not already marked
          const org = await OrganizationService.getOrganization(orgId);
          if (org && !org.metadata?.onboardingCompletedAt) {
            console.log('📝 Marking onboarding as complete for existing org');
            const orgRef = doc(db, 'organizations', orgId);
            await setDoc(orgRef, {
              metadata: {
                ...org.metadata,
                onboardingCompletedAt: new Date().toISOString()
              }
            }, { merge: true });
        }
        }
        
        console.log('✅ Final org ID to use:', orgId);
        setCurrentOrgId(orgId);
        
        // Load user role FIRST (needed for project filtering)
        const members = await OrganizationService.getOrgMembers(orgId);
        const member = members.find(m => m.userId === user.uid);
        const role = member?.role || null;
        setUserRole(role);

        // Get or create default project (role-aware)
        const projectId = await loadOrCreateProject(orgId, user.uid, role);
        setCurrentProjectId(projectId);
      } else {
        setCurrentOrgId(null);
        setCurrentProjectId(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadOrCreateProject = async (orgId: string, userId: string, role: string | null): Promise<string> => {
    const maxRetries = 3;
    let lastError;
    const isCreator = role === 'creator';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if user has a last active project
        const lastProjectId = await ProjectService.getActiveProjectId(orgId, userId);
        if (lastProjectId) {
          // For creators, verify they have access to this project
          if (isCreator) {
            const creatorProjectIds = await ProjectService.getCreatorProjectIds(orgId, userId);
            if (creatorProjectIds.includes(lastProjectId)) {
              const project = await ProjectService.getProjectWithStats(orgId, lastProjectId);
              if (project && !project.isArchived) {
                return lastProjectId;
              }
            }
          } else {
            const project = await ProjectService.getProjectWithStats(orgId, lastProjectId);
            if (project && !project.isArchived) {
              return lastProjectId;
            }
          }
        }

        // Get projects (filtered for creators)
        let projects;
        if (isCreator) {
          projects = await ProjectService.getProjectsForCreator(orgId, userId);
        } else {
          projects = await ProjectService.getProjects(orgId, false);
        }
        
        if (projects.length > 0) {
          // Use first available project
          const projectId = projects[0].id;
          await ProjectService.setActiveProject(orgId, userId, projectId);
          return projectId;
        }
        
        // For creators with no assigned projects, return empty string
        if (isCreator) {
          console.log('⚠️ Creator has no assigned projects');
          return '';
        }

        // No projects exist, create default project (admins/members only)
        const projectId = await ProjectService.createDefaultProject(orgId, userId);
        await ProjectService.setActiveProject(orgId, userId, projectId);
        return projectId;
      } catch (error: any) {
        lastError = error;
        console.error(`Failed to load/create project (attempt ${attempt}/${maxRetries}):`, error);
        
        // If it's a permission error and not the last attempt, wait and retry
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3s
            continue;
          }
          
          // On last attempt with permission error, sign user out to reset state
          console.error('❌ Still getting permission errors after retries. Signing out to reset state...');
          alert('There was an issue loading your organization. Please sign in again.');
          await logout();
          return ''; // Return empty to prevent further execution
        }
        
        // For other errors or last attempt, throw
        throw error;
      }
    }
    
    throw lastError;
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection every time
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Default to popup mode - more reliable and no React StrictMode issues
      // Can be switched to redirect mode by setting sessionStorage flag
      const shouldUsePopup = sessionStorage.getItem('use_redirect_auth') !== 'true';
      
      if (shouldUsePopup) {
        console.log('🪟 Using popup mode for Google sign-in...');
        console.log('🌐 Auth domain:', auth.app.options.authDomain);
        
        const result = await signInWithPopup(auth, provider);
        
        console.log('✅ Google sign-in popup successful:', result.user.email);
        console.log('👤 User ID:', result.user.uid);
        
        // Create user account immediately
        try {
          await OrganizationService.createUserAccount(
            result.user.uid,
            result.user.email!,
            result.user.displayName || undefined,
            result.user.photoURL || undefined
          );
          console.log('✅ User account created/verified in Firestore');
        } catch (err) {
          console.error('❌ Error creating user account:', err);
        }
        
        // Store that we just completed auth
        sessionStorage.setItem('justCompletedGoogleRedirect', 'true');
        
      } else {
        console.log('🔄 Using redirect mode for Google sign-in...');
      console.log('🌐 Auth domain:', auth.app.options.authDomain);
      await signInWithRedirect(auth, provider);
      // User will be redirected, so no need to handle result here
      }
    } catch (error: any) {
      console.error('❌ Failed to initiate Google sign-in:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Show user-friendly error
      if (error.code === 'auth/unauthorized-domain') {
        alert('Error: This domain is not authorized for Google sign-in. Please contact support.');
      } else if (error.code === 'auth/operation-not-allowed') {
        alert('Google sign-in is not enabled. Please contact support.');
      } else if (error.code === 'auth/popup-blocked') {
        alert('Popup was blocked by your browser. Please allow popups and try again, or we\'ll use redirect mode.');
        // Don't set popup mode flag - let user try again
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('User closed the popup');
        // Don't show error - user intentionally closed it
      } else {
        alert(`Sign-in failed: ${error.message}. Please try again.`);
      }
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Failed to sign in with email:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Note: Verification code is sent by EmailVerificationScreen component
      console.log('✅ User created:', email);
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
      
      // Clear any auth-related session flags
      sessionStorage.removeItem('justCompletedGoogleRedirect');
      sessionStorage.removeItem('use_popup_auth');
      
      console.log('✅ Signed out and cleared session flags');
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  };

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    setCurrentProjectId(null); // Reset project when switching orgs
  };

  const switchProject = async (projectId: string) => {
    if (!currentOrgId || !user) return;
    
    try {
      await ProjectService.setActiveProject(currentOrgId, user.uid, projectId);
      setCurrentProjectId(projectId);
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
    userRole,
    isAdmin,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    switchOrganization,
    switchProject,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

