import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { OrgMember, Creator, TeamInvitation } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import DateFilterService from '../services/DateFilterService';
import TeamInvitationService from '../services/TeamInvitationService';
import { DateFilterType } from '../components/DateRangeFilter';

interface CreatorsDataResult {
  creators: OrgMember[];
  creatorProfiles: Map<string, Creator>;
  calculatedEarnings: Map<string, number>;
  creatorTotalViews: Map<string, number>;
  videoCounts: Map<string, number>;
  pendingInvitations: TeamInvitation[];
  isAdmin: boolean;
  loading: boolean;
  loadData: () => Promise<void>;
}

/**
 * Hook to load creators, profiles, earnings, video counts, and invitations.
 */
export function useCreatorsData(
  orgId: string | null,
  projectId: string | null,
  userId: string | undefined,
  dateFilter: DateFilterType
): CreatorsDataResult {
  const [creators, setCreators] = useState<OrgMember[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<Map<string, Creator>>(new Map());
  const [calculatedEarnings, setCalculatedEarnings] = useState<Map<string, number>>(new Map());
  const [creatorTotalViews, setCreatorTotalViews] = useState<Map<string, number>>(new Map());
  const [videoCounts, setVideoCounts] = useState<Map<string, number>>(new Map());
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Earnings calculator ────────────────────────────────────────────
  const calculateCreatorEarnings = async (
    creatorId: string,
    profile: Creator,
    projectAccounts: any[],
    creatorLinks: any[]
  ): Promise<{ earnings: number; videoCount: number; totalViews: number }> => {
    if (!orgId || !projectId) return { earnings: 0, videoCount: 0, totalViews: 0 };

    try {
      const accountIds = creatorLinks.map((link: any) => link.accountId);
      const linkedAccounts = projectAccounts.filter((acc: any) => accountIds.includes(acc.id));

      const videosPromises = linkedAccounts.map(async (account: any) => {
        try {
          return await FirestoreDataService.getVideos(orgId, projectId, {
            trackedAccountId: account.id,
            limitCount: 100,
          });
        } catch {
          return [];
        }
      });

      const linkedVideos = (await Promise.all(videosPromises)).flat();

      let directlySubmittedVideos: any[] = [];
      try {
        const allProjectVideos = await FirestoreDataService.getVideos(orgId, projectId, { limitCount: 1000 });
        directlySubmittedVideos = allProjectVideos.filter((v: any) => v.addedBy === creatorId);
      } catch {
        /* noop */
      }

      const videoMap = new Map<string, any>();
      linkedVideos.forEach((v: any) => videoMap.set(v.id, v));
      directlySubmittedVideos.forEach((v: any) => videoMap.set(v.id, v));
      let allVideos = Array.from(videoMap.values());

      if (dateFilter !== 'all') {
        const dateRange = DateFilterService.getDateRange(dateFilter);
        if (dateRange) {
          allVideos = allVideos.filter((video: any) => {
            const uploadDate = video.uploadDate?.toDate ? video.uploadDate.toDate() : new Date(video.uploadDate);
            return uploadDate >= dateRange.startDate && uploadDate <= dateRange.endDate;
          });
        }
      }

      const videoCount = allVideos.length;
      const totalViews = allVideos.reduce((s: number, v: any) => s + (v.views || 0), 0);

      if (!profile.customPaymentTerms || allVideos.length === 0) {
        return { earnings: 0, videoCount, totalViews };
      }

      const terms = profile.customPaymentTerms;
      let total = 0;

      allVideos.forEach((video: any) => {
        let videoEarnings = 0;
        switch (terms.type) {
          case 'flat_fee':
            videoEarnings = terms.baseAmount || 0;
            break;
          case 'base_cpm': {
            const views = video.views || 0;
            videoEarnings = (terms.baseAmount || 0) + (views / 1000) * (terms.cpmRate || 0);
            break;
          }
          case 'base_guaranteed_views': {
            const actualViews = video.views || 0;
            if (actualViews >= (terms.guaranteedViews || 0)) videoEarnings = terms.baseAmount || 0;
            break;
          }
          case 'cpc':
            videoEarnings = ((video as any).clicks || 0) * (terms.cpcRate || 0);
            break;
          case 'revenue_share':
            videoEarnings = ((video as any).revenue || 0) * ((terms.revenueSharePercentage || 0) / 100);
            break;
          case 'retainer':
            videoEarnings = 0;
            break;
        }
        total += videoEarnings;
      });

      return { earnings: total, videoCount, totalViews };
    } catch (error) {
      console.error(`Failed to calculate earnings for creator ${creatorId}:`, error);
      return { earnings: 0, videoCount: 0, totalViews: 0 };
    }
  };

  // ── Data Loader ────────────────────────────────────────────────────
  const loadData = async () => {
    if (!orgId || !projectId || !userId) return;

    setLoading(true);
    try {
      const [role, creatorProfilesList, membersData, invitesData, projectAccounts, allCreatorLinksSnapshot] =
        await Promise.all([
          OrganizationService.getUserRole(orgId, userId),
          CreatorLinksService.getAllCreators(orgId, projectId),
          OrganizationService.getOrgMembers(orgId),
          TeamInvitationService.getOrgInvitations(orgId),
          FirestoreDataService.getTrackedAccounts(orgId, projectId),
          getDocs(collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks')),
        ]);

      setIsAdmin(role === 'owner' || role === 'admin');

      // Combine creators list
      const creatorMembers = membersData.filter((m) => creatorProfilesList.some((p) => p.id === m.userId));
      const pendingCreators = creatorProfilesList
        .filter((profile) => !membersData.some((m) => m.userId === profile.id))
        .map((profile) => ({
          userId: profile.id,
          displayName: profile.displayName,
          email: profile.email || '',
          photoURL: profile.photoURL,
          joinedAt: profile.createdAt,
          role: 'creator' as const,
          status: 'invited' as const,
        }));
      const creatorsWithoutProfile = membersData
        .filter((m) => m.role === 'creator' && !creatorProfilesList.some((p) => p.id === m.userId))
        .map((member) => ({ ...member, role: 'creator' as const }));

      setCreators([...creatorMembers, ...pendingCreators, ...creatorsWithoutProfile]);

      const profilesMap = new Map<string, Creator>();
      creatorProfilesList.forEach((p) => profilesMap.set(p.id, p));
      setCreatorProfiles(profilesMap);

      setPendingInvitations(invitesData.filter((inv) => inv.role === 'creator'));

      const creatorLinksMap = new Map<string, any[]>();
      allCreatorLinksSnapshot.docs.forEach((doc) => {
        const link = { id: doc.id, ...doc.data() };
        const cId = (link as any).creatorId;
        if (!creatorLinksMap.has(cId)) creatorLinksMap.set(cId, []);
        creatorLinksMap.get(cId)!.push(link);
      });

      // Calculate earnings in parallel
      const earningsMap = new Map<string, number>();
      const videoCountsMap = new Map<string, number>();
      const viewsMap = new Map<string, number>();

      await Promise.all(
        creatorProfilesList.map(async (profile) => {
          const links = creatorLinksMap.get(profile.id) || [];
          const { earnings, videoCount, totalViews } = await calculateCreatorEarnings(
            profile.id,
            profile,
            projectAccounts,
            links
          );
          earningsMap.set(profile.id, earnings);
          videoCountsMap.set(profile.id, videoCount);
          viewsMap.set(profile.id, totalViews);
        })
      );

      setCalculatedEarnings(earningsMap);
      setVideoCounts(videoCountsMap);
      setCreatorTotalViews(viewsMap);
    } catch (error) {
      console.error('Failed to load creators:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId, projectId, userId, dateFilter]);

  return {
    creators,
    creatorProfiles,
    calculatedEarnings,
    creatorTotalViews,
    videoCounts,
    pendingInvitations,
    isAdmin,
    loading,
    loadData,
  };
}
