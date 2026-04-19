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
      caps?: import('../types/payouts').StructureCaps;
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
      const structure: Record<string, any> = {
        id: structureRef.id,
        orgId,
        name: data.name,
        components: data.components,
        isActive: true,
        createdAt: now,
        createdBy: userId
      };
      // Firestore rejects undefined — only include optional fields if defined
      if (data.description) structure.description = data.description;
      if (data.maxPayout != null) structure.maxPayout = data.maxPayout;
      if (data.caps) structure.caps = data.caps;

      await setDoc(structureRef, structure);

      return structure as PayoutStructure;
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
      caps?: import('../types/payouts').StructureCaps;
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

      // Strip undefined values — Firestore rejects them
      const clean: Record<string, any> = { updatedAt: Timestamp.now() };
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) clean[k] = v;
      }
      await updateDoc(structureRef, clean);
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

      // Additional bug-fix checks that need positional context (name + index) and
      // emit their own fully-formed messages so they're surfaced verbatim in the UI.
      const displayName = component.name || `Component ${index + 1}`;

      if (component.type === 'bonus') {
        // Bug 1: stacking bonus with per === 0 silently defaults to 1 in the engine,
        // which can turn a $100/100K bonus into $100/view. Reject per <= 0 outright
        // when per is provided (per !== undefined means caller intended stacking mode).
        if (component.per !== undefined && !(component.per > 0)) {
          errors.push(`Bonus component '${displayName}': 'per' must be greater than 0`);
        }

        // Bug 2: duplicate / invalid rate tiers. Tiers are sorted by threshold and
        // processed as bands; duplicates collapse bands and make the winner depend
        // on sort stability. Also reject threshold === 0 (conflicts with implicit
        // base tier) and non-positive rate/per values.
        if (component.rateTiers && component.rateTiers.length > 0) {
          const seenThresholds = new Set<number>();
          component.rateTiers.forEach((tier, tierIdx) => {
            const tierNum = tierIdx + 1;
            if (tier.threshold === undefined || tier.threshold === null) {
              errors.push(`Bonus component '${displayName}': rate tier ${tierNum} is missing 'threshold'`);
            } else if (tier.threshold === 0) {
              errors.push(`Bonus component '${displayName}': rate tier ${tierNum} cannot use threshold 0 (the base amount/per defines the 'from 0' band)`);
            } else if (tier.threshold < 0) {
              errors.push(`Bonus component '${displayName}': rate tier ${tierNum} threshold must be >= 0`);
            } else if (seenThresholds.has(tier.threshold)) {
              errors.push(`Bonus component '${displayName}': rate tier ${tierNum} has duplicate threshold ${tier.threshold}`);
            } else {
              seenThresholds.add(tier.threshold);
            }

            if (tier.rate === undefined || tier.rate === null || tier.rate < 0) {
              errors.push(`Bonus component '${displayName}': rate tier ${tierNum} 'rate' must be >= 0`);
            }
            if (tier.per === undefined || tier.per === null || !(tier.per > 0)) {
              errors.push(`Bonus component '${displayName}': rate tier ${tierNum} 'per' must be greater than 0`);
            }
          });
        }
      }

      if (component.type === 'bonus_tiered') {
        // Bug 3: same duplicate-threshold issue on tiered bonuses. Tiers here use
        // fixed amounts rather than rate/per, but the sort-and-process logic has
        // the same ambiguity on collisions.
        if (component.tiers && component.tiers.length > 0) {
          const seenThresholds = new Set<number>();
          component.tiers.forEach((tier, tierIdx) => {
            const tierNum = tierIdx + 1;
            if (tier.threshold === undefined || tier.threshold === null) {
              return;
            }
            if (tier.threshold < 0) {
              errors.push(`Tiered bonus component '${displayName}': tier ${tierNum} threshold must be >= 0`);
            } else if (seenThresholds.has(tier.threshold)) {
              errors.push(`Tiered bonus component '${displayName}': tier ${tierNum} has duplicate threshold ${tier.threshold}`);
            } else {
              seenThresholds.add(tier.threshold);
            }
            if (tier.amount === undefined || tier.amount === null || tier.amount < 0) {
              errors.push(`Tiered bonus component '${displayName}': tier ${tierNum} amount must be >= 0`);
            }
          });
        }
      }

      if (component.type === 'per_video') {
        // Bug 4: crossPostCap sanity for 'count-with-cap' policy.
        if (component.crossPostPolicy === 'count-with-cap') {
          const cap = component.crossPostCap;
          if (cap === undefined || cap === null) {
            errors.push(`Per-video component '${displayName}': cross-post cap is required when crossPostPolicy is 'count-with-cap'`);
          } else if (cap < 1) {
            errors.push(`Per-video component '${displayName}': cross-post cap must be >= 1`);
          } else if (component.maxVideos !== undefined && cap > component.maxVideos) {
            errors.push(`Per-video component '${displayName}': cross-post cap (${cap}) cannot exceed max videos (${component.maxVideos})`);
          }
        }
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

  /**
   * Seed default templates if the project has no structures yet.
   * Call this when the PayoutStructureManager first loads an empty list.
   */
  static async seedDefaultsIfEmpty(
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<PayoutStructure[]> {
    const existing = await this.listStructures(orgId, projectId);
    if (existing.length > 0) return existing;

    const seeds: Array<{ name: string; description: string; components: PayoutComponent[] }> = [
      {
        name: 'CPM Only',
        description: 'Pay per 1,000 views — simplest structure',
        components: [
          { id: 'seed_cpm', type: 'cpm', name: 'CPM', rate: 3, metric: 'views' },
        ],
      },
      {
        name: 'Flat + CPM',
        description: 'Guaranteed base + performance pay',
        components: [
          { id: 'seed_flat', type: 'flat', name: 'Base Fee', amount: 100 },
          { id: 'seed_cpm2', type: 'cpm', name: 'CPM', rate: 3, metric: 'views' },
        ],
      },
      {
        name: 'Tiered CPM',
        description: 'Escalating rates at higher view counts',
        components: [
          { id: 'seed_tiered', type: 'bonus_tiered', name: 'Tiered Bonus', metric: 'views', tiers: [
            { threshold: 100000, amount: 100 },
            { threshold: 500000, amount: 400 },
            { threshold: 1000000, amount: 800 },
          ]},
        ],
      },
      {
        name: 'Per-Video + Viral Bonus',
        description: '$50/video + bonus at 1M views',
        components: [
          { id: 'seed_pv', type: 'per_video', name: 'Per Video', amountPerVideo: 50 },
          { id: 'seed_viral', type: 'bonus', name: 'Viral Bonus', amount: 500, condition: { metric: 'views', value: 1000000, operator: '>=' as const }, caps: { perVideo: 500 } },
        ],
      },
      {
        name: '$15/video + $100 per 100K views',
        description: 'Flat $15 per video, plus a view bonus per video',
        components: [
          { id: 'seed_pv2', type: 'per_video', name: 'Per Video', amountPerVideo: 15 },
          { id: 'seed_stack', type: 'bonus', name: 'View Bonus', amount: 100, per: 100000, scope: 'per_video' as const, condition: { metric: 'views', value: 0, operator: '>=' as const } },
        ],
      },
      {
        name: '$100 per 100K views (capped $1K per video)',
        description: 'Per-video view bonus with a ceiling — each video earns independently',
        components: [
          { id: 'seed_capped_view', type: 'bonus', name: 'View Bonus', amount: 100, per: 100000, scope: 'per_video' as const, condition: { metric: 'views', value: 0, operator: '>=' as const }, caps: { perVideo: 1000 } },
        ],
      },
      {
        name: 'Retainer + Performance',
        description: 'Fixed base + CPM + milestone bonuses',
        components: [
          { id: 'seed_ret', type: 'base', name: 'Retainer', amount: 500 },
          { id: 'seed_perf', type: 'cpm', name: 'Performance CPM', rate: 2, metric: 'views' },
          { id: 'seed_mile', type: 'bonus', name: 'Milestone Bonus', amount: 300, condition: { metric: 'views', value: 500000, operator: '>=' as const } },
        ],
      },
    ];

    const created: PayoutStructure[] = [];
    for (const seed of seeds) {
      const s = await this.createStructure(orgId, projectId, userId, seed);
      created.push(s);
    }
    return created;
  }
}

