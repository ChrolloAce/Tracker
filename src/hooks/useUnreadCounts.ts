import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const DEMO_ORG_ID = 'Vx2UpxGCV3uD8Xj2ioX4';

interface UnreadCounts {
  videos: number;
  accounts: number;
}

interface LoadingState {
  videos: boolean;
  accounts: boolean;
}

export function useUnreadCounts(orgId: string | null, projectId: string | null) {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    videos: 0,
    accounts: 0
  });
  const [loading, setLoading] = useState<LoadingState>({
    videos: false,
    accounts: false
  });

  // Refs for debounced batching of state updates
  const pendingUnreadRef = useRef<Partial<UnreadCounts>>({});
  const pendingLoadingRef = useRef<Partial<LoadingState>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushUpdates = useCallback(() => {
    const pendingUnread = pendingUnreadRef.current;
    const pendingLoading = pendingLoadingRef.current;

    if (Object.keys(pendingUnread).length > 0) {
      setUnreadCounts(prev => ({ ...prev, ...pendingUnread }));
      pendingUnreadRef.current = {};
    }

    if (Object.keys(pendingLoading).length > 0) {
      setLoading(prev => ({ ...prev, ...pendingLoading }));
      pendingLoadingRef.current = {};
    }

    debounceTimerRef.current = null;
  }, []);

  const scheduleUpdate = useCallback((
    unreadPatch?: Partial<UnreadCounts>,
    loadingPatch?: Partial<LoadingState>
  ) => {
    if (unreadPatch) {
      pendingUnreadRef.current = { ...pendingUnreadRef.current, ...unreadPatch };
    }
    if (loadingPatch) {
      pendingLoadingRef.current = { ...pendingLoadingRef.current, ...loadingPatch };
    }

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(flushUpdates, 100);
  }, [flushUpdates]);

  useEffect(() => {
    console.log('🔄 useUnreadCounts effect triggered', { orgId, projectId });

    // Skip Firestore listeners in demo mode when there's no authenticated user
    if ((!orgId || orgId === DEMO_ORG_ID) && !auth.currentUser) {
      console.log('⚠️ Demo mode with no auth user, returning zeros');
      setUnreadCounts({ videos: 0, accounts: 0 });
      setLoading({ videos: false, accounts: false });
      return;
    }

    if (!orgId || !projectId) {
      console.log('⚠️ No orgId or projectId, resetting counts');
      setUnreadCounts({ videos: 0, accounts: 0 });
      return;
    }

    // --- Single listener for the videos collection ---
    // Replaces the previous separate unreadVideos and processingVideos listeners.
    const videosRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'videos'
    );

    const unsubscribeVideos = onSnapshot(
      videosRef,
      (snapshot) => {
        // Count unread videos (replaces the old isRead==false query)
        const unreadCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isRead === false;
        }).length;

        // Count valid processing videos (replaces the old status=='processing' query)
        const fiveMinutesAgo = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        const validProcessingVideos = snapshot.docs.filter(doc => {
          const data = doc.data();
          if (data.status !== 'processing') return false;
          // Check if syncRequestedAt exists and is within last 5 minutes
          if (data.syncRequestedAt) {
            const requestedTime = data.syncRequestedAt.toMillis ? data.syncRequestedAt.toMillis() : data.syncRequestedAt;
            const timeDiff = fiveMinutesAgo - requestedTime;
            return timeDiff < fiveMinutes;
          }
          return false; // If no timestamp, don't count as loading
        }).length;

        console.log('📊 Unread videos count:', unreadCount);
        console.log('⏳ Processing videos count:', validProcessingVideos, '(total docs:', snapshot.size, ')');

        scheduleUpdate(
          { videos: unreadCount },
          { videos: validProcessingVideos > 0 }
        );
      },
      (error) => {
        console.error('❌ Error listening to videos collection:', error);
        scheduleUpdate({ videos: 0 }, { videos: false });
      }
    );

    // --- Single listener for the trackedAccounts collection ---
    // Replaces the previous separate unreadAccounts and syncingAccounts listeners.
    const accountsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'trackedAccounts'
    );

    const unsubscribeAccounts = onSnapshot(
      accountsRef,
      (snapshot) => {
        // Count unread active accounts (replaces the old isRead==false query + client filter)
        const unreadActiveCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isRead === false && data.isActive !== false;
        }).length;

        // Count syncing accounts (replaces the old isActive==true query + client filter)
        const tenMinutesAgo = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        const syncingCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          if (data.isActive !== true) return false;

          const isSyncing = data.syncStatus === 'pending' ||
                 data.syncStatus === 'syncing' ||
                 (data.syncProgress && data.syncProgress.current < data.syncProgress.total);

          if (!isSyncing) return false;

          // Check if lastSyncStarted exists and is within last 10 minutes
          if (data.lastSyncStarted) {
            const syncStartedTime = data.lastSyncStarted.toMillis ? data.lastSyncStarted.toMillis() : data.lastSyncStarted;
            const timeDiff = tenMinutesAgo - syncStartedTime;
            return timeDiff < tenMinutes;
          }

          return false; // If no timestamp, don't count as loading
        }).length;

        console.log('📊 Unread accounts count:', unreadActiveCount, '(total docs:', snapshot.size, ')');
        console.log('⏳ Syncing accounts count:', syncingCount);

        scheduleUpdate(
          { accounts: unreadActiveCount },
          { accounts: syncingCount > 0 }
        );
      },
      (error) => {
        console.error('❌ Error listening to trackedAccounts collection:', error);
        scheduleUpdate({ accounts: 0 }, { accounts: false });
      }
    );

    return () => {
      // Clear any pending debounced update
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingUnreadRef.current = {};
      pendingLoadingRef.current = {};

      unsubscribeVideos();
      unsubscribeAccounts();
    };
  }, [orgId, projectId, scheduleUpdate]);

  return { unreadCounts, loading };
}
