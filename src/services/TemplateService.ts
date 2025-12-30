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
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  terms: string;
  source: 'system' | 'saved';
  organizationId?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedAt: Timestamp;
  // Additional template fields
  companyName?: string;
  contractStartDate?: string;
  contractEndDate?: string;
}

export class TemplateService {
  private static TEMPLATES_COLLECTION = 'contractTemplates';

  /**
   * Save a new contract template
   */
  static async saveTemplate(
    organizationId: string,
    name: string,
    description: string,
    terms: string,
    createdBy: string,
    companyName?: string,
    contractStartDate?: string,
    contractEndDate?: string
  ): Promise<ContractTemplate> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }
    if (!createdBy) {
      throw new Error('Created by user ID is required');
    }
    if (!name || !name.trim()) {
      throw new Error('Template name is required');
    }

    const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Timestamp.now();

    const template: ContractTemplate = {
      id: templateId,
      name: name.trim(),
      description: description || '',
      terms: terms || '',
      source: 'saved',
      organizationId,
      createdBy,
      createdAt: now,
      updatedAt: now,
      companyName: companyName || undefined,
      contractStartDate: contractStartDate || undefined,
      contractEndDate: contractEndDate || undefined,
    };

    // Remove undefined values to avoid Firestore errors
    const cleanTemplate = Object.fromEntries(
      Object.entries(template).filter(([_, v]) => v !== undefined)
    ) as ContractTemplate;

    console.log('[TemplateService] Saving template:', {
      id: templateId,
      name: cleanTemplate.name,
      orgId: organizationId,
      createdBy,
    });

    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      await setDoc(templateRef, cleanTemplate);
      console.log('[TemplateService] Template saved successfully:', templateId);
      return cleanTemplate;
    } catch (error) {
      console.error('[TemplateService] Failed to save template:', error);
      throw error;
    }
  }

  /**
   * Get all saved templates for an organization
   */
  static async getSavedTemplates(organizationId: string): Promise<ContractTemplate[]> {
    try {
      const templatesRef = collection(db, this.TEMPLATES_COLLECTION);
      const q = query(
        templatesRef,
        where('organizationId', '==', organizationId),
        where('source', '==', 'saved'),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as ContractTemplate);
    } catch (error) {
      console.error('Error fetching saved templates:', error);
      return [];
    }
  }

  /**
   * Get a specific template by ID
   */
  static async getTemplate(templateId: string): Promise<ContractTemplate | null> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      const templateSnap = await getDoc(templateRef);

      if (!templateSnap.exists()) {
        return null;
      }

      return templateSnap.data() as ContractTemplate;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(templateId: string): Promise<void> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      await deleteDoc(templateRef);
    } catch (error) {
      console.error('Error deleting template:', error);
      throw new Error('Failed to delete template');
    }
  }

  /**
   * Update a template
   */
  static async updateTemplate(
    templateId: string,
    updates: Partial<ContractTemplate>
  ): Promise<void> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      await setDoc(templateRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error('Failed to update template');
    }
  }
}

