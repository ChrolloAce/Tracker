import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { PayoutStructure, PayoutComponent } from '../types/payouts';

/**
 * Service for managing Payout Structures (templates/rules)
 * 
 * Usage:
 * - Create reusable payout templates
 * - Assign to campaigns/creators
 * - Override per creator
 * - Store snapshots for historical accuracy
 */
export class PayoutStructureService {
  /**
   * Get payout structure by ID
   */
  static async getStructure(
    orgId: string,
    projectId: string,
    structureId: string
  ): Promise<PayoutStructure | null> {
    try {
      const structureRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'payoutStructures',
        structureId
      );

      const structureDoc = await getDoc(structureRef);

      if (!structureDoc.exists()) {
        return null;
      }

      return structureDoc.data() as PayoutStructure;
    } catch (error) {
      console.error('Error fetching payout structure:', error);
      throw error;
    }
  }

  /**
   * List all payout structures for a project
   */
  static async listStructures(
    orgId: string,
    projectId: string
  ): Promise<PayoutStructure[]> {
    try {
      const structuresRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'payoutStructures'
      );

      const q = query(structuresRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => doc.data() as PayoutStructure);
    } catch (error) {
      console.error('Error listing payout structures:', error);
      throw error;
    }
  }

  /**
   * Create a new payout structure
   */
  static async createStructure(
    orgId: string,
    projectId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      components: PayoutComponent[];
      maxPayout?: number;
    }
  ): Promise<PayoutStructure> {
    try {
      const structureRef = doc(
        collection(
          db,
          'organizations',
          orgId,
          'projects',
          projectId,
          'payoutStructures'
        )
      );

      const now = Timestamp.now();
      const structure: PayoutStructure = {
        id: structureRef.id,
        orgId,
        name: data.name,
        description: data.description,
        components: data.components,
        maxPayout: data.maxPayout,
        isActive: true,
        createdAt: now as any,
        createdBy: userId
      };

      await setDoc(structureRef, structure);

      return structure;
    } catch (error) {
      console.error('Error creating payout structure:', error);
      throw error;
    }
  }

  /**
   * Update an existing payout structure
   */
  static async updateStructure(
    orgId: string,
    projectId: string,
    structureId: string,
    updates: {
      name?: string;
      description?: string;
      components?: PayoutComponent[];
      maxPayout?: number;
    }
  ): Promise<void> {
    try {
      const structureRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'payoutStructures',
        structureId
      );

      await updateDoc(structureRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating payout structure:', error);
      throw error;
    }
  }

  /**
   * Delete a payout structure
   * 
   * Note: This will NOT delete structures that are actively being used in campaigns.
   * Check campaign assignments first.
   */
  static async deleteStructure(
    orgId: string,
    projectId: string,
    structureId: string
  ): Promise<void> {
    try {
      // Check if structure is being used in any campaigns
      const isInUse = await this.isStructureInUse(orgId, projectId, structureId);
      
      if (isInUse) {
        throw new Error('Cannot delete payout structure: it is currently being used in one or more campaigns');
      }

      const structureRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'payoutStructures',
        structureId
      );

      await deleteDoc(structureRef);
    } catch (error) {
      console.error('Error deleting payout structure:', error);
      throw error;
    }
  }

  /**
   * Check if a payout structure is being used in any campaigns
   */
  static async isStructureInUse(
    orgId: string,
    projectId: string,
    structureId: string
  ): Promise<boolean> {
    try {
      const campaignsRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns'
      );

      // Check defaultPayoutStructureId
      const q1 = query(
        campaignsRef,
        where('defaultPayoutStructureId', '==', structureId)
      );
      const snapshot1 = await getDocs(q1);

      if (!snapshot1.empty) {
        return true;
      }

      // Check creatorAssignments (this requires fetching all campaigns)
      // For better performance, you might want to denormalize this data
      const allCampaignsSnapshot = await getDocs(campaignsRef);
      
      for (const campaignDoc of allCampaignsSnapshot.docs) {
        const campaign = campaignDoc.data();
        const creatorAssignments = campaign.creatorAssignments || [];
        
        const hasStructure = creatorAssignments.some(
          (assignment: any) => assignment.payoutStructureId === structureId
        );
        
        if (hasStructure) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking if structure is in use:', error);
      throw error;
    }
  }

  /**
   * Duplicate an existing payout structure (useful for creating variations)
   */
  static async duplicateStructure(
    orgId: string,
    projectId: string,
    userId: string,
    structureId: string,
    newName?: string
  ): Promise<PayoutStructure> {
    try {
      const original = await this.getStructure(orgId, projectId, structureId);

      if (!original) {
        throw new Error('Payout structure not found');
      }

      const duplicated = await this.createStructure(
        orgId,
        projectId,
        userId,
        {
          name: newName || `${original.name} (Copy)`,
          description: original.description,
          components: JSON.parse(JSON.stringify(original.components)), // Deep clone
          maxPayout: original.maxPayout
        }
      );

      return duplicated;
    } catch (error) {
      console.error('Error duplicating payout structure:', error);
      throw error;
    }
  }

  /**
   * Create a snapshot of a payout structure (for campaign assignment history)
   * 
   * When assigning a structure to a creator in a campaign, save a snapshot
   * so historical payouts remain accurate even if the template is modified.
   */
  static createSnapshot(structure: PayoutStructure): PayoutStructure {
    return JSON.parse(JSON.stringify(structure)); // Deep clone
  }

  /**
   * Validate a payout structure
   */
  static validateStructure(structure: PayoutStructure): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic validation
    if (!structure.name || structure.name.trim().length === 0) {
      errors.push('Structure name is required');
    }

    if (!structure.components || structure.components.length === 0) {
      errors.push('At least one payout component is required');
    }

    // Validate each component
    structure.components?.forEach((component, index) => {
      const componentErrors = this.validateComponent(component);
      if (componentErrors.length > 0) {
        errors.push(`Component ${index + 1} (${component.name}): ${componentErrors.join(', ')}`);
      }
    });

    // Validate max payout
    if (structure.maxPayout !== undefined && structure.maxPayout < 0) {
      errors.push('Max payout cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single payout component
   */
  static validateComponent(component: PayoutComponent): string[] {
    const errors: string[] = [];

    if (!component.name || component.name.trim().length === 0) {
      errors.push('Component name is required');
    }

    if (!component.type) {
      errors.push('Component type is required');
    }

    switch (component.type) {
      case 'base':
      case 'flat':
        if (component.amount === undefined || component.amount < 0) {
          errors.push('Amount must be a positive number');
        }
        break;

      case 'cpm':
        if (component.rate === undefined || component.rate < 0) {
          errors.push('CPM rate must be a positive number');
        }
        if (!component.metric) {
          errors.push('Metric is required for CPM component');
        }
        if (component.cap !== undefined && component.cap < 0) {
          errors.push('Cap must be a positive number');
        }
        if (component.minThreshold !== undefined && component.minThreshold < 0) {
          errors.push('Min threshold must be a positive number');
        }
        break;

      case 'bonus':
        if (component.amount === undefined || component.amount < 0) {
          errors.push('Bonus amount must be a positive number');
        }
        if (!component.condition) {
          errors.push('Condition is required for bonus component');
        }
        break;

      case 'bonus_tiered':
        if (!component.tiers || component.tiers.length === 0) {
          errors.push('At least one tier is required for tiered bonus');
        }
        component.tiers?.forEach((tier, index) => {
          if (tier.threshold === undefined || tier.threshold < 0) {
            errors.push(`Tier ${index + 1}: threshold is required and must be positive`);
          }
          if (tier.amount === undefined || tier.amount < 0) {
            errors.push(`Tier ${index + 1}: amount must be a positive number`);
          }
        });
        break;
    }

    return errors;
  }
}

