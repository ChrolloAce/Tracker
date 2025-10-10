import { Timestamp } from 'firebase/firestore';

export interface ContractSignature {
  name: string;
  signedAt: Timestamp;
  signatureData?: string; // Base64 signature image
  ipAddress?: string;
}

export interface ShareableContract {
  id: string;
  organizationId: string;
  projectId: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  
  // Contract details
  contractStartDate: string;
  contractEndDate: string;
  contractNotes: string;
  paymentStructureName?: string;
  
  // Signatures
  companySignature?: ContractSignature;
  creatorSignature?: ContractSignature;
  
  // Status
  status: 'draft' | 'pending' | 'signed' | 'expired';
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  shareableLink: string;
  expiresAt?: Timestamp;
}

