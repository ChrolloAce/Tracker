/**
 * Demo Organization Service
 * Handles demo account detection and restrictions
 */

// Demo org configuration
export const DEMO_CONFIG = {
  email: '001ernestolopez@gmail.com',
  password: '', // No password needed for direct login
  // Add your demo org ID here after creating it manually in Firebase
  // or it will be auto-detected by the email
  demoOrgSlug: 'demo-viewtrack'
};

class DemoOrgService {
  /**
   * Check if user is using demo account
   */
  static isDemoUser(userEmail: string | null): boolean {
    if (!userEmail) return false;
    return userEmail.toLowerCase() === DEMO_CONFIG.email.toLowerCase();
  }

  /**
   * Check if organization is a demo org (by slug or metadata)
   */
  static isDemoOrg(orgSlug: string | undefined, orgMetadata?: any): boolean {
    if (!orgSlug) return false;
    
    // Check by slug
    if (orgSlug === DEMO_CONFIG.demoOrgSlug) return true;
    
    // Check by metadata flag (if you add isDemo: true to the org)
    if (orgMetadata?.isDemo === true) return true;
    
    return false;
  }

  /**
   * Check if action is allowed in demo mode
   */
  static canPerformAction(_action: 'addAccount' | 'addVideo' | 'inviteTeam' | 'editSettings' | 'delete'): boolean {
    // All write actions are blocked in demo
    return false;
  }

  /**
   * Get demo restrictions message
   */
  static getRestrictionMessage(_action: string): string {
    return `This action is disabled in demo mode. Sign up to unlock full access!`;
  }
}

export default DemoOrgService;

