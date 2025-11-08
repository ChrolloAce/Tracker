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
import type {
  CampaignCompetition,
  CampaignCompetitionType,
  PayoutMetric,
  CampaignCompetitionPrize
} from '../types/payouts';
import type { VideoSubmission } from '../types';
import { PayoutCalculationEngine, CreatorPerformance } from './PayoutCalculationEngine';

/**
 * Competition Result for a Single Creator
 */
export interface CompetitionResult {
  competitionId: string;
  competitionName: string;
  creatorId: string;
  rank: number;
  metricValue: number;
  prize?: CampaignCompetitionPrize;
  qualified: boolean;
  disqualificationReason?: string;
}

/**
 * Full Competition Standings
 */
export interface CompetitionStandings {
  competitionId: string;
  competition: CampaignCompetition;
  results: CompetitionResult[];
  calculatedAt: Date;
}

/**
 * Service for managing Campaign Competitions
 * 
 * Supports:
 * - Top N performers (most views, likes, etc.)
 * - First to hit a target (first to 100K views)
 * - Most improved (biggest % growth)
 * - Random draw among eligible creators
 */
export class CampaignCompetitionService {
  /**
   * Create a new competition for a campaign
   */
  static async createCompetition(
    orgId: string,
    projectId: string,
    campaignId: string,
    data: {
      name: string;
      description?: string;
      metric: PayoutMetric;
      type: CampaignCompetitionType;
      prizes: CampaignCompetitionPrize[];
      n?: number; // For 'top_n'
      targetValue?: number; // For 'first_to_hit'
      eligibility?: CampaignCompetition['eligibility'];
      startsAt: Date;
      endsAt: Date;
    }
  ): Promise<CampaignCompetition> {
    try {
      const competitionRef = doc(
        collection(
          db,
          'organizations',
          orgId,
          'projects',
          projectId,
          'campaigns',
          campaignId,
          'competitions'
        )
      );

      const now = Timestamp.now();
      const competition: CampaignCompetition = {
        id: competitionRef.id,
        campaignId,
        name: data.name,
        description: data.description,
        metric: data.metric,
        type: data.type,
        prizes: data.prizes,
        n: data.n,
        targetValue: data.targetValue,
        eligibility: data.eligibility,
        isActive: true,
        startsAt: Timestamp.fromDate(data.startsAt),
        endsAt: Timestamp.fromDate(data.endsAt),
        createdAt: now,
        updatedAt: now
      };

      await setDoc(competitionRef, competition);

      return competition;
    } catch (error) {
      console.error('Error creating competition:', error);
      throw error;
    }
  }

  /**
   * List all competitions for a campaign
   */
  static async listCompetitions(
    orgId: string,
    projectId: string,
    campaignId: string
  ): Promise<CampaignCompetition[]> {
    try {
      const competitionsRef = collection(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'competitions'
      );

      const q = query(competitionsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => doc.data() as CampaignCompetition);
    } catch (error) {
      console.error('Error listing competitions:', error);
      throw error;
    }
  }

  /**
   * Get a single competition
   */
  static async getCompetition(
    orgId: string,
    projectId: string,
    campaignId: string,
    competitionId: string
  ): Promise<CampaignCompetition | null> {
    try {
      const competitionRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'competitions',
        competitionId
      );

      const competitionDoc = await getDoc(competitionRef);

      if (!competitionDoc.exists()) {
        return null;
      }

      return competitionDoc.data() as CampaignCompetition;
    } catch (error) {
      console.error('Error fetching competition:', error);
      throw error;
    }
  }

  /**
   * Update a competition
   */
  static async updateCompetition(
    orgId: string,
    projectId: string,
    campaignId: string,
    competitionId: string,
    updates: Partial<CampaignCompetition>
  ): Promise<void> {
    try {
      const competitionRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'competitions',
        competitionId
      );

      await updateDoc(competitionRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating competition:', error);
      throw error;
    }
  }

  /**
   * Delete a competition
   */
  static async deleteCompetition(
    orgId: string,
    projectId: string,
    campaignId: string,
    competitionId: string
  ): Promise<void> {
    try {
      const competitionRef = doc(
        db,
        'organizations',
        orgId,
        'projects',
        projectId,
        'campaigns',
        campaignId,
        'competitions',
        competitionId
      );

      await deleteDoc(competitionRef);
    } catch (error) {
      console.error('Error deleting competition:', error);
      throw error;
    }
  }

  /**
   * Calculate competition standings based on creator performance
   */
  static calculateStandings(
    competition: CampaignCompetition,
    creatorPerformances: CreatorPerformance[]
  ): CompetitionStandings {
    // Filter eligible creators
    const eligiblePerformances = creatorPerformances.filter(perf =>
      this.isCreatorEligible(competition, perf)
    );

    let results: CompetitionResult[] = [];

    switch (competition.type) {
      case 'top_n':
        results = this.calculateTopN(competition, eligiblePerformances);
        break;
      case 'first_to_hit':
        results = this.calculateFirstToHit(competition, eligiblePerformances);
        break;
      case 'most_improved':
        results = this.calculateMostImproved(competition, eligiblePerformances);
        break;
      case 'random_draw':
        results = this.calculateRandomDraw(competition, eligiblePerformances);
        break;
      default:
        console.warn('Unknown competition type:', competition.type);
    }

    // Add disqualified creators
    const disqualified = creatorPerformances
      .filter(perf => !this.isCreatorEligible(competition, perf))
      .map(perf => ({
        competitionId: competition.id,
        competitionName: competition.name,
        creatorId: perf.creatorId,
        rank: 0,
        metricValue: this.getMetricValue(competition.metric, perf),
        qualified: false,
        disqualificationReason: this.getDisqualificationReason(competition, perf)
      }));

    return {
      competitionId: competition.id,
      competition,
      results: [...results, ...disqualified],
      calculatedAt: new Date()
    };
  }

  /**
   * Top N competition: Highest metric values win
   */
  private static calculateTopN(
    competition: CampaignCompetition,
    performances: CreatorPerformance[]
  ): CompetitionResult[] {
    const n = competition.n || 3;

    // Sort by metric (descending)
    const sorted = [...performances].sort((a, b) => {
      const aValue = this.getMetricValue(competition.metric, a);
      const bValue = this.getMetricValue(competition.metric, b);
      return bValue - aValue;
    });

    // Assign prizes to top N
    return sorted.map((perf, index) => {
      const rank = index + 1;
      const prize = competition.prizes.find(p => p.rank === rank);

      return {
        competitionId: competition.id,
        competitionName: competition.name,
        creatorId: perf.creatorId,
        rank,
        metricValue: this.getMetricValue(competition.metric, perf),
        prize: rank <= n ? prize : undefined,
        qualified: true
      };
    });
  }

  /**
   * First to Hit: First creator to reach target wins
   */
  private static calculateFirstToHit(
    competition: CampaignCompetition,
    performances: CreatorPerformance[]
  ): CompetitionResult[] {
    const targetValue = competition.targetValue || 0;

    // Find creators who hit the target
    const qualifiers = performances
      .filter(perf => this.getMetricValue(competition.metric, perf) >= targetValue)
      .sort((a, b) => {
        // Sort by who hit first (we'd need timestamp data for this)
        // For now, just sort by highest value
        return this.getMetricValue(competition.metric, b) - this.getMetricValue(competition.metric, a);
      });

    // Award prize to first qualifier
    return performances.map(perf => {
      const metricValue = this.getMetricValue(competition.metric, perf);
      const qualified = metricValue >= targetValue;
      const isWinner = qualified && qualifiers[0]?.creatorId === perf.creatorId;

      return {
        competitionId: competition.id,
        competitionName: competition.name,
        creatorId: perf.creatorId,
        rank: qualified ? (isWinner ? 1 : 2) : 0,
        metricValue,
        prize: isWinner ? competition.prizes[0] : undefined,
        qualified
      };
    });
  }

  /**
   * Most Improved: Biggest growth percentage wins
   */
  private static calculateMostImproved(
    competition: CampaignCompetition,
    performances: CreatorPerformance[]
  ): CompetitionResult[] {
    // Note: This requires historical data (before/after)
    // For now, we'll rank by absolute values (future enhancement)
    // TODO: Add support for growth percentage calculation
    
    console.warn('Most improved calculation requires historical baseline data');
    
    // Fallback to absolute ranking for now
    return this.calculateTopN(competition, performances);
  }

  /**
   * Random Draw: Randomly select winner(s) from eligible creators
   */
  private static calculateRandomDraw(
    competition: CampaignCompetition,
    performances: CreatorPerformance[]
  ): CompetitionResult[] {
    const n = competition.prizes.length;
    
    // Shuffle eligible creators
    const shuffled = [...performances].sort(() => Math.random() - 0.5);
    
    return shuffled.map((perf, index) => {
      const rank = index + 1;
      const prize = competition.prizes.find(p => p.rank === rank);

      return {
        competitionId: competition.id,
        competitionName: competition.name,
        creatorId: perf.creatorId,
        rank,
        metricValue: this.getMetricValue(competition.metric, perf),
        prize: rank <= n ? prize : undefined,
        qualified: true
      };
    });
  }

  /**
   * Check if creator is eligible for competition
   */
  private static isCreatorEligible(
    competition: CampaignCompetition,
    performance: CreatorPerformance
  ): boolean {
    if (!competition.eligibility) {
      return true; // No eligibility requirements
    }

    const { eligibility } = competition;

    // Check if creator is in allowed list
    if (eligibility.creatorIds && !eligibility.creatorIds.includes(performance.creatorId)) {
      return false;
    }

    // Check minimum videos
    if (eligibility.minVideos && performance.videoCount < eligibility.minVideos) {
      return false;
    }

    // Check minimum engagement rate
    if (eligibility.minEngagementRate && performance.engagementRate < eligibility.minEngagementRate) {
      return false;
    }

    return true;
  }

  /**
   * Get disqualification reason
   */
  private static getDisqualificationReason(
    competition: CampaignCompetition,
    performance: CreatorPerformance
  ): string {
    if (!competition.eligibility) {
      return '';
    }

    const { eligibility } = competition;

    if (eligibility.creatorIds && !eligibility.creatorIds.includes(performance.creatorId)) {
      return 'Not in eligible creator list';
    }

    if (eligibility.minVideos && performance.videoCount < eligibility.minVideos) {
      return `Needs ${eligibility.minVideos} videos (has ${performance.videoCount})`;
    }

    if (eligibility.minEngagementRate && performance.engagementRate < eligibility.minEngagementRate) {
      return `Needs ${eligibility.minEngagementRate}% engagement (has ${performance.engagementRate.toFixed(1)}%)`;
    }

    return '';
  }

  /**
   * Get metric value from performance
   */
  private static getMetricValue(
    metric: PayoutMetric,
    performance: CreatorPerformance
  ): number {
    switch (metric) {
      case 'views':
        return performance.totalViews;
      case 'likes':
        return performance.totalLikes;
      case 'comments':
        return performance.totalComments;
      case 'shares':
        return performance.totalShares;
      case 'saves':
        return performance.totalSaves;
      case 'engagement_rate':
        return performance.engagementRate;
      case 'video_count':
        return performance.videoCount;
      default:
        return 0;
    }
  }
}

