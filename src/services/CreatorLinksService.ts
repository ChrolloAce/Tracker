import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  writeBatch,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';
import { CreatorLink, Creator } from '../types/firestore';

/**
 * CreatorLinksService - PROJECT SCOPED
 * Manages the mapping between creators and their linked accounts within projects
 * Creators are now project-specific and can be in multiple projects
 */
class CreatorLinksService {
  /**
   * Add a creator profile directly (without invitation).
   * Creates both an org member record and a project-scoped creator profile.
   */
  static async addCreatorProfile(
    orgId: string,
    projectId: string,
    createdBy: string,
    data: {
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
    }
  ): Promise<string> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Generate a unique ID for this "virtual" creator (no real Firebase Auth user)
    const memberRef = doc(collection(db, 'organizations', orgId, 'members'));
    const creatorId = memberRef.id;

    // Create org member record so the creator appears in the creators list
    batch.set(memberRef, {
      userId: creatorId,
      role: 'creator',
      joinedAt: now,
      status: 'active',
      invitedBy: createdBy,
      displayName: data.name,
      ...(data.email && { email: data.email }),
      creatorProjectIds: [projectId],
    });

    // Create project-scoped creator profile
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    const creatorData: Omit<Creator, 'id'> = {
      orgId,
      projectId,
      displayName: data.name,
      ...(data.email && { email: data.email }),
      ...(data.phone && { phone: data.phone }),
      ...(data.notes && { notes: data.notes }),
      linkedAccountsCount: 0,
      totalEarnings: 0,
      payoutsEnabled: true,
      addedWithoutInvite: true,
      createdAt: now,
    };
    batch.set(creatorRef, creatorData);

    await batch.commit();
    return creatorId;
  }

  /**
   * Link a creator to one or more accounts within a project
   */
  static async linkCreatorToAccounts(
    orgId: string,
    projectId: string,
    creatorId: string,
    accountIds: string[],
    linkedBy: string
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Create creator profile if it doesn't exist in this project
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    const creatorDoc = await getDoc(creatorRef);
    
    if (!creatorDoc.exists()) {
      // Get creator details from members collection
      const memberRef = doc(db, 'organizations', orgId, 'members', creatorId);
      const memberDoc = await getDoc(memberRef);
      
      if (memberDoc.exists()) {
        const memberData = memberDoc.data();

        // Get photoURL: try member doc first, then fall back to user account
        let photoURL = memberData.photoURL;
        if (!photoURL) {
          try {
            const userAccountRef = doc(db, 'users', creatorId);
            const userAccountDoc = await getDoc(userAccountRef);
            if (userAccountDoc.exists()) {
              photoURL = userAccountDoc.data()?.photoURL;
            }
          } catch (err) {
            // Ignore - photoURL is optional
          }
        }

        const creatorData: Omit<Creator, 'id'> = {
          orgId,
          projectId,
          displayName: memberData.displayName || 'Unknown',
          email: memberData.email || '',
          ...(photoURL && { photoURL }), // Only include if defined
          linkedAccountsCount: accountIds.length,
          totalEarnings: 0,
          payoutsEnabled: true,
          createdAt: now,
        };
        batch.set(creatorRef, creatorData);
        
        // Add this project to the member's creatorProjectIds
        batch.update(memberRef, {
          creatorProjectIds: arrayUnion(projectId)
        });
      }
    } else {
      // Update linked accounts count
      const currentData = creatorDoc.data() as Creator;
      batch.update(creatorRef, {
        linkedAccountsCount: currentData.linkedAccountsCount + accountIds.length,
      });
    }

    // Create links for each account
    for (const accountId of accountIds) {
      const linkRef = doc(collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks'));
      const linkData: Omit<CreatorLink, 'id'> = {
        orgId,
        projectId,
        creatorId,
        accountId,
        createdAt: now,
        createdBy: linkedBy,
      };
      batch.set(linkRef, linkData);
    }

    await batch.commit();
  }

  /**
   * Unlink a creator from an account within a project
   */
  static async unlinkCreatorFromAccount(
    orgId: string,
    projectId: string,
    creatorId: string,
    accountId: string
  ): Promise<void> {
    const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
    const q = query(
      linksRef,
      where('creatorId', '==', creatorId),
      where('accountId', '==', accountId)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Update creator's linked accounts count
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    const creatorDoc = await getDoc(creatorRef);
    
    if (creatorDoc.exists()) {
      const currentData = creatorDoc.data() as Creator;
      batch.update(creatorRef, {
        linkedAccountsCount: Math.max(0, currentData.linkedAccountsCount - 1),
      });
    }

    await batch.commit();
  }

  /**
   * Get all accounts linked to a creator in a project
   */
  static async getCreatorLinkedAccounts(
    orgId: string,
    projectId: string,
    creatorId: string
  ): Promise<CreatorLink[]> {
    const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
    const q = query(linksRef, where('creatorId', '==', creatorId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreatorLink[];
  }

  /**
   * Get all creators linked to an account in a project
   */
  static async getAccountLinkedCreators(
    orgId: string,
    projectId: string,
    accountId: string
  ): Promise<CreatorLink[]> {
    const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
    const q = query(linksRef, where('accountId', '==', accountId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreatorLink[];
  }

  /**
   * Get all creator links for a project
   */
  static async getAllCreatorLinks(orgId: string, projectId: string): Promise<CreatorLink[]> {
    const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
    const snapshot = await getDocs(linksRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreatorLink[];
  }

  /**
   * Check if a creator is linked to a specific account in a project
   */
  static async isCreatorLinkedToAccount(
    orgId: string,
    projectId: string,
    creatorId: string,
    accountId: string
  ): Promise<boolean> {
    const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
    const q = query(
      linksRef,
      where('creatorId', '==', creatorId),
      where('accountId', '==', accountId)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get creator profile in a specific project
   */
  static async getCreatorProfile(
    orgId: string,
    projectId: string,
    creatorId: string
  ): Promise<Creator | null> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    const creatorDoc = await getDoc(creatorRef);

    if (!creatorDoc.exists()) {
      return null;
    }

    const creatorData = {
      id: creatorDoc.id,
      ...creatorDoc.data(),
    } as Creator;

    // If photoURL is missing, try to fetch from user account
    if (!creatorData.photoURL) {
      try {
        const userAccountRef = doc(db, 'users', creatorId);
        const userAccountDoc = await getDoc(userAccountRef);
        if (userAccountDoc.exists() && userAccountDoc.data()?.photoURL) {
          creatorData.photoURL = userAccountDoc.data()!.photoURL;
        }
      } catch {
        // Ignore - photoURL is optional
      }
    }

    return creatorData;
  }

  /**
   * Get all creators in a project
   */
  static async getAllCreators(orgId: string, projectId: string): Promise<Creator[]> {
    const creatorsRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creators');
    const snapshot = await getDocs(creatorsRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Creator[];
  }

  /**
   * Get all projects where a user is a creator
   */
  static async getCreatorProjects(orgId: string, userId: string): Promise<string[]> {
    const memberRef = doc(db, 'organizations', orgId, 'members', userId);
    const memberDoc = await getDoc(memberRef);
    
    if (!memberDoc.exists()) {
      return [];
    }

    const memberData = memberDoc.data();
    return memberData.creatorProjectIds || [];
  }

  /**
   * Update creator profile in a project
   */
  static async updateCreatorProfile(
    orgId: string,
    projectId: string,
    creatorId: string,
    updates: Partial<Omit<Creator, 'id' | 'orgId' | 'projectId' | 'createdAt'>>
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    await updateDoc(creatorRef, updates);
  }

  /**
   * Flip the per-creator `payoutPortalEnabled` gate.
   *
   * This is the single source of truth for whether a creator sees the Stripe Connect banner
   * and "My payouts" section on their public share link. Default is OFF (not set = hidden);
   * admin must explicitly enable per creator from the Creators tab. Used for staged rollout —
   * e.g., only turn on for yourself to test in production before exposing to all creators.
   *
   * Writes to: organizations/{orgId}/projects/{projectId}/creators/{creatorId}.payoutPortalEnabled
   */
  static async updateCreatorPayoutPortalEnabled(
    orgId: string,
    projectId: string,
    creatorId: string,
    enabled: boolean
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    await updateDoc(creatorRef, { payoutPortalEnabled: enabled });
  }

  /**
   * Remove all links for a creator in a project (when removing from project)
   */
  static async removeAllCreatorLinks(
    orgId: string,
    projectId: string,
    creatorId: string
  ): Promise<void> {
    const linksRef = collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks');
    const q = query(linksRef, where('creatorId', '==', creatorId));
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete creator profile from this project
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    batch.delete(creatorRef);

    // Remove projectId from member's creatorProjectIds
    const memberRef = doc(db, 'organizations', orgId, 'members', creatorId);
    batch.update(memberRef, {
      creatorProjectIds: arrayRemove(projectId)
    });

    await batch.commit();
  }

  /**
   * Update creator payment information
   */
  static async updateCreatorPaymentInfo(
    orgId: string,
    projectId: string,
    creatorId: string,
    paymentInfo: {
      isPaid: boolean;
      structure?: string;
      paymentRules?: any[];
      tieredStructure?: any;
      schedule?: string;
      customSchedule?: string;
      notes?: string;
      updatedAt: Date;
    }
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'projects', projectId, 'creators', creatorId);
    
    await updateDoc(creatorRef, {
      paymentInfo: {
        ...paymentInfo,
        updatedAt: Timestamp.fromDate(paymentInfo.updatedAt)
      }
    });
  }

  /**
   * Get creator name for an account
   * Returns the creator's display name if the account is linked to a creator
   */
  static async getCreatorNameForAccount(
    orgId: string,
    projectId: string,
    accountId: string
  ): Promise<string | null> {
    try {
      const links = await this.getAccountLinkedCreators(orgId, projectId, accountId);
      
      if (links.length === 0) {
        return null;
      }

      // Get the first creator (accounts typically have one creator)
      const creatorId = links[0].creatorId;
      const creator = await this.getCreatorProfile(orgId, projectId, creatorId);
      
      return creator?.displayName || null;
    } catch (error) {
      console.error('Error getting creator name for account:', error);
      return null;
    }
  }

  /**
   * Get creator info (name + photo) for an account
   */
  static async getCreatorInfoForAccount(
    orgId: string,
    projectId: string,
    accountId: string
  ): Promise<{ name: string; photoURL?: string } | null> {
    try {
      const links = await this.getAccountLinkedCreators(orgId, projectId, accountId);
      if (links.length === 0) return null;

      const creatorId = links[0].creatorId;
      const creator = await this.getCreatorProfile(orgId, projectId, creatorId);
      if (!creator) return null;

      // Try to get photoURL from member record, then fall back to user account
      let photoURL = creator.photoURL;
      if (!photoURL) {
        const memberRef = doc(db, 'organizations', orgId, 'members', creatorId);
        const memberDoc = await getDoc(memberRef);
        photoURL = memberDoc.exists() ? memberDoc.data()?.photoURL : undefined;
      }
      if (!photoURL) {
        try {
          const userAccountRef = doc(db, 'users', creatorId);
          const userAccountDoc = await getDoc(userAccountRef);
          if (userAccountDoc.exists()) {
            photoURL = userAccountDoc.data()?.photoURL;
          }
        } catch {
          // Ignore - photoURL is optional
        }
      }

      return {
        name: creator.displayName || 'Unknown',
        photoURL: photoURL || undefined,
      };
    } catch (error) {
      console.error('Error getting creator info for account:', error);
      return null;
    }
  }
}

export default CreatorLinksService;
