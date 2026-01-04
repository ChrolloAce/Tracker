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
    // Validation
    if (!organizationId || typeof organizationId !== 'string') {
      console.error('[TemplateService] Invalid organizationId:', organizationId);
      throw new Error('Organization ID is required and must be a string');
    }
    if (!createdBy || typeof createdBy !== 'string') {
      console.error('[TemplateService] Invalid createdBy:', createdBy);
      throw new Error('Created by user ID is required and must be a string');
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      console.error('[TemplateService] Invalid name:', name);
      throw new Error('Template name is required');
    }

    const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Timestamp.now();

    // Build the template object with only defined values
    const template: Record<string, any> = {
      id: templateId,
      name: name.trim(),
      description: description || '',
      terms: terms || '',
      source: 'saved',
      organizationId: organizationId,
      createdBy: createdBy,
      createdAt: now,
      updatedAt: now,
    };

    // Only add optional fields if they have values
    if (companyName && companyName.trim()) {
      template.companyName = companyName.trim();
    }
    if (contractStartDate && contractStartDate.trim()) {
      template.contractStartDate = contractStartDate.trim();
    }
    if (contractEndDate && contractEndDate.trim()) {
      template.contractEndDate = contractEndDate.trim();
    }

    console.log('[TemplateService] Preparing to save template:', {
      id: templateId,
      name: template.name,
      orgId: organizationId,
      createdBy: createdBy,
      fieldCount: Object.keys(template).length,
      fields: Object.keys(template),
    });

    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      console.log('[TemplateService] Writing to Firestore collection:', this.TEMPLATES_COLLECTION);
      await setDoc(templateRef, template);
      console.log('[TemplateService] Template saved successfully:', templateId);
      return template as ContractTemplate;
    } catch (error: any) {
      console.error('[TemplateService] Failed to save template:', {
        error: error,
        message: error?.message,
        code: error?.code,
        templateId,
        organizationId,
        createdBy,
      });
      
      // Provide more helpful error messages
      if (error?.code === 'permission-denied') {
        throw new Error('Permission denied. Please check that you are signed in and have access to this organization.');
      } else if (error?.code === 'unavailable') {
        throw new Error('Firestore is temporarily unavailable. Please try again.');
      } else {
        throw new Error(error?.message || 'Failed to save template to database');
      }
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

