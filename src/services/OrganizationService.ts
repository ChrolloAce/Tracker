import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Organization, 
  OrgMember, 
  UserAccount,
  Role
} from '../types/firestore';
import SubscriptionService from './SubscriptionService';

/**
 * OrganizationService - Manages organizations and memberships
 */
class OrganizationService {
  
  // ==================== USER ACCOUNT ====================
  
  /**
   * Create user account on first sign-in
   */
  static async createUserAccount(uid: string, email: string, displayName?: string, photoURL?: string): Promise<void> {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      const userData: UserAccount = {
        uid,
        email,
        displayName,
        photoURL,
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        plan: 'free'
      };
      
      await setDoc(userRef, userData);
      console.log(`✅ Created user account for ${email}`);
    } else {
      // Update last login
      await setDoc(userRef, {
        lastLoginAt: Timestamp.now()
      }, { merge: true });
    }
  }

  /**
   * Get user account
   */
  static async getUserAccount(uid: string): Promise<UserAccount | null> {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserAccount;
    }
    return null;
  }

  // ==================== ORGANIZATIONS ====================
  
  /**
   * Create a new organization
   */
  static async createOrganization(
    userId: string, 
    data: {
      name: string;
      slug?: string;
      website?: string;
      logoUrl?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const batch = writeBatch(db);
    
    // Create organization
    const orgRef = doc(collection(db, 'organizations'));
    const orgData: Organization = {
      id: orgRef.id,
      name: data.name,
      ...(data.slug && { slug: data.slug }),
      ...(data.website && { website: data.website }),
      ...(data.logoUrl && { logoUrl: data.logoUrl }),
      ...(data.metadata && { metadata: data.metadata }),
      createdAt: Timestamp.now(),
      createdBy: userId,
      ownerUserId: userId,
      memberCount: 1,
      trackedAccountCount: 0,
      videoCount: 0,
      linkCount: 0,
      projectCount: 0
    };
    
    batch.set(orgRef, orgData);
    
    // Add creator as owner member
    const memberRef = doc(db, 'organizations', orgRef.id, 'members', userId);
    const memberData: OrgMember = {
      userId,
      role: 'owner',
      joinedAt: Timestamp.now(),
      status: 'active'
    };
    
    batch.set(memberRef, memberData);
    
    // Set as default org for user
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, { defaultOrgId: orgRef.id });
    
    await batch.commit();
    
    // Create default subscription with 7-day trial
    try {
      await SubscriptionService.createDefaultSubscription(orgRef.id);
      console.log(`✅ Created default subscription for org ${orgRef.id}`);
    } catch (error) {
      console.error('Failed to create default subscription:', error);
      // Don't fail org creation if subscription fails
    }
    
    console.log(`✅ Created organization "${name}" with ID: ${orgRef.id}`);
    return orgRef.id;
  }

  /**
   * Get user's organizations
   */
  static async getUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      // Query all orgs where user is a member
      const orgsSnapshot = await getDocs(collection(db, 'organizations'));
      const userOrgs: Organization[] = [];
      
      for (const orgDoc of orgsSnapshot.docs) {
        const memberDoc = await getDoc(
          doc(db, 'organizations', orgDoc.id, 'members', userId)
        );
        
        if (memberDoc.exists() && memberDoc.data().status === 'active') {
          userOrgs.push({ id: orgDoc.id, ...orgDoc.data() } as Organization);
        }
      }
      
      return userOrgs;
    } catch (error) {
      console.error('Failed to get user organizations:', error);
      return [];
    }
  }

  /**
   * Get organization by ID
   */
  static async getOrganization(orgId: string): Promise<Organization | null> {
    const orgDoc = await getDoc(doc(db, 'organizations', orgId));
    if (orgDoc.exists()) {
      return { id: orgDoc.id, ...orgDoc.data() } as Organization;
    }
    return null;
  }

  /**
   * Get user's default organization (or create one)
   */
  static async getOrCreateDefaultOrg(userId: string, email: string): Promise<string> {
    const userAccount = await this.getUserAccount(userId);
    
    if (userAccount?.defaultOrgId) {
      const org = await this.getOrganization(userAccount.defaultOrgId);
      if (org) return userAccount.defaultOrgId;
    }
    
    // Create default organization
    const defaultName = email.split('@')[0] + "'s Workspace";
    return await this.createOrganization(userId, { name: defaultName });
  }

  // ==================== MEMBERS ====================
  
  /**
   * Get organization members
   */
  static async getOrgMembers(orgId: string): Promise<Array<OrgMember & { email?: string; displayName?: string }>> {
    const membersSnapshot = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'members'),
        where('status', '==', 'active'),
        orderBy('joinedAt', 'desc')
      )
    );
    
    const members: Array<OrgMember & { email?: string; displayName?: string }> = [];
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data() as OrgMember;
      const userAccount = await this.getUserAccount(memberData.userId);
      
      members.push({
        ...memberData,
        email: userAccount?.email,
        displayName: userAccount?.displayName
      });
    }
    
    return members;
  }

  /**
   * Add member to organization
   */
  static async addMember(orgId: string, userId: string, role: Role, invitedBy: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Add member
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    const memberData: OrgMember = {
      userId,
      role,
      joinedAt: Timestamp.now(),
      status: 'active',
      invitedBy
    };
    
    batch.set(memberRef, memberData);
    
    // Increment member count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, { memberCount: increment(1) });
    
    await batch.commit();
    console.log(`✅ Added member ${userId} to organization ${orgId}`);
  }

  /**
   * Remove member from organization
   */
  static async removeMember(orgId: string, userId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Update member status
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    batch.update(memberRef, { status: 'removed' });
    
    // Decrement member count
    const orgRef = doc(db, 'organizations', orgId);
    batch.update(orgRef, { memberCount: increment(-1) });
    
    await batch.commit();
    console.log(`✅ Removed member ${userId} from organization ${orgId}`);
  }

  /**
   * Check if user has access to organization
   */
  static async hasOrgAccess(orgId: string, userId: string): Promise<boolean> {
    const memberDoc = await getDoc(
      doc(db, 'organizations', orgId, 'members', userId)
    );
    
    return memberDoc.exists() && memberDoc.data().status === 'active';
  }

  /**
   * Get user's role in organization
   */
  static async getUserRole(orgId: string, userId: string): Promise<Role | null> {
    const memberDoc = await getDoc(
      doc(db, 'organizations', orgId, 'members', userId)
    );
    
    if (memberDoc.exists() && memberDoc.data().status === 'active') {
      return memberDoc.data().role;
    }
    return null;
  }
}

export default OrganizationService;

