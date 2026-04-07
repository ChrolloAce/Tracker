import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { ShareableContract, CreatorContactInfo, CompanyContactInfo } from '../types/contract';

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
   * Resolve the correct status for a contract based on its current state.
   * - Both signatures present -> 'signed'
   * - expiresAt is in the past -> 'expired'
   * - contractEndDate is in the past and status is still 'pending' -> 'expired'
   * - Otherwise -> keep current status
   */
  static resolveStatus(contract: ShareableContract): ShareableContract['status'] {
    // If both signatures exist, it's signed regardless of dates
    if (contract.creatorSignature && contract.companySignature) {
      return 'signed';
    }

    // If expiresAt exists and is in the past, mark expired
    if (contract.expiresAt) {
      const expiresDate = contract.expiresAt instanceof Timestamp
        ? contract.expiresAt.toDate()
        : new Date(contract.expiresAt as any);
      if (expiresDate < new Date()) {
        return 'expired';
      }
    }

    // If contract end date is in the past and still pending, mark expired
    if (contract.status === 'pending' && contract.contractEndDate) {
      const endDate = new Date(contract.contractEndDate);
      if (endDate < new Date()) {
        return 'expired';
      }
    }

    return contract.status;
  }

  /**
   * Apply resolveStatus to a contract and persist the change if status differs.
   */
  private static async applyResolvedStatus(contract: ShareableContract): Promise<ShareableContract> {
    const resolvedStatus = this.resolveStatus(contract);
    if (resolvedStatus !== contract.status) {
      contract.status = resolvedStatus;
      // Persist the status fix
      const contractRef = doc(db, this.CONTRACTS_COLLECTION, contract.id);
      await updateDoc(contractRef, {
        status: resolvedStatus,
        updatedAt: Timestamp.now(),
      });
    }
    return contract;
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
    createdBy: string,
    isPendingInvitation?: boolean, // For creators who haven't accepted their invitation yet
    contractTitle?: string,
    companyName?: string,
    creatorInfo?: CreatorContactInfo,
    companyInfo?: CompanyContactInfo,
    expirationDays?: number
  ): Promise<ShareableContract> {
    const contractId = this.generateContractId();
    const now = Timestamp.now();

    const baseUrl = window.location.origin;

    const contract: any = {
      id: contractId,
      organizationId,
      projectId,
      creatorId, // For pending invitations, this is the invitation ID
      creatorName,
      creatorEmail,
      contractStartDate,
      contractEndDate,
      contractNotes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      createdBy,
      shareableLink: `${baseUrl}/contract/${contractId}`, // Legacy - both can sign
      creatorLink: `${baseUrl}/contract/${contractId}?role=creator`,
      companyLink: `${baseUrl}/contract/${contractId}?role=company`,
    };

    // Only set expiresAt if an explicit expirationDays was provided
    if (expirationDays !== undefined && expirationDays > 0) {
      contract.expiresAt = Timestamp.fromDate(
        new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
      );
    }

    // Only add optional fields if they're defined (Firestore doesn't allow undefined)
    if (paymentStructureName) {
      contract.paymentStructureName = paymentStructureName;
    }
    if (contractTitle) {
      contract.contractTitle = contractTitle;
    }
    if (companyName) {
      contract.companyName = companyName;
    }
    if (creatorInfo) {
      contract.creatorInfo = creatorInfo;
    }
    if (companyInfo) {
      contract.companyInfo = companyInfo;
    }
    if (isPendingInvitation) {
      contract.isPendingInvitation = true;
      contract.invitationId = creatorId; // Store invitation ID for later linking
    }

    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
    await setDoc(contractRef, contract as ShareableContract);

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

      const contract = contractSnap.data() as ShareableContract;
      return await this.applyResolvedStatus(contract);
    } catch (error) {
      console.error('Error fetching contract:', error);
      return null;
    }
  }

  /**
   * Sign contract as creator (atomic: sets signature and status in one write)
   */
  static async signAsCreator(
    contractId: string,
    creatorName: string,
    signatureData?: string
  ): Promise<void> {
    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);

    // Read the current contract to check if the other party has signed
    const contractSnap = await getDoc(contractRef);
    if (!contractSnap.exists()) {
      throw new Error('Contract not found');
    }
    const contract = contractSnap.data() as ShareableContract;

    const signature: any = {
      name: creatorName,
      signedAt: Timestamp.now(),
    };

    // Only add signatureData if it's defined (Firestore doesn't allow undefined)
    if (signatureData) {
      signature.signatureData = signatureData;
    }

    const updateData: any = {
      creatorSignature: signature,
      updatedAt: Timestamp.now(),
    };

    // If the other party already signed, set status to 'signed' atomically
    if (contract.companySignature) {
      updateData.status = 'signed';
    }

    await updateDoc(contractRef, updateData);
  }

  /**
   * Sign contract as company (atomic: sets signature and status in one write)
   */
  static async signAsCompany(
    contractId: string,
    companyRepName: string,
    signatureData?: string
  ): Promise<void> {
    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);

    // Read the current contract to check if the other party has signed
    const contractSnap = await getDoc(contractRef);
    if (!contractSnap.exists()) {
      throw new Error('Contract not found');
    }
    const contract = contractSnap.data() as ShareableContract;

    const signature: any = {
      name: companyRepName,
      signedAt: Timestamp.now(),
    };

    // Only add signatureData if it's defined (Firestore doesn't allow undefined)
    if (signatureData) {
      signature.signatureData = signatureData;
    }

    const updateData: any = {
      companySignature: signature,
      updatedAt: Timestamp.now(),
    };

    // If the other party already signed, set status to 'signed' atomically
    if (contract.creatorSignature) {
      updateData.status = 'signed';
    }

    await updateDoc(contractRef, updateData);
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
      const contracts = snapshot.docs.map(doc => doc.data() as ShareableContract);
      return await Promise.all(contracts.map(c => this.applyResolvedStatus(c)));
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
      const contracts = snapshot.docs.map(doc => doc.data() as ShareableContract);
      return await Promise.all(contracts.map(c => this.applyResolvedStatus(c)));
    } catch (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }
  }

  /**
   * Renew a contract. Resets status to 'pending' if it was 'expired',
   * and optionally sets a new expiresAt.
   */
  static async renewContract(
    contractId: string,
    newExpiresAt?: Date
  ): Promise<void> {
    const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
    const contractSnap = await getDoc(contractRef);

    if (!contractSnap.exists()) {
      throw new Error('Contract not found');
    }

    const contract = contractSnap.data() as ShareableContract;

    const updateData: any = {
      updatedAt: Timestamp.now(),
    };

    // Reset status from expired back to pending
    if (contract.status === 'expired') {
      updateData.status = 'pending';
    }

    // Update or remove expiresAt
    if (newExpiresAt !== undefined) {
      updateData.expiresAt = Timestamp.fromDate(newExpiresAt);
    }

    await updateDoc(contractRef, updateData);
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

  /**
   * Delete contract by ID
   */
  static async deleteContract(contractId: string): Promise<void> {
    try {
      const contractRef = doc(db, this.CONTRACTS_COLLECTION, contractId);
      await deleteDoc(contractRef);
    } catch (error) {
      console.error('Error deleting contract:', error);
      throw new Error('Failed to delete contract');
    }
  }
}
