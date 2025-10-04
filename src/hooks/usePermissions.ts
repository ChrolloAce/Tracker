import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import OrganizationService from '../services/OrganizationService';
import PermissionsService from '../services/PermissionsService';
import { OrgMember } from '../types/firestore';
import { TeamMemberPermissions } from '../types/permissions';

/**
 * Hook to access current user's permissions
 * Automatically loads the user's member data and checks permissions
 */
export function usePermissions() {
  const { user, currentOrgId } = useAuth();
  const [member, setMember] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Load member data
  useEffect(() => {
    let isMounted = true;

    const loadMember = async () => {
      if (!user || !currentOrgId) {
        setMember(null);
        setLoading(false);
        return;
      }

      try {
        const members = await OrganizationService.getOrgMembers(currentOrgId);
        const currentMember = members.find(m => m.userId === user.uid);
        
        if (isMounted) {
          setMember(currentMember || null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load member permissions:', error);
        if (isMounted) {
          setMember(null);
          setLoading(false);
        }
      }
    };

    loadMember();

    return () => {
      isMounted = false;
    };
  }, [user, currentOrgId]);

  // Memoize permissions to avoid recalculation
  const permissions = useMemo((): TeamMemberPermissions => {
    return PermissionsService.getPermissions(member);
  }, [member]);

  // Helper functions for common permission checks
  const can = useMemo(() => ({
    // Tabs
    accessTab: (tab: keyof TeamMemberPermissions['tabs']) => 
      PermissionsService.canAccessTab(member, tab),
    
    // Analytics
    viewAnalytics: (metric: keyof TeamMemberPermissions['analytics']) =>
      PermissionsService.canViewAnalytics(member, metric),
    
    // Projects
    viewProjects: () => PermissionsService.canViewProjects(member),
    createProjects: () => PermissionsService.canCreateProjects(member),
    editProjects: () => PermissionsService.canEditProjects(member),
    deleteProjects: () => PermissionsService.canDeleteProjects(member),
    
    // Accounts
    viewAccounts: () => PermissionsService.canViewAccounts(member),
    addAccounts: () => PermissionsService.canAddAccounts(member),
    editAccounts: () => PermissionsService.canEditAccounts(member),
    deleteAccounts: () => PermissionsService.canDeleteAccounts(member),
    syncAccounts: () => PermissionsService.canSyncAccounts(member),
    
    // Team
    viewTeam: () => PermissionsService.canViewTeam(member),
    inviteTeam: () => PermissionsService.canInviteTeam(member),
    editRoles: () => PermissionsService.canEditRoles(member),
    editPermissions: () => PermissionsService.canEditPermissions(member),
    removeTeamMembers: () => PermissionsService.canRemoveTeamMembers(member),
    
    // Contracts
    viewContracts: () => PermissionsService.canViewContracts(member),
    createContracts: () => PermissionsService.canCreateContracts(member),
    editContracts: () => PermissionsService.canEditContracts(member),
    deleteContracts: () => PermissionsService.canDeleteContracts(member),
    
    // Rules
    viewRules: () => PermissionsService.canViewRules(member),
    createRules: () => PermissionsService.canCreateRules(member),
    editRules: () => PermissionsService.canEditRules(member),
    deleteRules: () => PermissionsService.canDeleteRules(member),
    
    // Links
    viewLinks: () => PermissionsService.canViewLinks(member),
    createLinks: () => PermissionsService.canCreateLinks(member),
    editLinks: () => PermissionsService.canEditLinks(member),
    deleteLinks: () => PermissionsService.canDeleteLinks(member),
  }), [member]);

  // Role checks
  const isAdmin = useMemo(() => PermissionsService.isAdmin(member), [member]);
  const isOwner = useMemo(() => PermissionsService.isOwner(member), [member]);

  return {
    permissions,
    member,
    loading,
    can,
    isAdmin,
    isOwner,
  };
}

