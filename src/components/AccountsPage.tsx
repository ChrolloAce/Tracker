import { useState, useEffect, useCallback, useMemo, forwardRef, useRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertCircle } from 'lucide-react';
import { TrackingRule } from '../types/rules';
import { DateFilterType } from './DateRangeFilter';
import { TrackedAccount } from '../types/firestore';
import { VideoSubmission } from '../types';
import { AccountTrackingServiceFirebase } from '../services/AccountTrackingServiceFirebase';
import FirestoreDataService from '../services/FirestoreDataService';
import { exportAccountsToCSV } from '../utils/accountCsvExport';

// Components
import { AccountDetailsView } from './accounts/AccountDetailsView';
import { AccountsTable } from './accounts/AccountsTable';
import { AccountsHeader } from './accounts/AccountsHeader';
import { AddAccountModal } from './accounts/AddAccountModal';
import { AttachCreatorModal } from './accounts/AttachCreatorModal';
import { DeleteAccountModal } from './accounts/DeleteAccountModal';
import { ExportVideosModal } from './ExportVideosModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Toast } from './ui/Toast';
import { BlurEmptyState } from './ui/BlurEmptyState';
import profileAnimation from '../../public/lottie/Target Audience.json';
import VideoPlayerModal from './VideoPlayerModal';
import VideoAnalyticsModal from './VideoAnalyticsModal';
import CreateLinkModal from './CreateLinkModal';
import BulkAssignCreatorModal from './BulkAssignCreatorModal';
import Pagination from './ui/Pagination';
import { PageLoadingSkeleton } from './ui/LoadingSkeleton';

// Hook
import { useAccounts } from '../hooks/useAccounts';

export interface AccountsPageProps {
  dateFilter: DateFilterType;
  platformFilter: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[];
  searchQuery?: string;
  onViewModeChange: (mode: 'table' | 'details') => void;
  pendingAccounts?: TrackedAccount[];
  organizationId?: string;
  projectId?: string;
  selectedRuleIds?: string[];
  dashboardRules?: TrackingRule[];
  accountFilterId?: string | null;
  creatorFilterId?: string | null;
  isDemoMode?: boolean;
}

export interface AccountsPageRef {
  openAddModal: () => void;
  refreshData?: () => Promise<void>;
  handleBackToTable: () => void;
}

const AccountsPage = forwardRef<AccountsPageRef, AccountsPageProps>(
  (props, ref) => {
    const { 
      dateFilter, platformFilter, searchQuery = '', onViewModeChange, 
      pendingAccounts = [], selectedRuleIds = [], dashboardRules = [], 
      organizationId, projectId, accountFilterId, creatorFilterId, isDemoMode = false 
    } = props;

    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'table' | 'details'>('table');
    
    // Use Hook
    const {
      // Data
      accounts,
      processedAccounts,
      processingAccounts,
      loading,
      
      // Details
      selectedAccount,
      setSelectedAccount,
      accountVideos,
      allAccountVideos,
      accountVideosSnapshots,
      loadingAccountDetail,
      loadAccountVideos,
      setAccountVideos,
      setAccountVideosSnapshots,
      
      // Sync
      isSyncing,
      syncError: hookSyncError,
      setSyncError,
      handleSyncAccount: hookHandleSyncAccount,
      syncingAccounts,
      retryFailedAccount,
      dismissAccountError,
      cancelSync,
      
      // Account Management
      toggleAccountType,
      
      // Selection
      selectedAccounts,
      setSelectedAccounts,
      
      // Sorting
      sortBy,
      setSortBy,
      sortOrder,
      setSortOrder,
      
      // Metadata
      accountCreatorNames,
      setAccountCreatorNames,
      accountCreatorPhotos,
      trackedLinks,
      linkClicks,
      usageLimits,
      imageErrors,
      setImageErrors,
      creators,
      
      // Misc
      currentOrgId,
      currentProjectId,
      setProcessingAccounts,
      user,
      setAccounts,
      setFilteredAccounts
    } = useAccounts({
      organizationId,
      projectId,
      dateFilter,
      platformFilter,
      searchQuery,
      selectedRuleIds,
      dashboardRules,
      accountFilterId,
      creatorFilterId,
      isDemoMode
    });

    // UI State (Modals)
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [selectedVideoForPlayer, setSelectedVideoForPlayer] = useState<{url: string; title: string; platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' } | null>(null);
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<VideoSubmission | null>(null);
  const [isVideoAnalyticsModalOpen, setIsVideoAnalyticsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TrackedAccount | null>(null);
  const [showAttachCreatorModal, setShowAttachCreatorModal] = useState(false);
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [showBulkAssignCreator, setShowBulkAssignCreator] = useState(false);
  const [singleAssignAccountId, setSingleAssignAccountId] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const actionsMenuRef = useRef<HTMLButtonElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Pagination State
  const [accountsCurrentPage, setAccountsCurrentPage] = useState(1);
  const [accountsItemsPerPage, setAccountsItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('accounts_itemsPerPage');
    return saved ? Number(saved) : 10;
  });
  
    // Sync viewMode with internal state and props
  useEffect(() => {
      if (selectedAccount) {
        setViewMode('details');
        onViewModeChange('details');
      } else {
        setViewMode('table');
        onViewModeChange('table');
      }
    }, [selectedAccount, onViewModeChange]);

    // Reset pagination on search
  useEffect(() => {
      setAccountsCurrentPage(1);
    }, [searchQuery]);

    // Save pagination pref
  useEffect(() => {
    localStorage.setItem('accounts_itemsPerPage', String(accountsItemsPerPage));
  }, [accountsItemsPerPage]);

    // Restore selected account from localStorage on load
    const hasRestoredFromLocalStorage = useRef(false);
  useEffect(() => {
      if (!loading && accounts.length > 0 && !hasRestoredFromLocalStorage.current) {
        const savedAccountId = localStorage.getItem('selectedAccountId');
        if (savedAccountId) {
          const account = accounts.find(a => a.id === savedAccountId);
          if (account) {
            setSelectedAccount(account);
            loadAccountVideos(account.id);
          }
        }
        hasRestoredFromLocalStorage.current = true;
      }
    }, [loading, accounts, setSelectedAccount, loadAccountVideos]);

    // Save selected account to localStorage
  useEffect(() => {
      if (selectedAccount) {
        localStorage.setItem('selectedAccountId', selectedAccount.id);
      } else {
        localStorage.removeItem('selectedAccountId');
      }
    }, [selectedAccount]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      openAddModal: () => setIsAddModalOpen(true),
      refreshData: async () => {
        // Data is real-time, but we can force reload videos if needed
        if (selectedAccount) {
          await loadAccountVideos(selectedAccount.id);
        }
      },
      handleBackToTable
    }));

    // Handlers
    
  const handleBackToTable = useCallback(() => {
    setSelectedAccount(null);
    navigate('/accounts');
    setAccountVideos([]);
    setAccountVideosSnapshots(new Map());
    setViewMode('table');
    onViewModeChange('table');
    localStorage.removeItem('selectedAccountId');
    }, [navigate, setSelectedAccount, setAccountVideos, setAccountVideosSnapshots, onViewModeChange]);

    const handleVideoClick = useCallback(async (video: VideoSubmission) => {
    if (!currentOrgId || !currentProjectId) return;
      try {
        const snapshots = await FirestoreDataService.getVideoSnapshots(currentOrgId, currentProjectId, video.id);
        const videoWithSnapshots: VideoSubmission = { ...video, snapshots: snapshots };
        setSelectedVideoForAnalytics(videoWithSnapshots);
        setIsVideoAnalyticsModalOpen(true);
    } catch (error) {
        console.error('❌ Failed to load snapshots:', error);
        setSelectedVideoForAnalytics(video);
        setIsVideoAnalyticsModalOpen(true);
      }
    }, [currentOrgId, currentProjectId]);

    const handleSyncAccount = useCallback(async (accountId: string) => {
        const account = processedAccounts.find(a => a.id === accountId);
        const accountName = account?.username || 'account';
        try {
            const count = await hookHandleSyncAccount(accountId);
            setShowToast({ message: `✅ Synced @${accountName} - ${count} video${count !== 1 ? 's' : ''} processed!`, type: 'success' });
            
            if (selectedAccount?.id === accountId) {
                await loadAccountVideos(accountId);
            }
      } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            setShowToast({ message: `❌ Failed to sync @${accountName}: ${msg}`, type: 'error' });
        }
    }, [processedAccounts, hookHandleSyncAccount, selectedAccount, loadAccountVideos]);

    const handleAccountsAdded = useCallback(async (accountsToAdd: Array<{url: string, username: string, platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter', videoCount: number}>) => {
        if (!currentOrgId || !currentProjectId || !user) return;
        
        setProcessingAccounts(prev => [
          ...accountsToAdd.map(acc => ({ username: acc.username, platform: acc.platform, startedAt: Date.now() })),
          ...prev
        ]);
        
        setIsAddModalOpen(false);
    
        const addPromises = accountsToAdd.map(account => 
          AccountTrackingServiceFirebase.addAccount(
            currentOrgId,
            currentProjectId,
            user.uid,
            account.username,
            account.platform,
            'my',
            account.videoCount
          ).then(() => ({ success: true, username: account.username }))
           .catch(error => {
            console.error(`Failed to add account @${account.username}:`, error);
            return { success: false, username: account.username };
          })
        );
    
        await Promise.all(addPromises);
        
        // Cleanup handled by hook effect
    }, [currentOrgId, currentProjectId, user, setProcessingAccounts]);

  const handleCopyAccountLinks = useCallback(() => {
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    const links = selected.map(a => {
      switch (a.platform) {
            case 'instagram': return `https://www.instagram.com/${a.username}`;
            case 'tiktok': return `https://www.tiktok.com/@${a.username}`;
            case 'youtube': return `https://www.youtube.com/@${a.username}`;
            case 'twitter': return `https://twitter.com/${a.username}`;
            default: return '';
      }
    }).join('\n');
    navigator.clipboard.writeText(links);
    setShowActionsMenu(false);
    setShowToast({ message: `Copied ${selected.length} account link${selected.length !== 1 ? 's' : ''} to clipboard`, type: 'success' });
  }, [processedAccounts, selectedAccounts]);

    const handleBulkDeleteAccounts = useCallback(() => {
        if (selectedAccounts.size === 0) return;
    setShowActionsMenu(false);
        setTimeout(() => setShowDeleteConfirm(true), 10);
    }, [selectedAccounts]);

  const confirmBulkDeleteAccounts = useCallback(async () => {
    const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
    const count = selected.length;
    const selectedIds = new Set(selected.map(a => a.id));
      
        // Optimistic UI Update
      setShowActionsMenu(false);
      setSelectedAccounts(new Set());
      setAccounts(prev => prev.filter(a => !selectedIds.has(a.id)));
      setFilteredAccounts(prev => prev.filter(a => !selectedIds.has(a.id)));
      
      if (selectedAccount && selectedIds.has(selectedAccount.id)) {
            handleBackToTable();
      }
      
        // Background Deletion
      (async () => {
        try {
                await Promise.all(selected.map(account =>
              AccountTrackingServiceFirebase.removeAccount(
                        currentOrgId!, currentProjectId!, account.id, account.username, account.platform
                    ).catch(console.error)
                ));
            } catch (error) { console.error('Bulk delete failed', error); }
      })();
      
      setShowToast({ message: `Deleting ${count} account${count !== 1 ? 's' : ''}...`, type: 'success' });
        setShowDeleteConfirm(false);
    }, [processedAccounts, selectedAccounts, currentOrgId, currentProjectId, selectedAccount, handleBackToTable, setAccounts, setFilteredAccounts, setSelectedAccounts]);

    const handleRemoveAccount = useCallback((id: string) => {
        const account = processedAccounts.find(a => a.id === id);
    if (!account) return;
        setAccountToDelete(account);
    setShowDeleteModal(true);
    }, [processedAccounts]);

  const confirmDeleteAccount = useCallback(async () => {
    if (!currentOrgId || !currentProjectId || !accountToDelete) return;
        const { id, username, platform } = accountToDelete;
        
    setShowDeleteModal(false);
    setAccountToDelete(null);
        
        // Optimistic
        setAccounts(prev => prev.filter(a => a.id !== id));
        setFilteredAccounts(prev => prev.filter(a => a.id !== id));
        if (selectedAccount?.id === id) handleBackToTable();
        
        // Background
    (async () => {
      try {
                await AccountTrackingServiceFirebase.removeAccount(currentOrgId, currentProjectId, id, username, platform);
            } catch (e) { console.error(e); alert(`Failed to delete @${username}`); }
    })();
    }, [accountToDelete, currentOrgId, currentProjectId, selectedAccount, handleBackToTable, setAccounts, setFilteredAccounts]);

    const handleExportAccounts = useCallback((filename: string) => {
        const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
        exportAccountsToCSV(selected, filename);
        setShowExportModal(false);
        setSelectedAccounts(new Set());
    }, [processedAccounts, selectedAccounts, setSelectedAccounts]);

    const deleteTotalVideosCount = useMemo(() => {
        const selected = processedAccounts.filter(a => selectedAccounts.has(a.id));
        return selected.reduce((sum, acc) => sum + (acc.totalVideos || 0), 0);
    }, [processedAccounts, selectedAccounts]);

    // --- Render ---
    
    if (loading) return <PageLoadingSkeleton type="accounts" />;
    if (!user || !currentOrgId || loading) return <PageLoadingSkeleton type="accounts" />;

  return (
    <div className="space-y-6">
      {/* Error Display */}
            {hookSyncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">{hookSyncError}</p>
                    <button onClick={() => setSyncError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="space-y-6">
          {/* Only show empty state if ABSOLUTELY NO accounts exist (not just filtered) */}
          {!loading && accounts.length === 0 && processingAccounts.length === 0 ? (
            <BlurEmptyState
              title="Add Your First Account to Track"
              description="Track Instagram, TikTok, YouTube, and X accounts to monitor followers, engagement, and growth."
              animation={profileAnimation}
                            tooltipText="Track accounts to get started."
                            actions={[{
                  label: isDemoMode ? "Can't Add - Not Your Org" : 'Add Account',
                                onClick: () => !isDemoMode && setIsAddModalOpen(true),
                  icon: Plus,
                  primary: true,
                  disabled: isDemoMode
                            }]}
            />
          ) : (
          <div className="bg-zinc-900/60 dark:bg-zinc-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
                            <AccountsHeader
                                dateFilter={dateFilter}
                                selectedCount={selectedAccounts.size}
                                showActionsMenu={showActionsMenu}
                                setShowActionsMenu={setShowActionsMenu}
                                actionsMenuRef={actionsMenuRef}
                                onCopyLinks={handleCopyAccountLinks}
                                onExport={() => setShowExportModal(true)}
                                onDelete={handleBulkDeleteAccounts}
                                onAssignCreator={() => {
                                    setShowActionsMenu(false);
                                    setSingleAssignAccountId(null);
                                    setShowBulkAssignCreator(true);
                                }}
                            />
                            <AccountsTable 
                                realAccounts={processedAccounts.slice((accountsCurrentPage - 1) * accountsItemsPerPage, (accountsCurrentPage - 1) * accountsItemsPerPage + accountsItemsPerPage)} 
                                processingAccounts={processingAccounts} 
                                pendingAccounts={pendingAccounts} 
                                selectedAccounts={selectedAccounts} 
                                syncingAccounts={syncingAccounts} 
                                sortBy={sortBy} 
                      sortOrder={sortOrder}
                                accountCreatorNames={accountCreatorNames}
                                accountCreatorPhotos={accountCreatorPhotos}
                                imageErrors={imageErrors} 
                                onSort={(key) => {
                                    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    else { setSortBy(key as any); setSortOrder('asc'); }
                                }}
                                onSelectAccount={(id) => {
                                    const newSet = new Set(selectedAccounts);
                                    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                                    setSelectedAccounts(newSet);
                                }}
                                onSelectAll={(e) => {
                                    if (e.target.checked) {
                                        // Select only visible accounts or all? Typically visible or all.
                                        // processedAccounts excludes pending/processing? No, it includes logic.
                                        // Let's select all processedAccounts.
                                        const allIds = new Set(processedAccounts.map(a => a.id));
                                        // Add pending if rendered?
                                        // AccountsTable renders pendingAccounts too.
                                        pendingAccounts.forEach(a => allIds.add(a.id));
                                        setSelectedAccounts(allIds);
                        } else {
                                        setSelectedAccounts(new Set());
                                    }
                                }}
                                onCancelProcessing={(index) => setProcessingAccounts(prev => prev.filter((_, i) => i !== index))}
                                onCancelSync={cancelSync} 
                                onRetrySync={(account) => retryFailedAccount(account.id)} 
                                onDismissError={(account) => dismissAccountError(account.id)} 
                                onRemoveAccount={handleRemoveAccount} 
                                onToggleType={toggleAccountType} 
                                onNavigate={(url) => navigate(url)} 
                                onImageError={(id) => setImageErrors(prev => new Set(prev).add(id))}
                                onAssignCreator={(accountId) => {
                                    setSingleAssignAccountId(accountId);
                                    setShowBulkAssignCreator(true);
                                }}
                            />
          <div className="mt-6">
            <Pagination
              currentPage={accountsCurrentPage}
              totalPages={Math.ceil(processedAccounts.length / accountsItemsPerPage)}
              totalItems={processedAccounts.length}
              itemsPerPage={accountsItemsPerPage}
                                    onPageChange={(page) => { setAccountsCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    onItemsPerPageChange={(newItemsPerPage) => { setAccountsItemsPerPage(newItemsPerPage); setAccountsCurrentPage(1); }}
            />
          </div>
          </div>
          )}
        </div>
      ) : (
        selectedAccount && (
                    <AccountDetailsView
                        selectedAccount={selectedAccount}
                        loading={loadingAccountDetail}
                        accountVideos={accountVideos}
                        allAccountVideos={allAccountVideos}
                        accountVideosSnapshots={accountVideosSnapshots}
                    dateFilter={dateFilter}
                        trackedLinks={trackedLinks}
                        linkClicks={linkClicks}
                        accountCreatorNames={accountCreatorNames}
                        isSyncing={isSyncing}
                        onSyncAccount={handleSyncAccount}
                        onAttachCreator={() => setShowAttachCreatorModal(true)}
                    onCreateLink={() => setShowCreateLinkModal(true)}
                        onVideoClick={handleVideoClick}
                    />
                )
            )}

            {/* Modals */}
            <AddAccountModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAccountsAdded}
                usageLimits={usageLimits}
            />
            
      {selectedVideoForPlayer && (
        <VideoPlayerModal
          isOpen={videoPlayerOpen}
                    onClose={() => { setVideoPlayerOpen(false); setSelectedVideoForPlayer(null); }}
          videoUrl={selectedVideoForPlayer.url}
          title={selectedVideoForPlayer.title}
          platform={selectedVideoForPlayer.platform}
        />
      )}

      <VideoAnalyticsModal
        video={selectedVideoForAnalytics}
        isOpen={isVideoAnalyticsModalOpen}
                onClose={() => { setIsVideoAnalyticsModalOpen(false); setSelectedVideoForAnalytics(null); }}
        onDelete={async () => {
          if (selectedAccount && currentOrgId && currentProjectId) {
              await loadAccountVideos(selectedAccount.id);
                    }
                }}
                totalCreatorVideos={selectedVideoForAnalytics ? allAccountVideos.filter(v => v.uploaderHandle === selectedVideoForAnalytics.uploaderHandle).length : undefined}
        orgId={currentOrgId}
        projectId={currentProjectId}
      />

            <DeleteAccountModal
                isOpen={showDeleteModal}
                onClose={() => { setShowDeleteModal(false); setAccountToDelete(null); }}
                onConfirm={confirmDeleteAccount}
                account={accountToDelete}
            />

      {showCreateLinkModal && selectedAccount && (
        <CreateLinkModal
          isOpen={showCreateLinkModal}
          onClose={() => setShowCreateLinkModal(false)}
                    onCreate={() => {
                        // Refresh logic if needed
                        setShowCreateLinkModal(false);
                    }}
          preselectedAccountId={selectedAccount.id}
        />
      )}

            <AttachCreatorModal
                isOpen={showAttachCreatorModal}
                onClose={() => setShowAttachCreatorModal(false)}
                selectedAccount={selectedAccount}
                creators={creators}
                orgId={currentOrgId || ''}
                projectId={currentProjectId || ''}
                userId={user?.uid || ''}
                onSuccess={(creatorName) => {
                    if (selectedAccount) {
                              setAccountCreatorNames(prev => {
                                const updated = new Map(prev);
                                updated.set(selectedAccount.id, creatorName);
                                return updated;
                              });
                    }
                }}
            />

      <ExportVideosModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportAccounts}
        selectedCount={selectedAccounts.size}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Accounts"
        message={`⚠️ You are about to delete ${selectedAccounts.size} account${selectedAccounts.size !== 1 ? 's' : ''}\n\nThis will permanently delete:\n• ${selectedAccounts.size} account${selectedAccounts.size !== 1 ? 's' : ''}\n• ${deleteTotalVideosCount} video${deleteTotalVideosCount !== 1 ? 's' : ''}\n• All associated snapshots and data\n\nThis action CANNOT be undone!`}
        confirmText="Delete Accounts"
        cancelText="Cancel"
        requireTyping={true}
        typingConfirmation="DELETE"
        onConfirm={confirmBulkDeleteAccounts}
                onCancel={() => setShowDeleteConfirm(false)}
        isDanger={true}
      />

      <BulkAssignCreatorModal
        isOpen={showBulkAssignCreator}
        accountIds={singleAssignAccountId ? [singleAssignAccountId] : Array.from(selectedAccounts)}
        selectionLabel={singleAssignAccountId ? '1 account' : `${selectedAccounts.size} account${selectedAccounts.size !== 1 ? 's' : ''}`}
        onClose={() => {
          setShowBulkAssignCreator(false);
          setSingleAssignAccountId(null);
        }}
        onSuccess={() => {
          const count = singleAssignAccountId ? 1 : selectedAccounts.size;
          setShowBulkAssignCreator(false);
          setSingleAssignAccountId(null);
          setSelectedAccounts(new Set());
          setShowToast({ message: `Assigned ${count} account${count !== 1 ? 's' : ''} to creator`, type: 'success' });
          // Refresh creator names
          const refreshCreatorNames = async () => {
            if (!currentOrgId || !currentProjectId) return;
            const CreatorLinksService = (await import('../services/CreatorLinksService')).default;
            const map = new Map<string, string>();
            for (const acc of accounts) {
              try {
                const name = await CreatorLinksService.getCreatorNameForAccount(currentOrgId, currentProjectId, acc.id);
                if (name) map.set(acc.id, name);
              } catch {}
            }
            setAccountCreatorNames(map);
          };
          refreshCreatorNames();
        }}
      />

      {showToast && (
        <Toast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}
    </div>
  );
  }
);

AccountsPage.displayName = 'AccountsPage';

export default AccountsPage;
