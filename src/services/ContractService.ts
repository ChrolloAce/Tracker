import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  Timestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { ShareableContract } from '../types/contract';

export class ContractService {
  private static CONTRACTS_COLLECTION = 'shareableContracts';

  /**
   * Generate a unique contract ID
   */
  private static generateContractId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create a shareable contract
   */
  static async createShareableContract(
    organizationId: string,
    projectId: string,
    creatorId: string,
    creatorName: string,
    creatorEmail: string,
    contractStartDate: string,
    contractEndDate: string,
    contractNotes: string,
    paymentStructureName: string | undefined,
    createdBy: string
  ): Promise<ShareableContract> {
    const contractId = this.generateContractId();
    const now = Timestamp.now();
    
    // Set expiration to 90 days from now
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    );

    const baseUrl = window.location.origin;

    const contract: ShareableContract = {
      id: contractId,
      organizationId,
      projectId,
      creatorId,
      creatorName,
      creatorEmail,
      contractStartDate,
      contractEndDate,
      contractNotes,
      paymentStructureName,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      createdBy,
      shareableLink: `${baseUrl}/contract/${contractId}`, // Legacy - both can sign
      creatorLink: `${baseUrl}/contract/${contractId}?role=creator`,
      companyLink: `${baseUrl}/contract/${contractId}?role=company`,
      expiresAt,
    };

    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
    await setDoc(contractRef, contract);

    return contract;
  }

  /**
   * Get contract by ID (public access)
   */
  static async getContractById(contractId: string): Promise<ShareableContract | null> {
    try {
      const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
      const contractSnap = await getDoc(contractRef);

      if (!contractSnap.exists()) {
        return null;
      }

      return contractSnap.data() as ShareableContract;
    } catch (error) {
      console.error('Error fetching contract:', error);
      return null;
    }
  }

  /**
   * Sign contract as creator
   */
  static async signAsCreator(
    contractId: string,
    creatorName: string,
    signatureData?: string
  ): Promise<void> {
    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
    
    const signature: any = {
      name: creatorName,
      signedAt: Timestamp.now(),
    };
    
    // Only add signatureData if it's defined (Firestore doesn't allow undefined)
    if (signatureData) {
      signature.signatureData = signatureData;
    }

    await updateDoc(contractRef, {
      creatorSignature: signature,
      updatedAt: Timestamp.now(),
    });

    // Check if both parties have signed
    const contract = await this.getContractById(contractId);
    if (contract?.companySignature && contract?.creatorSignature) {
      await updateDoc(contractRef, {
        status: 'signed',
      });
    }
  }

  /**
   * Sign contract as company
   */
  static async signAsCompany(
    contractId: string,
    companyRepName: string,
    signatureData?: string
  ): Promise<void> {
    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
    
    const signature: any = {
      name: companyRepName,
      signedAt: Timestamp.now(),
    };
    
    // Only add signatureData if it's defined (Firestore doesn't allow undefined)
    if (signatureData) {
      signature.signatureData = signatureData;
    }

    await updateDoc(contractRef, {
      companySignature: signature,
      updatedAt: Timestamp.now(),
    });

    // Check if both parties have signed
    const contract = await this.getContractById(contractId);
    if (contract?.companySignature && contract?.creatorSignature) {
      await updateDoc(contractRef, {
        status: 'signed',
      });
    }
  }

  /**
   * Get all contracts for a project
   */
  static async getAllContractsForProject(
    organizationId: string,
    projectId: string
  ): Promise<ShareableContract[]> {
    try {
      const contractsRef = collection(db, this.CONTRACTS_COLLECTION);
      const q = query(
        contractsRef,
        where('organizationId', '==', organizationId),
        where('projectId', '==', projectId)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as ShareableContract);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }
  }

  /**
   * Get all contracts for a creator
   */
  static async getContractsForCreator(
    organizationId: string,
    projectId: string,
    creatorId: string
  ): Promise<ShareableContract[]> {
    try {
      const contractsRef = collection(db, this.CONTRACTS_COLLECTION);
      const q = query(
        contractsRef,
        where('organizationId', '==', organizationId),
        where('projectId', '==', projectId),
        where('creatorId', '==', creatorId)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as ShareableContract);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }
  }

  /**
   * Update contract
   */
  static async updateContract(
    contractId: string,
    updates: Partial<ShareableContract>
  ): Promise<void> {
    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
    await updateDoc(contractRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }
}

