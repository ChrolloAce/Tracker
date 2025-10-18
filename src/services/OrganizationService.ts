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
  increment,
  collectionGroup,
  updateDoc,
  deleteField
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
      // Update last login and refresh profile data (displayName, photoURL) on every login
      await setDoc(userRef, {
        lastLoginAt: Timestamp.now(),
        displayName: displayName || userDoc.data()?.displayName,
        photoURL: photoURL || userDoc.data()?.photoURL
      }, { merge: true });
      // console.log(`✅ Updated user profile for ${email}`);
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
      email?: string;
      displayName?: string;
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
    
    // Add creator as owner member with email and displayName
    const memberRef = doc(db, 'organizations', orgRef.id, 'members', userId);
    const memberData: OrgMember = {
      userId,
      role: 'owner',
      joinedAt: Timestamp.now(),
      status: 'active',
      email: data.email,
      displayName: data.displayName
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
      // Query all members subcollections where this user is a member
      const membersQuery = query(
        collectionGroup(db, 'members'),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      
      const membersSnapshot = await getDocs(membersQuery);
      const userOrgs: Organization[] = [];
      
      // Get each organization that the user is a member of
      for (const memberDoc of membersSnapshot.docs) {
        // Extract orgId from the member document path
        // Path format: organizations/{orgId}/members/{userId}
        const orgId = memberDoc.ref.parent.parent?.id;
        
        if (orgId) {
          const orgDoc = await getDoc(doc(db, 'organizations', orgId));
          if (orgDoc.exists()) {
            userOrgs.push({ id: orgDoc.id, ...orgDoc.data() } as Organization);
          }
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
   * Returns null if user has no orgs and shouldn't auto-create
   */
  static async getOrCreateDefaultOrg(userId: string, _email: string, _displayName?: string): Promise<string | null> {
    const userAccount = await this.getUserAccount(userId);
    
    // Check if default org exists and is accessible
    if (userAccount?.defaultOrgId) {
      try {
        const org = await this.getOrganization(userAccount.defaultOrgId);
        if (org) {
          // Verify user is still a member
          const member = await getDoc(doc(db, 'organizations', userAccount.defaultOrgId, 'members', userId));
          if (member.exists() && member.data()?.status === 'active') {
            return userAccount.defaultOrgId;
          }
        }
      } catch (error) {
        console.warn('Default org no longer accessible:', error);
      }
    }
    
    // Check if user has any other organizations
    const userOrgs = await this.getUserOrganizations(userId);
    if (userOrgs.length > 0) {
      // Use first available org
      const firstOrgId = userOrgs[0].id;
      await this.setDefaultOrg(userId, firstOrgId);
      return firstOrgId;
    }
    
    // No organizations found - return null to trigger redirect to create org page
    console.log('❌ User has no organizations');
    return null;
  }

  // ==================== MEMBERS ====================
  
  /**
   * Get organization members
   */
  static async getOrgMembers(orgId: string): Promise<Array<OrgMember & { email?: string; displayName?: string; photoURL?: string }>> {
    const membersSnapshot = await getDocs(
      query(
        collection(db, 'organizations', orgId, 'members'),
        where('status', '==', 'active'),
        orderBy('joinedAt', 'desc')
      )
    );
    
    const members: Array<OrgMember & { email?: string; displayName?: string; photoURL?: string }> = [];
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data() as OrgMember;
      
      // Try to fetch full user profile from user account
      let email = memberData.email;
      let displayName = memberData.displayName;
      let photoURL: string | undefined = undefined;
      
      try {
        const userAccount = await this.getUserAccount(memberData.userId);
        email = email || userAccount?.email;
        displayName = displayName || userAccount?.displayName;
        photoURL = userAccount?.photoURL; // Get profile photo
        
        // console.log(`👤 Loaded user profile:`, {
        //   userId: memberData.userId,
        //   email,
        //   displayName,
        //   hasPhoto: !!photoURL
        // });
      } catch (error) {
        // If user account fetch fails, use fallbacks from member doc
        console.warn(`⚠️ Could not fetch user account for ${memberData.userId}`, error);
      }
      
      members.push({
        ...memberData,
        email,
        displayName,
        photoURL
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

  /**
   * Update member role
   */
  static async updateMemberRole(orgId: string, userId: string, newRole: Role): Promise<void> {
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    await setDoc(memberRef, { role: newRole }, { merge: true });
    console.log(`✅ Updated role for member ${userId} to ${newRole}`);
  }

  /**
   * Update member permissions
   */
  static async updateMemberPermissions(orgId: string, userId: string, permissions: any): Promise<void> {
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    await setDoc(memberRef, { permissions }, { merge: true });
    console.log(`✅ Updated permissions for member ${userId}`);
  }

  /**
   * Clear member permissions (revert to role defaults)
   */
  static async clearMemberPermissions(orgId: string, userId: string): Promise<void> {
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    await updateDoc(memberRef, { permissions: deleteField() });
    console.log(`✅ Cleared custom permissions for member ${userId}, reverted to role defaults`);
  }

  /**
   * Check if user is owner or admin
   */
  static async isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    const role = await this.getUserRole(orgId, userId);
    return role === 'owner' || role === 'admin';
  }

  /**
   * Check if user is owner
   */
  static async isOrgOwner(orgId: string, userId: string): Promise<boolean> {
    const role = await this.getUserRole(orgId, userId);
    return role === 'owner';
  }

  /**
   * Set user's default organization
   */
  static async setDefaultOrg(userId: string, orgId: string): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { defaultOrgId: orgId }, { merge: true });
    console.log(`✅ Set default org to ${orgId} for user ${userId}`);
  }

  /**
   * Delete an organization and all its data
   * This is a server-side operation to ensure proper cascading deletes
   */
  static async deleteOrganization(organizationId: string, userId: string): Promise<void> {
    try {
      console.log(`🗑️  Deleting organization: ${organizationId}`);
      
      const response = await fetch('/api/delete-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete organization');
      }

      console.log(`✅ Organization deleted:`, data);
      return data;
    } catch (error) {
      console.error('❌ Failed to delete organization:', error);
      throw error;
    }
  }
}

export default OrganizationService;

