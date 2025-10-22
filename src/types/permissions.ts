/**
 * Permission Types & Interfaces
 * Defines the granular permission system for team members
 */

export type PermissionLevel = 'none' | 'view' | 'manage';

export interface AnalyticsPermissions {
  views: boolean;
  likes: boolean;
  comments: boolean;
  shares: boolean;
  engagement: boolean;
  linkClicks: boolean;
  revenue: boolean;
}

export interface TabsPermissions {
  dashboard: boolean;
  trackedAccounts: boolean;
  videos: boolean;
  trackedLinks: boolean;
  rules: boolean;
  contracts: boolean;
  team: boolean;
  creators: boolean;
  campaigns: boolean;
  extension: boolean;
  settings: boolean;
}

export interface ProjectPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface AccountPermissions {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
  sync: boolean;
}

export interface TeamPermissions {
  view: boolean;
  invite: boolean;
  editRoles: boolean;
  editPermissions: boolean;
  remove: boolean;
}

export interface ContractsPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface RulesPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface LinksPermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * Complete permissions object for a team member
 */
export interface TeamMemberPermissions {
  analytics: AnalyticsPermissions;
  tabs: TabsPermissions;
  projects: ProjectPermissions;
  accounts: AccountPermissions;
  team: TeamPermissions;
  contracts: ContractsPermissions;
  rules: RulesPermissions;
  links: LinksPermissions;
}

/**
 * Default permissions for different roles
 */
export const DEFAULT_PERMISSIONS: Record<'owner' | 'admin' | 'member' | 'creator', TeamMemberPermissions> = {
  owner: {
    analytics: {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      engagement: true,
      linkClicks: true,
      revenue: true,
    },
    tabs: {
      dashboard: true,
      trackedAccounts: true,
      videos: true,
      trackedLinks: true,
      rules: true,
      contracts: true,
      team: true,
      creators: true,
      campaigns: true,
      extension: true,
      settings: true,
    },
    projects: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    accounts: {
      view: true,
      add: true,
      edit: true,
      delete: true,
      sync: true,
    },
    team: {
      view: true,
      invite: true,
      editRoles: true,
      editPermissions: true,
      remove: true,
    },
    contracts: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    rules: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    links: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
  },
  admin: {
    analytics: {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      engagement: true,
      linkClicks: true,
      revenue: true,
    },
    tabs: {
      dashboard: true,
      trackedAccounts: true,
      videos: true,
      trackedLinks: true,
      rules: true,
      contracts: true,
      team: true,
      creators: true,
      campaigns: true,
      extension: true,
      settings: true,
    },
    projects: {
      view: true,
      create: true,
      edit: true,
      delete: false, // Admins can't delete projects
    },
    accounts: {
      view: true,
      add: true,
      edit: true,
      delete: true,
      sync: true,
    },
    team: {
      view: true,
      invite: true,
      editRoles: true,
      editPermissions: true,
      remove: true,
    },
    contracts: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    rules: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
    links: {
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
  },
  member: {
    analytics: {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      engagement: true,
      linkClicks: true,
      revenue: false, // Members don't see revenue by default
    },
    tabs: {
      dashboard: true,
      trackedAccounts: true,
      videos: true,
      trackedLinks: true,
      rules: true,
      contracts: false, // Members don't see contracts by default
      team: true,
      creators: false,
      extension: true,
      settings: true,
    },
    projects: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    accounts: {
      view: true,
      add: true, // Can add accounts
      edit: false,
      delete: false,
      sync: true, // Can sync their own accounts
    },
    team: {
      view: true,
      invite: false,
      editRoles: false,
      editPermissions: false,
      remove: false,
    },
    contracts: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    rules: {
      view: true,
      create: true,
      edit: false,
      delete: false,
    },
    links: {
      view: true,
      create: true,
      edit: false,
      delete: false,
    },
  },
  creator: {
    analytics: {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      engagement: true,
      linkClicks: false,
      revenue: true, // Can see their own revenue/earnings
    },
    tabs: {
      dashboard: false, // Creators have their own specific views
      trackedAccounts: false,
      videos: false,
      trackedLinks: false,
      rules: false,
      contracts: false,
      team: false,
      creators: true, // Access to creator portal
      campaigns: false, // Creators view campaigns in their portal
      extension: false, // Creators don't need extension
      settings: true,
    },
    projects: {
      view: true,
      create: false,
      edit: false,
      delete: false,
    },
    accounts: {
      view: true, // Can view their linked accounts only
      add: false,
      edit: false,
      delete: false,
      sync: false,
    },
    team: {
      view: false,
      invite: false,
      editRoles: false,
      editPermissions: false,
      remove: false,
    },
    contracts: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    rules: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
    links: {
      view: false,
      create: false,
      edit: false,
      delete: false,
    },
  },
};

/**
 * Permission preset templates
 */
export interface PermissionPreset {
  id: string;
  name: string;
  description: string;
  permissions: TeamMemberPermissions;
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'creator',
    name: 'Creator',
    description: 'Can view analytics and manage their own content',
    permissions: {
      analytics: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        engagement: true,
        linkClicks: false,
        revenue: false,
      },
      tabs: {
        dashboard: true,
        trackedAccounts: true,
        videos: true,
        trackedLinks: false,
        rules: false,
        contracts: false,
        team: false,
        creators: false,
        extension: true,
        settings: true,
      },
      projects: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      accounts: {
        view: true,
        add: true,
        edit: false,
        delete: false,
        sync: true,
      },
      team: {
        view: false,
        invite: false,
        editRoles: false,
        editPermissions: false,
        remove: false,
      },
      contracts: {
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
      rules: {
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
      links: {
        view: false,
        create: false,
        edit: false,
        delete: false,
      },
    },
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Full analytics and content management, no team control',
    permissions: {
      analytics: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        engagement: true,
        linkClicks: true,
        revenue: true,
      },
      tabs: {
        dashboard: true,
        trackedAccounts: true,
        videos: true,
        trackedLinks: true,
        rules: true,
        contracts: true,
        team: false,
        creators: true,
        campaigns: true,
        extension: true,
        settings: true,
      },
      projects: {
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
      accounts: {
        view: true,
        add: true,
        edit: true,
        delete: false,
        sync: true,
      },
      team: {
        view: true,
        invite: false,
        editRoles: false,
        editPermissions: false,
        remove: false,
      },
      contracts: {
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
      rules: {
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
      links: {
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
    },
  },
  {
    id: 'analyst',
    name: 'Analyst',
    description: 'View-only access to all analytics and data',
    permissions: {
      analytics: {
        views: true,
        likes: true,
        comments: true,
        shares: true,
        engagement: true,
        linkClicks: true,
        revenue: true,
      },
      tabs: {
        dashboard: true,
        trackedAccounts: true,
        videos: true,
        trackedLinks: true,
        rules: true,
        contracts: true,
        team: false,
        creators: true,
        extension: true,
        settings: false,
      },
      projects: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      accounts: {
        view: true,
        add: false,
        edit: false,
        delete: false,
        sync: false,
      },
      team: {
        view: false,
        invite: false,
        editRoles: false,
        editPermissions: false,
        remove: false,
      },
      contracts: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      rules: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      links: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
    },
  },
];

