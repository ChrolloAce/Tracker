import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  Timestamp,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { CreatorLink, Creator } from '../types/firestore';

/**
 * CreatorLinksService
 * Manages the mapping between creators and their linked accounts
 */
class CreatorLinksService {
  /**
   * Link a creator to one or more accounts
   */
  static async linkCreatorToAccounts(
    orgId: string,
    creatorId: string,
    accountIds: string[],
    linkedBy: string
  ): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Create creator profile if it doesn't exist
    const creatorRef = doc(db, 'organizations', orgId, 'creators', creatorId);
    const creatorDoc = await getDoc(creatorRef);
    
    if (!creatorDoc.exists()) {
      // Get creator details from members collection
      const memberRef = doc(db, 'organizations', orgId, 'members', creatorId);
      const memberDoc = await getDoc(memberRef);
      
      if (memberDoc.exists()) {
        const memberData = memberDoc.data();
        const creatorData: Omit<Creator, 'id'> = {
          orgId,
          displayName: memberData.displayName || 'Unknown',
          email: memberData.email || '',
          photoURL: memberData.photoURL,
          linkedAccountsCount: accountIds.length,
          totalEarnings: 0,
          payoutsEnabled: true,
          createdAt: now,
        };
        batch.set(creatorRef, creatorData);
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
      const linkRef = doc(collection(db, 'organizations', orgId, 'creatorLinks'));
      const linkData: Omit<CreatorLink, 'id'> = {
        orgId,
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
   * Unlink a creator from an account
   */
  static async unlinkCreatorFromAccount(
    orgId: string,
    creatorId: string,
    accountId: string
  ): Promise<void> {
    const linksRef = collection(db, 'organizations', orgId, 'creatorLinks');
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
    const creatorRef = doc(db, 'organizations', orgId, 'creators', creatorId);
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
   * Get all accounts linked to a creator
   */
  static async getCreatorLinkedAccounts(
    orgId: string,
    creatorId: string
  ): Promise<CreatorLink[]> {
    const linksRef = collection(db, 'organizations', orgId, 'creatorLinks');
    const q = query(linksRef, where('creatorId', '==', creatorId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreatorLink[];
  }

  /**
   * Get all creators linked to an account
   */
  static async getAccountLinkedCreators(
    orgId: string,
    accountId: string
  ): Promise<CreatorLink[]> {
    const linksRef = collection(db, 'organizations', orgId, 'creatorLinks');
    const q = query(linksRef, where('accountId', '==', accountId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreatorLink[];
  }

  /**
   * Get all creator links for an organization
   */
  static async getAllCreatorLinks(orgId: string): Promise<CreatorLink[]> {
    const linksRef = collection(db, 'organizations', orgId, 'creatorLinks');
    const snapshot = await getDocs(linksRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreatorLink[];
  }

  /**
   * Check if a creator is linked to a specific account
   */
  static async isCreatorLinkedToAccount(
    orgId: string,
    creatorId: string,
    accountId: string
  ): Promise<boolean> {
    const linksRef = collection(db, 'organizations', orgId, 'creatorLinks');
    const q = query(
      linksRef,
      where('creatorId', '==', creatorId),
      where('accountId', '==', accountId)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Get creator profile
   */
  static async getCreatorProfile(
    orgId: string,
    creatorId: string
  ): Promise<Creator | null> {
    const creatorRef = doc(db, 'organizations', orgId, 'creators', creatorId);
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
   * Get all creators in an organization
   */
  static async getAllCreators(orgId: string): Promise<Creator[]> {
    const creatorsRef = collection(db, 'organizations', orgId, 'creators');
    const snapshot = await getDocs(creatorsRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Creator[];
  }

  /**
   * Update creator profile
   */
  static async updateCreatorProfile(
    orgId: string,
    creatorId: string,
    updates: Partial<Omit<Creator, 'id' | 'orgId' | 'createdAt'>>
  ): Promise<void> {
    const creatorRef = doc(db, 'organizations', orgId, 'creators', creatorId);
    await getDoc(creatorRef); // Ensure exists
    
    // Use batch to update
    const batch = writeBatch(db);
    batch.update(creatorRef, updates);
    await batch.commit();
  }

  /**
   * Remove all links for a creator (when removing from org)
   */
  static async removeAllCreatorLinks(
    orgId: string,
    creatorId: string
  ): Promise<void> {
    const linksRef = collection(db, 'organizations', orgId, 'creatorLinks');
    const q = query(linksRef, where('creatorId', '==', creatorId));
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete creator profile
    const creatorRef = doc(db, 'organizations', orgId, 'creators', creatorId);
    batch.delete(creatorRef);

    await batch.commit();
  }
}

export default CreatorLinksService;

