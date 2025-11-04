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
    if (!orgId || !projectId) {
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
      'videoSubmissions'
    );
    const videosQuery = query(
      videosRef,
      where('isRead', '==', false),
      where('status', '!=', 'archived')
    );

    const unsubscribeVideos = onSnapshot(videosQuery, (snapshot) => {
      setUnreadCounts(prev => ({ ...prev, videos: snapshot.size }));
    });

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
      where('isRead', '==', false),
      where('isActive', '==', true)
    );

    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      setUnreadCounts(prev => ({ ...prev, accounts: snapshot.size }));
    });

    // Listen for processing videos (loading state)
    const processingVideosQuery = query(
      videosRef,
      where('status', '==', 'processing')
    );

    const unsubscribeProcessing = onSnapshot(processingVideosQuery, (snapshot) => {
      setLoading(prev => ({ ...prev, videos: snapshot.size > 0 }));
    });

    // Listen for syncing accounts (loading state) - check for pending OR accounts with progress
    const syncingAccountsQuery = query(
      accountsRef,
      where('isActive', '==', true)
    );

    const unsubscribeSyncing = onSnapshot(syncingAccountsQuery, (snapshot) => {
      // Count accounts that are actively syncing (have syncStatus pending/syncing OR have progress < 100)
      const syncingCount = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.syncStatus === 'pending' || 
               data.syncStatus === 'syncing' ||
               (data.syncProgress && data.syncProgress.current < data.syncProgress.total);
      }).length;
      
      setLoading(prev => ({ ...prev, accounts: syncingCount > 0 }));
    });

    return () => {
      unsubscribeVideos();
      unsubscribeAccounts();
      unsubscribeProcessing();
      unsubscribeSyncing();
    };
  }, [orgId, projectId]);

  return { unreadCounts, loading };
}

