import { Timestamp } from 'firebase/firestore';

export interface ContractSignature {
  name: string;
  signedAt: Timestamp;
  signatureData?: string; // Base64 signature image
  ipAddress?: string;
}

export interface CreatorContactInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CompanyContactInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface ShareableContract {
  id: string;
  organizationId: string;
  projectId: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  
  // Contract details
  contractTitle?: string;
  companyName?: string;
  contractStartDate: string;
  contractEndDate: string;
  contractNotes: string;
  paymentStructureName?: string;
  
  // Extended contact info
  creatorInfo?: CreatorContactInfo;
  companyInfo?: CompanyContactInfo;
  
  // Signatures
  companySignature?: ContractSignature;
  creatorSignature?: ContractSignature;
  
  // Status
  status: 'draft' | 'pending' | 'signed' | 'expired';
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  shareableLink: string; // Legacy - general link
  creatorLink: string; // Link for creator to sign
  companyLink: string; // Link for company to sign
  expiresAt?: Timestamp;
}

