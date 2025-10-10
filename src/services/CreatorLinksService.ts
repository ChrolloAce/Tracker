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
        const creatorData: Omit<Creator, 'id'> = {
          orgId,
          projectId,
          displayName: memberData.displayName || 'Unknown',
          email: memberData.email || '',
          photoURL: memberData.photoURL,
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

    return {
      id: creatorDoc.id,
      ...creatorDoc.data(),
    } as Creator;
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
}

export default CreatorLinksService;
