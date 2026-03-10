// Super admin email(s) - only these can access super admin features
export const SUPER_ADMIN_EMAILS = [
  'ernesto@maktubtechnologies.com'
];

export interface OrganizationSummary {
  id: string;
  name: string;
  createdAt: Date;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  memberCount: number;
  plan: string;
  planTier: 'free' | 'basic' | 'pro' | 'enterprise';
  projectCount: number;
  totalTrackedAccounts: number;
  totalVideos: number;
}

export interface SuperAdminStats {
  totalOrganizations: number;
  totalPaidOrganizations: number;
  totalFreeOrganizations: number;
  totalUsers: number;
  totalTrackedAccounts: number;
  totalVideos: number;
  planBreakdown: {
    free: number;
    basic: number;
    pro: number;
    enterprise: number;
  };
}

class SuperAdminService {
  /**
   * Check if an email is a super admin
   */
  isSuperAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
  }

  /**
   * Get all organizations with their summary data via API
   */
  async getAllOrganizations(userEmail: string): Promise<{ organizations: OrganizationSummary[], stats: SuperAdminStats }> {
    console.log('🔍 SuperAdmin: Fetching all organizations via API...');
    
    try {
      const response = await fetch(`/api/super-admin/organizations?email=${encodeURIComponent(userEmail)}`);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Super Admin API not available. Please ensure you are on the production Vercel deployment.');
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch organizations');
      }
      
      const data = await response.json();
      
      // Convert date strings back to Date objects
      const organizations = data.organizations.map((org: any) => ({
        ...org,
        createdAt: new Date(org.createdAt)
      }));
      
      console.log('✅ SuperAdmin: Loaded', organizations.length, 'organizations');
      return { organizations, stats: data.stats };
    } catch (error) {
      console.error('❌ SuperAdmin: Failed to fetch organizations:', error);
      throw error;
    }
  }

  /**
   * Get detailed info for a specific organization via API
   */
  async getOrganizationDetails(orgId: string, userEmail: string): Promise<{
    organization: OrganizationSummary | null;
    trackedAccounts: any[];
    videos: any[];
    members: any[];
  }> {
    console.log('🔍 SuperAdmin: Fetching org details via API...');
    
    try {
      const response = await fetch(`/api/super-admin/organizations/${orgId}?email=${encodeURIComponent(userEmail)}`);
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Super Admin API not available.');
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch organization details');
      }
      
      const data = await response.json();
      
      if (data.organization) {
        data.organization.createdAt = new Date(data.organization.createdAt);
      }
      
      return data;
    } catch (error) {
      console.error('❌ SuperAdmin: Failed to fetch org details:', error);
      throw error;
    }
  }

  /**
   * Delete an organization and all its data (super admin only)
   */
  async deleteOrganization(orgId: string, userEmail: string): Promise<void> {
    const response = await fetch('/api/super-admin/delete-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, orgId }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete organization');
    }
  }

  /**
   * Assign an owner to an organization by email
   */
  async assignOwner(orgId: string, targetEmail: string, userEmail: string): Promise<{ displayName: string }> {
    const response = await fetch('/api/super-admin/assign-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, orgId, targetEmail }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to assign owner');
    }

    return response.json();
  }

  /**
   * Delete or remove a member from an organization
   */
  async deleteMember(orgId: string, memberId: string, userEmail: string, hardDelete: boolean = false): Promise<void> {
    const response = await fetch('/api/super-admin/delete-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, orgId, memberId, hardDelete }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete member');
    }
  }
}

export default new SuperAdminService();
