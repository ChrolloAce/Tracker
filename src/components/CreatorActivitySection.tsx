import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { VideoDoc } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorLinksService from '../services/CreatorLinksService';
import FirestoreDataService from '../services/FirestoreDataService';
import DateFilterService from '../services/DateFilterService';
import { DateFilterType } from './DateRangeFilter';
import Pagination from './ui/Pagination';
import { ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';
import {
  CreatorRow,
  SortField,
  getEngagementRate,
  ActivityTable,
  PerformanceTable
} from './CreatorActivityTables';

// ─── Props ──────────────────────────────────────────────────

interface CreatorActivitySectionProps {
  dateFilter: DateFilterType;
  organizationId?: string;
  projectId?: string;
}

// ─── Main Component ─────────────────────────────────────────

export default function CreatorActivitySection({
  dateFilter,
  organizationId,
  projectId
}: CreatorActivitySectionProps) {
  const { currentOrgId: authOrgId, currentProjectId: authProjectId } = useAuth();
  const orgId = organizationId || authOrgId;
  const projId = projectId || authProjectId;

  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Toggle between activity / performance
  const [activeView, setActiveView] = useState<'activity' | 'performance'>('activity');

  // ─── Data Loading ─────────────────────────────────────────

  useEffect(() => {
    loadCreatorData();
  }, [orgId, projId, dateFilter]);

  const loadCreatorData = async () => {
    if (!orgId || !projId) return;
    setLoading(true);
    try {
      const [
        creatorProfiles,
        membersData,
        allVideos,
        creatorLinksSnap
      ] = await Promise.all([
        CreatorLinksService.getAllCreators(orgId, projId),
        OrganizationService.getOrgMembers(orgId),
        FirestoreDataService.getVideos(orgId, projId, { limitCount: 5000 }),
        getDocs(collection(db, 'organizations', orgId, 'projects', projId, 'creatorLinks'))
      ]);

      // Map creator -> linked account IDs
      const creatorAccountsMap = new Map<string, string[]>();
      creatorLinksSnap.docs.forEach(d => {
        const data = d.data();
        const cid = data.creatorId as string;
        if (!creatorAccountsMap.has(cid)) creatorAccountsMap.set(cid, []);
        creatorAccountsMap.get(cid)!.push(data.accountId as string);
      });

      // Date range
      const dateRange = dateFilter !== 'all' ? DateFilterService.getDateRange(dateFilter) : null;

      const creatorRows: CreatorRow[] = [];

      for (const profile of creatorProfiles) {
        const accountIds = creatorAccountsMap.get(profile.id) || [];

        // Videos = linked accounts + directly submitted + assigned
        const creatorVideos = allVideos.filter((v: any) => {
          if (v.trackedAccountId && accountIds.includes(v.trackedAccountId)) return true;
          if (v.addedBy === profile.id) return true;
          if (v.assignedCreatorId === profile.id) return true;
          return false;
        });

        // Deduplicate
        const videoMap = new Map<string, VideoDoc>();
        creatorVideos.forEach((v: any) => videoMap.set(v.id, v));
        const allCreatorVids = Array.from(videoMap.values());

        // Filter by date
        let periodVideos = allCreatorVids;
        if (dateRange) {
          periodVideos = allCreatorVids.filter((v: any) => {
            const d = v.uploadDate?.toDate ? v.uploadDate.toDate() : new Date(v.uploadDate);
            return d >= dateRange.startDate && d <= dateRange.endDate;
          });
        }

        // Get member info for photo
        const member = membersData.find(m => m.userId === profile.id);

        creatorRows.push({
          creatorId: profile.id,
          displayName: profile.displayName || member?.displayName || 'Unknown',
          photoURL: profile.photoURL || member?.photoURL,
          email: profile.email || member?.email,
          accountCount: accountIds.length,
          videos: periodVideos,
          allVideos: allCreatorVids,
        });
      }

      setRows(creatorRows);
    } catch (err) {
      console.error('Failed to load creator activity:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Sorting & Pagination ─────────────────────────────────

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;

      switch (sortField) {
        case 'creator':
          av = a.displayName.toLowerCase();
          bv = b.displayName.toLowerCase();
          break;
        case 'posted':
          av = a.videos.length;
          bv = b.videos.length;
          break;
        case 'views':
          av = a.videos.reduce((s, v) => s + (v.views || 0), 0);
          bv = b.videos.reduce((s, v) => s + (v.views || 0), 0);
          break;
        case 'likes':
          av = a.videos.reduce((s, v) => s + (v.likes || 0), 0);
          bv = b.videos.reduce((s, v) => s + (v.likes || 0), 0);
          break;
        case 'comments':
          av = a.videos.reduce((s, v) => s + (v.comments || 0), 0);
          bv = b.videos.reduce((s, v) => s + (v.comments || 0), 0);
          break;
        case 'shares':
          av = a.videos.reduce((s, v) => s + (v.shares || 0), 0);
          bv = b.videos.reduce((s, v) => s + (v.shares || 0), 0);
          break;
        case 'saves':
          av = a.videos.reduce((s, v) => s + (v.saves || 0), 0);
          bv = b.videos.reduce((s, v) => s + (v.saves || 0), 0);
          break;
        case 'engagement':
          av = getEngagementRate(a.videos);
          bv = getEngagementRate(b.videos);
          break;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [rows, sortField, sortDir]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex ml-1 opacity-50">
      {sortField === field ? (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronUp className="w-3 h-3 opacity-30" />
      )}
    </span>
  );

  // ─── Skeleton ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6 animate-pulse">
            <div className="h-6 bg-white/5 rounded w-1/4 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3].map(j => (
                <div key={j} className="h-14 bg-white/5 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-12 text-center">
        <TrendingUp className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No creators found</h3>
        <p className="text-white/60 text-sm">Add creators in the Creators tab to see activity here.</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 bg-zinc-900/60 rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setActiveView('activity')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === 'activity'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            Creator Activity
          </button>
          <button
            onClick={() => setActiveView('performance')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeView === 'performance'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            Creator Performance
          </button>
        </div>
        <span className="text-sm text-white/40">{rows.length} creator{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {activeView === 'activity' ? (
        <ActivityTable rows={paginated} toggleSort={toggleSort} SortIcon={SortIcon} />
      ) : (
        <PerformanceTable rows={paginated} toggleSort={toggleSort} SortIcon={SortIcon} />
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(sorted.length / itemsPerPage)}
        totalItems={sorted.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(n) => {
          setItemsPerPage(n);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
