import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { OrgMember, Creator } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import DateFilterService from '../services/DateFilterService';
import { DateFilterType } from '../components/DateRangeFilter';

interface CreatorsDataResult {
  creators: OrgMember[];
  creatorProfiles: Map<string, Creator>;
  calculatedEarnings: Map<string, number>;
  creatorTotalViews: Map<string, number>;
  videoCounts: Map<string, number>;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Earnings calculator (cache-only — no Firestore reads) ──────────
  const calculateCreatorEarnings = (
    creatorId: string,
    profile: Creator,
    creatorLinks: any[],
    allProjectVideosCache: any[]
  ): { earnings: number; videoCount: number; totalViews: number } => {
    const accountIds = new Set(creatorLinks.map((link: any) => link.accountId));

    // Filter videos from the already-fetched cache instead of querying per account.
    // A video belongs to this creator if:
    //   - trackedAccountId is one of the creator's linked accounts
    //   - OR it was directly submitted by this creator (addedBy === creatorId)
    //   - OR it was assigned to this creator (assignedCreatorId === creatorId)
    const videoMap = new Map<string, any>();
    for (const v of allProjectVideosCache) {
      if (
        (v.trackedAccountId && accountIds.has(v.trackedAccountId)) ||
        v.addedBy === creatorId ||
        v.assignedCreatorId === creatorId
      ) {
        videoMap.set(v.id, v);
      }
    }

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
  };

  // ── Data Loader ────────────────────────────────────────────────────
  const DEMO_ORG_ID = 'Vx2UpxGCV3uD8Xj2ioX4';
  const isDemoOrg = orgId === DEMO_ORG_ID;

  const loadData = async () => {
    if (!orgId || !projectId) return;

    // Demo mode: inject fake creators immediately
    if (isDemoOrg) {
      const demoCreators: OrgMember[] = [
        {
          userId: 'demo-ernesto',
          displayName: 'Ernesto Lopez',
          email: 'ernesto@viewtrack.app',
          photoURL: '/demo-ernesto.jpg',
          joinedAt: new Date('2025-09-15'),
          role: 'creator',
          status: 'active',
        } as any,
        {
          userId: 'demo-mau',
          displayName: 'Mau Baron',
          email: 'mau@viewtrack.app',
          photoURL: '/demo-mau.jpg',
          joinedAt: new Date('2025-10-02'),
          role: 'creator',
          status: 'active',
        } as any,
      ];
      setCreators(demoCreators);
      setIsAdmin(true);
      const profilesMap = new Map<string, Creator>();
      profilesMap.set('demo-ernesto', {
        id: 'demo-ernesto',
        displayName: 'Ernesto Lopez',
        email: 'ernesto@viewtrack.app',
        photoURL: '/demo-ernesto.jpg',
        platforms: [
          { platform: 'tiktok', username: 'ernestosoftware' },
          { platform: 'instagram', username: 'ernestosoftware' },
          { platform: 'youtube', username: 'ernestosoftware' },
          { platform: 'twitter', username: 'ernestosoftware' },
        ],
        linkedAccounts: 4,
      } as any);
      profilesMap.set('demo-mau', {
        id: 'demo-mau',
        displayName: 'Mau Baron',
        email: 'mau@viewtrack.app',
        photoURL: '/demo-mau.jpg',
        platforms: [
          { platform: 'tiktok', username: 'maubaron' },
          { platform: 'youtube', username: 'maubaron' },
          { platform: 'instagram', username: 'maubaron' },
        ],
        linkedAccounts: 3,
      } as any);
      setCreatorProfiles(profilesMap);
      setCalculatedEarnings(new Map([['demo-ernesto', 4250], ['demo-mau', 7800]]));
      setVideoCounts(new Map([['demo-ernesto', 34], ['demo-mau', 52]]));
      setCreatorTotalViews(new Map([['demo-ernesto', 2400000], ['demo-mau', 5100000]]));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // ── Step 1: Parallel reads — 5 queries, no N+1 ──────────────
      // Instead of getOrgMembers (which reads ALL members then does a
      // sequential getUserAccount for EACH one), we read only the member
      // docs we need: creator-role members. No user-profile enrichment
      // loop — member docs already have displayName/email.
      const membersRef = collection(db, 'organizations', orgId, 'members');

      const [
        role,
        creatorProfilesList,
        creatorMembersSnapshot,
        allCreatorLinksSnapshot,
        allProjectVideosCache,
      ] = await Promise.all([
        userId ? OrganizationService.getUserRole(orgId, userId) : Promise.resolve('admin'),
        CreatorLinksService.getAllCreators(orgId, projectId),
        getDocs(query(membersRef, where('status', '==', 'active'), where('role', '==', 'creator'))),
        getDocs(collection(db, 'organizations', orgId, 'projects', projectId, 'creatorLinks')),
        FirestoreDataService.getVideos(orgId, projectId, { limitCount: 10000 }).catch(() => [] as any[]),
      ]);

      setIsAdmin(role === 'owner' || role === 'admin');

      // Parse creator member docs (no sequential user-profile reads)
      const membersData: Array<OrgMember & { email?: string; displayName?: string; photoURL?: string }> =
        creatorMembersSnapshot.docs.map((d) => {
          const data = d.data() as OrgMember;
          return {
            ...data,
            email: data.email,
            displayName: data.displayName,
            photoURL: (data as any).photoURL,
          };
        });

      // For any creator member missing a photoURL, try to fetch it from
      // /users/{uid} — but do ALL of them in PARALLEL, not sequentially.
      const membersNeedingPhoto = membersData.filter((m) => !m.photoURL);
      if (membersNeedingPhoto.length > 0) {
        const photoResults = await Promise.all(
          membersNeedingPhoto.map(async (m) => {
            try {
              const userAccount = await OrganizationService.getUserAccount(m.userId);
              return { userId: m.userId, photoURL: userAccount?.photoURL };
            } catch {
              return { userId: m.userId, photoURL: undefined };
            }
          })
        );
        const photoMap = new Map(photoResults.map((r) => [r.userId, r.photoURL]));
        membersData.forEach((m) => {
          if (!m.photoURL && photoMap.get(m.userId)) {
            m.photoURL = photoMap.get(m.userId);
          }
        });
      }

      // ── Step 2: Combine creators list ──────────────────────────
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


      // ── Step 3: Build creator→links map ────────────────────────
      const creatorLinksMap = new Map<string, any[]>();
      allCreatorLinksSnapshot.docs.forEach((d) => {
        const link = { id: d.id, ...d.data() };
        const cId = (link as any).creatorId;
        if (!creatorLinksMap.has(cId)) creatorLinksMap.set(cId, []);
        creatorLinksMap.get(cId)!.push(link);
      });

      // ── Step 4: Calculate earnings from cache (zero extra reads) ─
      const earningsMap = new Map<string, number>();
      const videoCountsMap = new Map<string, number>();
      const viewsMap = new Map<string, number>();

      for (const profile of creatorProfilesList) {
        const links = creatorLinksMap.get(profile.id) || [];
        const { earnings, videoCount, totalViews } = calculateCreatorEarnings(
          profile.id,
          profile,
          links,
          allProjectVideosCache
        );
        earningsMap.set(profile.id, earnings);
        videoCountsMap.set(profile.id, videoCount);
        viewsMap.set(profile.id, totalViews);
      }

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
    isAdmin,
    loading,
    loadData,
  };
}
