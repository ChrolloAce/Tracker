import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { TrackingRule, RuleCondition, RuleMatchResult } from '../types/rules';
import { AccountVideo } from '../types/accounts';

/**
 * RulesService
 * Manages tracking rules for filtered video syncing
 */
class RulesService {
  /**
   * Create a new tracking rule
   */
  static async createRule(
    orgId: string,
    projectId: string,
    userId: string,
    ruleData: Omit<TrackingRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'organizationId' | 'projectId'>
  ): Promise<string> {
    try {
      const rulesRef = collection(db, 'organizations', orgId, 'projects', projectId, 'trackingRules');
      
      // Clean undefined values from appliesTo to prevent Firestore errors
      const cleanedData = {
        ...ruleData,
        appliesTo: {
          ...(ruleData.appliesTo.platforms && ruleData.appliesTo.platforms.length > 0 
            ? { platforms: ruleData.appliesTo.platforms } 
            : {}),
          ...(ruleData.appliesTo.accountIds && ruleData.appliesTo.accountIds.length > 0 
            ? { accountIds: ruleData.appliesTo.accountIds } 
            : {}),
        }
      };
      
      const docRef = await addDoc(rulesRef, {
        ...cleanedData,
        createdBy: userId,
        organizationId: orgId,
        projectId: projectId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Created tracking rule:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Failed to create rule:', error);
      throw error;
    }
  }

  /**
   * Get all rules for a project
   */
  static async getRules(orgId: string, projectId: string): Promise<TrackingRule[]> {
    try {
      const rulesRef = collection(db, 'organizations', orgId, 'projects', projectId, 'trackingRules');
      const snapshot = await getDocs(rulesRef);

      const rules: TrackingRule[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          conditions: data.conditions || [],
          isActive: data.isActive ?? true,
          appliesTo: data.appliesTo || {},
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          organizationId: data.organizationId,
          projectId: data.projectId,
        };
      });

      console.log(`📋 Loaded ${rules.length} tracking rules`);
      return rules;
    } catch (error) {
      console.error('❌ Failed to load rules:', error);
      return [];
    }
  }

  /**
   * Get rules applicable to a specific account
   */
  static async getRulesForAccount(
    orgId: string,
    projectId: string,
    accountId: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter'
  ): Promise<TrackingRule[]> {
    const allRules = await this.getRules(orgId, projectId);
    
    return allRules.filter(rule => {
      if (!rule.isActive) return false;
      
      const { platforms, accountIds } = rule.appliesTo;
      
      // Check platform match
      const platformMatch = !platforms || platforms.length === 0 || platforms.includes(platform);
      
      // Check account match (empty accountIds means applies to all)
      const accountMatch = !accountIds || accountIds.length === 0 || accountIds.includes(accountId);
      
      return platformMatch && accountMatch;
    });
  }

  /**
   * Update an existing rule
   */
  static async updateRule(
    orgId: string,
    projectId: string,
    ruleId: string,
    updates: Partial<Omit<TrackingRule, 'id' | 'createdAt' | 'createdBy' | 'organizationId' | 'projectId'>>
  ): Promise<void> {
    try {
      const ruleRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackingRules', ruleId);
      await updateDoc(ruleRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Updated tracking rule:', ruleId);
    } catch (error) {
      console.error('❌ Failed to update rule:', error);
      throw error;
    }
  }

  /**
   * Delete a rule
   */
  static async deleteRule(orgId: string, projectId: string, ruleId: string): Promise<void> {
    try {
      const ruleRef = doc(db, 'organizations', orgId, 'projects', projectId, 'trackingRules', ruleId);
      await deleteDoc(ruleRef);

      console.log('✅ Deleted tracking rule:', ruleId);
    } catch (error) {
      console.error('❌ Failed to delete rule:', error);
      throw error;
    }
  }

  /**
   * Check if a video matches a rule's conditions
   */
  static checkVideoMatchesRule(video: AccountVideo, rule: TrackingRule): RuleMatchResult {
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];

    let currentResult = true; // Start with true for first condition

    for (let i = 0; i < rule.conditions.length; i++) {
      const condition = rule.conditions[i];
      const conditionMatches = this.evaluateCondition(video, condition);

      if (conditionMatches) {
        matchedConditions.push(condition.id);
      } else {
        failedConditions.push(condition.id);
      }

      // Apply operator logic
      if (i === 0) {
        currentResult = conditionMatches;
      } else {
        const previousCondition = rule.conditions[i - 1];
        if (previousCondition.operator === 'OR') {
          currentResult = currentResult || conditionMatches;
        } else {
          // Default to AND
          currentResult = currentResult && conditionMatches;
        }
      }
    }

    return {
      matches: currentResult,
      matchedConditions,
      failedConditions,
    };
  }

  /**
   * Evaluate a single condition against a video
   */
  private static evaluateCondition(video: AccountVideo, condition: RuleCondition): boolean {
    const originalDescription = video.caption || '';
    const description = condition.caseSensitive ? originalDescription : originalDescription.toLowerCase();
    
    switch (condition.type) {
      case 'description_contains': {
        const searchValue = condition.caseSensitive 
          ? String(condition.value) 
          : String(condition.value).toLowerCase();
        return description.includes(searchValue);
      }
      
      case 'description_not_contains': {
        const searchValue = condition.caseSensitive 
          ? String(condition.value) 
          : String(condition.value).toLowerCase();
        return !description.includes(searchValue);
      }
      
      case 'hashtag_includes': {
        const searchValue = String(condition.value).replace(/^#/, '');
        const targetTag = condition.caseSensitive ? searchValue : searchValue.toLowerCase();
        const videoTags = originalDescription.match(/#[\w]+/g) || [];
        return videoTags.some((tag: string) => {
          const compareTag = condition.caseSensitive ? tag : tag.toLowerCase();
          return compareTag.includes(targetTag);
        });
      }
      
      case 'hashtag_not_includes': {
        const searchValue = String(condition.value).replace(/^#/, '');
        const targetTag = condition.caseSensitive ? searchValue : searchValue.toLowerCase();
        const videoTags = originalDescription.match(/#[\w]+/g) || [];
        return !videoTags.some((tag: string) => {
          const compareTag = condition.caseSensitive ? tag : tag.toLowerCase();
          return compareTag.includes(targetTag);
        });
      }
      
      case 'views_greater_than':
        return (video.views || 0) > Number(condition.value);
      
      case 'views_less_than':
        return (video.views || 0) < Number(condition.value);
      
      case 'likes_greater_than':
        return (video.likes || 0) > Number(condition.value);
      
      case 'engagement_rate_greater_than': {
        const views = video.views || 0;
        const likes = video.likes || 0;
        const comments = video.comments || 0;
        const engagementRate = views > 0 
          ? ((likes + comments) / views) * 100 
          : 0;
        return engagementRate > Number(condition.value);
      }
      
      case 'posted_after_date': {
        const targetDate = new Date(String(condition.value));
        const videoDate = typeof video.timestamp === 'string' ? new Date(video.timestamp) : video.timestamp;
        return (videoDate || new Date(0)) > targetDate;
      }
      
      case 'posted_before_date': {
        const targetDate = new Date(String(condition.value));
        const videoDate = typeof video.timestamp === 'string' ? new Date(video.timestamp) : video.timestamp;
        return (videoDate || new Date()) < targetDate;
      }
      
      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return true;
    }
  }

  /**
   * Filter videos based on rules
   */
  static async filterVideosByRules(
    orgId: string,
    projectId: string,
    accountId: string,
    platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter',
    videos: AccountVideo[]
  ): Promise<AccountVideo[]> {
    const rules = await this.getRulesForAccount(orgId, projectId, accountId, platform);
    
    if (rules.length === 0) {
      console.log('📋 No rules applied, returning all videos');
      return videos;
    }

    console.log(`📋 Applying ${rules.length} rule(s) to ${videos.length} videos`);

    const filteredVideos = videos.filter(video => {
      // Video must match at least one rule
      return rules.some(rule => {
        const result = this.checkVideoMatchesRule(video, rule);
        return result.matches;
      });
    });

    console.log(`✅ Filtered to ${filteredVideos.length} videos matching rules`);
    return filteredVideos;
  }

  /**
   * Get condition type display name
   */
  static getConditionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      description_contains: 'Description contains',
      description_not_contains: 'Description does not contain',
      hashtag_includes: 'Hashtag includes',
      hashtag_not_includes: 'Hashtag does not include',
      views_greater_than: 'Views greater than',
      views_less_than: 'Views less than',
      likes_greater_than: 'Likes greater than',
      engagement_rate_greater_than: 'Engagement rate greater than',
      posted_after_date: 'Posted after',
      posted_before_date: 'Posted before',
    };
    return labels[type] || type;
  }
}

export default RulesService;

