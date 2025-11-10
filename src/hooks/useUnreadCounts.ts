import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

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

  useEffect(() => {
    console.log('🔄 useUnreadCounts effect triggered', { orgId, projectId });
    
    if (!orgId || !projectId) {
      console.log('⚠️ No orgId or projectId, resetting counts');
      setUnreadCounts({ videos: 0, accounts: 0 });
      return;
    }

    // Listen for unread videos
    const videosRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'videos'
    );
    const videosQuery = query(
      videosRef,
      where('isRead', '==', false)
    );

    const unsubscribeVideos = onSnapshot(
      videosQuery,
      (snapshot) => {
        console.log('📊 Unread videos count:', snapshot.size);
        setUnreadCounts(prev => ({ ...prev, videos: snapshot.size }));
      },
      (error) => {
        console.error('❌ Error listening to unread videos:', error);
        setUnreadCounts(prev => ({ ...prev, videos: 0 }));
      }
    );

    // Listen for unread tracked accounts
    const accountsRef = collection(
      db,
      'organizations',
      orgId,
      'projects',
      projectId,
      'trackedAccounts'
    );
    const accountsQuery = query(
      accountsRef,
      where('isRead', '==', false)
    );

    const unsubscribeAccounts = onSnapshot(
      accountsQuery,
      (snapshot) => {
        // Filter for active accounts in memory to avoid compound index requirement
        const unreadActiveCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.isActive !== false; // Consider active if not explicitly false
        }).length;
        console.log('📊 Unread accounts count:', unreadActiveCount, '(total unread:', snapshot.size, ')');
        setUnreadCounts(prev => ({ ...prev, accounts: unreadActiveCount }));
      },
      (error) => {
        console.error('❌ Error listening to unread accounts:', error);
        // If error (e.g., missing index), reset count
        setUnreadCounts(prev => ({ ...prev, accounts: 0 }));
      }
    );

    // Listen for processing videos (loading state)
    // Only count videos that have been processing for less than 5 minutes
    const processingVideosQuery = query(
      videosRef,
      where('status', '==', 'processing')
    );

    const unsubscribeProcessing = onSnapshot(
      processingVideosQuery,
      (snapshot) => {
        const fiveMinutesAgo = Date.now();
        const validProcessingVideos = snapshot.docs.filter(doc => {
          const data = doc.data();
          // Check if syncRequestedAt exists and is within last 5 minutes
          if (data.syncRequestedAt) {
            const requestedTime = data.syncRequestedAt.toMillis ? data.syncRequestedAt.toMillis() : data.syncRequestedAt;
            const timeDiff = fiveMinutesAgo - requestedTime;
            const fiveMinutes = 5 * 60 * 1000;
            return timeDiff < fiveMinutes; // Only count if less than 5 minutes old
          }
          return false; // If no timestamp, don't count as loading
        }).length;
        
        console.log('⏳ Processing videos count:', validProcessingVideos, '(total:', snapshot.size, ')');
        setLoading(prev => ({ ...prev, videos: validProcessingVideos > 0 }));
      },
      (error) => {
        console.error('❌ Error listening to processing videos:', error);
        setLoading(prev => ({ ...prev, videos: false }));
      }
    );

    // Listen for syncing accounts (loading state) - check for pending OR accounts with progress
    // Only count accounts that have been syncing for less than 10 minutes
    const syncingAccountsQuery = query(
      accountsRef,
      where('isActive', '==', true)
    );

    const unsubscribeSyncing = onSnapshot(
      syncingAccountsQuery,
      (snapshot) => {
        const tenMinutesAgo = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        
        // Count accounts that are actively syncing (have syncStatus pending/syncing OR have progress < 100)
        // But exclude ones that have been syncing for more than 10 minutes
        const syncingCount = snapshot.docs.filter(doc => {
          const data = doc.data();
          const isSyncing = data.syncStatus === 'pending' || 
                 data.syncStatus === 'syncing' ||
                 (data.syncProgress && data.syncProgress.current < data.syncProgress.total);
          
          if (!isSyncing) return false;
          
          // Check if lastSyncStarted exists and is within last 10 minutes
          if (data.lastSyncStarted) {
            const syncStartedTime = data.lastSyncStarted.toMillis ? data.lastSyncStarted.toMillis() : data.lastSyncStarted;
            const timeDiff = tenMinutesAgo - syncStartedTime;
            return timeDiff < tenMinutes; // Only count if less than 10 minutes old
          }
          
          return false; // If no timestamp, don't count as loading
        }).length;
        
        console.log('⏳ Syncing accounts count:', syncingCount);
        setLoading(prev => ({ ...prev, accounts: syncingCount > 0 }));
      },
      (error) => {
        console.error('❌ Error listening to syncing accounts:', error);
        setLoading(prev => ({ ...prev, accounts: false }));
      }
    );

    return () => {
      unsubscribeVideos();
      unsubscribeAccounts();
      unsubscribeProcessing();
      unsubscribeSyncing();
    };
  }, [orgId, projectId]);

  return { unreadCounts, loading };
}

