import React, { useState, useRef } from 'react';
import {
  RefreshCw, AlertCircle, Trash2, X, MoreVertical,
  ExternalLink, Copy, User, Users, BarChart3, Snowflake
} from 'lucide-react';
import { ProxiedImage } from '../ProxiedImage';
import { clsx } from 'clsx';
import { PlatformIcon } from '../ui/PlatformIcon';
import { ColumnHeader } from './ColumnHeader';
import { FloatingTooltip } from '../ui/FloatingTooltip';
import { FloatingDropdown, DropdownItem, DropdownDivider } from '../ui/FloatingDropdown';
import { TrackedAccount, AccountWithFilteredStats } from '../../types/accounts';
import { formatDate } from '../../utils/formatters';

const toDate = (date: any): Date => {
  if (!date) return new Date();
  if (date && typeof date.toDate === 'function') return date.toDate();
  return new Date(date);
};

interface AccountsTableProps {
  realAccounts: AccountWithFilteredStats[];
  processingAccounts: Array<{username: string; platform: string}>;
  pendingAccounts: TrackedAccount[];
  selectedAccounts: Set<string>;
  syncingAccounts: Set<string>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  accountCreatorNames: Map<string, string>;
  accountCreatorPhotos?: Map<string, string>;
  imageErrors: Set<string>;
  
  // Handlers
  onSort: (key: string) => void;
  onSelectAccount: (id: string) => void;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancelProcessing: (index: number) => void;
  onCancelSync: (account: TrackedAccount) => void;
  onRetrySync: (account: TrackedAccount) => void;
  onDismissError: (account: TrackedAccount) => void;
  onRemoveAccount: (id: string) => void;
  onToggleType: (account: TrackedAccount) => void;
  onToggleStale?: (account: TrackedAccount) => void;
  onNavigate: (url: string) => void;
  onImageError: (id: string) => void;
  /** Assign a single account to a creator (opens modal) */
  onAssignCreator?: (accountId: string) => void;
  /** SUPER-ADMIN-ONLY: open the public share link modal for this account. */
  onCreateShareLink?: (account: TrackedAccount) => void;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({
  realAccounts,
  processingAccounts,
  selectedAccounts,
  syncingAccounts,
  sortBy,
  sortOrder,
  accountCreatorNames,
  accountCreatorPhotos,
  imageErrors,
  onSort,
  onSelectAccount,
  onSelectAll,
  onCancelProcessing,
  onCancelSync,
  onRetrySync,
  onDismissError,
  onRemoveAccount,
  onToggleType,
  onToggleStale,
  onNavigate,
  onImageError,
  onAssignCreator,
  onCreateShareLink,
}) => {
  const typeBadgeRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [hoveredTypeId, setHoveredTypeId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Check if all visible accounts are selected
  const areAllSelected = realAccounts.length > 0 && realAccounts.every(acc => selectedAccounts.has(acc.id));

  return (
    <div className="overflow-x-auto -mx-3 sm:-mx-0">
      <table className="w-full min-w-max">
        <thead className="bg-surface-secondary border-b border-border">
          <tr>
            {/* Select All Checkbox */}
            <th className="w-10 px-2 sm:px-4 py-3 sm:py-4 text-left sticky left-0 z-20 bg-surface-secondary">
              <div className="flex items-center justify-center" title={`Select all ${realAccounts.length} accounts`}>
                <input
                  type="checkbox"
                  checked={areAllSelected}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-border bg-surface-secondary text-content focus:ring-2 focus:ring-border-hover cursor-pointer"
                />
              </div>
            </th>
            <ColumnHeader
              label="Username"
              tooltip="The account username along with profile picture. Platform icon shows which social media platform this account is on, and a verified badge appears if the account is verified."
              sortable
              sortKey="username"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('username')}
              sticky
            />
            <ColumnHeader
              label="Creator"
              tooltip="The team member or creator associated with this account. This helps you track which accounts belong to which team member."
              sortable={false}
            />
            <ColumnHeader
              label="Type"
              tooltip="Account tracking type. Automatic accounts discover new videos on refresh, while Static accounts only update existing videos."
              sortable={false}
            />
            <ColumnHeader
              label="Date Added"
              tooltip="The date and time when this account was first added to your tracking list."
              sortable
              sortKey="dateAdded"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('dateAdded')}
            />
            <ColumnHeader
              label="Last Refreshed"
              tooltip="The date and time when data for this account was last updated from the platform."
              sortable
              sortKey="lastRefreshed"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('lastRefreshed')}
            />
            <ColumnHeader
              label="Followers"
              tooltip="Total number of followers this account currently has on the platform. This metric helps gauge account reach and audience size."
              sortable
              sortKey="followers"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('followers')}
            />
            <ColumnHeader
              label="Last Post"
              tooltip="The date and time when the most recent content was posted by this account. Helps you track posting frequency and consistency."
              sortable={false}
            />
            <ColumnHeader
              label="Total Posts"
              tooltip="Total number of posts published by this account within the selected date range. Use this to monitor content output and activity levels."
              sortable
              sortKey="videos"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('videos')}
            />
            <ColumnHeader
              label="Views"
              tooltip="Total view count across all posts in the selected time period. This is a key metric for understanding content reach and visibility."
              sortable
              sortKey="views"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('views')}
            />
            <ColumnHeader
              label="Top Video"
              tooltip="The highest-performing video by view count in the selected period. Click to see which content resonated most with your audience."
              sortable
              sortKey="highestViewed"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('highestViewed')}
            />
            <ColumnHeader
              label="Likes"
              tooltip="Total number of likes received across all posts in the selected date range. This metric reflects content appeal and audience appreciation."
              sortable
              sortKey="likes"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('likes')}
            />
            <ColumnHeader
              label="Comments"
              tooltip="Total comments received across all posts in the selected period. High comment counts indicate strong audience engagement and conversation."
              sortable
              sortKey="comments"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('comments')}
            />
            <ColumnHeader
              label="Shares"
              tooltip="Total number of times posts were shared or reposted in the selected period. Shares indicate content virality and audience advocacy."
              sortable
              sortKey="shares"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('shares')}
            />
            <ColumnHeader
              label="Bookmarks"
              tooltip="Total number of times posts were bookmarked or saved by viewers. This shows content that people find valuable enough to reference later."
              sortable
              sortKey="bookmarks"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('bookmarks')}
            />
            <ColumnHeader
              label="Engagement"
              tooltip="Average engagement rate calculated across all videos in the selected time period. Formula: (Likes + Comments + Shares) / Views × 100. Higher rates indicate more interactive audience."
              sortable
              sortKey="engagementRate"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('engagementRate')}
            />
            <ColumnHeader
              label="Posting Frequency"
              tooltip="How often this account posts content in the selected time period. Shows posting rate as posts per day, posts per week, or average days between posts."
              sortable
              sortKey="postingFrequency"
              currentSortBy={sortBy}
              sortOrder={sortOrder}
              onSort={() => onSort('postingFrequency')}
            />
            <th className="px-6 py-4 text-left text-xs font-medium text-content-muted uppercase tracking-wider sticky right-0 bg-surface-secondary backdrop-blur z-10">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface-secondary">
          {/* Processing Accounts */}
          {processingAccounts.map((procAccount, index) => {
            // Match with real account to show data if available
            const matchingAccount = realAccounts.find(
              acc => acc.platform === procAccount.platform && acc.username === procAccount.username
            );
            const isPartiallyLoaded = matchingAccount && (!matchingAccount.profilePicture && matchingAccount.followerCount === 0);
            
            return (
              <tr 
                key={`processing-${procAccount.platform}-${procAccount.username}`}
                className="bg-surface-hover border-l-2 border-border-hover transition-all duration-500"
                style={{ boxShadow: 'inset 0 -1px 0 var(--border)' }}
              >
                {/* Checkbox Column */}
                <td className="w-10 px-2 sm:px-4 py-4 sticky left-0 z-20 bg-surface-hover backdrop-blur">
                  <input
                    type="checkbox"
                    disabled
                    className="w-4 h-4 rounded border-border bg-surface-secondary text-content focus:ring-2 focus:ring-border-hover opacity-30"
                  />
                </td>
                {/* Username Column */}
                <td className="px-6 py-4 whitespace-nowrap sticky left-10 bg-surface-hover backdrop-blur z-10">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-10 h-10">
                      {matchingAccount?.profilePicture ? (
                        <img
                          src={matchingAccount.profilePicture}
                          alt={`@${procAccount.username}`}
                          className="w-10 h-10 rounded-full object-cover animate-fade-in"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden bg-surface-active">
                          <RefreshCw className="w-5 h-5 text-content-muted animate-spin" />
                        </div>
                      )}
                      {/* Platform Icon Overlay */}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-surface rounded-full p-0.5 flex items-center justify-center border border-border-hover">
                        <PlatformIcon platform={procAccount.platform as any} size="xs" />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-content flex items-center gap-1.5">
                        {matchingAccount?.displayName || `@${procAccount.username}`}
                        {matchingAccount?.isVerified && (
                          <img src="/verified-badge.png" alt="Verified" className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="text-xs text-content-muted font-medium flex items-center gap-1">
                        {isPartiallyLoaded || !matchingAccount ? (
                          <>
                            <span className="inline-block w-1.5 h-1.5 bg-content-muted rounded-full animate-pulse"></span>
                            Loading account data...
                          </>
                        ) : (
                          `@${procAccount.username}`
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {/* Empty columns for processing state */}
                {Array.from({ length: 16 }).map((_, i) => (
                  <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                    <div className="w-12 h-4 bg-surface-active rounded-full animate-pulse" style={{ animationDelay: `${0.1 * (i + 1)}s` }}></div>
                  </td>
                ))}
                {/* Actions Column */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-surface-hover backdrop-blur z-20">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onCancelProcessing(index)}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Cancel processing"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          
          {/* Real Accounts */}
          {realAccounts.map((account) => {
            const isAccountSyncing = syncingAccounts.has(account.id);
            
            return (
              <tr
                key={account.id}
                onClick={(e) => {
                  // Don't trigger row click if clicking on checkbox
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                  if (!isAccountSyncing) {
                    onNavigate(`/dashboard?accounts=${account.id}`);
                  }
                }}
                className={clsx(
                  'transition-colors cursor-pointer',
                  {
                    'bg-surface-hover border-l-2 border-border-hover animate-pulse-slow': isAccountSyncing,
                    'hover:bg-surface-hover': !isAccountSyncing,
                  }
                )}
                style={{ boxShadow: 'inset 0 -1px 0 var(--border)' }}
              >
                {/* Checkbox Column */}
                <td 
                  className="w-10 px-2 sm:px-4 py-4 sticky left-0 z-20 bg-surface-secondary backdrop-blur group-hover:bg-surface-hover"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccounts.has(account.id)}
                    onChange={() => onSelectAccount(account.id)}
                    disabled={isAccountSyncing}
                    className="w-4 h-4 rounded border-border bg-surface-secondary text-content focus:ring-2 focus:ring-border-hover cursor-pointer disabled:opacity-30"
                  />
                </td>
                {/* Username Column */}
                <td className="px-6 py-4 whitespace-nowrap sticky left-10 bg-surface-secondary backdrop-blur z-10 group-hover:bg-surface-hover">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-10 h-10">
                      {account.profilePicture && !imageErrors.has(account.id) ? (
                        <img
                          src={account.profilePicture}
                          alt={`@${account.username}`}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={() => onImageError(account.id)}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-content font-bold text-sm">
                          {(account.username || account.platform || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-surface rounded-full p-0.5 flex items-center justify-center border border-border-hover">
                        <PlatformIcon platform={account.platform} size="xs" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-content flex items-center gap-1.5">
                          {account.displayName || account.username}
                          {account.isVerified && (
                            <img src="/verified-badge.png" alt="Verified" className="w-3.5 h-3.5" />
                          )}
                          {account.isStale && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" title="Frozen — no auto-refresh">
                              <Snowflake className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        {isAccountSyncing && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                              <span className="text-xs text-blue-400 font-medium">Syncing...</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCancelSync(account);
                              }}
                              className="px-2 py-0.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                              title="Cancel sync"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {(account.syncStatus === 'error' || account.hasError) && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 group relative">
                              <span className="inline-block w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                              <span className="text-xs text-red-400 font-medium">Sync Failed</span>
                              {account.lastSyncError && (
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-64 p-2 bg-surface-secondary text-content text-xs rounded-lg shadow-xl border border-border">
                                  <div className="font-semibold mb-1">Error Details:</div>
                                  <div className="text-content-muted">{account.lastSyncError}</div>
                                  {account.syncRetryCount && account.syncRetryCount > 0 && (
                                    <div className="text-content-muted mt-1">Retry attempts: {account.syncRetryCount}</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRetrySync(account);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                              title="Retry sync"
                            >
                              <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismissError(account);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs text-content-muted hover:text-content hover:bg-surface-hover rounded transition-colors"
                              title="Dismiss error"
                            >
                              <X className="w-3 h-3" /> Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-content-muted">@{account.username}</div>
                    </div>
                  </div>
                </td>

                {/* Creator Column — clickable to assign/reassign */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const creatorName = accountCreatorNames.get(account.id);
                    const creatorPhoto = accountCreatorPhotos?.get(account.id);
                    const handleClick = onAssignCreator ? (e: React.MouseEvent) => {
                      e.stopPropagation();
                      onAssignCreator(account.id);
                    } : undefined;

                    return creatorName ? (
                      <button
                        onClick={handleClick}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-active text-content border border-border-hover hover:bg-surface-active hover:border-border-hover transition-colors cursor-pointer"
                        title="Click to reassign creator"
                      >
                        {creatorPhoto ? (
                          <ProxiedImage
                            src={creatorPhoto}
                            alt={creatorName}
                            className="w-5 h-5 rounded-full object-cover"
                            fallback={
                              <div className="w-5 h-5 rounded-full bg-surface-active flex items-center justify-center text-[10px] font-bold text-content">
                                {creatorName.charAt(0).toUpperCase()}
                              </div>
                            }
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-surface-active flex items-center justify-center text-[10px] font-bold text-content">
                            {creatorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {creatorName}
                      </button>
                    ) : (
                      <button
                        onClick={handleClick}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-content-muted hover:text-content hover:bg-surface-active border border-transparent hover:border-border-hover transition-colors cursor-pointer"
                        title="Click to assign a creator"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Assign</span>
                      </button>
                    );
                  })()}
                </td>

                {/* Type Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span 
                    ref={(el) => {
                      if (el) typeBadgeRefs.current.set(account.id, el);
                      else typeBadgeRefs.current.delete(account.id);
                    }}
                    onMouseEnter={() => setHoveredTypeId(account.id)}
                    onMouseLeave={() => setHoveredTypeId(null)}
                    className={clsx(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-help transition-all",
                      (account.creatorType || 'automatic') === 'automatic'
                        ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                        : "bg-surface-hover text-content-muted border border-border hover:bg-surface-active"
                    )}
                  >
                    {(account.creatorType || 'automatic') === 'automatic' ? 'Automatic' : 'Static'}
                  </span>
                  
                  <FloatingTooltip
                    isVisible={hoveredTypeId === account.id}
                    triggerRef={{ current: typeBadgeRefs.current.get(account.id) || null }}
                    position="top"
                  >
                    {(account.creatorType || 'automatic') === 'automatic' ? (
                      <div className="space-y-1.5 w-64">
                        <div className="font-semibold text-green-400">Automatic Mode</div>
                        <div className="text-content-muted">• <span className="text-content font-medium">Discovers new videos</span> during refresh</div>
                        <div className="text-content-muted">• Updates <span className="text-content font-medium">all existing videos</span></div>
                        <div className="text-content-muted">• Best for <span className="text-content font-medium">tracking full accounts</span></div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 w-64">
                        <div className="font-semibold text-content-muted">Static Mode</div>
                        <div className="text-content-muted">• <span className="text-content font-medium">Only refreshes existing videos</span></div>
                        <div className="text-content-muted">• Does <span className="text-content font-medium">not discover new content</span></div>
                        <div className="text-content-muted">• Best for <span className="text-content font-medium">specific video tracking</span></div>
                      </div>
                    )}
                  </FloatingTooltip>
                </td>

                {/* Date Added */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                  {account.dateAdded ? formatDate(toDate(account.dateAdded)) : '—'}
                </td>
                {/* Last Refreshed */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                  {account.lastRefreshed ? formatDate(toDate(account.lastRefreshed)) : '—'}
                </td>
                {/* Followers */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.followerCount ?? 0).toLocaleString()}
                </td>
                {/* Last Post */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {account.lastSynced ? formatDate(toDate(account.lastSynced)) : '—'}
                </td>
                {/* Total Posts (Filtered) */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.filteredTotalVideos ?? 0).toLocaleString()}
                </td>
                {/* Views */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.filteredTotalViews ?? 0).toLocaleString()}
                </td>
                {/* Top Video */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content-muted">
                  {account.highestViewedVideo ? (
                    <div className="flex flex-col">
                      <span className="text-content truncate max-w-[150px]" title={account.highestViewedVideo.title}>
                        {account.highestViewedVideo.title}
                      </span>
                      <span className="text-xs text-content-muted">
                        {account.highestViewedVideo.views.toLocaleString()} views
                      </span>
                    </div>
                  ) : '—'}
                </td>
                {/* Likes */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.filteredTotalLikes ?? 0).toLocaleString()}
                </td>
                {/* Comments */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.filteredTotalComments ?? 0).toLocaleString()}
                </td>
                {/* Shares */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.filteredTotalShares ?? 0).toLocaleString()}
                </td>
                {/* Bookmarks */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {(account.filteredTotalBookmarks ?? 0).toLocaleString()}
                </td>
                {/* Engagement */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {account.avgEngagementRate !== undefined ? `${account.avgEngagementRate.toFixed(2)}%` : '—'}
                </td>
                {/* Posting Frequency */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                  {account.postingFrequency || '—'}
                </td>

                {/* Actions Column */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-surface-secondary backdrop-blur z-20">
                  <div className="relative">
                    <button
                      ref={(el) => {
                        if (el) dropdownTriggerRefs.current.set(account.id, el);
                        else dropdownTriggerRefs.current.delete(account.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === account.id ? null : account.id);
                      }}
                      className="text-content-muted hover:text-content transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1 hover:bg-surface-hover rounded"
                      title="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    <FloatingDropdown
                      isOpen={openDropdownId === account.id}
                      onClose={() => setOpenDropdownId(null)}
                      triggerRef={{ current: dropdownTriggerRefs.current.get(account.id) || null }}
                      align="right"
                    >
                      <DropdownItem
                        icon={<ExternalLink className="w-4 h-4" />}
                        label="Go to Account"
                        onClick={(e) => {
                          e.stopPropagation();
                          const platformUrl = account.platform === 'tiktok' ? `https://www.tiktok.com/@${account.username}`
                            : account.platform === 'instagram' ? `https://www.instagram.com/${account.username.replace('@', '')}`
                            : account.platform === 'youtube' ? `https://www.youtube.com/@${account.username.replace('@', '')}`
                            : `https://twitter.com/${account.username.replace('@', '')}`;
                          window.open(platformUrl, '_blank');
                          setOpenDropdownId(null);
                        }}
                      />
                      <DropdownItem
                        icon={<Copy className="w-4 h-4" />}
                        label="Copy Account Link"
                        onClick={(e) => {
                          e.stopPropagation();
                          const platformUrl = account.platform === 'tiktok' ? `https://www.tiktok.com/@${account.username}`
                            : account.platform === 'instagram' ? `https://www.instagram.com/${account.username.replace('@', '')}`
                            : account.platform === 'youtube' ? `https://www.youtube.com/@${account.username.replace('@', '')}`
                            : `https://twitter.com/${account.username.replace('@', '')}`;
                          navigator.clipboard.writeText(platformUrl);
                          alert('Account link copied!');
                          setOpenDropdownId(null);
                        }}
                      />
                      <DropdownItem
                        icon={<User className="w-4 h-4" />}
                        label="Copy Username"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(account.username);
                          alert('Username copied!');
                          setOpenDropdownId(null);
                        }}
                      />
                      <DropdownItem
                        icon={<BarChart3 className="w-4 h-4" />}
                        label="View Stats"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(null);
                          onNavigate(`/dashboard?accounts=${account.id}`);
                        }}
                      />
                      <DropdownItem
                        icon={<RefreshCw className="w-4 h-4" />}
                        label={(account.creatorType || 'automatic') === 'automatic' ? 'Convert to Static' : 'Convert to Automatic'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(null);
                          onToggleType(account);
                        }}
                      />
                      {onToggleStale && (
                        <DropdownItem
                          icon={<Snowflake className="w-4 h-4" />}
                          label={account.isStale ? 'Unfreeze Account' : 'Freeze Account'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(null);
                            onToggleStale(account);
                          }}
                        />
                      )}
                      {onAssignCreator && (
                        <DropdownItem
                          icon={<Users className="w-4 h-4" />}
                          label={accountCreatorNames.get(account.id) ? 'Reassign Creator' : 'Assign to Creator'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(null);
                            onAssignCreator(account.id);
                          }}
                        />
                      )}
                      {onCreateShareLink && (
                        <>
                          <DropdownDivider />
                          <DropdownItem
                            icon={<ExternalLink className="w-4 h-4 text-cyan-400" />}
                            label="Share Account Dashboard"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(null);
                              onCreateShareLink(account);
                            }}
                          />
                        </>
                      )}
                      <DropdownDivider />
                      <DropdownItem
                        icon={<Trash2 className="w-4 h-4" />}
                        label="Remove Account"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(null);
                          onRemoveAccount(account.id);
                        }}
                      />
                    </FloatingDropdown>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

