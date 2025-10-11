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
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  sections: string; // Contract terms/clauses
  placeholders?: Record<string, string>; // e.g., {clientName: '', startDate: ''}
  source: 'system' | 'saved';
  organizationId?: string;
  updatedAt: Timestamp;
  createdBy: string;
  icon?: string;
}

export class TemplateService {
  private static TEMPLATES_COLLECTION = 'templates';

  /**
   * Get all templates for an organization (includes system templates)
   */
  static async getTemplates(organizationId: string): Promise<ContractTemplate[]> {
    try {
      const templatesRef = collection(db, this.TEMPLATES_COLLECTION);
      const q = query(
        templatesRef,
        where('organizationId', '==', organizationId),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ContractTemplate));
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  /**
   * Get a single template by ID
   */
  static async getTemplate(templateId: string): Promise<ContractTemplate | null> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      const templateSnap = await getDoc(templateRef);

      if (!templateSnap.exists()) {
        return null;
      }

      return {
        id: templateSnap.id,
        ...templateSnap.data()
      } as ContractTemplate;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  /**
   * Create a new template
   */
  static async createTemplate(
    organizationId: string,
    name: string,
    description: string,
    sections: string,
    createdBy: string,
    icon?: string
  ): Promise<string> {
    try {
      const templatesRef = collection(db, this.TEMPLATES_COLLECTION);
      const newTemplateRef = doc(templatesRef);
      
      const template: Omit<ContractTemplate, 'id'> = {
        name,
        description,
        sections,
        source: 'saved',
        organizationId,
        updatedAt: Timestamp.now(),
        createdBy,
        icon
      };

      await setDoc(newTemplateRef, template);
      return newTemplateRef.id;
    } catch (error) {
      console.error('Error creating template:', error);
      throw new Error('Failed to create template');
    }
  }

  /**
   * Update an existing template
   */
  static async updateTemplate(
    templateId: string,
    updates: Partial<Omit<ContractTemplate, 'id' | 'createdBy' | 'organizationId'>>
  ): Promise<void> {
    try {
      const templateRef = doc(db, this.TEMPLATES_COLLECTION, templateId);
      await updateDoc(templateRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating template:', error);
      throw new Error('Failed to update template');
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
}

