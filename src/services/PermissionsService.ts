import { TeamMemberPermissions, DEFAULT_PERMISSIONS } from '../types/permissions';
import { OrgMember } from '../types/firestore';

/**
 * PermissionsService
 * Centralized service for checking user permissions
 */
class PermissionsService {
  /**
   * Get permissions for a member
   * Returns custom permissions if set, otherwise returns default for their role
   */
  static getPermissions(member: OrgMember | null): TeamMemberPermissions {
    if (!member) {
      // Return most restrictive permissions for non-members
      return DEFAULT_PERMISSIONS.member;
    }

    // If member has custom permissions, use those
    if (member.permissions) {
      return member.permissions as TeamMemberPermissions;
    }

    // Otherwise, return default permissions for their role
    return DEFAULT_PERMISSIONS[member.role] || DEFAULT_PERMISSIONS.member;
  }

  /**
   * Check if user can access a specific tab
   */
  static canAccessTab(member: OrgMember | null, tab: keyof TeamMemberPermissions['tabs']): boolean {
    const permissions = this.getPermissions(member);
    return permissions.tabs[tab] === true;
  }

  /**
   * Check if user can view a specific analytics metric
   */
  static canViewAnalytics(member: OrgMember | null, metric: keyof TeamMemberPermissions['analytics']): boolean {
    const permissions = this.getPermissions(member);
    return permissions.analytics[metric] === true;
  }

  /**
   * Check project permissions
   */
  static canViewProjects(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.projects.view;
  }

  static canCreateProjects(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.projects.create;
  }

  static canEditProjects(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.projects.edit;
  }

  static canDeleteProjects(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.projects.delete;
  }

  /**
   * Check account permissions
   */
  static canViewAccounts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.accounts.view;
  }

  static canAddAccounts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.accounts.add;
  }

  static canEditAccounts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.accounts.edit;
  }

  static canDeleteAccounts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.accounts.delete;
  }

  static canSyncAccounts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.accounts.sync;
  }

  /**
   * Check team permissions
   */
  static canViewTeam(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.team.view;
  }

  static canInviteTeam(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.team.invite;
  }

  static canEditRoles(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.team.editRoles;
  }

  static canEditPermissions(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.team.editPermissions;
  }

  static canRemoveTeamMembers(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.team.remove;
  }

  /**
   * Check contract permissions
   */
  static canViewContracts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.contracts.view;
  }

  static canCreateContracts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.contracts.create;
  }

  static canEditContracts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.contracts.edit;
  }

  static canDeleteContracts(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.contracts.delete;
  }

  /**
   * Check rules permissions
   */
  static canViewRules(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.rules.view;
  }

  static canCreateRules(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.rules.create;
  }

  static canEditRules(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.rules.edit;
  }

  static canDeleteRules(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.rules.delete;
  }

  /**
   * Check link permissions
   */
  static canViewLinks(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.links.view;
  }

  static canCreateLinks(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.links.create;
  }

  static canEditLinks(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.links.edit;
  }

  static canDeleteLinks(member: OrgMember | null): boolean {
    const permissions = this.getPermissions(member);
    return permissions.links.delete;
  }

  /**
   * Check if user is admin or owner (has elevated permissions)
   */
  static isAdmin(member: OrgMember | null): boolean {
    if (!member) return false;
    return member.role === 'admin' || member.role === 'owner';
  }

  static isOwner(member: OrgMember | null): boolean {
    if (!member) return false;
    return member.role === 'owner';
  }

  /**
   * Update member permissions
   * (This should be called through OrganizationService)
   */
  static mergePermissions(basePermissions: TeamMemberPermissions, customPermissions: Partial<TeamMemberPermissions>): TeamMemberPermissions {
    return {
      analytics: { ...basePermissions.analytics, ...customPermissions.analytics },
      tabs: { ...basePermissions.tabs, ...customPermissions.tabs },
      projects: { ...basePermissions.projects, ...customPermissions.projects },
      accounts: { ...basePermissions.accounts, ...customPermissions.accounts },
      team: { ...basePermissions.team, ...customPermissions.team },
      contracts: { ...basePermissions.contracts, ...customPermissions.contracts },
      rules: { ...basePermissions.rules, ...customPermissions.rules },
      links: { ...basePermissions.links, ...customPermissions.links },
    };
  }
}

export default PermissionsService;

