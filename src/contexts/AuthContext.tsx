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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  currentOrgId: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => void;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
        const orgId = await OrganizationService.getOrCreateDefaultOrg(user.uid, user.email!);
        setCurrentOrgId(orgId);
        console.log('✅ Current organization:', orgId);
      } else {
        console.log('❌ User signed out');
        setCurrentOrgId(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
      console.log('✅ Signed out');
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw error;
    }
  };

  const switchOrganization = (orgId: string) => {
    setCurrentOrgId(orgId);
    console.log('🔄 Switched to organization:', orgId);
  };

  const value: AuthContextType = {
    user,
    loading,
    currentOrgId,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    switchOrganization
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

