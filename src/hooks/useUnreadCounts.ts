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

    // Listen for syncing accounts (loading state)
    const syncingAccountsQuery = query(
      accountsRef,
      where('syncStatus', 'in', ['pending', 'syncing'])
    );

    const unsubscribeSyncing = onSnapshot(syncingAccountsQuery, (snapshot) => {
      setLoading(prev => ({ ...prev, accounts: snapshot.size > 0 }));
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

